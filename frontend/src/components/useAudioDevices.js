import { useState, useEffect, useCallback, useRef } from 'react';

export default function useAudioDevices() {
    const supported = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
    const [devices, setDevices] = useState([]);
    // Prevent concurrent getUserMedia calls (e.g. multiple hook instances or rapid devicechange)
    const labelsRequestedRef = useRef(false);

    const enumerate = useCallback(async () => {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        try {
            const all = await navigator.mediaDevices.enumerateDevices();
            const outputs = all
                .filter(d => d.kind === 'audiooutput')
                .map(d => {
                    let label = d.label;
                    if (!label) {
                        if (d.deviceId === 'default') label = 'System Default';
                        else if (d.deviceId === 'communications') label = 'Communications Default';
                        else label = `Output ${d.deviceId.slice(0, 8)}…`;
                    }
                    return { deviceId: d.deviceId, label };
                });
            setDevices(outputs);
        } catch {
            setDevices([]);
        }
    }, []);

    // Request mic permission briefly so Chrome unlocks real device labels, then re-enumerate.
    // Chrome needs ~150 ms after stream.stop() before the device list is updated.
    const requestLabels = useCallback(async () => {
        if (!supported || labelsRequestedRef.current) return;
        labelsRequestedRef.current = true;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            // Wait for Chrome to refresh its internal device list
            await new Promise(r => setTimeout(r, 150));
            await enumerate();
        } catch {
            // Permission denied — enumerate with whatever names are available
            await enumerate();
        } finally {
            labelsRequestedRef.current = false;
        }
    }, [supported, enumerate]);

    useEffect(() => {
        if (!supported || !navigator.mediaDevices) return;
        // Initial enumeration with label unlock
        requestLabels();
        // On device plug/unplug, re-request labels so new devices get real names
        navigator.mediaDevices.addEventListener('devicechange', requestLabels);
        return () => navigator.mediaDevices.removeEventListener('devicechange', requestLabels);
    }, [supported, requestLabels]);

    return { devices, supported, requestLabels };
}
