import React, { useState, useRef, useEffect } from 'react';
import { X, Volume2, VolumeX } from 'lucide-react';
import './SFXControlBar.css';

/**
 * SFXControlBar - Floating bar at bottom showing active sound effects
 * Draggable, minimizable, shows all playing SFX and allows stopping them
 */
export default function SFXControlBar() {
    const [isHovering, setIsHovering] = useState(false);
    const [isMinimized, setIsMinimized] = useState(true);
    const [position, setPosition] = useState({ x: 20, y: -120 }); // Start at bottom, above the fold
    const [activeSounds, setActiveSounds] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);
    const updateIntervalRef = useRef(null);

    // Track active sound effects
    useEffect(() => {
        const updateActiveSounds = () => {
            if (window.__activeAudioNodes && window.__activeAudioNodes.size > 0) {
                const sounds = Array.from(window.__activeAudioNodes).map((el, idx) => ({
                    id: idx,
                    playing: !el.paused,
                    currentTime: el.currentTime.toFixed(1),
                    duration: el.duration.toFixed(1),
                    element: el
                }));
                setActiveSounds(sounds.filter(s => s.playing));
            } else {
                setActiveSounds([]);
            }
        };

        // Update every 100ms to track progress
        updateIntervalRef.current = setInterval(updateActiveSounds, 100);
        return () => clearInterval(updateIntervalRef.current);
    }, []);

    const handleStopAll = () => {
        if (window.__activeAudioNodes) {
            window.__activeAudioNodes.forEach(el => {
                el.pause();
                el.src = '';
            });
            window.__activeAudioNodes.clear();
            setActiveSounds([]);
        }
    };

    const handleStopSound = (idx) => {
        if (activeSounds[idx]) {
            const el = activeSounds[idx].element;
            el.pause();
            el.src = '';
            if (window.__activeAudioNodes) {
                window.__activeAudioNodes.delete(el);
            }
        }
    };

    // Dragging logic
    const handleMouseDown = (e) => {
        // Only drag from the header area
        if (e.target.closest('.sfx-bar-header')) {
            setIsDragging(true);
            setDragOffset({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
        }
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e) => {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    if (activeSounds.length === 0 && isMinimized) {
        return null; // Don't show if minimized and no sounds
    }

    return (
        <div
            className={`sfx-control-bar ${isHovering || !isMinimized ? 'sfx-bar-expanded' : 'sfx-bar-minimized'}`}
            ref={containerRef}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                bottom: `${position.y}px`,
                zIndex: 5000,
                userSelect: isDragging ? 'none' : 'auto',
                cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="sfx-bar-header">
                <div className="sfx-bar-title">
                    <Volume2 size={14} />
                    <span>Sound Effects ({activeSounds.length})</span>
                </div>
                <button
                    className="sfx-bar-minimize"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsMinimized(!isMinimized);
                    }}
                    title={isMinimized ? 'Show' : 'Hide'}
                >
                    {isMinimized ? '▲' : '▼'}
                </button>
            </div>

            {(isHovering || !isMinimized) && (
                <div className="sfx-bar-content">
                    {activeSounds.length > 0 ? (
                        <>
                            <div className="sfx-sounds-list">
                                {activeSounds.map((sound, idx) => (
                                    <div key={idx} className="sfx-sound-item">
                                        <div className="sfx-sound-progress">
                                            <div
                                                className="sfx-sound-bar"
                                                style={{
                                                    width: `${(sound.currentTime / sound.duration) * 100}%`
                                                }}
                                            />
                                        </div>
                                        <span className="sfx-sound-time">
                                            {sound.currentTime}s / {sound.duration}s
                                        </span>
                                        <button
                                            className="sfx-sound-stop"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleStopSound(idx);
                                            }}
                                            title="Stop this sound"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                className="sfx-bar-stop-all"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleStopAll();
                                }}
                            >
                                <VolumeX size={13} />
                                Stop All
                            </button>
                        </>
                    ) : (
                        <div className="sfx-bar-empty">No sounds playing</div>
                    )}
                </div>
            )}
        </div>
    );
}
