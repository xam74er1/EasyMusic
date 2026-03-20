import React, { useState, useRef, useCallback } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, X, ListMusic, Play, GripVertical, FolderPlus, CheckCircle2 } from 'lucide-react';
import './SetlistPanel.css';

const API_BASE = 'http://localhost:8000/api';

export default function SetlistPanel({
    setlists,
    activeSetlistId,
    onSelectSetlist,
    onUpdateSetlist,
    onCreateSetlist,
    onDeleteSetlist,
    autoPlay,
    onAutoPlayToggle,
    playlist, // full track list for resolving IDs
    onLoadToDeck,
    currentPlayingId, // track currently playing on active deck
}) {
    const [newName, setNewName] = useState('');
    const [showNewInput, setShowNewInput] = useState(false);
    const [newSubName, setNewSubName] = useState('');
    const [showNewSub, setShowNewSub] = useState(false);
    const [dragIdx, setDragIdx] = useState(null);
    const [dragOverIdx, setDragOverIdx] = useState(null);
    const [dragSection, setDragSection] = useState(null); // 'main' or sublist id

    const activeSetlist = setlists.find(s => s.id === activeSetlistId);
    const trackMap = {};
    for (const t of playlist) trackMap[t.id] = t;

    // ─── CRUD helpers ────────────────────────────
    const handleCreate = () => {
        if (!newName.trim()) return;
        onCreateSetlist(newName.trim());
        setNewName('');
        setShowNewInput(false);
    };

    const handleAddSublist = () => {
        if (!activeSetlist || !newSubName.trim()) return;
        const sub = { id: '', name: newSubName.trim(), tracks: [] };
        const updated = { ...activeSetlist, sublists: [...activeSetlist.sublists, sub] };
        onUpdateSetlist(updated);
        setNewSubName('');
        setShowNewSub(false);
    };

    const removeTrack = (idx, section = 'main') => {
        if (!activeSetlist) return;
        if (section === 'main') {
            const tracks = [...activeSetlist.tracks];
            tracks.splice(idx, 1);
            onUpdateSetlist({ ...activeSetlist, tracks });
        } else {
            const sublists = activeSetlist.sublists.map(s => {
                if (s.id === section || s.name === section) {
                    const tracks = [...s.tracks];
                    tracks.splice(idx, 1);
                    return { ...s, tracks };
                }
                return s;
            });
            onUpdateSetlist({ ...activeSetlist, sublists });
        }
    };

    const clearAll = () => {
        if (!activeSetlist) return;
        const cleared = {
            ...activeSetlist,
            tracks: [],
            sublists: activeSetlist.sublists.map(s => ({ ...s, tracks: [] })),
        };
        onUpdateSetlist(cleared);
    };

    const moveTrack = (idx, direction, section = 'main') => {
        if (!activeSetlist) return;
        const swap = (arr, i, j) => { const copy = [...arr];[copy[i], copy[j]] = [copy[j], copy[i]]; return copy; };

        if (section === 'main') {
            const newIdx = idx + direction;
            if (newIdx < 0 || newIdx >= activeSetlist.tracks.length) return;
            onUpdateSetlist({ ...activeSetlist, tracks: swap(activeSetlist.tracks, idx, newIdx) });
        } else {
            const sublists = activeSetlist.sublists.map(s => {
                if (s.id === section || s.name === section) {
                    const newIdx = idx + direction;
                    if (newIdx < 0 || newIdx >= s.tracks.length) return s;
                    return { ...s, tracks: swap(s.tracks, idx, newIdx) };
                }
                return s;
            });
            onUpdateSetlist({ ...activeSetlist, sublists });
        }
    };

    const deleteSublist = (subId) => {
        if (!activeSetlist) return;
        const sublists = activeSetlist.sublists.filter(s => s.id !== subId);
        onUpdateSetlist({ ...activeSetlist, sublists });
    };

    // ─── Drag & Drop within setlist ────────────────────────
    const handleDragStart = (e, idx, section) => {
        setDragIdx(idx);
        setDragSection(section);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, idx) => {
        e.preventDefault();
        setDragOverIdx(idx);
    };

    const handleDrop = (e, dropIdx, section) => {
        e.preventDefault();
        if (dragIdx === null || dragSection !== section) { setDragIdx(null); setDragOverIdx(null); return; }

        if (section === 'main' && activeSetlist) {
            const tracks = [...activeSetlist.tracks];
            const [moved] = tracks.splice(dragIdx, 1);
            tracks.splice(dropIdx, 0, moved);
            onUpdateSetlist({ ...activeSetlist, tracks });
        } else if (activeSetlist) {
            const sublists = activeSetlist.sublists.map(s => {
                if (s.id === section) {
                    const tracks = [...s.tracks];
                    const [moved] = tracks.splice(dragIdx, 1);
                    tracks.splice(dropIdx, 0, moved);
                    return { ...s, tracks };
                }
                return s;
            });
            onUpdateSetlist({ ...activeSetlist, sublists });
        }

        setDragIdx(null);
        setDragOverIdx(null);
    };

    // ─── Drop from library (track ID in dataTransfer) ──────
    const handleExternalDrop = (e, section = 'main') => {
        e.preventDefault();
        const trackId = e.dataTransfer.getData('text/track-id');
        if (!trackId || !activeSetlist) return;

        if (section === 'main') {
            onUpdateSetlist({ ...activeSetlist, tracks: [...activeSetlist.tracks, trackId] });
        } else {
            const sublists = activeSetlist.sublists.map(s => {
                if (s.id === section) return { ...s, tracks: [...s.tracks, trackId] };
                return s;
            });
            onUpdateSetlist({ ...activeSetlist, sublists });
        }
    };

    // ─── Track Row ──────────────────────────────────────
    const TrackItem = ({ trackId, idx, section, total }) => {
        const track = trackMap[trackId];
        const isCurrent = trackId === currentPlayingId;
        if (!track) return (
            <div className="sl-track-row sl-missing">
                <span className="sl-num">{idx + 1}</span>
                <span style={{ opacity: 0.4, fontSize: '0.7rem' }}>Track not found</span>
                <button className="sl-remove-btn" onClick={() => removeTrack(idx, section)}><X size={12} /></button>
            </div>
        );

        return (
            <div
                className={`sl-track-row ${isCurrent ? 'sl-current' : ''} ${dragOverIdx === idx && dragSection === section ? 'sl-drop-target' : ''}`}
                draggable
                onDragStart={e => handleDragStart(e, idx, section)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={e => handleDrop(e, idx, section)}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
            >
                <span className="sl-drag-handle"><GripVertical size={12} /></span>
                <span className="sl-num">{idx + 1}</span>
                <img className="sl-thumb" src={track.thumbnail || '/music_placeholder.png'} alt="" />
                <div className="sl-info">
                    <div className="sl-title">{track.title}</div>
                    <div className="sl-author">{track.author}</div>
                </div>
                {isCurrent && <CheckCircle2 size={12} className="sl-playing-icon" />}
                <div className="sl-deck-btns">
                    <button className="load-to-deck deck-a-btn" onClick={() => onLoadToDeck('a', track, `${API_BASE}/play/${track.id}`)}>→ A</button>
                    <button className="load-to-deck deck-b-btn" onClick={() => onLoadToDeck('b', track, `${API_BASE}/play/${track.id}`)}>→ B</button>
                </div>
                <div className="sl-actions">
                    <button disabled={idx === 0} onClick={() => moveTrack(idx, -1, section)} title="Move Up"><ChevronUp size={12} /></button>
                    <button disabled={idx === total - 1} onClick={() => moveTrack(idx, 1, section)} title="Move Down"><ChevronDown size={12} /></button>
                    <button className="sl-remove-btn" onClick={() => removeTrack(idx, section)} title="Remove"><X size={12} /></button>
                </div>
            </div>
        );
    };

    return (
        <div className="setlist-panel">
            {/* Header */}
            <div className="sl-header">
                <ListMusic size={14} />
                <span className="sl-header-title">Setlists</span>
                <div className="sl-autoplay-toggle" onClick={onAutoPlayToggle} title={autoPlay ? 'Auto-play ON' : 'Auto-play OFF'}>
                    <Play size={10} fill={autoPlay ? 'currentColor' : 'none'} />
                    <span className={autoPlay ? 'on' : ''}>Auto</span>
                </div>
            </div>

            {/* Setlist selector */}
            <div className="sl-selector">
                <select
                    className="sl-select"
                    value={activeSetlistId || ''}
                    onChange={e => onSelectSetlist(e.target.value)}
                >
                    <option value="">— Select —</option>
                    {setlists.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.tracks.length + s.sublists.reduce((a, sub) => a + sub.tracks.length, 0)})</option>
                    ))}
                </select>
                <button className="sl-icon-btn" onClick={() => setShowNewInput(!showNewInput)} title="New Setlist"><Plus size={13} /></button>
                {activeSetlistId && (
                    <button className="sl-icon-btn sl-delete-btn" onClick={() => onDeleteSetlist(activeSetlistId)} title="Delete Setlist"><Trash2 size={13} /></button>
                )}
            </div>

            {showNewInput && (
                <div className="sl-new-row">
                    <input className="sl-new-input" placeholder="Setlist name..." value={newName} onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
                    <button className="sl-icon-btn" onClick={handleCreate}><Plus size={13} /></button>
                </div>
            )}

            {/* Body */}
            {activeSetlist ? (
                <div className="sl-body">
                    {/* Toolbar */}
                    <div className="sl-toolbar">
                        <span className="sl-section-label">Main List ({activeSetlist.tracks.length})</span>
                        <button className="sl-icon-btn" onClick={() => setShowNewSub(!showNewSub)} title="Add Section"><FolderPlus size={12} /></button>
                        <button className="sl-icon-btn sl-clear-btn" onClick={clearAll} title="Clear All"><Trash2 size={12} /> Clear</button>
                    </div>

                    {showNewSub && (
                        <div className="sl-new-row">
                            <input className="sl-new-input" placeholder="Section name..." value={newSubName} onChange={e => setNewSubName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddSublist()} autoFocus />
                            <button className="sl-icon-btn" onClick={handleAddSublist}><Plus size={13} /></button>
                        </div>
                    )}

                    {/* Main tracks */}
                    <div
                        className="sl-track-list"
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => handleExternalDrop(e, 'main')}
                    >
                        {activeSetlist.tracks.length === 0 && (
                            <div className="sl-empty">Drag tracks here or use + buttons in library</div>
                        )}
                        {activeSetlist.tracks.map((tid, idx) => (
                            <TrackItem key={`${tid}-${idx}`} trackId={tid} idx={idx} section="main" total={activeSetlist.tracks.length} />
                        ))}
                    </div>

                    {/* Sublists */}
                    {activeSetlist.sublists.map(sub => (
                        <div key={sub.id} className="sl-sublist">
                            <div className="sl-sublist-header">
                                <span className="sl-section-label">{sub.name} ({sub.tracks.length})</span>
                                <button className="sl-icon-btn sl-delete-btn" onClick={() => deleteSublist(sub.id)} title="Delete Section"><X size={12} /></button>
                            </div>
                            <div
                                className="sl-track-list"
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => handleExternalDrop(e, sub.id)}
                            >
                                {sub.tracks.length === 0 && (
                                    <div className="sl-empty">Drag tracks here</div>
                                )}
                                {sub.tracks.map((tid, idx) => (
                                    <TrackItem key={`${tid}-${idx}`} trackId={tid} idx={idx} section={sub.id} total={sub.tracks.length} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="sl-empty-state">
                    <ListMusic size={24} style={{ opacity: 0.2 }} />
                    <span>Select or create a setlist</span>
                </div>
            )}
        </div>
    );
}
