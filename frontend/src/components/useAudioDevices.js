import { useState, useEffect, useCallback } from 'react';

/**
 * useAudioDevices — enumerate available audio output devices.
 * Re-runs automatically when the user plugs/unplugs a device.
 *
 * Returns:
 *   devices        – array of { deviceId, label } for kind === 'audiooutput'
 *   supported      – boolean, false if setSinkId is not available in this browser
 *   requestLabels  – call this to unlock real device names (triggers mic permission)
 */
export default function useAudioDevices() {
    const supported = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
    const [devices, setDevices] = useState([]);

    const enumerate = useCallback(async () => {
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
    }, [supported]);

    // Request mic permission briefly to unlock real device labels, then re-enumerate
    const requestLabels = useCallback(async () => {
        if (!supported) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            await enumerate();
        } catch {
            // Permission denied — enumerate anyway (may have generic names)
            await enumerate();
        }
    }, [supported, enumerate]);

    useEffect(() => {
        if (!supported || !navigator.mediaDevices) return;
        // Auto-request permission on mount so we get real device labels immediately
        requestLabels();
        navigator.mediaDevices.addEventListener('devicechange', enumerate);
        return () => navigator.mediaDevices.removeEventListener('devicechange', enumerate);
    }, [enumerate, requestLabels]);

    return { devices, supported, requestLabels };
}
