import React, { useState, useEffect } from 'react';
import { X, Settings, Shield, Globe, Music, Youtube, Check } from 'lucide-react';
import './ConfigPanel.css';

const ConfigPanel = ({ isOpen, onClose, currentMode, onModeChange }) => {
    const [fallbackEnabled, setFallbackEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchFallbackStatus();
        }
    }, [isOpen]);

    const fetchFallbackStatus = async () => {
        try {
            const resp = await fetch('/api/config/fallback');
            const data = await resp.json();
            setFallbackEnabled(data.enable_fallback);
        } catch (err) {
            console.error('Failed to fetch fallback status:', err);
        }
    };

    const handleToggleFallback = async () => {
        setIsLoading(true);
        try {
            const resp = await fetch('/api/config/fallback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !fallbackEnabled })
            });
            const data = await resp.json();
            setFallbackEnabled(data.enable_fallback);
        } catch (err) {
            console.error('Failed to update fallback status:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="config-panel-overlay" onClick={onClose}>
            <div className="config-panel-content" onClick={e => e.stopPropagation()}>
                <div className="config-panel-header">
                    <div className="header-title">
                        <Settings className="header-icon" size={20} />
                        <h2>Download Settings</h2>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="config-section">
                    <h3>Primary Download Source</h3>
                    <p className="section-desc">Choose which service to try first when downloading music.</p>
                    <div className="source-grid">
                        <div 
                            className={`source-card ${currentMode === 'youtube' ? 'active' : ''}`}
                            onClick={() => onModeChange('youtube')}
                        >
                            <div className="source-icon youtube">
                                <Youtube size={24} />
                            </div>
                            <span>YouTube</span>
                            {currentMode === 'youtube' && <Check className="check-icon" size={16} />}
                        </div>
                        <div 
                            className={`source-card ${currentMode === 'spotify' ? 'active' : ''}`}
                            onClick={() => onModeChange('spotify')}
                        >
                            <div className="source-icon spotify">
                                <Music size={24} />
                            </div>
                            <span>Spotify</span>
                            {currentMode === 'spotify' && <Check className="check-icon" size={16} />}
                        </div>
                        <div 
                            className={`source-card ${currentMode === 'cc' ? 'active' : ''}`}
                            onClick={() => onModeChange('cc')}
                        >
                            <div className="source-icon cc">
                                <Globe size={24} />
                            </div>
                            <span>Creative Commons</span>
                            {currentMode === 'cc' && <Check className="check-icon" size={16} />}
                        </div>
                    </div>
                </div>

                <div className="config-section">
                    <div className="toggle-row">
                        <div className="toggle-info">
                            <h3>Enable Automatic Fallback</h3>
                            <p className="section-desc">
                                If the primary source fails, automatically try the other one (YouTube ↔ Spotify).
                            </p>
                        </div>
                        <label className="switch">
                            <input 
                                type="checkbox" 
                                checked={fallbackEnabled} 
                                onChange={handleToggleFallback}
                                disabled={isLoading}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>
                    {currentMode === 'cc' && fallbackEnabled && (
                        <div className="warning-notice">
                            <Shield size={14} />
                            <span>Fallback is only available between YouTube and Spotify.</span>
                        </div>
                    )}
                </div>

                <div className="config-footer">
                    <button className="done-btn" onClick={onClose}>Done</button>
                </div>
            </div>
        </div>
    );
};

export default ConfigPanel;
