import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Headphones, ChevronDown, RefreshCw } from 'lucide-react';
import useAudioDevices from '../useAudioDevices';
import './MasterOutputSelector.css';

export default function MasterOutputSelector({ onDeviceChange, selectedId: externalId }) {
    const { devices, supported, requestLabels } = useAudioDevices();
    const [open, setOpen] = useState(false);
    const [internalId, setInternalId] = useState('default');
    const [refreshing, setRefreshing] = useState(false);
    const [panelPos, setPanelPos] = useState({});
    const triggerRef = useRef(null);

    const selectedId = externalId ?? internalId;

    // Compute fixed position above the button (escapes overflow:hidden parents)
    useEffect(() => {
        if (!open || !triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setPanelPos({
            bottom: window.innerHeight - rect.top + 8,
            left: rect.left + rect.width / 2,
        });
    }, [open]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (!triggerRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Fallback to default if selected device is unplugged
    useEffect(() => {
        if (!devices.length) return;
        const ids = devices.map(d => d.deviceId);
        if (!ids.includes(selectedId)) handleSelect('default');
    }, [devices]);

    const handleSelect = (deviceId) => {
        setInternalId(deviceId);
        onDeviceChange?.(deviceId);
        setOpen(false);
    };

    const handleRefresh = async (e) => {
        e.stopPropagation();
        setRefreshing(true);
        await requestLabels();
        setRefreshing(false);
    };

    if (!supported) return null;

    const currentDevice = devices.find(d => d.deviceId === selectedId);
    const displayName = currentDevice?.label ?? 'Default Output';
    const isNonDefault = selectedId !== 'default';

    const panel = open && ReactDOM.createPortal(
        <div className="mos-panel" style={{ bottom: panelPos.bottom, left: panelPos.left }}>
            <div className="mos-panel-header">
                <span>Audio Output</span>
                <button
                    className={`mos-refresh-btn ${refreshing ? 'mos-refresh-btn--spin' : ''}`}
                    onClick={handleRefresh}
                    title="Refresh device list"
                >
                    <RefreshCw size={12} />
                </button>
            </div>
            {devices.length === 0 ? (
                <div className="mos-empty">No output devices found</div>
            ) : (
                <div className="mos-device-list">
                    {devices.map(device => {
                        const isSelected = device.deviceId === selectedId;
                        return (
                            <button
                                key={device.deviceId}
                                className={`mos-device-btn ${isSelected ? 'mos-device-btn--selected' : ''}`}
                                onClick={() => handleSelect(device.deviceId)}
                            >
                                <span className="mos-device-indicator" />
                                <span className="mos-device-name">{device.label}</span>
                                {isSelected && <span className="mos-active-badge">ACTIVE</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>,
        document.body
    );

    return (
        <>
            <button
                ref={triggerRef}
                className={`mos-trigger ${open ? 'mos-trigger--open' : ''} ${isNonDefault ? 'mos-trigger--active' : ''}`}
                onClick={() => setOpen(p => !p)}
                title="Select audio output device"
            >
                <Headphones size={14} className="mos-icon" />
                <span className="mos-current-label">{displayName}</span>
                <ChevronDown size={12} className={`mos-chevron ${open ? 'mos-chevron--up' : ''}`} />
            </button>
            {panel}
        </>
    );
}
