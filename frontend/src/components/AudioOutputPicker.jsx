import React, { useState, useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import useAudioDevices from './useAudioDevices';
import './AudioOutputPicker.css';

/**
 * AudioOutputPicker
 * Renders a small speaker-icon button. Clicking it opens a dropdown of
 * all available audio output devices. Selecting one calls setSinkId() on
 * the provided audioElement.
 *
 * Props:
 *   audioElement – the raw HTMLAudioElement to route (can be null)
 *   className    – optional extra class for the wrapper
 */
export default function AudioOutputPicker({ audioElement, className = '' }) {
    const { devices, supported } = useAudioDevices();
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState('default');
    const wrapperRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // If the selected device disappears (unplugged), fall back to default
    useEffect(() => {
        if (devices.length === 0) return;
        const ids = devices.map(d => d.deviceId);
        if (!ids.includes(selectedId)) {
            setSelectedId('default');
            applyDevice('default');
        }
    }, [devices]);

    if (!supported) return null;

    const applyDevice = async (deviceId) => {
        if (!audioElement) return;
        try {
            await audioElement.setSinkId(deviceId);
        } catch (err) {
            console.warn('setSinkId failed:', err);
        }
    };

    const handleSelect = async (deviceId) => {
        setSelectedId(deviceId);
        await applyDevice(deviceId);
        setOpen(false);
    };

    const hasNonDefault = devices.some(d => d.deviceId !== 'default');
    const isActive = selectedId !== 'default';

    return (
        <div className={`aop-wrapper ${className}`} ref={wrapperRef}>
            <button
                className={`aop-btn ${open ? 'open' : ''} ${isActive ? 'active-device' : ''}`}
                onClick={() => setOpen(prev => !prev)}
                title={isActive ? `Output: ${devices.find(d => d.deviceId === selectedId)?.label}` : 'Select audio output'}
            >
                <Volume2 size={14} />
            </button>

            {open && (
                <div className="aop-dropdown">
                    <div className="aop-dropdown-header">
                        {hasNonDefault ? 'Audio Output' : 'Default Only'}
                    </div>

                    {devices.length === 0 ? (
                        <div className="aop-no-devices">No output devices found</div>
                    ) : (
                        devices.map(device => (
                            <button
                                key={device.deviceId}
                                className={`aop-device-item ${selectedId === device.deviceId ? 'selected' : ''}`}
                                onClick={() => handleSelect(device.deviceId)}
                            >
                                <span className="aop-dot" />
                                {device.label}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
