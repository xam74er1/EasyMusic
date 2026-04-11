import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import AudioOutputPicker from '../AudioOutputPicker';
import './CustomAudioPlayer.css';

// ── IndexedDB peak cache ───────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────

const LOG = (...args) => console.log('[CAP]', ...args);

export default function CustomAudioPlayer({ url, isStreaming, showVolume = true, autoLoad = false, initialVolume = 0.8 }) {
    const containerRef = useRef();
    const wavesurferRef = useRef(null);
    const destroyedRef = useRef(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(initialVolume);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState('0:00');
    const [duration, setDuration] = useState('0:00');
    const [isLoaded, setIsLoaded] = useState(false);
    const audioElRef = useRef(null);

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const initWaveSurfer = useCallback(() => {
        if (!containerRef.current || wavesurferRef.current) return;
        destroyedRef.current = false;
        LOG('initWaveSurfer — creating instance');

        const wsOptions = {
            container: containerRef.current,
            waveColor: 'rgba(255, 255, 255, 0.2)',
            progressColor: 'var(--primary)',
            cursorColor: 'var(--secondary)',
            cursorWidth: 2,
            barWidth: 3,
            barGap: 2,
            barRadius: 2,
            responsive: true,
            height: 40,
            normalize: true,
            mediaControls: false,
            // interact:true (default) — WaveSurfer handles waveform clicks natively
        };

        let mediaObj;
        if (isStreaming) {
            mediaObj = new Audio(url);
            mediaObj.crossOrigin = 'anonymous';
            wsOptions.media = mediaObj;
        }

        const ws = WaveSurfer.create(wsOptions);

        ws.on('ready', async () => {
            if (destroyedRef.current) return;
            const dur = ws.getDuration();
            LOG('ready — duration:', dur, 'mediaElement:', ws.getMediaElement());
            ws.setVolume(isMuted ? 0 : initialVolume);
            setDuration(isStreaming ? 'Live' : formatTime(dur));
            setIsLoaded(true);
            audioElRef.current = ws.getMediaElement();

            if (!isStreaming) {
                try {
                    const peaks = ws.exportPeaks?.();
                    if (peaks) await storePeaks(url, peaks);
                } catch { }
            }
        });

        ws.on('play', () => {
            const t = ws.getCurrentTime();
            LOG('▶ play — currentTime:', t.toFixed(3));
            setIsPlaying(true);
        });

        ws.on('pause', () => {
            const t = ws.getCurrentTime();
            LOG('⏸ pause — currentTime:', t.toFixed(3));
            setIsPlaying(false);
        });

        ws.on('finish', () => {
            LOG('■ finish');
            setIsPlaying(false);
        });

        // 'interaction' fires when user clicks the waveform canvas
        ws.on('interaction', (newTime) => {
            LOG('🖱 interaction — newTime:', newTime, 'getCurrentTime:', ws.getCurrentTime().toFixed(3));
            setCurrentTime(formatTime(ws.getCurrentTime()));
        });

        // 'seek' fires after the media element currentTime has been updated
        ws.on('seek', (progress) => {
            const t = ws.getCurrentTime();
            const el = ws.getMediaElement();
            LOG('⏩ seek — progress:', progress.toFixed(4),
                '| ws.getCurrentTime():', t.toFixed(3),
                '| el.currentTime:', el?.currentTime?.toFixed(3),
                '| el.paused:', el?.paused);
        });

        ws.on('audioprocess', () => {
            setCurrentTime(formatTime(ws.getCurrentTime()));
        });

        ws.on('error', (err) => {
            if (!destroyedRef.current) {
                console.error('[CAP] WaveSurfer error:', err);
                setIsPlaying(false);
                setIsLoaded(false);
            }
        });

        wavesurferRef.current = ws;
        return ws;
    }, [url, isStreaming, isMuted, initialVolume]);

    const handleLoad = useCallback(async () => {
        LOG('handleLoad — isLoaded:', isLoaded, 'isStreaming:', isStreaming);
        if (isStreaming) {
            if (!wavesurferRef.current) initWaveSurfer();
            return;
        }

        if (!wavesurferRef.current) initWaveSurfer();
        const ws = wavesurferRef.current;
        if (!ws || isLoaded) return;

        const cached = await getCachedPeaks(url);
        LOG('handleLoad — cached peaks?', !!cached);
        if (destroyedRef.current || wavesurferRef.current !== ws) return;
        try {
            ws.load(url, cached || undefined);
        } catch (e) {
            console.warn('[CAP] load error:', e);
        }
    }, [url, isStreaming, isLoaded, initWaveSurfer]);

    // Auto-load on mount
    useEffect(() => {
        if (autoLoad) handleLoad();
        return () => {
            destroyedRef.current = true;
            if (wavesurferRef.current) {
                try { wavesurferRef.current.destroy(); } catch { }
                wavesurferRef.current = null;
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Re-init when url changes
    useEffect(() => {
        if (!url) return;
        destroyedRef.current = true;
        if (wavesurferRef.current) {
            try { wavesurferRef.current.destroy(); } catch { }
            wavesurferRef.current = null;
        }
        setIsLoaded(false);
        setIsPlaying(false);
        setCurrentTime('0:00');
        setDuration('0:00');
        destroyedRef.current = false;
        if (autoLoad) handleLoad();
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const togglePlay = async () => {
        LOG('togglePlay — isLoaded:', isLoaded);
        if (!isLoaded) {
            await handleLoad();
            const ws = wavesurferRef.current;
            if (!ws) return;
            const onReady = () => {
                ws.off('ready', onReady);
                LOG('togglePlay/onReady — playing from:', ws.getCurrentTime().toFixed(3));
                ws.play().catch(e => console.error('[CAP] Playback error:', e));
            };
            ws.on('ready', onReady);
            return;
        }

        const ws = wavesurferRef.current;
        if (!ws) return;
        LOG('togglePlay — calling playPause(), currently playing:', ws.isPlaying());
        try {
            await ws.playPause();
        } catch (e) {
            console.error('[CAP] Playback error:', e);
        }
    };

    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (wavesurferRef.current) wavesurferRef.current.setVolume(isMuted ? 0 : val);
    };

    const toggleMute = () => {
        const newMute = !isMuted;
        setIsMuted(newMute);
        if (wavesurferRef.current) wavesurferRef.current.setVolume(newMute ? 0 : volume);
    };

    return (
        <div className="custom-player">
            <button className="play-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>

            <div className="time-display">{currentTime}</div>

            <div
                className="waveform-wrapper"
                onClick={() => {
                    if (!isLoaded) {
                        LOG('waveform-wrapper click — not loaded yet, triggering handleLoad');
                        handleLoad();
                    } else {
                        LOG('waveform-wrapper click — already loaded, WaveSurfer handles seek');
                    }
                }}
                style={{ cursor: isLoaded ? 'default' : 'pointer' }}
            >
                {!isLoaded && (
                    <div className="fake-waveform">
                        {Array.from({ length: 40 }).map((_, i) => (
                            <div
                                key={i}
                                className="fake-bar"
                                style={{ height: `${15 + Math.random() * 85}%` }}
                            />
                        ))}
                    </div>
                )}
                <div className={`waveform-container ${isLoaded ? 'loaded' : ''}`} ref={containerRef} />
            </div>

            <div className="time-display">{duration}</div>

            {isLoaded && <AudioOutputPicker audioElement={audioElRef.current} />}

            {showVolume && (
                <div className="volume-control">
                    <button className="mute-btn" onClick={toggleMute}>
                        {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={handleVolumeChange}
                    />
                </div>
            )}
        </div>
    );
}
