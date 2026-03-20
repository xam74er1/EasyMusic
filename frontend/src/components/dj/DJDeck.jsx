import React, { useState } from 'react';
import { Play, Pause, Square, Repeat } from 'lucide-react';
import DJWaveform from './DJWaveform';
import AudioOutputPicker from '../AudioOutputPicker';

function formatTime(secs) {
    if (!isFinite(secs) || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function DJDeck({
    side,
    deck,
    onPlay,
    onStop,
    onSeek,
    onVolumeChange,
    onSpeedChange,
    onLoopToggle,
    onCue,
    audioElement,
    onDrop,
}) {
    const isA = side === 'a';
    const waveColor = isA ? 'rgba(157, 78, 221, 0.40)' : 'rgba(0, 245, 212, 0.35)';
    const progressColor = isA ? '#9D4EDD' : '#00F5D4';
    const volPct = Math.round(deck.volume * 100);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = (e) => {
        if (!e.dataTransfer.types.includes('text/track-id')) return;
        e.preventDefault();
        setIsDragOver(true);
    };
    const handleDragLeave = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const trackId = e.dataTransfer.getData('text/track-id');
        if (trackId && onDrop) onDrop(trackId);
    };

    return (
        <div
            className={`vdj-deck deck-${side}${isDragOver ? ' deck-drop-target' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Header row: label + track info */}
            <div className="deck-header">
                <span className="deck-label">{side.toUpperCase()}</span>
                {deck.track ? (
                    <>
                        <img className="deck-thumb" src={deck.track.thumbnail || '/music_placeholder.png'} alt="" />
                        <div className="deck-track-info">
                            <div className="track-title">{deck.track.title}</div>
                            <div className="track-author">{deck.track.author}</div>
                        </div>
                    </>
                ) : (
                    <div className="deck-track-info">
                        <div className="track-title" style={{ opacity: 0.3 }}>No track loaded</div>
                        <div className="track-author" style={{ opacity: 0.2 }}>Load from library ↓</div>
                    </div>
                )}
            </div>

            {/* Waveform */}
            <DJWaveform
                url={deck.url}
                color={waveColor}
                progressColor={progressColor}
                height={64}
                onSeek={onSeek}
                currentTime={deck.currentTime}
                duration={deck.duration}
                audioElement={audioElement}
            />

            {/* Time row */}
            <div className="deck-time-row">
                <span className="time-display">{formatTime(deck.currentTime)}</span>
                <input
                    type="range"
                    className="progress-bar"
                    min={0}
                    max={deck.duration || 0}
                    step={0.1}
                    value={deck.currentTime || 0}
                    onChange={e => onSeek(parseFloat(e.target.value))}
                    disabled={!deck.track}
                />
                <span className="time-display">{formatTime(deck.duration)}</span>
            </div>

            {/* Bottom row: transport + faders in one line */}
            <div className="deck-bottom-row">
                {/* Transport buttons */}
                <div className="deck-transport">
                    <button className={`ctrl-btn play-btn ${deck.isPlaying ? 'active' : ''}`} onClick={onPlay} disabled={!deck.track} title="Play / Pause">
                        {deck.isPlaying ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
                        {deck.isPlaying ? 'PAUSE' : 'PLAY'}
                    </button>
                    <button className="ctrl-btn" onClick={onStop} disabled={!deck.track} title="Stop">
                        <Square size={10} fill="currentColor" /> STOP
                    </button>
                    <button className={`ctrl-btn loop-btn ${deck.loop ? 'active' : ''}`} onClick={onLoopToggle} disabled={!deck.track}>
                        <Repeat size={10} /> LOOP
                    </button>
                    <button className="ctrl-btn cue-btn" onClick={onCue} disabled={!deck.track}>CUE</button>
                    {deck.cuePoint !== null && (
                        <span className="cue-marker">CUE {formatTime(deck.cuePoint)}</span>
                    )}
                </div>

                {/* Faders: volume + speed */}
                <div className="deck-faders">
                    <div className="fader-item">
                        <span className="fader-label">VOL</span>
                        <input type="range" className="fader-slider vol-slider" min={0} max={1} step={0.01}
                            value={deck.volume} style={{ '--val': `${volPct}%` }}
                            onChange={e => onVolumeChange(parseFloat(e.target.value))} />
                        <span className="fader-val">{volPct}%</span>
                        <AudioOutputPicker audioElement={audioElement} />
                    </div>
                    <div className="fader-item">
                        <span className="fader-label">SPEED</span>
                        <input type="range" className="speed-slider" min={0.7} max={1.3} step={0.01}
                            value={deck.speed}
                            onChange={e => onSpeedChange(parseFloat(e.target.value))}
                            disabled={!deck.track} />
                        <span className="fader-val speed-val">{deck.speed.toFixed(2)}x</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
