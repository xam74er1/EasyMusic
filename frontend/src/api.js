// Automatically detect the server's IP address based on the browser's URL
export const API_HOST = import.meta.env.VITE_API_HOST || `${window.location.protocol}//${window.location.hostname}:8082`;
export const API_BASE = `${API_HOST}/api`;

export const api = {
    // Media URLs
    getPlayUrl: (id) => `${API_BASE}/play/${id}`,
    getStreamUrl: (id) => `${API_BASE}/stream/${id}`,
    getSoundEffectPlayUrl: (id) => `${API_BASE}/sound-effects/play/${id}`,
    getDownloadFileUrl: (id) => `${API_BASE}/download/file/${id}`,
    getZipDownloadUrl: (flat, profileId, folderId) => {
        let url = `${API_HOST}/api/download/zip?flat=${flat}`;
        if (profileId) url += `&profile_id=${encodeURIComponent(profileId)}`;
        if (folderId) url += `&folder_id=${encodeURIComponent(folderId)}`;
        return url;
    },

    // Profiles
    getProfiles: () => fetch(`${API_BASE}/profiles`),
    switchProfile: (id) => fetch(`${API_BASE}/profiles/switch/${id}`, { method: 'POST' }),
    createProfile: (data) => fetch(`${API_BASE}/profiles`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(data) 
    }),
    renameProfile: (id, data) => fetch(`${API_BASE}/profiles/${id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(data) 
    }),
    updateProfileConfig: (id, data) => fetch(`${API_BASE}/profiles/${id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(data) 
    }),
    deleteProfile: (id, deleteSetlists) => fetch(`${API_BASE}/profiles/${id}?delete_setlists=${deleteSetlists}`, { method: 'DELETE' }),

    // Library Context
    getFolders: (profileId) => fetch(`${API_BASE}/folders${profileId ? `?profile_id=${profileId}` : ''}`),
    getSetlists: (profileId) => fetch(`${API_BASE}/setlists${profileId ? `?profile_id=${profileId}` : ''}`),
    getPlaylist: (profileId) => fetch(`${API_BASE}/playlist${profileId ? `?profile_id=${profileId}` : ''}`),
    getTrack: (id) => fetch(`${API_BASE}/playlist/${id}`),
    
    createFolder: (data) => fetch(`${API_BASE}/folders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }),
    updateFolder: (id, data) => fetch(`${API_BASE}/folders/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }),
    deleteFolder: (id, action) => fetch(`${API_BASE}/folders/${id}?action=${action}`, { method: 'DELETE' }),

    updateSetlist: (id, data) => fetch(`${API_BASE}/setlists/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }),
    createSetlist: (data) => fetch(`${API_BASE}/setlists`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }),
    deleteSetlist: (id) => fetch(`${API_BASE}/setlists/${id}`, { method: 'DELETE' }),

    // Sound Effects
    getSoundEffects: () => fetch(`${API_BASE}/sound-effects`),
    searchSoundEffects: (query, source) => fetch(`${API_BASE}/sound-effects/search${source === 'youtube' ? '/youtube' : ''}?q=${encodeURIComponent(query)}`),
    previewYoutubeSfx: (videoId) => fetch(`${API_BASE}/sound-effects/preview/youtube?video_id=${videoId}`),
    downloadYoutubeSfx: (videoId, name) => fetch(`${API_BASE}/sound-effects/download/youtube?video_id=${encodeURIComponent(videoId)}&name=${encodeURIComponent(name)}`, { method: 'POST' }),
    downloadUrlSfx: (url, name) => {
        let qs = `?url=${encodeURIComponent(url)}`;
        if (name) qs += `&name=${encodeURIComponent(name)}`;
        return fetch(`${API_BASE}/sound-effects/download${qs}`, { method: 'POST' });
    },
    deleteSoundEffect: (id) => fetch(`${API_BASE}/sound-effects/${id}`, { method: 'DELETE' }),
    updateSoundEffect: (id, data) => fetch(`${API_BASE}/sound-effects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),

    updateTrackCategory: (id, newCategory) => fetch(`${API_BASE}/playlist/${id}/category?category=${encodeURIComponent(newCategory)}`, { method: 'PUT' }),
    renameCategory: (data) => fetch(`${API_BASE}/playlist/category`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }),
    deleteTrack: (id) => fetch(`${API_BASE}/playlist/${id}`, { method: 'DELETE' }),
    updateTrack: (id, data) => fetch(`${API_BASE}/playlist/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }),

    // Audio / Sync
    syncTrack: (id) => fetch(`${API_BASE}/playlist/${id}/sync`, { method: 'POST' }),
    downloadTrack: (id, overwrite) => fetch(`${API_BASE}/download/${id}?overwrite=${overwrite}`, { method: 'POST' }),
    downloadBatch: () => fetch(`${API_BASE}/download/batch`, { method: 'POST' }),
    scanAudio: () => fetch(`${API_BASE}/scan-audio`, { method: 'POST' }),

    // Chatbot
    chat: (data) => fetch(`${API_BASE}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }),
    libraryReorganize: (data) => fetch(`${API_BASE}/library/reorganize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }),
    libraryUndo: () => fetch(`${API_BASE}/library/undo`, { method: 'POST' }),

    // Import
    importAnalyze: (formData, useAI) => fetch(`${API_BASE}/import/analyze?use_ai=${useAI}`, { method: 'POST', body: formData }),
    importConfirm: (data) => fetch(`${API_BASE}/import/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }),
    importLegacy: (formData) => fetch(`${API_BASE}/import`, { method: 'POST', body: formData }),
};

export default api;
