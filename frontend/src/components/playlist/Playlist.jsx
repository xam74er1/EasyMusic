import React, { useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import EditModal from './EditModal';
import CustomAudioPlayer from './CustomAudioPlayer';
import { Pencil, Download, Trash2, Search, LayoutGrid, List as ListIcon, RefreshCw, Maximize2, X, Loader2 } from 'lucide-react';
import ShinyText from '../reactbits/ShinyText';
import { useToast } from '../ToastContext';
import { useLibrary } from '../LibraryContext';
import './Playlist.css';

const API_BASE = 'http://localhost:8000/api';

export default function Playlist({ playlist, onUpdate }) {
    const [filterCat, setFilterCat] = useState('All');
    const [filterSpeed, setFilterSpeed] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingVideo, setEditingVideo] = useState(null);
    const [fullscreenTrack, setFullscreenTrack] = useState(null);
    const [viewMode, setViewMode] = useState('list');
    const { addToast } = useToast();
    const { downloadingTracks, setTrackDownloading } = useLibrary();

    const [highlightNewOn, setHighlightNewOn] = useState(false);

    React.useEffect(() => {
        const handleHighlight = () => {
            setHighlightNewOn(true);
            setFilterCat('All');
            setFilterSpeed('All');
            setSearchQuery('');
        };
        window.addEventListener('highlight-new', handleHighlight);
        return () => window.removeEventListener('highlight-new', handleHighlight);
    }, []);

    const categories = ['All', ...new Set(playlist.map(v => v.category))];
    const speeds = ['All', ...new Set(playlist.map(v => v.speed))];

    let filtered = playlist.filter(v => {
        if (filterCat !== 'All' && v.category !== filterCat) return false;
        if (filterSpeed !== 'All' && v.speed !== filterSpeed) return false;
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            const titleMatch = v.title?.toLowerCase().includes(query);
            const authorMatch = v.author?.toLowerCase().includes(query);
            const tagMatch = v.tags?.some(t => t.toLowerCase().includes(query));
            if (!titleMatch && !authorMatch && !tagMatch) return false;
        }
        return true;
    });

    if (highlightNewOn) {
        filtered = filtered.filter(t => {
            if (!t.added_at) return false;
            const addedAt = new Date(t.added_at);
            return (new Date() - addedAt) < 24 * 60 * 60 * 1000;
        });
    }

    // Sort by added_at descending by default
    filtered.sort((a, b) => {
        const dateA = a.added_at ? new Date(a.added_at).getTime() : 0;
        const dateB = b.added_at ? new Date(b.added_at).getTime() : 0;
        return dateB - dateA; // Descending
    });

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this track?")) return;
        try {
            await fetch(`${API_BASE}/playlist/${id}`, { method: 'DELETE' });
            onUpdate();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDownload = async (id, overwrite = false) => {
        setTrackDownloading(id, true);
        try {
            const res = await fetch(`${API_BASE}/download/${id}?overwrite=${overwrite}`, { method: 'POST' });

            if (res.status === 409) {
                setTrackDownloading(id, false);
                if (window.confirm("The sound exists, do you want to overwrite it?")) {
                    handleDownload(id, true);
                }
                return;
            }

            if (!res.ok) throw new Error("Download failed");
            addToast("Background download triggered!", "info");

            // Poll for completion
            let attempts = 0;
            const maxAttempts = 60; // 2 minutes max polling
            const poll = setInterval(async () => {
                attempts++;
                try {
                    const checkRes = await fetch(`${API_BASE}/playlist/${id}`);
                    if (checkRes.ok) {
                        const data = await checkRes.json();
                        if (data.is_downloaded) {
                            clearInterval(poll);
                            setTrackDownloading(id, false);
                            addToast(`Download completed for: ${data.title || 'Track'}`, "success");
                            onUpdate();
                        } else if (data.download_error && data.download_error !== "downloading...") {
                            clearInterval(poll);
                            setTrackDownloading(id, false);
                            addToast(`Download failed: ${data.download_error}`, "error");
                        }
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }

                if (attempts >= maxAttempts) {
                    clearInterval(poll);
                    setTrackDownloading(id, false);
                    addToast("Download timed out waiting for completion.", "error");
                }
            }, 2000);

        } catch (err) {
            console.error(err);
            setTrackDownloading(id, false);
            addToast("Error triggering download", "error");
        }
    };

    const handleSync = async (id) => {
        try {
            const res = await fetch(`${API_BASE}/playlist/${id}/sync`, { method: 'POST' });
            if (res.ok) {
                addToast("YouTube Sync complete!", "success");
                onUpdate();
            } else {
                addToast("Sync failed: No video >100k views found.", "error");
            }
        } catch (err) {
            addToast("Error syncing", "error");
        }
    };

    const handleBatchDownload = async () => {
        try {
            const res = await fetch(`${API_BASE}/download/batch`, { method: 'POST' });
            if (res.ok) {
                addToast("Batch download for missing tracks started in background!", "success");
                // The polling will naturally update individual tracks eventually if implemented, 
                // or user can just see progress from backend logs / rely on next refresh.
            } else {
                addToast("Failed to start batch download.", "error");
            }
        } catch (err) {
            console.error(err);
            addToast("Error communicating with server", "error");
        }
    };

    return (
        <div className="playlist-content">
            <div className="controls-bar">
                <div className="filters">
                    <div className="search-container">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search title, author or tag..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select className="filter-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select className="filter-select" value={filterSpeed} onChange={e => setFilterSpeed(e.target.value)}>
                        {speeds.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={handleBatchDownload}>
                        <Download size={14} style={{ marginRight: '6px' }} />
                        Batch Download Missing
                    </button>

                    <div className="view-toggle">
                        <button
                            className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setViewMode('list')}
                            title="List View"
                        >
                            <ListIcon size={18} />
                        </button>
                        <button
                            className={`icon-btn ${viewMode === 'card' ? 'active' : ''}`}
                            onClick={() => setViewMode('card')}
                            title="Card View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                    </div>
                </div>
                <div className="text-muted" style={{ fontWeight: '500' }}>
                    <ShinyText text={`${filtered.length} track(s)`} speed={3} />
                </div>
            </div>

            {highlightNewOn && (
                <div style={{ padding: '8px 16px', background: 'rgba(var(--primary-rgb, 100, 100, 255), 0.1)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>✨ Showing recently added sounds</span>
                    <button onClick={() => setHighlightNewOn(false)} style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>
                        Clear Filter
                    </button>
                </div>
            )}

            {viewMode === 'card' ? (
                <div className="track-grid">
                    {filtered.map(v => (
                        <TrackCard
                            key={v.id}
                            track={v}
                            onEdit={() => setEditingVideo(v)}
                            onDelete={() => handleDelete(v.id)}
                            onDownload={() => handleDownload(v.id)}
                            onSync={() => handleSync(v.id)}
                            onExpand={() => setFullscreenTrack(v)}
                            isDownloading={downloadingTracks.has(v.id)}
                        />
                    ))}
                    {filtered.length === 0 && (
                        <div className="no-results">
                            No tracks found matching your criteria.
                        </div>
                    )}
                </div>
            ) : filtered.length === 0 ? (
                <div className="track-list">
                    <div className="no-results">
                        No tracks found matching your criteria.
                    </div>
                </div>
            ) : (
                <Virtuoso
                    className="track-list"
                    style={{ height: 'calc(100vh - 220px)' }}
                    totalCount={filtered.length}
                    itemContent={(index) => {
                        const v = filtered[index];
                        return (
                            <TrackRow
                                key={v.id}
                                track={v}
                                onEdit={() => setEditingVideo(v)}
                                onDelete={() => handleDelete(v.id)}
                                onDownload={() => handleDownload(v.id)}
                                onSync={() => handleSync(v.id)}
                                onExpand={() => setFullscreenTrack(v)}
                                isDownloading={downloadingTracks.has(v.id)}
                            />
                        );
                    }}
                />
            )}

            {editingVideo && (
                <EditModal
                    video={editingVideo}
                    onClose={() => setEditingVideo(null)}
                    onSave={onUpdate}
                />
            )}

            {fullscreenTrack && (
                <FullscreenCard
                    track={fullscreenTrack}
                    onClose={() => setFullscreenTrack(null)}
                    onUpdate={onUpdate}
                    onEdit={() => {
                        setEditingVideo(fullscreenTrack);
                        setFullscreenTrack(null);
                    }}
                    onDelete={() => {
                        handleDelete(fullscreenTrack.id);
                        setFullscreenTrack(null);
                    }}
                    onDownload={() => handleDownload(fullscreenTrack.id)}
                    onSync={() => handleSync(fullscreenTrack.id)}
                />
            )}
        </div>
    );
}

function TrackCard({ track, onEdit, onDelete, onDownload, onSync, onExpand, isDownloading }) {
    const playUrl = track.is_downloaded
        ? `${API_BASE}/play/${track.id}`
        : (track.youtube_url ? `${API_BASE}/stream/${track.id}` : null);

    return (
        <div className="track-card">
            <div className="track-thumb">
                {track.thumbnail ? (
                    <img src={track.thumbnail} alt={track.title} />
                ) : (
                    <img src="/music_placeholder.png" alt="" className="thumb-placeholder-img" />
                )}
                {!track.is_downloaded && track.youtube_url && (
                    <div className="streaming-badge">Streaming</div>
                )}
                <button className="play-overlay" onClick={onExpand}>
                    <Maximize2 size={32} />
                    <span>Open Full Mode</span>
                </button>
            </div>
            <div className="track-main">
                <div className="track-info">
                    <h3>{track.title}</h3>
                    <p>{track.author}</p>
                    <div className="track-meta">
                        <span className="badge">{track.category}</span>
                        <span className="badge">{track.speed}</span>
                    </div>
                    {track.tags && track.tags.length > 0 && (
                        <div className="track-tags">
                            {track.tags.map(t => <span key={t} className="mini-tag">#{t}</span>)}
                        </div>
                    )}
                </div>

                <div className="track-player">
                    {playUrl ? (
                        <CustomAudioPlayer
                            url={playUrl}
                            isStreaming={!track.is_downloaded && !!track.youtube_url}
                            showVolume={false}
                        />
                    ) : (
                        <div className="status-missing">No link available</div>
                    )}
                </div>

                <div className="track-actions">
                    <div className="icon-group">
                        <button onClick={onSync} title="Sync metadata"><RefreshCw size={14} /></button>
                        <button onClick={onDownload} title="Download MP3" disabled={isDownloading}>
                            {isDownloading ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                        </button>
                        <button onClick={onEdit} title="Edit"><Pencil size={14} /></button>
                        <button onClick={onDelete} title="Delete"><Trash2 size={14} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function InlineEditable({ value, onSave, className, type = "text", options = [] }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);

    const handleBlur = () => {
        setIsEditing(false);
        if (editValue !== value) {
            onSave(editValue);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleBlur();
        if (e.key === 'Escape') {
            setEditValue(value);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        if (type === "select") {
            return (
                <select
                    className="edit-input"
                    value={editValue}
                    autoFocus
                    onBlur={handleBlur}
                    onChange={e => setEditValue(e.target.value)}
                >
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            );
        }
        return (
            <input
                className="edit-input"
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
            />
        );
    }

    return (
        <span className={`editable ${className}`} onClick={() => setIsEditing(true)}>
            {value || "Click to edit"}
        </span>
    );
}

function TrackRow({ track, onEdit, onDelete, onDownload, onSync, onExpand, isDownloading }) {
    const playUrl = track.is_downloaded
        ? `${API_BASE}/play/${track.id}`
        : (track.youtube_url ? `${API_BASE}/stream/${track.id}` : null);

    return (
        <div className="track-row">
            <div className="row-thumb" onClick={onExpand} style={{ cursor: 'pointer' }}>
                {track.thumbnail ? <img src={track.thumbnail} alt="" /> : <img src="/music_placeholder.png" alt="" />}
            </div>
            <div className="row-info" onClick={onExpand} style={{ cursor: 'pointer' }}>
                <strong>{track.title}</strong>
                <span className="author">{track.author}</span>
            </div>
            <div className="row-meta" style={{ display: 'flex', gap: '8px', minWidth: '120px' }}>
                <span className="badge" style={{ padding: '3px 8px', fontSize: '0.65rem' }}>{track.category}</span>
                <span className="badge" style={{ padding: '3px 8px', fontSize: '0.65rem' }}>{track.speed}</span>
            </div>
            <div className="row-player">
                {playUrl ? (
                    <CustomAudioPlayer
                        url={playUrl}
                        isStreaming={!track.is_downloaded && !!track.youtube_url}
                        showVolume={false}
                    />
                ) : track.youtube_url ? (
                    <a className="yt-play-link" href={track.youtube_url} target="_blank" rel="noreferrer">▶ Play from YouTube</a>
                ) : (
                    <span className="status-missing">No link available</span>
                )}
            </div>
            <div className="row-actions">
                <div className="icon-group">
                    <button onClick={onExpand} title="Expand"><Maximize2 size={16} /></button>
                    <button onClick={onSync} title="Sync metadata"><RefreshCw size={16} /></button>
                    <button onClick={onDownload} title="Download MP3" disabled={isDownloading}>
                        {isDownloading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                    </button>
                    <button onClick={onEdit} title="Edit"><Pencil size={16} /></button>
                    <button onClick={onDelete} title="Delete"><Trash2 size={16} /></button>
                </div>
            </div>
        </div>
    );
}

function FullscreenCard({ track, onClose, onEdit, onDelete, onDownload, onSync, onUpdate }) {
    const playUrl = track.is_downloaded
        ? `${API_BASE}/play/${track.id}`
        : (track.youtube_url ? `${API_BASE}/stream/${track.id}` : null);

    const handleInlineSave = async (field, newVal) => {
        try {
            const updated = { ...track, [field]: newVal };
            // If it's tags, we might need special handling if it's a string from input
            if (field === 'tags' && typeof newVal === 'string') {
                updated.tags = newVal.split(',').map(t => t.trim()).filter(t => t);
            }

            await fetch(`${API_BASE}/playlist/${track.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            });
            onUpdate();
        } catch (err) {
            console.error("Failed to save inline edit", err);
        }
    };

    return (
        <div className="fullscreen-card-overlay" onClick={onClose}>
            <div className="fullscreen-card" onClick={e => e.stopPropagation()}>
                <button className="close-fullscreen" onClick={onClose}>
                    <X size={24} />
                </button>

                <div className="fs-thumb">
                    {track.thumbnail ? (
                        <img src={track.thumbnail} alt={track.title} />
                    ) : (
                        <img src="/music_placeholder.png" alt="" />
                    )}
                </div>

                <div className="fs-content">
                    <div className="fs-header">
                        <h2 className="text-gradient">
                            <InlineEditable
                                value={track.title}
                                onSave={(val) => handleInlineSave('title', val)}
                            />
                        </h2>
                        <p>
                            <InlineEditable
                                value={track.author}
                                onSave={(val) => handleInlineSave('author', val)}
                            />
                        </p>
                    </div>

                    <div className="fs-meta" style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="text-muted" style={{ fontSize: '0.8rem' }}>CATEGORY:</span>
                            <InlineEditable
                                value={track.category}
                                type="select"
                                options={['Atmospheric', 'Intense', 'Upbeat', 'Cinematic', 'Experimental', 'Other']}
                                onSave={(val) => handleInlineSave('category', val)}
                                className="badge"
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="text-muted" style={{ fontSize: '0.8rem' }}>SPEED:</span>
                            <InlineEditable
                                value={track.speed}
                                type="select"
                                options={['Slow', 'Medium', 'Fast', 'Variable']}
                                onSave={(val) => handleInlineSave('speed', val)}
                                className="badge"
                            />
                        </div>
                    </div>

                    <div className="track-tags" style={{ marginBottom: '10px' }}>
                        <span className="text-muted" style={{ fontSize: '0.8rem', marginRight: '8px' }}>TAGS:</span>
                        <InlineEditable
                            value={track.tags?.join(', ')}
                            onSave={(val) => handleInlineSave('tags', val)}
                            className="mini-tag"
                            style={{ fontSize: '0.9rem' }}
                        />
                    </div>

                    <div className="fs-player">
                        {playUrl ? (
                            <CustomAudioPlayer
                                url={playUrl}
                                isStreaming={!track.is_downloaded && !!track.youtube_url}
                                showVolume={true}
                                autoLoad={true}
                                initialVolume={0.3}
                            />
                        ) : track.youtube_url ? (
                            <a className="yt-play-link" href={track.youtube_url} target="_blank" rel="noreferrer">▶ Play from YouTube</a>
                        ) : (
                            <div className="status-missing">No link available</div>
                        )}
                    </div>

                    <div className="fs-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <button className="btn btn-secondary fs-btn" onClick={onSync}>
                            <RefreshCw size={18} /> Sync YouTube
                        </button>
                        <button className="btn btn-primary fs-btn" onClick={onDownload}>
                            <Download size={18} /> Download MP3
                        </button>
                        <button className="btn btn-secondary fs-btn" onClick={onEdit}>
                            <Pencil size={18} /> Edit Full Data
                        </button>
                        <button className="btn fs-btn" style={{ background: 'rgba(255, 42, 109, 0.1)', color: 'var(--danger)', border: '1px solid rgba(255, 42, 109, 0.2)' }} onClick={onDelete}>
                            <Trash2 size={18} /> Delete Track
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
