import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useProfile } from './ProfileContext';
import { useToast } from './ToastContext';

const LibraryContext = createContext();
import api from '../api';

export function LibraryProvider({ children }) {
    const { activeProfile, updateProfileConfig } = useProfile();
    const { addToast } = useToast();
    const [folders, setFolders] = useState([]);
    const [setlists, setSetlists] = useState([]);
    const [tracks, setTracks] = useState([]);
    const [downloadMode, setDownloadMode] = useState('youtube');
    
    // Track downloads & previous tracks globally
    const [downloadingTracks, setDownloadingTracks] = useState(new Set());
    const prevTracksRef = React.useRef([]);

    const setTrackDownloading = useCallback((trackId, isDownloading) => {
        setDownloadingTracks(prev => {
            const next = new Set(prev);
            if (isDownloading) next.add(trackId);
            else next.delete(trackId);
            return next;
        });
    }, []);

    const fetchLibraryData = useCallback(async (isSilentPoll = false) => {
        if (!activeProfile) return;
        try {
            const profileParam = `?profile_id=${activeProfile.id}`;
            const [foldersRes, setlistsRes, tracksRes] = await Promise.all([
                api.getFolders(activeProfile.id),
                api.getSetlists(activeProfile.id),
                api.getPlaylist(activeProfile.id)
            ]);

            if (foldersRes.ok) setFolders(await foldersRes.json());
            if (setlistsRes.ok) setSetlists(await setlistsRes.json());
            if (tracksRes.ok) {
                const rawTracks = await tracksRes.json();
                // Apply profile-specific category overrides
                const overrides = activeProfile?.config?.trackCategories || {};
                const newTracks = Object.keys(overrides).length
                    ? rawTracks.map(t => overrides[t.id] ? { ...t, category: overrides[t.id] } : t)
                    : rawTracks;
                const prev = prevTracksRef.current;

                if (prev.length > 0) {
                    // O(1) lookup instead of O(n) array.find per track
                    const prevMap = new Map(prev.map(t => [t.id, t]));
                    newTracks.forEach(nt => {
                        const ot = prevMap.get(nt.id);
                        if (ot) {
                            if (!ot.is_downloaded && nt.is_downloaded) {
                                addToast(`✅ Download completed: ${nt.title}`, 'success');
                                setTrackDownloading(nt.id, false);
                            } else if (ot.download_error !== nt.download_error && nt.download_error && nt.download_error !== 'downloading...') {
                                addToast(`❌ Download failed for ${nt.title}: ${nt.download_error}`, 'error');
                                setTrackDownloading(nt.id, false);
                            }
                        }
                    });
                }
                prevTracksRef.current = newTracks;
                setTracks(newTracks);

                // If this library poll discovered a state change from the background, we broadcast it
                if (isSilentPoll) {
                    window.dispatchEvent(new CustomEvent('playlist-updated'));
                }
            }
        } catch (err) {
            console.error("Failed to fetch library data", err);
        }
    }, [activeProfile, addToast, setTrackDownloading]);

    // Initial setup
    useEffect(() => {
        fetchLibraryData();
    }, [fetchLibraryData]);

    // Adaptive background poll: fast when downloads are active, slow when idle
    useEffect(() => {
        const delay = downloadingTracks.size > 0 ? 2000 : 30000;
        const interval = setInterval(() => {
            fetchLibraryData(true);
        }, delay);
        return () => clearInterval(interval);
    }, [fetchLibraryData, downloadingTracks.size]);

    // Actions
    const createFolder = async (name, parentId = null) => {
        const res = await api.createFolder({ name, parent_id: parentId, profile_id: activeProfile.id });
        if (res.ok) fetchLibraryData();
    };

    const updateFolder = async (id, updates) => {
        const folder = folders.find(f => f.id === id);
        if (!folder) return;

        // Optimistic
        setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));

        const res = await api.updateFolder(id, { ...folder, ...updates });
        if (!res.ok) fetchLibraryData();
    };

    const deleteFolder = async (id, action = 'archive') => {
        const res = await api.deleteFolder(id, action);
        if (res.ok) fetchLibraryData();
    };

    const updateSetlist = async (id, updates) => {
        const setlist = setlists.find(s => s.id === id);
        if (!setlist) return;

        // Optimistic update
        setSetlists(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

        const res = await api.updateSetlist(id, { ...setlist, ...updates });
        if (!res.ok) fetchLibraryData();
    };

    const createSetlist = async (name, folderId = null) => {
        const res = await api.createSetlist({ name, folder_id: folderId, profile_id: activeProfile.id });
        if (res.ok) fetchLibraryData();
    };

    const updateTrackCategory = async (trackId, newCategory) => {
        if (activeProfile && activeProfile.id !== 'master') {
            // Profile-specific: store override in profile config, don't touch global category
            const currentOverrides = activeProfile.config?.trackCategories || {};
            const newOverrides = { ...currentOverrides, [trackId]: newCategory };
            setTracks(prev => prev.map(t => t.id === trackId ? { ...t, category: newCategory } : t));
            await updateProfileConfig(activeProfile.id, { trackCategories: newOverrides });
        } else {
            setTracks(prev => prev.map(t => t.id === trackId ? { ...t, category: newCategory } : t));
            const res = await api.updateTrackCategory(trackId, newCategory);
            if (!res.ok) fetchLibraryData();
        }
    };

    const renameCategory = async (oldCategory, newCategory) => {
        if (activeProfile && activeProfile.id !== 'master') {
            // Profile-specific: rename only in the profile's overrides
            const currentOverrides = activeProfile.config?.trackCategories || {};
            const newOverrides = { ...currentOverrides };
            tracks.forEach(t => {
                const effectiveCat = currentOverrides[t.id] || t.category;
                if (effectiveCat === oldCategory || effectiveCat.startsWith(oldCategory + '/')) {
                    newOverrides[t.id] = effectiveCat.replace(oldCategory, newCategory);
                }
            });
            setTracks(prev => prev.map(t => {
                const effectiveCat = currentOverrides[t.id] || t.category;
                if (effectiveCat === oldCategory || effectiveCat.startsWith(oldCategory + '/')) {
                    return { ...t, category: effectiveCat.replace(oldCategory, newCategory) };
                }
                return t;
            }));
            await updateProfileConfig(activeProfile.id, { trackCategories: newOverrides });
        } else {
            setTracks(prev => prev.map(t => {
                if (t.category === oldCategory || t.category?.startsWith(oldCategory + "/")) {
                    return { ...t, category: t.category.replace(oldCategory, newCategory) };
                }
                return t;
            }));
            const res = await api.renameCategory({ old_category: oldCategory, new_category: newCategory });
            if (!res.ok) fetchLibraryData();
        }
    };

    const handleModeChange = useCallback(async (mode) => {
        try {
            const res = await api.setDownloadMode(mode);
            if (res.ok) {
                setDownloadMode(mode);
            }
        } catch (err) {
            console.error("Failed to change download mode", err);
        }
    }, []);

    const value = {
        folders,
        setlists,
        tracks,
        refreshLibrary: fetchLibraryData,
        createFolder,
        updateFolder,
        deleteFolder,
        updateSetlist,
        createSetlist,
        updateTrackCategory,
        renameCategory,
        downloadingTracks,
        setTrackDownloading,
        downloadMode,
        handleModeChange
    };

    return (
        <LibraryContext.Provider value={value}>
            {children}
        </LibraryContext.Provider>
    );
}

export const useLibrary = () => useContext(LibraryContext);
