import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useProfile } from '../ProfileContext';
import DJLibrary from './DJLibrary';
import { Edit2, LayoutGrid, Play, Square, Music, Plus, Trash2, Check, X } from 'lucide-react';
import './SimplifiedDJ.css';

import api from '../../api';

const DEFAULT_LAYOUT = [
    {
        id: 'entre',
        title: 'Entre',
        buttons: [
            { id: 'equipe1', label: 'Musique equipe 1', color: 'hsl(340, 75%, 60%)' },
            { id: 'equipe2', label: 'Musique equipe 2', color: 'hsl(300, 75%, 60%)' },
            { id: 'mc', label: 'Musique MC', color: 'hsl(260, 75%, 60%)' },
            { id: 'arbitre', label: 'Musique Arbitre', color: 'hsl(220, 75%, 60%)' },
        ]
    },
    {
        id: 'engine',
        title: 'Engine',
        buttons: [
            { id: 'engine1', label: 'Musique engine 1', color: 'hsl(180, 75%, 50%)' },
            { id: 'engine2', label: 'Musique engine 2', color: 'hsl(140, 75%, 50%)' },
            { id: 'engine3', label: 'Musique engine 3', color: 'hsl(100, 75%, 50%)' },
            { id: 'engine4', label: 'Musique engine 4', color: 'hsl(60, 75%, 50%)' },
            { id: 'engine5', label: 'Musique engine 5', color: 'hsl(20, 75%, 60%)' },
        ]
    },
    {
        id: 'autre',
        title: 'Autre',
        buttons: [
            { id: 'ascenseur', label: 'Musique ascenseur', color: 'hsl(0, 0%, 60%)' },
            { id: 'eyeoftiger', label: 'Musique eye of the tiger', color: 'hsl(40, 90%, 55%)' },
        ]
    }
];

const getRandomColor = () => `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`;
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function SimplifiedDJ({ playlist }) {
    const { activeProfile, updateProfileConfig } = useProfile();
    const [editMode, setEditMode] = useState(false);
    const [playingState, setPlayingState] = useState({});
    const [dragOverId, setDragOverId] = useState(null);
    const audioRefs = useRef({});

    const [editingSectionId, setEditingSectionId] = useState(null);
    const [editingSectionTitle, setEditingSectionTitle] = useState('');
    const [editingButtonId, setEditingButtonId] = useState(null);
    const [editingButtonLabel, setEditingButtonLabel] = useState('');

    const djPlaylist = useMemo(() => playlist.filter(t => t.is_downloaded), [playlist]);
    const noOpLoadToDeck = useCallback(() => {}, []);
    const configMap = activeProfile?.config?.simplifiedDjMap || {};
    const layout = activeProfile?.config?.simplifiedDjLayout || DEFAULT_LAYOUT;

    const handleUpdateConfig = (newMap, newLayout) => {
        if (activeProfile) {
            updateProfileConfig(activeProfile.id, {
                simplifiedDjMap: newMap || configMap,
                simplifiedDjLayout: newLayout || layout
            });
        }
    };

    // ----- Drop / Drag Logic -----
    const handleDrop = (e, buttonId) => {
        e.preventDefault();
        setDragOverId(null);
        if (!editMode) return;

        const trackId = e.dataTransfer.getData('text/track-id');
        if (trackId) {
            const newMap = { ...configMap, [buttonId]: trackId };
            handleUpdateConfig(newMap, layout);
        }
    };

    const handleDragOver = (e, buttonId) => {
        e.preventDefault();
        if (editMode && dragOverId !== buttonId) {
            setDragOverId(buttonId);
        }
    };

    const handleDragLeave = (e, buttonId) => {
        e.preventDefault();
        if (dragOverId === buttonId) {
            setDragOverId(null);
        }
    };

    // ----- Playback Logic -----
    const togglePlay = (buttonId, trackId) => {
        if (!trackId) return;

        if (playingState[buttonId]) {
            const audio = audioRefs.current[buttonId];
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
            setPlayingState(prev => ({ ...prev, [buttonId]: false }));
            return;
        }

        const audioUrl = api.getPlayUrl(trackId);

        let audio = audioRefs.current[buttonId];
        if (!audio) {
            audio = new Audio(audioUrl);
            audio.crossOrigin = 'anonymous';
            audioRefs.current[buttonId] = audio;

            audio.addEventListener('ended', () => {
                setPlayingState(prev => ({ ...prev, [buttonId]: false }));
            });
            audio.addEventListener('pause', () => {
                setPlayingState(prev => ({ ...prev, [buttonId]: false }));
            });
        }

        if (!audio.src.includes(trackId)) {
            audio.src = audioUrl;
            audio.load();
        }

        audio.play().catch(err => console.warn('Play error:', err));
        setPlayingState(prev => ({ ...prev, [buttonId]: true }));
    };

    const getTrackInfo = (trackId) => djPlaylist.find(t => t.id === trackId);

    // ----- Editing Structure Logic -----
    const addSection = () => {
        const newLayout = [...layout, { id: generateId(), title: 'New Category', buttons: [] }];
        handleUpdateConfig(configMap, newLayout);
    };

    const removeSection = (sectionId) => {
        if (!confirm('Are you sure you want to delete this category?')) return;
        const newLayout = layout.filter(s => s.id !== sectionId);
        handleUpdateConfig(configMap, newLayout);
    };

    const saveSectionTitle = (sectionId) => {
        if (!editingSectionTitle.trim()) return;
        const newLayout = layout.map(s => s.id === sectionId ? { ...s, title: editingSectionTitle } : s);
        handleUpdateConfig(configMap, newLayout);
        setEditingSectionId(null);
    };

    const addButton = (sectionId) => {
        const newLayout = layout.map(s => {
            if (s.id === sectionId) {
                return { ...s, buttons: [...s.buttons, { id: 'btn_' + generateId(), label: 'New Button', color: getRandomColor() }] };
            }
            return s;
        });
        handleUpdateConfig(configMap, newLayout);
    };

    const removeButton = (sectionId, buttonId) => {
        if (!confirm('Are you sure you want to delete this button?')) return;
        const newLayout = layout.map(s => {
            if (s.id === sectionId) {
                return { ...s, buttons: s.buttons.filter(b => b.id !== buttonId) };
            }
            return s;
        });
        const newMap = { ...configMap };
        delete newMap[buttonId];
        handleUpdateConfig(newMap, newLayout);
    };

    const saveButtonLabel = (sectionId, buttonId) => {
        if (!editingButtonLabel.trim()) return;
        const newLayout = layout.map(s => {
            if (s.id === sectionId) {
                return { ...s, buttons: s.buttons.map(b => b.id === buttonId ? { ...b, label: editingButtonLabel } : b) };
            }
            return s;
        });
        handleUpdateConfig(configMap, newLayout);
        setEditingButtonId(null);
    };

    useEffect(() => {
        return () => {
            Object.values(audioRefs.current).forEach(audio => {
                audio.pause();
                audio.src = '';
            });
        };
    }, []);

    return (
        <div className="simple-dj-root">
            <div className="simple-dj-main">
                <div className="simple-dj-header">
                    <div className="simple-dj-title">
                        <LayoutGrid size={32} />
                        Simplified DJ
                    </div>
                    <button
                        className={`simple-dj-edit-btn ${editMode ? 'active' : ''}`}
                        onClick={() => setEditMode(!editMode)}
                    >
                        <Edit2 size={18} />
                        {editMode ? 'Done Editing' : 'Edit Mode'}
                    </button>
                </div>

                {layout.map(section => (
                    <div key={section.id} className="simple-dj-section">
                        <div className="simple-dj-section-header">
                            {editingSectionId === section.id ? (
                                <div className="sdj-edit-inline">
                                    <input
                                        autoFocus
                                        value={editingSectionTitle}
                                        onChange={e => setEditingSectionTitle(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && saveSectionTitle(section.id)}
                                    />
                                    <button onClick={() => saveSectionTitle(section.id)} className="sdj-icon-btn text-green"><Check size={16} /></button>
                                    <button onClick={() => setEditingSectionId(null)} className="sdj-icon-btn text-red"><X size={16} /></button>
                                </div>
                            ) : (
                                <div className="simple-dj-section-title">
                                    {section.title}
                                    {editMode && (
                                        <div className="sdj-section-actions">
                                            <button onClick={() => { setEditingSectionTitle(section.title); setEditingSectionId(section.id); }} className="sdj-icon-btn"><Edit2 size={14} /></button>
                                            <button onClick={() => removeSection(section.id)} className="sdj-icon-btn text-red"><Trash2 size={14} /></button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="simple-dj-grid">
                            {section.buttons.map(btn => {
                                const trackId = configMap[btn.id];
                                const track = trackId ? getTrackInfo(trackId) : null;
                                const isPlaying = playingState[btn.id];
                                const isEmpty = !track;
                                const isDragOver = dragOverId === btn.id;

                                // Inline edit button label
                                if (editingButtonId === btn.id && editMode) {
                                    return (
                                        <div key={btn.id} className="simple-dj-btn sdj-btn-editing">
                                            <input
                                                autoFocus
                                                value={editingButtonLabel}
                                                onChange={e => setEditingButtonLabel(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && saveButtonLabel(section.id, btn.id)}
                                                className="sdj-btn-input"
                                            />
                                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                                <button onClick={() => saveButtonLabel(section.id, btn.id)} className="sdj-icon-btn text-green"><Check size={16} /></button>
                                                <button onClick={() => setEditingButtonId(null)} className="sdj-icon-btn text-red"><X size={16} /></button>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={btn.id}
                                        className={`simple-dj-btn ${isEmpty ? 'empty' : ''} ${isPlaying ? 'playing' : ''} ${isDragOver ? 'sdj-drag-over' : ''}`}
                                        onClick={() => !editMode && togglePlay(btn.id, trackId)}
                                        onDragOver={(e) => handleDragOver(e, btn.id)}
                                        onDragLeave={(e) => handleDragLeave(e, btn.id)}
                                        onDrop={(e) => editMode && handleDrop(e, btn.id)}
                                        style={{
                                            cursor: editMode ? 'auto' : 'pointer',
                                            '--btn-color': btn.color
                                        }}
                                    >
                                        {editMode && (
                                            <div className="sdj-btn-actions">
                                                <button onClick={() => { setEditingButtonLabel(btn.label); setEditingButtonId(btn.id); }} className="sdj-icon-btn bg-dark"><Edit2 size={12} /></button>
                                                <button onClick={() => removeButton(section.id, btn.id)} className="sdj-icon-btn bg-dark text-red" style={{ marginLeft: 4 }}><Trash2 size={12} /></button>
                                                {trackId && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); const m = { ...configMap }; delete m[btn.id]; handleUpdateConfig(m, layout); }}
                                                        className="sdj-icon-btn bg-dark text-yellow"
                                                        title="Remove Track"
                                                        style={{ marginLeft: 4 }}>
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        <div className="simple-dj-btn-icon" style={{ color: isPlaying ? btn.color : undefined }}>
                                            {isPlaying ? <Music /> : isEmpty ? <Square /> : <Play fill="currentColor" />}
                                        </div>
                                        <div className="simple-dj-btn-label">
                                            {btn.label}
                                        </div>
                                        {track && (
                                            <div className="simple-dj-track-name" title={`${track.title} ${track.author ? `- ${track.author}` : ''}`}>
                                                {track.title} {track.author ? `- ${track.author}` : ''}
                                            </div>
                                        )}
                                        {isEmpty && editMode && (
                                            <div className="simple-dj-track-name" style={{ fontStyle: 'italic', marginTop: 4, opacity: 0.8 }}>
                                                Drop track here
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {editMode && (
                                <div className="simple-dj-btn sdj-add-btn" onClick={() => addButton(section.id)}>
                                    <div className="simple-dj-btn-icon"><Plus size={24} /></div>
                                    <div className="simple-dj-btn-label">Add Button</div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {editMode && (
                    <button className="sdj-add-section-btn" onClick={addSection}>
                        <Plus size={20} /> Add Category
                    </button>
                )}
            </div>

            {editMode && (
                <div className="simple-dj-library-pane">
                    <DJLibrary
                        playlist={djPlaylist}
                        onLoadToDeck={noOpLoadToDeck}
                        showAddToSetlist={false}
                    />
                </div>
            )}
        </div>
    );
}
