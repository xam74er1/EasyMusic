import React, { useState, useRef, useEffect } from 'react';
import { useProfile } from './ProfileContext';
import { User, ChevronDown, Plus, Settings, Pencil, Trash2, Crown, X, Check } from 'lucide-react';
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
                </div>
            )}
        </div>
    );
}
