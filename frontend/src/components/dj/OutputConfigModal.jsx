import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Speaker, Headphones, X, Check } from 'lucide-react';
import useAudioDevices from '../useAudioDevices';
import './OutputConfigModal.css';

/**
 * OutputConfigModal
 * A modal where the DJ configures which physical device is "Room" (speakers)
 * and which is "Headset" (headphones/monitor).
 *
 * Props:
 *   open             – boolean
 *   onClose()        – called on cancel / close
 *   roomDevice       – current roomDevice ID
 *   headsetDevice    – current headsetDevice ID
 *   onSave(room, headset) – called with the new IDs on confirm
 */
export default function OutputConfigModal({ open, onClose, roomDevice, headsetDevice, onSave }) {
    const { devices, supported, requestLabels } = useAudioDevices();
    const [localRoom, setLocalRoom] = useState(roomDevice);
    const [localHeadset, setLocalHeadset] = useState(headsetDevice);

    // Sync when parent values change (e.g. first open)
    useEffect(() => { setLocalRoom(roomDevice); }, [roomDevice]);
    useEffect(() => { setLocalHeadset(headsetDevice); }, [headsetDevice]);

    // Make sure we have real device labels
    useEffect(() => {
        if (open) requestLabels();
    }, [open]);

    if (!open) return null;

    const handleSave = () => onSave(localRoom, localHeadset);

    const deviceLabel = (id) => {
        const d = devices.find(x => x.deviceId === id);
        return d?.label ?? 'Default';
    };

    const modal = (
        <div className="ocm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="ocm-dialog">
                {/* Header */}
                <div className="ocm-header">
                    <span className="ocm-title">Audio Output Configuration</span>
                    <button className="ocm-close" onClick={onClose} title="Close"><X size={16} /></button>
                </div>

                <p className="ocm-subtitle">
                    Assign your audio devices once — then switch any deck between Room and Headset instantly.
                </p>

                {!supported && (
                    <div className="ocm-unsupported">
                        ⚠️ Your browser does not support audio output routing (<code>setSinkId</code>).
                        Try Chrome or Edge.
                    </div>
                )}

                {/* Room */}
                <div className="ocm-section">
                    <div className="ocm-section-label">
                        <Speaker size={15} className="ocm-icon ocm-icon--room" />
                        Room Output
                        <span className="ocm-section-desc">Main speakers in the room</span>
                    </div>
                    <select
                        className="ocm-select"
                        value={localRoom}
                        onChange={e => setLocalRoom(e.target.value)}
                        disabled={!supported}
                    >
                        {devices.length === 0 && <option value="default">Default</option>}
                        {devices.map(d => (
                            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                        ))}
                    </select>
                </div>

                {/* Headset */}
                <div className="ocm-section">
                    <div className="ocm-section-label">
                        <Headphones size={15} className="ocm-icon ocm-icon--headset" />
                        Headset Output
                        <span className="ocm-section-desc">Monitor headphones / cueing</span>
                    </div>
                    <select
                        className="ocm-select"
                        value={localHeadset}
                        onChange={e => setLocalHeadset(e.target.value)}
                        disabled={!supported}
                    >
                        {devices.length === 0 && <option value="default">Default</option>}
                        {devices.map(d => (
                            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                        ))}
                    </select>
                </div>

                {/* Preview */}
                <div className="ocm-preview">
                    <div className="ocm-preview-row">
                        <Speaker size={12} className="ocm-icon ocm-icon--room" />
                        <span className="ocm-preview-label">Room:</span>
                        <span className="ocm-preview-val">{deviceLabel(localRoom)}</span>
                    </div>
                    <div className="ocm-preview-row">
                        <Headphones size={12} className="ocm-icon ocm-icon--headset" />
                        <span className="ocm-preview-label">Headset:</span>
                        <span className="ocm-preview-val">{deviceLabel(localHeadset)}</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="ocm-footer">
                    <button className="ocm-btn ocm-btn--cancel" onClick={onClose}>Cancel</button>
                    <button className="ocm-btn ocm-btn--save" onClick={handleSave} disabled={!supported}>
                        <Check size={14} /> Save
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
}
