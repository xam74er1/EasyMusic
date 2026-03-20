import { useState, useEffect } from 'react';

/**
 * useAudioDevices — enumerate available audio output devices.
 * Re-runs automatically when the user plugs/unplugs a device.
 *
 * Returns:
 *   devices  – array of { deviceId, label } for kind === 'audiooutput'
 *   supported – boolean, false if setSinkId is not available in this browser
 */
export default function useAudioDevices() {
    const supported = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
    const [devices, setDevices] = useState([]);

    const enumerate = async () => {
        if (!supported || !navigator.mediaDevices?.enumerateDevices) return;
        try {
            const all = await navigator.mediaDevices.enumerateDevices();
            const outputs = all
                .filter(d => d.kind === 'audiooutput')
                .map(d => ({
                    deviceId: d.deviceId,
                    label: d.label || (d.deviceId === 'default' ? 'Default' : `Output ${d.deviceId.slice(0, 6)}…`),
                }));
            setDevices(outputs);
        } catch {
            setDevices([]);
        }
    };

    useEffect(() => {
        if (!supported) return;
        enumerate();
        navigator.mediaDevices.addEventListener('devicechange', enumerate);
        return () => navigator.mediaDevices.removeEventListener('devicechange', enumerate);
    }, []);

    return { devices, supported };
}
