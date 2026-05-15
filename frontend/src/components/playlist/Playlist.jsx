import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import EditModal from './EditModal';
import CustomAudioPlayer from './CustomAudioPlayer';
import {
    Pencil, Download, Trash2, Search, LayoutGrid, List as ListIcon,
    RefreshCw, Maximize2, X, Loader2, Settings
} from 'lucide-react';
import ShinyText from '../reactbits/ShinyText';
import { useToast } from '../ToastContext';
import { useLibrary } from '../LibraryContext';
import { useProfile } from '../ProfileContext';
import ConfigPanel from '../library/ConfigPanel';
import './Playlist.css';
import '../library/LibraryManager.css'; // Reuse source selector styles

import api from '../../api';

// Stable grid list wrapper — defined outside component to avoid recreation on each render
const GridList = React.forwardRef(({ style, children, ...props }, ref) => (
    <div ref={ref} {...props} className="track-grid" style={style}>
        {children}
    </div>
));
GridList.displayName = 'GridList';
const GRID_COMPONENTS = { List: GridList };

export default function Playlist({ playlist, onUpdate }) {
    const [filterCat, setFilterCat] = useState('All');
    const [filterSpeed, setFilterSpeed] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingVideo, setEditingVideo] = useState(null);
    const [fullscreenTrack, setFullscreenTrack] = useState(null);
    const [viewMode, setViewMode] = useState('list');
    const { addToast } = useToast();
    const { activeProfile } = useProfile();
    const {
        downloadingTracks, setTrackDownloading,
        downloadMode, handleModeChange
    } = useLibrary();
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [syncingTracks, setSyncingTracks] = useState(new Set());

    const isMasterProfile = !activeProfile || activeProfile.id === 'master';

    const [highlightNewOn, setHighlightNewOn] = useState(false);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQuery), 150);
        return () => clearTimeout(t);
    }, [searchQuery]);

    // Other-profile tracks: tracks that exist globally but aren't in this profile
    const [otherTracks, setOtherTracks] = useState([]);
    const [otherTracksOpen, setOtherTracksOpen] = useState(false);
    const [addingToProfile, setAddingToProfile] = useState(new Set());

    useEffect(() => {
        if (isMasterProfile) { setOtherTracks([]); return; }
        api.getPlaylist().then(async res => {
            if (!res.ok) return;
            const all = await res.json();
            const mine = new Set(playlist.map(t => t.id));
            setOtherTracks(all.filter(t => !mine.has(t.id)));
        }).catch(() => {});
    }, [activeProfile?.id, playlist]);

    const handleRemoveFromProfile = useCallback(async (trackId) => {
        if (isMasterProfile) return;
        try {
            const res = await api.removeTrackFromProfile(trackId, activeProfile.id);
            if (res.ok) { addToast('Track removed from your profile', 'info'); onUpdate(); }
        } catch { /* ignore */ }
    }, [activeProfile?.id, isMasterProfile, addToast, onUpdate]);

    const handleAddToProfile = useCallback(async (track) => {
        if (isMasterProfile) return;
        setAddingToProfile(prev => new Set([...prev, track.id]));
        try {
            const res = await api.addTrackToProfile(track.id, activeProfile.id);
            if (res.ok) { addToast(`"${track.title}" added to your profile`, 'success'); onUpdate(); }
        } finally {
            setAddingToProfile(prev => { const n = new Set(prev); n.delete(track.id); return n; });
        }
    }, [activeProfile?.id, isMasterProfile, addToast, onUpdate]);

    const filteredOtherTracks = useMemo(() => {
        if (!otherTracks.length) return [];
        const q = debouncedSearch.toLowerCase();
        if (!q) return otherTracks;
        return otherTracks.filter(t =>
            (t.title || '').toLowerCase().includes(q) ||
            (t.author || '').toLowerCase().includes(q) ||
            (t.tags || []).some(tag => tag.toLowerCase().includes(q)) ||
            (t.category || '').toLowerCase().includes(q)
        );
    }, [otherTracks, debouncedSearch]);

    useEffect(() => {
        const handleHighlight = () => {
            setHighlightNewOn(true);
            setFilterCat('All');
            setFilterSpeed('All');
            setSearchQuery('');
        };
        window.addEventListener('highlight-new', handleHighlight);
        return () => window.removeEventListener('highlight-new', handleHighlight);
    }, []);

    const categories = useMemo(() => ['All', ...new Set(playlist.map(v => v.category))], [playlist]);
    const speeds = useMemo(() => ['All', ...new Set(playlist.map(v => v.speed))], [playlist]);

    const filtered = useMemo(() => {
        const query = debouncedSearch.toLowerCase().trim();
        const now = Date.now();
        const DAY_MS = 86400000;
        const result = playlist.filter(v => {
            if (filterCat !== 'All' && v.category !== filterCat) return false;
            if (filterSpeed !== 'All' && v.speed !== filterSpeed) return false;
            if (query) {
                if (!v.title?.toLowerCase().includes(query) &&
                    !v.author?.toLowerCase().includes(query) &&
                    !v.tags?.some(t => t.toLowerCase().includes(query)) &&
                    !(v.category || '').toLowerCase().includes(query)) return false;
            }
            if (highlightNewOn) {
                if (!v.added_at || (now - new Date(v.added_at).getTime()) >= DAY_MS) return false;
            }
            return true;
        });
        result.sort((a, b) => (b.added_at ? new Date(b.added_at).getTime() : 0) -
                               (a.added_at ? new Date(a.added_at).getTime() : 0));
        return result;
    }, [playlist, filterCat, filterSpeed, debouncedSearch, highlightNewOn]);

    // Ref so handlers can read the latest playlist without being in their dep arrays
    const playlistRef = useRef(playlist);
    useEffect(() => { playlistRef.current = playlist; }, [playlist]);

    const handleDelete = useCallback(async (id) => {
        if (!confirm("Are you sure you want to delete this track?")) return;
        try { await api.deleteTrack(id); onUpdate(); } catch (err) { console.error(err); }
    }, [onUpdate]);

    const handleDownload = useCallback(async (id, overwrite = false) => {
        const track = playlistRef.current.find(t => t.id === id);
        if (track && !track.youtube_url) {
            setSyncingTracks(prev => { const n = new Set(prev); n.add(id); return n; });
            addToast(`🔍 Finding link for "${track.title}"...`, 'info');
            try {
                const syncRes = await api.syncTrack(id);
                if (!syncRes.ok) throw new Error("Sync failed");
                addToast(`✅ Link found. Starting download...`, 'success');
            } catch {
                addToast(`❌ Could not find link.`, 'error');
                setSyncingTracks(prev => { const n = new Set(prev); n.delete(id); return n; });
                return;
            } finally {
                setSyncingTracks(prev => { const n = new Set(prev); n.delete(id); return n; });
            }
        }
        setTrackDownloading(id, true);
        try {
            const res = await api.downloadTrack(id, overwrite);
            if (res.status === 409) {
                setTrackDownloading(id, false);
                if (window.confirm("The sound exists, do you want to overwrite it?")) handleDownload(id, true);
                return;
            }
            if (!res.ok) throw new Error("Download failed");
            addToast("Background download triggered!", "info");
        } catch (err) {
            console.error(err);
            setTrackDownloading(id, false);
            addToast("Error triggering download", "error");
        }
    }, [addToast, setTrackDownloading, onUpdate]);

    const handleFindAndPlay = useCallback(async (id) => {
        setSyncingTracks(prev => { const n = new Set(prev); n.add(id); return n; });
        addToast(`🔍 Finding stream link...`, 'info');
        try {
            const syncRes = await api.syncTrack(id);
            if (!syncRes.ok) throw new Error("Sync failed");
            addToast(`✅ Link found. You can now play!`, 'success');
            onUpdate();
        } catch { addToast(`❌ Could not find link.`, 'error'); }
        finally { setSyncingTracks(prev => { const n = new Set(prev); n.delete(id); return n; }); }
    }, [addToast, onUpdate]);

    const handleSync = useCallback(async (id) => {
        try {
            const res = await api.syncTrack(id);
            if (res.ok) { addToast("YouTube Sync complete!", "success"); onUpdate(); }
            else addToast("Sync failed: No video >100k views found.", "error");
        } catch { addToast("Error syncing", "error"); }
    }, [addToast, onUpdate]);

    const handleEdit = useCallback((track) => setEditingVideo(track), []);
    const handleExpand = useCallback((track) => setFullscreenTrack(track), []);

    const handleBatchDownload = useCallback(async () => {
        try {
            const res = await api.downloadBatch();
            if (res.ok) addToast("Batch download for missing tracks started in background!", "success");
            else addToast("Failed to start batch download.", "error");
        } catch (err) {
            console.error(err);
            addToast("Error communicating with server", "error");
        }
    }, [addToast]);

    // Stable itemContent — only recreates when filtered or download/sync state changes
    const listItemContent = useCallback((index) => {
        const v = filtered[index];
        return (
            <TrackRow
                track={v}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDownload={handleDownload}
                onSync={handleSync}
                onFindAndPlay={handleFindAndPlay}
                onExpand={handleExpand}
                isDownloading={downloadingTracks.has(v.id)}
                isSyncing={syncingTracks.has(v.id)}
                downloadMode={downloadMode}
                isMasterProfile={isMasterProfile}
                onRemoveFromProfile={handleRemoveFromProfile}
            />
        );
    }, [filtered, handleEdit, handleDelete, handleDownload, handleSync, handleFindAndPlay, handleExpand, downloadingTracks, syncingTracks, downloadMode, isMasterProfile, handleRemoveFromProfile]);

    const gridItemContent = useCallback((index) => {
        const v = filtered[index];
        return (
            <TrackCard
                track={v}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDownload={handleDownload}
                onSync={handleSync}
                onFindAndPlay={handleFindAndPlay}
                onExpand={handleExpand}
                isDownloading={downloadingTracks.has(v.id)}
                isSyncing={syncingTracks.has(v.id)}
                downloadMode={downloadMode}
                isMasterProfile={isMasterProfile}
                onRemoveFromProfile={handleRemoveFromProfile}
            />
        );
    }, [filtered, handleEdit, handleDelete, handleDownload, handleSync, handleFindAndPlay, handleExpand, downloadingTracks, syncingTracks, downloadMode, isMasterProfile, handleRemoveFromProfile]);

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

                    <div className="source-selector" style={{ transform: 'scale(0.85)', margin: '0 8px' }}>
                        <button
                            className={`source-btn${downloadMode === 'youtube' ? ' source-btn--active source-btn--youtube' : ''}`}
                            onClick={() => handleModeChange('youtube')}
                        >
                            YT
                        </button>
                        <button
                            className={`source-btn${downloadMode === 'spotify' ? ' source-btn--active source-btn--spotify' : ''}`}
                            onClick={() => handleModeChange('spotify')}
                        >
                            SP
                        </button>
                        <button
                            className={`source-btn${downloadMode === 'cc' ? ' source-btn--active source-btn--cc' : ''}`}
                            onClick={() => handleModeChange('cc')}
                        >
                            CC
                        </button>
                    </div>
                    <button 
                        className="lm-config-btn"
                        onClick={() => setIsConfigOpen(true)}
                        style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
                    >
                        <Settings size={18} />
                    </button>
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
                filtered.length === 0 ? (
                    <div className="track-grid">
                        <div className="no-results">No tracks found matching your criteria.</div>
                    </div>
                ) : (
                    <VirtuosoGrid
                        style={{ height: 'calc(100vh - 220px)' }}
                        totalCount={filtered.length}
                        components={GRID_COMPONENTS}
                        itemContent={gridItemContent}
                    />
                )
            ) : filtered.length === 0 ? (
                <div className="track-list">
                    <div className="no-results">No tracks found matching your criteria.</div>
                </div>
            ) : (
                <Virtuoso
                    className="track-list"
                    style={{ height: 'calc(100vh - 220px)' }}
                    totalCount={filtered.length}
                    itemContent={listItemContent}
                />
            )}

            {/* "Also available" section for non-master profiles */}
            {!isMasterProfile && filteredOtherTracks.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 4 }}>
                    <button
                        onClick={() => setOtherTracksOpen(o => !o)}
                        style={{
                            width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none',
                            color: 'var(--text-muted)', padding: '8px 16px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem'
                        }}
                    >
                        <span style={{ transform: otherTracksOpen ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
                        Also available — not in your profile ({filteredOtherTracks.length})
                    </button>
                    {otherTracksOpen && filteredOtherTracks.map(track => (
                        <div key={track.id} className="track-row" style={{ opacity: 0.55, borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                            <div className="row-thumb">
                                <img
                                    src={track.thumbnail || '/music_placeholder.png'}
                                    alt=""
                                    onError={e => { e.target.onerror = null; e.target.src = '/music_placeholder.png'; }}
                                    style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover' }}
                                />
                            </div>
                            <div className="row-info">
                                <strong>{track.title}</strong>
                                <span className="author">{track.author}</span>
                            </div>
                            <div className="row-meta" style={{ display: 'flex', gap: 6 }}>
                                <span className="badge" style={{ fontSize: '0.65rem' }}>{track.category}</span>
                            </div>
                            <div className="row-actions">
                                <button
                                    disabled={addingToProfile.has(track.id)}
                                    onClick={() => handleAddToProfile(track)}
                                    style={{
                                        background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                                        borderRadius: 5, padding: '3px 10px', cursor: 'pointer',
                                        color: 'var(--primary)', fontSize: '0.75rem'
                                    }}
                                >
                                    {addingToProfile.has(track.id) ? '…' : '+ Add to profile'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
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
                    onFindAndPlay={() => handleFindAndPlay(fullscreenTrack.id)}
                    downloadMode={downloadMode}
                />
            )}

            <ConfigPanel
                isOpen={isConfigOpen}
                onClose={() => setIsConfigOpen(false)}
                currentMode={downloadMode}
                onModeChange={handleModeChange}
            />
        </div>
    );
}

const TrackCard = React.memo(function TrackCard({ track, onEdit, onDelete, onDownload, onSync, onFindAndPlay, onExpand, isDownloading, isSyncing, downloadMode, isMasterProfile, onRemoveFromProfile }) {
    const playUrl = track.is_downloaded
        ? api.getPlayUrl(track.id)
        : (track.youtube_url ? api.getStreamUrl(track.id) : null);

    const hasFailed = !track.is_downloaded && !!track.download_error;
    const needsDownload = !track.is_downloaded && !isDownloading;
    const hasUrl = !!track.youtube_url;

    let cardClassName = 'track-card';
    if (hasFailed) cardClassName += ' lm-item--failed';
    else if (needsDownload && !hasUrl) cardClassName += ' lm-item--needs-sync';
    else if (needsDownload && hasUrl) cardClassName += ' lm-item--pending';

    return (
        <div 
            className={cardClassName}
            style={{ 
                borderTop: hasFailed ? '3px solid #ef4444' 
                          : needsDownload && !hasUrl ? '3px solid #8b5cf6'
                          : needsDownload && hasUrl ? '3px solid #f59e0b'
                          : '3px solid transparent'
            }}
        >
            <div className="track-thumb">
                {track.thumbnail ? (
                    <img src={track.thumbnail} alt={track.title} style={{ filter: needsDownload ? 'brightness(0.6) saturate(0.4)' : 'none' }} />
                ) : (
                    <img src="/music_placeholder.png" alt="" className="thumb-placeholder-img" style={{ filter: needsDownload ? 'brightness(0.6) saturate(0.4)' : 'none' }} />
                )}
                {needsDownload && !isDownloading && (
                    <div style={{
                        position: 'absolute', top: 5, right: 5,
                        background: hasFailed ? '#ef4444' : (hasUrl ? '#f59e0b' : '#8b5cf6'),
                        color: 'white', borderRadius: '50%', padding: 4, zIndex: 10, display: 'flex'
                    }}>
                        <Download size={14} />
                    </div>
                )}
                {!track.is_downloaded && track.youtube_url && (
                    <div className="streaming-badge">Streaming</div>
                )}
                <button className="play-overlay" onClick={() => onExpand(track)}>
                    <Maximize2 size={32} />
                    <span>Open Full Mode</span>
                </button>
            </div>
            <div className="track-main">
                <div className="track-info">
                    <h3>{track.title}</h3>
                    <p>{track.author}{track.added_at && <span style={{ marginLeft: 8, fontSize: '0.7rem', opacity: 0.5 }}>· {new Date(track.added_at).toLocaleDateString()}</span>}</p>
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
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button className="yt-play-link" onClick={() => onFindAndPlay(track.id)} style={{ background: 'transparent' }}>
                                ▶ Find Link & Play
                            </button>
                        </div>
                    )}
                </div>

                <div className="track-actions">
                    <div className="icon-group">
                        <button onClick={() => onSync(track.id)} title={`Sync ${downloadMode === 'spotify' ? 'Spotify' : 'YouTube'} metadata`}><RefreshCw size={14} /></button>
                        <button onClick={() => onDownload(track.id)} title="Download MP3" disabled={isDownloading}>
                            {isDownloading ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                        </button>
                        <button onClick={() => onEdit(track)} title="Edit"><Pencil size={14} /></button>
                        <button onClick={() => onDelete(track.id)} title="Delete"><Trash2 size={14} /></button>
                        {!isMasterProfile && (
                            <button onClick={() => onRemoveFromProfile(track.id)} title="Remove from this profile" style={{ color: 'rgba(255,100,100,0.6)' }}><X size={14} /></button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

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

const TrackRow = React.memo(function TrackRow({ track, onEdit, onDelete, onDownload, onSync, onFindAndPlay, onExpand, isDownloading, isSyncing, downloadMode, isMasterProfile, onRemoveFromProfile }) {
    const playUrl = track.is_downloaded
        ? api.getPlayUrl(track.id)
        : (track.youtube_url ? api.getStreamUrl(track.id) : null);

    const hasFailed = !track.is_downloaded && !!track.download_error;
    const needsDownload = !track.is_downloaded && !isDownloading;
    const hasUrl = !!track.youtube_url;

    let rowClassName = 'track-row';
    if (hasFailed) rowClassName += ' lm-item--failed';
    else if (needsDownload && !hasUrl) rowClassName += ' lm-item--needs-sync';
    else if (needsDownload && hasUrl) rowClassName += ' lm-item--pending';

    return (
        <div 
            className={rowClassName}
            style={{ 
                borderLeft: hasFailed ? '3px solid #ef4444' 
                          : needsDownload && !hasUrl ? '3px solid #8b5cf6'
                          : needsDownload && hasUrl ? '3px solid #f59e0b'
                          : '3px solid transparent'
            }}
        >
            <div className="row-thumb" onClick={() => onExpand(track)} style={{ cursor: 'pointer', position: 'relative' }}>
                {track.thumbnail ? <img src={track.thumbnail} alt="" style={{ filter: needsDownload ? 'brightness(0.6) saturate(0.4)' : 'none' }} /> : <img src="/music_placeholder.png" alt="" style={{ filter: needsDownload ? 'brightness(0.6) saturate(0.4)' : 'none' }} />}
                {needsDownload && !isDownloading && (
                    <Download size={14} style={{
                        position: 'absolute', bottom: -2, right: -2,
                        background: hasFailed ? '#ef4444' : (hasUrl ? '#f59e0b' : '#8b5cf6'),
                        color: 'white', borderRadius: '50%',
                        padding: 2, boxSizing: 'content-box'
                    }} />
                )}
            </div>
            <div className="row-info" onClick={() => onExpand(track)} style={{ cursor: 'pointer' }}>
                <strong>{track.title}</strong>
                <span className="author">{track.author}</span>
            </div>
            <div className="row-meta" style={{ display: 'flex', gap: '8px', minWidth: '120px' }}>
                <span className="badge" style={{ padding: '3px 8px', fontSize: '0.65rem' }}>{track.category}</span>
                <span className="badge" style={{ padding: '3px 8px', fontSize: '0.65rem' }}>{track.speed}</span>
            </div>
            <div className="row-player" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                {needsDownload && !isDownloading && (
                    <span
                        className={
                            hasFailed ? 'lm-badge lm-badge--failed lm-badge--clickable'
                                : !hasUrl ? 'lm-badge lm-badge--needs-sync lm-badge--clickable'
                                    : 'lm-badge lm-badge--pending lm-badge--clickable'
                        }
                        onClick={(e) => { e.stopPropagation(); onDownload(track.id); }}
                        title={!hasUrl ? 'Click to find link and download' : 'Click to download'}
                        style={{ flexShrink: 0, marginRight: '6px' }}
                    >
                        {isSyncing
                            ? <><Loader2 size={10} className="spin" style={{ marginRight: 3 }} />Finding...</>
                            : hasFailed ? '↺ Retry Download'
                            : !hasUrl ? '🔍 Find & Download'
                            : '⬇ Download Now'
                        }
                    </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {playUrl ? (
                        <CustomAudioPlayer
                            url={playUrl}
                            isStreaming={!track.is_downloaded && !!track.youtube_url}
                            showVolume={false}
                        />
                    ) : track.youtube_url ? (
                        <a className="yt-play-link" href={track.youtube_url} target="_blank" rel="noreferrer">▶ Play from YouTube</a>
                    ) : (
                        <button className="yt-play-link" onClick={() => onFindAndPlay(track.id)} style={{ border: '1px dashed rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text-muted)' }}>
                            ▶ Find Link & Play
                        </button>
                    )}
                </div>
            </div>
            <div className="row-actions">
                <div className="icon-group">
                    <button onClick={() => onExpand(track)} title="Expand"><Maximize2 size={16} /></button>
                    <button onClick={() => onSync(track.id)} title={`Sync ${downloadMode === 'spotify' ? 'Spotify' : 'YouTube'} metadata`}><RefreshCw size={16} /></button>
                    <button onClick={() => onDownload(track.id)} title="Download MP3" disabled={isDownloading}>
                        {isDownloading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                    </button>
                    <button onClick={() => onEdit(track)} title="Edit"><Pencil size={16} /></button>
                    <button onClick={() => onDelete(track.id)} title="Delete"><Trash2 size={16} /></button>
                    {!isMasterProfile && (
                        <button onClick={() => onRemoveFromProfile(track.id)} title="Remove from this profile" style={{ color: 'rgba(255,100,100,0.6)' }}><X size={16} /></button>
                    )}
                </div>
            </div>
        </div>
    );
});

function FullscreenCard({ track, onClose, onEdit, onDelete, onDownload, onSync, onFindAndPlay, onUpdate, downloadMode }) {
    const playUrl = track.is_downloaded
        ? api.getPlayUrl(track.id)
        : (track.youtube_url ? api.getStreamUrl(track.id) : null);

    const handleInlineSave = async (field, newVal) => {
        try {
            const updated = { ...track, [field]: newVal };
            // If it's tags, we might need special handling if it's a string from input
            if (field === 'tags' && typeof newVal === 'string') {
                updated.tags = newVal.split(',').map(t => t.trim()).filter(t => t);
            }

            await api.updateTrack(track.id, updated);
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
                            <a className="yt-play-link" style={{ fontSize: '1.2rem', padding: '12px 24px' }} href={track.youtube_url} target="_blank" rel="noreferrer">▶ Play from YouTube</a>
                        ) : (
                            <button className="yt-play-link" onClick={onFindAndPlay} style={{ fontSize: '1.2rem', padding: '12px 24px', background: 'transparent' }}>
                                ▶ Find Link & Play
                            </button>
                        )}
                    </div>

                    <div className="fs-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <button className="btn btn-secondary fs-btn" onClick={onSync}>
                            <RefreshCw size={18} /> Sync {downloadMode === 'spotify' ? 'Spotify' : 'YouTube'}
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
