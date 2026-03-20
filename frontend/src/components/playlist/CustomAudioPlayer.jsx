import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import AudioOutputPicker from '../AudioOutputPicker';
import './CustomAudioPlayer.css';

export default function CustomAudioPlayer({ url, isStreaming, showVolume = true, autoLoad = false, initialVolume = 0.8 }) {
    const containerRef = useRef();
    const wavesurferRef = useRef();
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(initialVolume);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState('0:00');
    const [duration, setDuration] = useState('0:00');
    const [isLoaded, setIsLoaded] = useState(false);
    const audioElRef = useRef(null);

    const initWaveSurfer = () => {
        if (!containerRef.current || wavesurferRef.current) return;

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
            mediaControls: false
        };

        if (isStreaming) {
            const mediaObj = new Audio(url);
            mediaObj.crossOrigin = "anonymous";
            wsOptions.media = mediaObj;
        }

        const ws = WaveSurfer.create(wsOptions);

        ws.on('ready', () => {
            setDuration(isStreaming ? 'Live' : formatTime(ws.getDuration()));
            ws.setVolume(volume);
            setIsLoaded(true);
            audioElRef.current = ws.getMediaElement();
        });

        ws.on('play', () => setIsPlaying(true));
        ws.on('pause', () => setIsPlaying(false));
        ws.on('finish', () => setIsPlaying(false));
        ws.on('audioprocess', () => {
            setCurrentTime(formatTime(ws.getCurrentTime()));
        });
        ws.on('interaction', () => {
            setCurrentTime(formatTime(ws.getCurrentTime()));
        });
        ws.on('error', (err) => {
            console.error('WaveSurfer error:', err);
            setIsPlaying(false);
            setIsLoaded(false);
        });

        wavesurferRef.current = ws;
    };

    useEffect(() => {
        if (autoLoad) {
            handleLoad();
        }
        return () => {
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
                wavesurferRef.current = null;
            }
        };
    }, [autoLoad]);

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const togglePlay = () => {
        if (!isLoaded) {
            handleLoad();
            setTimeout(() => {
                if (wavesurferRef.current) {
                    wavesurferRef.current.play().catch(e => console.error("Playback error:", e));
                }
            }, 100);
        } else if (wavesurferRef.current) {
            wavesurferRef.current.playPause().then(() => {
                setIsPlaying(wavesurferRef.current.isPlaying());
            }).catch(e => console.error("Playback error:", e));
        }
    };

    const handleLoad = () => {
        if (!wavesurferRef.current) {
            initWaveSurfer();
        }
        if (wavesurferRef.current && !isLoaded) {
            if (!isStreaming) {
                wavesurferRef.current.load(url).catch(e => console.error("Load error:", e));
            } else {
                // For streaming, the media element we passed in initWaveSurfer will load automatically.
                // We just need to wait for the 'ready' event.
            }
        }
    };

    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (wavesurferRef.current) {
            wavesurferRef.current.setVolume(isMuted ? 0 : val);
        }
    };

    const toggleMute = () => {
        const newMute = !isMuted;
        setIsMuted(newMute);
        if (wavesurferRef.current) {
            wavesurferRef.current.setVolume(newMute ? 0 : volume);
        }
    };

    return (
        <div className="custom-player">
            <button className="play-btn" onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>

            <div className="time-display">{currentTime}</div>

            <div className="waveform-wrapper" onClick={() => !isLoaded && handleLoad()} style={{ cursor: isLoaded ? 'default' : 'pointer' }}>
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
                <div className={`waveform-container ${isLoaded ? 'loaded' : ''}`} ref={containerRef}></div>
            </div>

            <div className="time-display">{duration}</div>

            {isLoaded && (
                <AudioOutputPicker audioElement={audioElRef.current} />
            )}

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
