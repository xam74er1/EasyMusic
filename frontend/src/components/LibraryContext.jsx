import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useProfile } from './ProfileContext';

const LibraryContext = createContext();
import api from '../api';

export function LibraryProvider({ children }) {
    const { activeProfile } = useProfile();
    const [folders, setFolders] = useState([]);
    const [setlists, setSetlists] = useState([]);
    const [tracks, setTracks] = useState([]);

    const fetchLibraryData = useCallback(async () => {
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
            if (tracksRes.ok) setTracks(await tracksRes.json());
        } catch (err) {
            console.error("Failed to fetch library data", err);
        }
    }, [activeProfile]);

    useEffect(() => {
        fetchLibraryData();
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

    const [downloadingTracks, setDownloadingTracks] = useState(new Set());

    const setTrackDownloading = useCallback((trackId, isDownloading) => {
        setDownloadingTracks(prev => {
            const next = new Set(prev);
            if (isDownloading) next.add(trackId);
            else next.delete(trackId);
            return next;
        });
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
        setTrackDownloading
    };

    return (
        <LibraryContext.Provider value={value}>
            {children}
        </LibraryContext.Provider>
    );
}

export const useLibrary = () => useContext(LibraryContext);
