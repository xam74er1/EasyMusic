import React, { useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';

// ── IndexedDB waveform peak cache ─────────────────────────────────────────
const DB_NAME = 'EasyMusicWaveCache';
const STORE_NAME = 'peaks';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME);
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function getCachedPeaks(url) {
    try {
        const db = await openDB();
        return await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(url);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch { return null; }
}

async function storePeaks(url, peaks) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(peaks, url);
    } catch { }
}

// ── Component ──────────────────────────────────────────────────────────────
/**
 * DJWaveform — Fully decoupled from deck playback audio element.
 * Uses its own WebAudio decode path so it never interferes with the
 * deck's <audio> element volume/play/pause state.
 * Peaks are cached in IndexedDB for instant re-renders.
 */
export default function DJWaveform({
    url,
    color,
    progressColor,
    height = 70,
    onSeek,
    currentTime,
    duration,
    // audioElement is intentionally NOT used — sharing the element caused
    // WaveSurfer to take control of it and break deck playback.
}) {
    const containerRef = useRef(null);
    const wsRef = useRef(null);
    const loadedUrlRef = useRef(null);
    const destroyedRef = useRef(false);
    const wsReadyRef = useRef(false);   // true once WaveSurfer emits 'ready'

    useEffect(() => {
        if (!url || !containerRef.current) return;
        if (loadedUrlRef.current === url && wsRef.current) return;

        destroyedRef.current = false;
        wsReadyRef.current = false;

        // Tear down previous WaveSurfer instance
        if (wsRef.current) {
            try { wsRef.current.destroy(); } catch { }
            wsRef.current = null;
        }

        const ws = WaveSurfer.create({
            container: containerRef.current,
            waveColor: color || 'rgba(157, 78, 221, 0.5)',
            progressColor: progressColor || '#9D4EDD',
            cursorColor: 'rgba(255, 255, 255, 0.6)',
            cursorWidth: 1,
            barWidth: 2,
            barGap: 1,
            barRadius: 1,
            barMinHeight: 1,
            height,
            normalize: true,        // keeps shape even for quiet tracks
            interact: false,        // we handle click manually
            backend: 'WebAudio',    // independent decode, never shares playback
            mediaControls: false,
        });

        // Once decoded: mute the WaveSurfer player + cache peaks
        ws.on('ready', async () => {
            if (destroyedRef.current) return;
            ws.setVolume(0);
            ws.setMuted(true);
            wsReadyRef.current = true;
            try {
                const peaks = ws.exportPeaks();
                if (peaks) await storePeaks(url, peaks);
            } catch { }
        });

        ws.on('error', (err) => {
            if (!destroyedRef.current) console.warn('[DJWaveform] error:', err);
        });

        wsRef.current = ws;
        loadedUrlRef.current = url;

        // Load: cached peaks = instant; no cache = decode from URL
        (async () => {
            if (destroyedRef.current || wsRef.current !== ws) return;
            const cached = await getCachedPeaks(url);
            if (destroyedRef.current || wsRef.current !== ws) return;
            try {
                // ws.load(url, peaks?) — when peaks are provided, WaveSurfer
                // skips the full AudioBuffer decode (fast path).
                ws.load(url, cached || undefined);
            } catch (e) {
                console.warn('[DJWaveform] load error:', e);
            }
        })();

        return () => {
            destroyedRef.current = true;
            wsReadyRef.current = false;
            try { ws.destroy(); } catch { }
        };
    }, [url, color, progressColor, height]);

    // Sync the progress cursor to deck audio position.
    // Guard: only move the cursor when WaveSurfer is ready AND the position
    // is meaningfully non-zero — this prevents seekTo(0) from racing with the
    // deck's currentTime state update right after a user click.
    useEffect(() => {
        const ws = wsRef.current;
        if (!ws || !wsReadyRef.current || !duration || duration <= 0) return;
        const pct = Math.min(1, Math.max(0, currentTime / duration));
        // Skip a no-op seekTo(0) that can confuse WaveSurfer's WebAudio backend
        if (pct === 0 && currentTime === 0) return;
        try { ws.seekTo(pct); } catch { }
    }, [currentTime, duration]);

    // Manual click-to-seek (interact: false means WaveSurfer won't do this)
    const handleClick = (e) => {
        if (!containerRef.current || !onSeek || !duration || duration <= 0) return;
        const rect = containerRef.current.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        onSeek(ratio * duration);
    };

    return (
        <div
            className="dj-waveform-wrapper"
            ref={containerRef}
            onClick={handleClick}
            style={{
                width: '100%',
                height: `${height}px`,
                borderRadius: '6px',
                overflow: 'hidden',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                cursor: url ? 'pointer' : 'default',
            }}
        />
    );
}
