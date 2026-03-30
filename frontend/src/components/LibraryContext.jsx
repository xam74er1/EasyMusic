import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useProfile } from './ProfileContext';
import { useToast } from './ToastContext';

const LibraryContext = createContext();
import api from '../api';

export function LibraryProvider({ children }) {
    const { activeProfile } = useProfile();
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
                const newTracks = await tracksRes.json();
                const prev = prevTracksRef.current;
                
                // Compare with previous array to check for completed/failed tracks globally!
                if (prev.length > 0) {
                    newTracks.forEach(nt => {
                        const ot = prev.find(t => t.id === nt.id);
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

    // Background poll for detecting downloads globally
    useEffect(() => {
        const interval = setInterval(() => {
            fetchLibraryData(true);
        }, 3000); // 3-second poll for snappy UX
        return () => clearInterval(interval);
    }, [fetchLibraryData]);

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
        // Optimistic
        setTracks(prev => prev.map(t => t.id === trackId ? { ...t, category: newCategory } : t));

        const res = await api.updateTrackCategory(trackId, newCategory);
        if (!res.ok) fetchLibraryData();
    };

    const renameCategory = async (oldCategory, newCategory) => {
        // Optimistic
        setTracks(prev => prev.map(t => {
            if (t.category === oldCategory || t.category.startsWith(oldCategory + "/")) {
                const updatedCat = t.category.replace(oldCategory, newCategory);
                return { ...t, category: updatedCat };
            }
            return t;
        }));

        const res = await api.renameCategory({ old_category: oldCategory, new_category: newCategory });
        if (!res.ok) fetchLibraryData();
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
