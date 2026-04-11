import React, { useState, useRef, useEffect } from 'react';
import { useProfile } from './ProfileContext';
import { User, ChevronDown, Plus, Settings, Pencil, Trash2, Crown, X, Check, Monitor, RefreshCw, Key, Activity } from 'lucide-react';
import './ProfileMenu.css';

export default function ProfileMenu() {
    const { profiles, activeProfile, switchProfile, createProfile, renameProfile, deleteProfile } = useProfile();
    const [open, setOpen] = useState(false);
    const [addMode, setAddMode] = useState(false);
    const [newName, setNewName] = useState('');
    const [settingsFor, setSettingsFor] = useState(null); // profile id
    const [renaming, setRenaming] = useState(null); // profile id being renamed
    const [renameValue, setRenameValue] = useState('');
    const menuRef = useRef(null);

    // Dynamic Port Management
    const isElectron = !!window.electronAPI;
    const initialPort = isElectron 
        ? (window.electronAPI.backendPort || 8000)
        : (parseInt(localStorage.getItem('preferredBackendPort'), 10) || 8000);
    
    const [portValue, setPortValue] = useState(initialPort);
    const [isRestarting, setIsRestarting] = useState(false);

    // Environment Variables State
    const [envVars, setEnvVars] = useState({});
    const [isLoadingEnv, setIsLoadingEnv] = useState(false);
    const [newEnvKey, setNewEnvKey] = useState('');
    const [newEnvValue, setNewEnvValue] = useState('');

    useEffect(() => {
        if (!isElectron) return;
        
        // Load initial env
        window.electronAPI.getBackendEnv().then(setEnvVars);

        // Update local state if the port is changed elsewhere (e.g. by another window)
        const cleanup = window.electronAPI.onBackendPortUpdated((newPort) => {
            setPortValue(newPort);
            setIsRestarting(false);
        });
        
        return cleanup;
    }, [isElectron]);

    const handleApplyEnv = async () => {
        if (!isElectron) return;
        try {
            setIsRestarting(true);
            await window.electronAPI.updateBackendEnv(envVars);
        } catch (err) {
            alert(`Failed to update environment: ${err.message}`);
            setIsRestarting(false);
        }
    };

    const addEnvVar = (key, value = '') => {
        if (!key) return;
        setEnvVars(prev => ({ ...prev, [key]: value }));
        setNewEnvKey('');
        setNewEnvValue('');
    };

    const removeEnvVar = (key) => {
        const next = { ...envVars };
        delete next[key];
        setEnvVars(next);
    };

    const updateEnvValue = (key, value) => {
        setEnvVars(prev => ({ ...prev, [key]: value }));
    };

    const handleApply = async () => {
        if (isElectron) {
            try {
                setIsRestarting(true);
                const result = await window.electronAPI.changeBackendPort(portValue);
                if (result.success) {
                    console.log(`[UI] Backend restarted on port ${result.port}`);
                }
            } catch (err) {
                alert(`Failed to restart backend: ${err.message}`);
                setIsRestarting(false);
            }
        } else {
            // Web mode: Just save to localStorage and alert
            localStorage.setItem('preferredBackendPort', portValue);
            alert('Port saved! Please refresh the page or restart your standalone backend to apply.');
        }
    };

    // Close dropdown on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpen(false);
                setAddMode(false);
                setSettingsFor(null);
                setRenaming(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleAddProfile = async () => {
        if (!newName.trim()) return;
        await createProfile(newName.trim());
        setNewName('');
        setAddMode(false);
    };

    const handleRename = async (id) => {
        if (!renameValue.trim()) return;
        await renameProfile(id, renameValue.trim());
        setRenaming(null);
        setRenameValue('');
    };

    const handleDelete = async (id) => {
        const del = confirm('Delete this profile? You can also delete its setlists.');
        if (!del) return;
        const delSetlists = confirm('Also delete all setlists belonging to this profile?');
        await deleteProfile(id, delSetlists);
        setSettingsFor(null);
    };

    const getInitials = (name) => {
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    };

    const getIconClass = (profile) => {
        if (profile.id === 'master') return 'master';
        if (profile.id === 'default') return 'default-profile';
        return 'custom';
    };

    if (!activeProfile) return null;

    return (
        <div className="profile-menu-wrapper" ref={menuRef}>
            <button className="profile-trigger" onClick={() => setOpen(!open)}>
                <User size={14} className="trigger-icon" />
                <span>{activeProfile.name}</span>
                <ChevronDown size={12} className={`trigger-arrow ${open ? 'open' : ''}`} />
            </button>

            {open && (
                <div className="profile-dropdown">
                    <div className="dropdown-header">Profiles</div>

                    <div className="profile-list">
                        {profiles.map(p => (
                            <div
                                key={p.id}
                                className={`profile-item ${activeProfile.id === p.id ? 'active' : ''}`}
                                onClick={() => {
                                    switchProfile(p.id);
                                    setOpen(false);
                                }}
                            >
                                <div className={`profile-icon ${getIconClass(p)}`}>
                                    {p.id === 'master' ? '★' : getInitials(p.name)}
                                </div>

                                {renaming === p.id ? (
                                    <form
                                        style={{ flex: 1, display: 'flex', gap: '4px' }}
                                        onSubmit={(e) => { e.preventDefault(); handleRename(p.id); }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            className="rename-input"
                                            autoFocus
                                            value={renameValue}
                                            onChange={e => setRenameValue(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Escape') { setRenaming(null); } }}
                                        />
                                        <button type="submit" className="settings-btn" style={{ opacity: 1, color: 'var(--success)' }}>
                                            <Check size={14} />
                                        </button>
                                    </form>
                                ) : (
                                    <span className="profile-name">{p.name}</span>
                                )}

                                {p.id === 'master' && <span className="master-badge">All</span>}

                                {p.id !== 'master' && p.id !== renaming && (
                                    <button
                                        className="settings-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSettingsFor(settingsFor === p.id ? null : p.id);
                                        }}
                                    >
                                        <Settings size={13} />
                                    </button>
                                )}

                                {settingsFor === p.id && (
                                    <div className="profile-settings-popover" onClick={e => e.stopPropagation()}>
                                        <button
                                            className="settings-action"
                                            onClick={() => {
                                                setRenaming(p.id);
                                                setRenameValue(p.name);
                                                setSettingsFor(null);
                                            }}
                                        >
                                            <Pencil size={13} /> Rename
                                        </button>
                                        {p.id !== 'default' && (
                                            <button
                                                className="settings-action danger"
                                                onClick={() => handleDelete(p.id)}
                                            >
                                                <Trash2 size={13} /> Delete
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="add-profile-section">
                        {addMode ? (
                            <form
                                className="add-profile-form"
                                onSubmit={(e) => { e.preventDefault(); handleAddProfile(); }}
                            >
                                <input
                                    autoFocus
                                    placeholder="Profile name..."
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Escape') setAddMode(false); }}
                                />
                                <button type="submit" className="submit-btn">Add</button>
                                <button type="button" className="cancel-btn" onClick={() => setAddMode(false)}>
                                    <X size={12} />
                                </button>
                            </form>
                        ) : (
                            <button className="add-profile-btn" onClick={() => setAddMode(true)}>
                                <Plus size={15} /> Add New Profile
                            </button>
                        )}
                    </div>

                    <div className="system-settings-section">
                        <div className="system-settings-header">
                            <Monitor size={12} className="header-icon" />
                            <span>System Settings</span>
                        </div>
                        
                        <div className="port-config">
                            <div className="port-input-wrapper">
                                <span className="port-label">Backend Port:</span>
                                <input 
                                    type="number" 
                                    className="port-input"
                                    value={portValue}
                                    onChange={(e) => setPortValue(e.target.value)}
                                    disabled={isRestarting}
                                />
                            </div>
                            <button 
                                className={`restart-btn ${isRestarting ? 'restarting' : ''}`}
                                onClick={handleApply}
                                disabled={isRestarting || !portValue}
                            >
                                <RefreshCw size={12} className={isRestarting ? 'spin' : ''} />
                                {isRestarting 
                                    ? 'Restarting Backend...' 
                                    : (isElectron ? 'Apply & Restart Backend' : 'Save Backend Port')}
                            </button>
                        </div>

                        {isElectron && (
                            <div className="env-config">
                                <div className="system-settings-header env-header">
                                    <Key size={12} className="header-icon" />
                                    <span>Backend Environment</span>
                                </div>
                                <div className="env-list">
                                    {Object.entries(envVars).map(([key, value]) => (
                                        <div key={key} className="env-item">
                                            <div className="env-key">{key}</div>
                                            <input 
                                                type={key.includes('KEY') ? 'password' : 'text'}
                                                className="env-input"
                                                value={value}
                                                onChange={(e) => updateEnvValue(key, e.target.value)}
                                                placeholder="Value..."
                                            />
                                            <button className="env-del" onClick={() => removeEnvVar(key)}><X size={10} /></button>
                                        </div>
                                    ))}
                                    
                                    <div className="env-add-row">
                                        <input 
                                            placeholder="NEW_VAR" 
                                            className="env-add-key"
                                            value={newEnvKey}
                                            onChange={e => setNewEnvKey(e.target.value)}
                                        />
                                        <input 
                                            placeholder="Value..." 
                                            className="env-add-val"
                                            value={newEnvValue}
                                            onChange={e => setNewEnvValue(e.target.value)}
                                        />
                                        <button className="env-add-btn" onClick={() => addEnvVar(newEnvKey, newEnvValue)}><Plus size={12} /></button>
                                    </div>
                                </div>

                                <div className="env-presets">
                                    <button onClick={() => addEnvVar('GEMINI_API_KEY')}>+ Gemini</button>
                                    <button onClick={() => addEnvVar('PIXABAY_API_KEY')}>+ Pixabay</button>
                                </div>

                                <button 
                                    className={`restart-btn ${isRestarting ? 'restarting' : ''}`}
                                    onClick={handleApplyEnv}
                                    disabled={isRestarting}
                                >
                                    <Activity size={12} className={isRestarting ? 'spin' : ''} />
                                    {isRestarting ? 'Restarting...' : 'Save & Apply Keys'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
