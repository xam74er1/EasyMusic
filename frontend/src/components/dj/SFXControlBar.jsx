import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, VolumeX, Square } from 'lucide-react';
import './SFXControlBar.css';

export default function SFXControlBar() {
    const [activeSounds, setActiveSounds] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 20, y: 20 }); // bottom-left, on-screen
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);
    const prevCountRef = useRef(0);

    // Poll window.__activeAudioNodes every 80ms
    useEffect(() => {
        const tick = () => {
            if (!window.__activeAudioNodes || window.__activeAudioNodes.size === 0) {
                setActiveSounds([]);
                return;
            }
            const sounds = Array.from(window.__activeAudioNodes)
                .filter(el => !el.paused)
                .map(el => ({
                    element: el,
                    effectId: el.__effectId,
                    name: el.__effectName
                        || window.__sfxRegistry?.[el.__effectId]
                        || 'Sound Effect',
                    currentTime: el.currentTime,
                    duration: isFinite(el.duration) && el.duration > 0 ? el.duration : null,
                }));
            setActiveSounds(sounds);
        };

        const id = setInterval(tick, 80);
        return () => clearInterval(id);
    }, []);

    // Auto-show bar when a new sound starts
    useEffect(() => {
        prevCountRef.current = activeSounds.length;
    }, [activeSounds.length]);

    const stopSound = useCallback((el) => {
        el.pause();
        el.src = '';
        window.__activeAudioNodes?.delete(el);
        setActiveSounds(prev => prev.filter(s => s.element !== el));
    }, []);

    const stopAll = useCallback(() => {
        window.__activeAudioNodes?.forEach(el => {
            el.pause();
            el.src = '';
        });
        window.__activeAudioNodes?.clear();
        setActiveSounds([]);
    }, []);

    // Drag handling
    const handleMouseDown = useCallback((e) => {
        if (!e.target.closest('.sfx-bar-header')) return;
        setIsDragging(true);
        setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
    }, [position]);

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e) => {
            const newX = Math.max(0, Math.min(window.innerWidth - 240, e.clientX - dragOffset.x));
            const newY = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.y));
            setPosition({ x: newX, y: newY });
        };
        const onUp = () => setIsDragging(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [isDragging, dragOffset]);

    if (activeSounds.length === 0) return null;

    const pct = (s) => s.duration ? Math.min(100, (s.currentTime / s.duration) * 100) : 0;
    const fmt = (t) => `${Math.floor(t)}:${String(Math.floor((t % 1) * 10)).padStart(1, '0')}`;

    return (
        <div
            ref={containerRef}
            className="sfx-bar"
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                zIndex: 9000,
                cursor: isDragging ? 'grabbing' : 'default',
                userSelect: isDragging ? 'none' : 'auto',
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="sfx-bar-header">
                <div className="sfx-bar-title">
                    <span className="sfx-bar-dot" />
                    Playing ({activeSounds.length})
                </div>
                <button className="sfx-bar-stop-all-btn" onClick={stopAll} title="Stop all sounds">
                    <VolumeX size={13} />
                </button>
            </div>

            <div className="sfx-bar-list">
                {activeSounds.map((s, i) => (
                    <div key={i} className="sfx-bar-item">
                        <div className="sfx-bar-item-name" title={s.name}>{s.name}</div>
                        <div className="sfx-bar-progress">
                            <div className="sfx-bar-fill" style={{ width: `${pct(s)}%` }} />
                        </div>
                        <span className="sfx-bar-time">
                            {fmt(s.currentTime)}{s.duration ? `/${fmt(s.duration)}` : ''}
                        </span>
                        <button
                            className="sfx-bar-stop"
                            onClick={(e) => { e.stopPropagation(); stopSound(s.element); }}
                            title="Stop"
                        >
                            <Square size={10} fill="currentColor" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
