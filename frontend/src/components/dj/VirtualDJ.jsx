import React, { useState, useEffect, useRef, useCallback } from 'react';
import DJDeck from './DJDeck';
import DJLibrary from './DJLibrary';
import SetlistPanel from './SetlistPanel';
import { useProfile } from '../ProfileContext';
import './VirtualDJ.css';

const API_BASE = 'http://localhost:8000/api';

const DEFAULT_DECK = {
    track: null,
    url: null,
    isPlaying: false,
    volume: 0.8,
    speed: 1.0,
    loop: false,
    currentTime: 0,
    duration: 0,
    cuePoint: null,
};

export default function VirtualDJ({ playlist }) {
    const { activeProfile, updateProfileConfig } = useProfile();
    const [deckA, setDeckA] = useState({ ...DEFAULT_DECK });
    const [deckB, setDeckB] = useState({ ...DEFAULT_DECK });
    const [crossfader, setCrossfader] = useState(0.5);
    const [autoPlay, setAutoPlay] = useState(false);

    // Setlist state
    const [setlists, setSetlists] = useState([]);
    const [activeSetlistId, setActiveSetlistId] = useState(null);
    const [showSetlist, setShowSetlist] = useState(true);
    const [showLibrary, setShowLibrary] = useState(true);
    const [activeDeckSide, setActiveDeckSide] = useState('a');

    // Keybindings & Sound Effects
    const keybindings = activeProfile?.config?.keybindings || {};
    const keybindingsRef = useRef({});
    useEffect(() => { keybindingsRef.current = keybindings; }, [keybindings]);

    const handleUpdateKeybindings = useCallback((newBindings) => {
        if (activeProfile) {
            updateProfileConfig(activeProfile.id, { keybindings: newBindings });
        }
    }, [activeProfile, updateProfileConfig]);

    const playSoundEffect = useCallback((id) => {
        if (!window.__activeAudioNodes) window.__activeAudioNodes = new Set();
        const el = new Audio(`${API_BASE}/sound-effects/play/${id}`);
        window.__activeAudioNodes.add(el);

        el.onended = () => window.__activeAudioNodes.delete(el);
        el.onerror = () => window.__activeAudioNodes.delete(el);
        el.play().catch(err => {
            console.warn('SFX Play Error:', err);
            window.__activeAudioNodes.delete(el);
        });
    }, []);

    const playSoundEffectRef = useRef(null);
    useEffect(() => { playSoundEffectRef.current = playSoundEffect; }, [playSoundEffect]);

    // Split panel resize
    const [splitRatio, setSplitRatio] = useState(0.5);
    const resizingRef = useRef(false);
    const splitContainerRef = useRef(null);

    // Audio refs — elements created once, sources tracked per side
    const audioCtxRef = useRef(null);
    const audioElARef = useRef(null);
    const audioElBRef = useRef(null);
    const gainARef = useRef(null);
    const gainBRef = useRef(null);
    const analyserARef = useRef(null);
    const analyserBRef = useRef(null);
    const sourceCreatedA = useRef(false);
    const sourceCreatedB = useRef(false);
    const deckEndedA = useRef(false);
    const deckEndedB = useRef(false);

    // VU meters
    const [vuA, setVuA] = useState(0);
    const [vuB, setVuB] = useState(0);
    const vuRafRef = useRef(null);

    // Master volume
    const masterGainRef = useRef(null);
    const [masterVolume, setMasterVolume] = useState(1.0);

    // ─── Only show downloaded MP3 tracks ────────────────
    const djPlaylist = playlist.filter(t => t.is_downloaded);

    // ─── Fetch setlists on mount + create default ────────
    useEffect(() => {
        fetchSetlists();
    }, [activeProfile?.id]);

    const fetchSetlists = async () => {
        try {
            const profileParam = activeProfile?.id ? `?profile_id=${activeProfile.id}` : '';
            const res = await fetch(`${API_BASE}/setlists${profileParam}`);
            const data = await res.json();
            setSetlists(data);
            // Create default setlist if none exists
            if (data.length === 0) {
                const defaultRes = await fetch(`${API_BASE}/setlists`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Default', tracks: [], sublists: [] }),
                });
                const created = await defaultRes.json();
                setSetlists([created]);
                setActiveSetlistId(created.id);
            } else {
                setActiveSetlistId(data[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch setlists:', err);
        }
    };

    const createSetlist = async (name) => {
        try {
            const res = await fetch(`${API_BASE}/setlists`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, profile_id: activeProfile?.id || 'default', tracks: [], sublists: [] }),
            });
            const created = await res.json();
            setSetlists(prev => [...prev, created]);
            setActiveSetlistId(created.id);
            setShowSetlist(true);
        } catch (err) {
            console.error('Failed to create setlist:', err);
        }
    };

    const updateSetlist = async (updated) => {
        try {
            const res = await fetch(`${API_BASE}/setlists/${updated.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
            });
            const saved = await res.json();
            setSetlists(prev => prev.map(s => s.id === saved.id ? saved : s));
        } catch (err) {
            console.error('Failed to update setlist:', err);
        }
    };

    const deleteSetlist = async (id) => {
        if (!confirm('Delete this setlist?')) return;
        try {
            await fetch(`${API_BASE}/setlists/${id}`, { method: 'DELETE' });
            setSetlists(prev => prev.filter(s => s.id !== id));
            if (activeSetlistId === id) setActiveSetlistId(setlists.find(s => s.id !== id)?.id || null);
        } catch (err) {
            console.error('Failed to delete setlist:', err);
        }
    };

    const addToSetlist = useCallback((trackId) => {
        const sl = setlists.find(s => s.id === activeSetlistId);
        if (!sl) return;
        updateSetlist({ ...sl, tracks: [...sl.tracks, trackId] });
    }, [setlists, activeSetlistId]);

    // ─── Audio Context (singleton) ───────────────────────
    const getAudioCtx = useCallback(() => {
        if (!audioCtxRef.current) {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            audioCtxRef.current = ctx;
            // Create master gain node once
            const masterGain = ctx.createGain();
            masterGain.gain.value = masterGainRef.current?.gain?.value ?? 1.0;
            masterGain.connect(ctx.destination);
            masterGainRef.current = masterGain;
        }
        return audioCtxRef.current;
    }, []);

    // Setup audio graph ONCE per side (create source only once)
    const setupDeckAudio = useCallback((side, audioEl) => {
        const ctx = getAudioCtx();
        const isA = side === 'a';
        const createdRef = isA ? sourceCreatedA : sourceCreatedB;

        // Only create the source once — MediaElementSource can only be created once per element
        if (createdRef.current) return;

        const source = ctx.createMediaElementSource(audioEl);
        const gain = ctx.createGain();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(gain);
        gain.connect(analyser);
        // Route through master gain node
        analyser.connect(masterGainRef.current ?? ctx.destination);

        if (isA) { gainARef.current = gain; analyserARef.current = analyser; }
        else { gainBRef.current = gain; analyserBRef.current = analyser; }
        createdRef.current = true;
    }, [getAudioCtx]);

    // Crossfader
    useEffect(() => {
        const angle = crossfader * (Math.PI / 2);
        if (gainARef.current) gainARef.current.gain.value = Math.cos(angle);
        if (gainBRef.current) gainBRef.current.gain.value = Math.sin(angle);
    }, [crossfader]);

    // Master volume
    useEffect(() => {
        if (masterGainRef.current) masterGainRef.current.gain.value = masterVolume;
    }, [masterVolume]);


    // VU meters
    useEffect(() => {
        const readVU = () => {
            const readLevel = (analyser) => {
                if (!analyser) return 0;
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                return (data.reduce((a, b) => a + b, 0) / data.length) / 255;
            };
            setVuA(readLevel(analyserARef.current));
            setVuB(readLevel(analyserBRef.current));
            vuRafRef.current = requestAnimationFrame(readVU);
        };
        vuRafRef.current = requestAnimationFrame(readVU);
        return () => cancelAnimationFrame(vuRafRef.current);
    }, []);

    // Audio element event listeners
    const bindAudioEvents = useCallback((audioEl, side) => {
        const setState = side === 'a' ? setDeckA : setDeckB;
        const endedRef = side === 'a' ? deckEndedA : deckEndedB;
        audioEl.addEventListener('loadedmetadata', () => {
            setState(prev => ({ ...prev, duration: audioEl.duration }));
        });
        audioEl.addEventListener('timeupdate', () => {
            setState(prev => ({ ...prev, currentTime: audioEl.currentTime }));
        });
        audioEl.addEventListener('ended', () => {
            setState(prev => {
                if (prev.loop) {
                    audioEl.currentTime = 0;
                    audioEl.play().catch(() => { });
                    return prev;
                }
                endedRef.current = true; // signal for auto-play
                return { ...prev, isPlaying: false, currentTime: 0 };
            });
        });
        audioEl.addEventListener('play', () => setState(prev => ({ ...prev, isPlaying: true })));
        audioEl.addEventListener('pause', () => setState(prev => ({ ...prev, isPlaying: false })));
    }, []);

    // Create audio elements once
    useEffect(() => {
        const elA = new Audio();
        const elB = new Audio();
        elA.crossOrigin = 'anonymous';
        elB.crossOrigin = 'anonymous';
        elA.preload = 'auto';
        elB.preload = 'auto';
        audioElARef.current = elA;
        audioElBRef.current = elB;
        bindAudioEvents(elA, 'a');
        bindAudioEvents(elB, 'b');
        return () => {
            elA.pause(); elA.src = '';
            elB.pause(); elB.src = '';
            try { audioCtxRef.current?.close(); } catch { }
        };
    }, [bindAudioEvents]);

    // ─── Auto-play: when a deck ends, load next from setlist ───
    useEffect(() => {
        if (!autoPlay || !activeSetlistId) return;
        const endedRef = activeDeckSide === 'a' ? deckEndedA : deckEndedB;
        if (!endedRef.current) return; // only trigger on actual track end
        endedRef.current = false;

        const sl = setlists.find(s => s.id === activeSetlistId);
        if (!sl) return;

        const allTrackIds = [...sl.tracks];
        for (const sub of sl.sublists) allTrackIds.push(...sub.tracks);

        const currentDeck = activeDeckSide === 'a' ? deckA : deckB;
        if (!currentDeck.track) return;

        const currentIdx = allTrackIds.indexOf(currentDeck.track.id);
        if (currentIdx === -1 || currentIdx >= allTrackIds.length - 1) return;

        const nextId = allTrackIds[currentIdx + 1];
        const nextTrack = djPlaylist.find(t => t.id === nextId);
        if (!nextTrack) return;

        const url = `${API_BASE}/play/${nextTrack.id}`;
        // Load and auto-play next track
        loadToDeck(activeDeckSide, nextTrack, url, true);
    }, [deckA.isPlaying, deckB.isPlaying, autoPlay, activeSetlistId, activeDeckSide]);

    // ─── Load track to deck ────
    // shouldAutoPlay: if true, start playing as soon as audio is ready
    const loadToDeck = useCallback((side, track, url, shouldAutoPlay = false) => {
        const elRef = side === 'a' ? audioElARef : audioElBRef;
        const setState = side === 'a' ? setDeckA : setDeckB;
        const el = elRef.current;
        if (!el) return;

        // Check if this deck was playing — if so, auto-play the new track
        const wasPlaying = !el.paused && !el.ended;
        const willAutoPlay = shouldAutoPlay || wasPlaying;

        // Stop and clear previous audio to free memory
        el.pause();
        el.removeAttribute('src');
        el.load(); // resets the element

        // Always use downloaded file endpoint
        const playUrl = url || `${API_BASE}/play/${track.id}`;
        el.src = playUrl;
        el.preload = 'auto';
        el.load();
        el.playbackRate = 1.0;

        // Setup audio graph (only once per element)
        try { setupDeckAudio(side, el); } catch (e) {
            console.warn('Audio graph:', e.message);
        }

        // Apply crossfader gain
        const angle = crossfader * (Math.PI / 2);
        if (side === 'a' && gainARef.current) gainARef.current.gain.value = Math.cos(angle);
        if (side === 'b' && gainBRef.current) gainBRef.current.gain.value = Math.sin(angle);

        const prevVol = side === 'a' ? deckA.volume : deckB.volume;
        const prevSpd = side === 'a' ? deckA.speed : deckB.speed;
        setState({ ...DEFAULT_DECK, track, url: playUrl, volume: prevVol, speed: prevSpd });
        el.volume = prevVol;
        setActiveDeckSide(side);

        // Auto-play: start playback once audio is ready
        if (willAutoPlay) {
            const onCanPlay = () => {
                el.removeEventListener('canplay', onCanPlay);
                const ctx = audioCtxRef.current;
                if (ctx && ctx.state === 'suspended') ctx.resume();
                el.play().catch(err => console.warn('Auto-play error:', err));
            };
            el.addEventListener('canplay', onCanPlay);
        }
    }, [setupDeckAudio, crossfader, deckA.volume, deckB.volume, deckA.speed, deckB.speed]);

    const deckPlay = useCallback((side) => {
        const el = (side === 'a' ? audioElARef : audioElBRef).current;
        if (!el || !el.src) return;
        const ctx = getAudioCtx();
        if (ctx.state === 'suspended') ctx.resume();
        if (el.paused) el.play().catch(err => console.error('Play error:', err));
        else el.pause();
    }, [getAudioCtx]);

    // ─── Global play/pause (spacebar + button): toggle all decks ──────
    const playingSnapshotRef = useRef([]); // which decks were playing before pause

    const globalTogglePlay = useCallback(() => {
        const elA = audioElARef.current;
        const elB = audioElBRef.current;
        const aPlaying = elA && !elA.paused;
        const bPlaying = elB && !elB.paused;
        const anyPlaying = aPlaying || bPlaying;
        const ctx = audioCtxRef.current;

        if (anyPlaying) {
            // Pause all playing decks and remember which were playing
            playingSnapshotRef.current = [];
            if (aPlaying) { elA.pause(); playingSnapshotRef.current.push('a'); }
            if (bPlaying) { elB.pause(); playingSnapshotRef.current.push('b'); }
        } else {
            // Resume previously playing decks
            const toResume = playingSnapshotRef.current.length > 0
                ? playingSnapshotRef.current
                : ['a']; // fall back to deck A if no snapshot
            if (ctx && ctx.state === 'suspended') ctx.resume();
            for (const side of toResume) {
                const el = side === 'a' ? elA : elB;
                if (el && el.src) el.play().catch(() => { });
            }
        }
    }, []);

    // Sync refs so spacebar handler uses latest function
    const globalToggleRef = useRef(null);
    useEffect(() => { globalToggleRef.current = globalTogglePlay; }, [globalTogglePlay]);

    useEffect(() => {
        const handleKey = (e) => {
            if (e.repeat) return;
            const tag = document.activeElement?.tagName?.toLowerCase();
            const type = document.activeElement?.type?.toLowerCase();

            if (tag === 'textarea' || tag === 'select') return;
            if (tag === 'input' && ['text', 'search', 'password', 'number', 'url'].includes(type || 'text')) return;

            if (e.code === 'Space') {
                e.preventDefault();
                globalToggleRef.current?.();
                return;
            }

            const keyChar = e.key.toLowerCase();
            const boundEffectId = keybindingsRef.current[keyChar];
            if (boundEffectId) {
                e.preventDefault();
                playSoundEffectRef.current?.(boundEffectId);
            }
        };
        window.addEventListener('keydown', handleKey, { capture: true });
        return () => window.removeEventListener('keydown', handleKey, { capture: true });
    }, []); // stable — reads from ref

    const deckStop = useCallback((side) => {
        const el = (side === 'a' ? audioElARef : audioElBRef).current;
        if (!el) return;
        el.pause();
        el.currentTime = 0;
        (side === 'a' ? setDeckA : setDeckB)(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    }, []);

    const deckSeek = useCallback((side, time) => {
        const el = (side === 'a' ? audioElARef : audioElBRef).current;
        if (!el || !isFinite(time)) return;
        try {
            el.currentTime = time;
        } catch (e) {
            console.warn('Seek error:', e);
        }
    }, []);

    const deckVolume = useCallback((side, vol) => {
        const el = (side === 'a' ? audioElARef : audioElBRef).current;
        if (el) el.volume = vol;
        (side === 'a' ? setDeckA : setDeckB)(prev => ({ ...prev, volume: vol }));
    }, []);

    const deckSpeed = useCallback((side, speed) => {
        const el = (side === 'a' ? audioElARef : audioElBRef).current;
        if (el) el.playbackRate = speed;
        (side === 'a' ? setDeckA : setDeckB)(prev => ({ ...prev, speed }));
    }, []);

    const deckLoop = useCallback((side) => {
        const el = (side === 'a' ? audioElARef : audioElBRef).current;
        (side === 'a' ? setDeckA : setDeckB)(prev => {
            const newLoop = !prev.loop;
            if (el) el.loop = newLoop;
            return { ...prev, loop: newLoop };
        });
    }, []);

    const deckCue = useCallback((side) => {
        const el = (side === 'a' ? audioElARef : audioElBRef).current;
        const deck = side === 'a' ? deckA : deckB;
        const setState = side === 'a' ? setDeckA : setDeckB;
        if (!el) return;
        if (deck.cuePoint === null) setState(prev => ({ ...prev, cuePoint: el.currentTime }));
        else { el.currentTime = deck.cuePoint; }
    }, [deckA, deckB]);

    // ─── Resize handler ──────────────────────────────────
    const handleResizeStart = (e) => {
        e.preventDefault();
        resizingRef.current = true;
        const handleMove = (ev) => {
            if (!resizingRef.current || !splitContainerRef.current) return;
            const rect = splitContainerRef.current.getBoundingClientRect();
            const x = (ev.clientX || ev.touches?.[0]?.clientX || 0) - rect.left;
            const ratio = Math.max(0.2, Math.min(0.8, x / rect.width));
            setSplitRatio(ratio);
        };
        const handleUp = () => {
            resizingRef.current = false;
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleUp);
    };

    const formatCFLabel = () => {
        if (crossfader < 0.45) return `← A (${Math.round((1 - crossfader) * 100)}%)`;
        if (crossfader > 0.55) return `B → (${Math.round(crossfader * 100)}%)`;
        return 'Center';
    };

    const dropToDeck = (side, trackId) => {
        const track = djPlaylist.find(t => t.id === trackId);
        if (!track) return;
        loadToDeck(side, track, `${API_BASE}/play/${track.id}`);
    };

    return (
        <div className="vdj-root">
            {/* Decks */}
            <div className="vdj-decks-row">
                <DJDeck side="a" deck={deckA}
                    onPlay={() => deckPlay('a')} onStop={() => deckStop('a')}
                    onSeek={(t) => deckSeek('a', t)} onVolumeChange={(v) => deckVolume('a', v)}
                    onSpeedChange={(s) => deckSpeed('a', s)} onLoopToggle={() => deckLoop('a')}
                    onCue={() => deckCue('a')}
                    onDrop={(id) => dropToDeck('a', id)}
                    audioElement={audioElARef.current} />

                <div className="vdj-master">
                    <span className="master-label">Master</span>
                    <div className="vu-row">
                        <div className="vu-meter"><div className="vu-fill" style={{ height: `${vuA * 100}%` }} /></div>
                        <div className="vu-meter"><div className="vu-fill" style={{ height: `${vuB * 100}%` }} /></div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div className="bpm-display">DJ</div>
                        <div className="bpm-unit">MIX</div>
                    </div>
                    {/* Master Volume — hardware fader */}
                    <div className="master-vol-block">
                        <span className="master-vol-label">VOL</span>
                        <div className="master-fader-rail">
                            <div className="master-fader-ticks">
                                {Array.from({ length: 13 }).map((_, i) => (
                                    <div key={i} className={`fader-tick${i === 0 || i === 6 || i === 12 ? ' fader-tick-major' : ''}`} />
                                ))}
                            </div>
                            <input
                                type="range"
                                className="master-vol-slider"
                                min={0} max={1} step={0.01}
                                value={masterVolume}
                                onChange={e => setMasterVolume(parseFloat(e.target.value))}
                                title={`Master: ${Math.round(masterVolume * 100)}%`}
                            />
                            <div className="master-fader-ticks">
                                {Array.from({ length: 13 }).map((_, i) => (
                                    <div key={i} className={`fader-tick${i === 0 || i === 6 || i === 12 ? ' fader-tick-major' : ''}`} />
                                ))}
                            </div>
                        </div>
                        <span className="master-vol-val">{Math.round(masterVolume * 100)}%</span>
                    </div>
                </div>

                <DJDeck side="b" deck={deckB}
                    onPlay={() => deckPlay('b')} onStop={() => deckStop('b')}
                    onSeek={(t) => deckSeek('b', t)} onVolumeChange={(v) => deckVolume('b', v)}
                    onSpeedChange={(s) => deckSpeed('b', s)} onLoopToggle={() => deckLoop('b')}
                    onCue={() => deckCue('b')}
                    onDrop={(id) => dropToDeck('b', id)}
                    audioElement={audioElBRef.current} />
            </div>

            {/* Crossfader */}
            <div className="vdj-crossfader-section">
                {/* Global play/pause button */}
                <button
                    className={`global-play-btn${(deckA.isPlaying || deckB.isPlaying) ? ' global-play-btn--playing' : ''}`}
                    onClick={globalTogglePlay}
                    title="Play / Pause all (Spacebar)"
                >
                    {(deckA.isPlaying || deckB.isPlaying) ? '⏸' : '▶'}
                </button>

                <span className="xfader-label label-a">◀ A</span>
                <input type="range" className="crossfader-slider" min={0} max={1} step={0.01}
                    value={crossfader} onChange={e => setCrossfader(parseFloat(e.target.value))} />
                <span className="xfader-label label-b">B ▶</span>
                <button className="xfader-center-btn" onClick={() => setCrossfader(0.5)}>CENTER</button>

                <button
                    className={`xfader-center-btn${showSetlist ? ' xfader-btn-active' : ''}`}
                    onClick={() => setShowSetlist(!showSetlist)}
                >
                    ☰ Setlist
                </button>

                <button
                    className={`xfader-center-btn${showLibrary ? ' xfader-btn-active xfader-btn-lib' : ''}`}
                    onClick={() => setShowLibrary(!showLibrary)}
                >
                    🎵 Library
                </button>

                <button
                    className={`xfader-center-btn${showLibrary ? ' xfader-btn-active xfader-btn-lib' : ''}`}
                    onClick={() => setShowLibrary(!showLibrary)}
                >
                    🎵 Library
                </button>
            </div>

            {/* Bottom section: setlist + library */}
            {(showSetlist || showLibrary) && (
                showSetlist && showLibrary ? (
                    <div className="library-split" ref={splitContainerRef}
                        style={{ gridTemplateColumns: `${splitRatio}fr ${1 - splitRatio}fr` }}>
                        <SetlistPanel
                            setlists={setlists}
                            activeSetlistId={activeSetlistId}
                            onSelectSetlist={setActiveSetlistId}
                            onUpdateSetlist={updateSetlist}
                            onCreateSetlist={createSetlist}
                            onDeleteSetlist={deleteSetlist}
                            autoPlay={autoPlay}
                            onAutoPlayToggle={() => setAutoPlay(!autoPlay)}
                            playlist={djPlaylist}
                            onLoadToDeck={loadToDeck}
                            currentPlayingId={(activeDeckSide === 'a' ? deckA : deckB).track?.id}
                        />
                        {/* Resize handle */}
                        <div className="split-resize-handle" onMouseDown={handleResizeStart} onTouchStart={handleResizeStart} />
                        <DJLibrary
                            playlist={djPlaylist}
                            onLoadToDeck={loadToDeck}
                            showAddToSetlist={!!activeSetlistId}
                            onAddToSetlist={addToSetlist}
                        />
                    </div>
                ) : showSetlist ? (
                    <SetlistPanel
                        setlists={setlists}
                        activeSetlistId={activeSetlistId}
                        onSelectSetlist={setActiveSetlistId}
                        onUpdateSetlist={updateSetlist}
                        onCreateSetlist={createSetlist}
                        onDeleteSetlist={deleteSetlist}
                        autoPlay={autoPlay}
                        onAutoPlayToggle={() => setAutoPlay(!autoPlay)}
                        playlist={djPlaylist}
                        onLoadToDeck={loadToDeck}
                        currentPlayingId={(activeDeckSide === 'a' ? deckA : deckB).track?.id}
                    />
                ) : (
                    <DJLibrary
                        playlist={djPlaylist}
                        onLoadToDeck={loadToDeck}
                        showAddToSetlist={!!activeSetlistId}
                        onAddToSetlist={addToSetlist}
                    />
                )
            )}
        </div>
    );
}
