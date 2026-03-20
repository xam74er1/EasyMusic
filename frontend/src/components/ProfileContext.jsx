import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import api from '../api';

const ProfileContext = createContext(null);

export function useProfile() {
    const ctx = useContext(ProfileContext);
    if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
    return ctx;
}

export function ProfileProvider({ children }) {
    const [profiles, setProfiles] = useState([]);
    const [activeProfile, setActiveProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProfiles = useCallback(async () => {
        try {
            const res = await api.getProfiles();
            const data = await res.json();
            setProfiles(data.profiles || []);
            // Set active profile from last_profile_id
            const lastId = data.last_profile_id || 'default';
            const found = (data.profiles || []).find(p => p.id === lastId);
            setActiveProfile(found || data.profiles?.[0] || null);
        } catch (err) {
            console.error('Failed to fetch profiles:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    const switchProfile = useCallback(async (profileId) => {
        try {
            await api.switchProfile(profileId);
            const found = profiles.find(p => p.id === profileId);
            if (found) setActiveProfile(found);
        } catch (err) {
            console.error('Failed to switch profile:', err);
        }
    }, [profiles]);

    const createProfile = useCallback(async (name) => {
        try {
            const res = await api.createProfile({ name, config: {} });
            const created = await res.json();
            setProfiles(prev => [...prev, created]);
            // Auto-switch to new profile
            await api.switchProfile(created.id);
            setActiveProfile(created);
            return created;
        } catch (err) {
            console.error('Failed to create profile:', err);
            return null;
        }
    }, []);

    const renameProfile = useCallback(async (profileId, newName) => {
        const profile = profiles.find(p => p.id === profileId);
        if (!profile) return;
        try {
            const updated = { ...profile, name: newName };
            const res = await api.renameProfile(profileId, updated);
            const saved = await res.json();
            setProfiles(prev => prev.map(p => p.id === profileId ? saved : p));
            if (activeProfile?.id === profileId) setActiveProfile(saved);
        } catch (err) {
            console.error('Failed to rename profile:', err);
        }
    }, [profiles, activeProfile]);

    const updateProfileConfig = useCallback(async (profileId, newConfig) => {
        const profile = profiles.find(p => p.id === profileId);
        if (!profile) return;
        try {
            const updated = { ...profile, config: { ...profile.config, ...newConfig } };
            const res = await api.updateProfileConfig(profileId, updated);
            const saved = await res.json();
            setProfiles(prev => prev.map(p => p.id === profileId ? saved : p));
            if (activeProfile?.id === profileId) setActiveProfile(saved);
        } catch (err) {
            console.error('Failed to update profile config:', err);
        }
    }, [profiles, activeProfile]);

    const deleteProfile = useCallback(async (profileId, deleteSetlists = false) => {
        try {
            await api.deleteProfile(profileId, deleteSetlists);
            setProfiles(prev => prev.filter(p => p.id !== profileId));
            if (activeProfile?.id === profileId) {
                const defaultP = profiles.find(p => p.id === 'default');
                setActiveProfile(defaultP || profiles[0] || null);
                if (defaultP) {
                    await api.switchProfile(defaultP.id);
                }
            }
        } catch (err) {
            console.error('Failed to delete profile:', err);
        }
    }, [profiles, activeProfile]);

    const value = {
        profiles,
        activeProfile,
        loading,
        switchProfile,
        createProfile,
        renameProfile,
        updateProfileConfig,
        deleteProfile,
        refreshProfiles: fetchProfiles,
    };

    return (
        <ProfileContext.Provider value={value}>
            {children}
        </ProfileContext.Provider>
    );
}
