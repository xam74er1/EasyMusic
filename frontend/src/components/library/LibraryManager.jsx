import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useLibrary } from '../LibraryContext';
import { useToast } from '../ToastContext';
import { useProfile } from '../ProfileContext';
import {
  Search, Plus, Download, Trash2, FolderPlus, Folder,
  Music, Tag, Play, Pause, SkipForward, SkipBack,
  Volume2, VolumeX, Shuffle, Repeat, List, Maximize2,
  Filter, MoreVertical, Check, AlertCircle, FileAudio,
  History, Settings, Loader2, Pencil, GripVertical, ChevronRight, FolderOpen, X, Edit2,
  ListMusic, Upload
} from 'lucide-react';
import ZipDownloadModal from './ZipDownloadModal';
import ImportModal from './ImportModal';
import CCBrowserModal from './CCBrowserModal';
import ConfigPanel from './ConfigPanel';
import './LibraryManager.css';
import api from '../../api';

// Build a nested tree from track categories
function buildCategoryTree(tracks, virtualFolders = []) {
    const root = {};
    for (const t of tracks) {
        if (!t.category || t.category === 'undefined') continue;
        const categories = t.category.split(';').map(c => c.trim()).filter(Boolean);
        for (const cat of categories) {
            const path = cat.split('/').map(s => s.trim()).filter(s => s && s !== 'undefined');
            if (!path.length) continue;
            let node = root;
            for (const seg of path) {
                if (!node[seg]) node[seg] = {};
                node = node[seg];
            }
            if (!node.__tracks) node.__tracks = [];
            if (!node.__tracks.find(x => x.id === t.id)) {
                node.__tracks.push(t);
            }
        }
    }
    // Add virtual (empty) folders so newly created folders appear in the tree
    for (const vfPath of virtualFolders) {
        const path = vfPath.split('/').map(s => s.trim()).filter(Boolean);
        let node = root;
        for (const seg of path) {
            if (!node[seg]) node[seg] = {};
            node = node[seg];
        }
    }
    return root;
}

// Filter the tree so it only contains nodes that match or have children that match
function filterTree(node, query, pathPrefix = '') {
    const result = {};
    let matches = false;

    for (const key of Object.keys(node).filter(k => k !== '__tracks')) {
        const childPath = pathPrefix ? `${pathPrefix}/${key}` : key;
        const isMatch = childPath.toLowerCase().includes(query.toLowerCase());

        // Recursively filter children
        const filteredChild = filterTree(node[key], query, childPath);

        if (isMatch || filteredChild.matches) {
            result[key] = isMatch ? node[key] : filteredChild.node;
            matches = true;
        }
    }

    return { node: result, matches };
}

function SmallBtn({ children, onClick, title, color }) {
    return (
        <button
            title={title}
            onClick={e => { e.stopPropagation(); onClick(); }}
            style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 5, padding: '3px 5px', cursor: 'pointer',
                color: color || 'var(--text-muted)', display: 'flex', alignItems: 'center',
            }}
        >
            {children}
        </button>
    );
}

export default function LibraryManager() {
    const {
        tracks,
        setlists,
        updateTrackCategory,
        renameCategory,
        downloadingTracks,
        setTrackDownloading,
        downloadMode,
        handleModeChange,
        refreshLibrary
    } = useLibrary();

    const { addToast } = useToast();
    const { activeProfile } = useProfile();

    const [activeCategory, setActiveCategory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [catSearchQuery, setCatSearchQuery] = useState('');
    const [virtualFolders, setVirtualFolders] = useState([]);

    const createSubfolder = (parentPath) => {
        const name = prompt(parentPath
            ? `New subfolder name inside "${parentPath}":`
            : 'New root category name:');
        if (!name || !name.trim()) return;
        const fullPath = parentPath ? `${parentPath}/${name.trim()}` : name.trim();
        setVirtualFolders(prev => [...prev, fullPath]);
        setOpenFolders(prev => ({ ...prev, [parentPath || '_root_']: true }));
    };

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQuery), 150);
        return () => clearTimeout(t);
    }, [searchQuery]);

    // Default open all if searching, else track manually
    const [openFolders, setOpenFolders] = useState({});

    // Highlight new sounds toggle
    const [highlightNewOn, setHighlightNewOn] = useState(false);

    // Per-track syncing state (finding YouTube URL)
    const [syncingTracks, setSyncingTracks] = useState(new Set());

    React.useEffect(() => {
        const handleHighlight = () => {
            setHighlightNewOn(true);
            setActiveCategory(null); // Go to all tracks
            setSearchQuery('');      // Clear search so we see everything
        };
        window.addEventListener('highlight-new', handleHighlight);
        return () => window.removeEventListener('highlight-new', handleHighlight);
    }, []);

    const setSyncing = useCallback((trackId, isSyncing) => {
        setSyncingTracks(prev => {
            const next = new Set(prev);
            if (isSyncing) next.add(trackId); else next.delete(trackId);
            return next;
        });
    }, []);

    /**
     * Clicking the "Not Downloaded" / "Download Failed" badge:
     * 1. If track has no youtube_url → sync first (search YouTube for the URL)
     * 2. Then trigger background download
     */
    const handleQuickDownload = useCallback(async (e, track) => {
        e.stopPropagation();
        const trackId = track.id;

        if (syncingTracks.has(trackId) || downloadingTracks.has(trackId)) return;

        let youtubeUrl = track.youtube_url;

        // Step 1: Sync YouTube URL if missing
        if (!youtubeUrl) {
            setSyncing(trackId, true);
            addToast(`🔍 Finding YouTube link for "${track.title}"...`, 'info');
            try {
                const syncRes = await api.syncTrack(trackId);
                if (!syncRes.ok) {
                    const err = await syncRes.json().catch(() => ({}));
                    throw new Error(err.detail || 'Sync failed');
                }
                const synced = await syncRes.json();
                youtubeUrl = synced?.track?.youtube_url;
                if (!youtubeUrl) throw new Error('No YouTube URL found');
                addToast(`✅ YouTube link found for "${track.title}"`, 'success');
                // Refresh tracks so the URL is stored in local state
                refreshLibrary();
            } catch (err) {
                addToast(`❌ Could not find YouTube URL: ${err.message}`, 'error');
                setSyncing(trackId, false);
                return;
            } finally {
                setSyncing(trackId, false);
            }
        }

        // Step 2: Kick off the background download
        try {
            setTrackDownloading(trackId, true);
            const dlRes = await api.downloadTrack(trackId, false);
            if (!dlRes.ok) {
                const err = await dlRes.json().catch(() => ({}));
                throw new Error(err.detail || 'Download failed to start');
            }
            addToast(`⬇️ Downloading "${track.title}"...`, 'info');
        } catch (err) {
            addToast(`❌ Download error: ${err.message}`, 'error');
            setTrackDownloading(trackId, false);
        }
    }, [syncingTracks, downloadingTracks, setSyncing, setTrackDownloading, addToast, refreshLibrary]);

    const [isConfigOpen, setIsConfigOpen] = useState(false);

    // --- Other-profile tracks (visible to master but not this profile) ---
    const [otherTracks, setOtherTracks] = useState([]);
    const [otherTracksOpen, setOtherTracksOpen] = useState(false);
    const [addingToProfile, setAddingToProfile] = useState(new Set());

    useEffect(() => {
        if (!activeProfile || activeProfile.id === 'master') {
            setOtherTracks([]);
            return;
        }
        // Fetch all tracks (no profile filter), then exclude what the profile already has
        api.getPlaylist().then(async res => {
            if (!res.ok) return;
            const all = await res.json();
            const profileIds = new Set(tracks.map(t => t.id));
            setOtherTracks(all.filter(t => !profileIds.has(t.id)));
        }).catch(() => {});
    }, [activeProfile?.id, tracks]);

    const handleAddToProfile = async (track) => {
        if (!activeProfile || activeProfile.id === 'master') return;
        setAddingToProfile(prev => new Set([...prev, track.id]));
        try {
            const res = await api.addTrackToProfile(track.id, activeProfile.id);
            if (res.ok) {
                addToast(`"${track.title}" added to your profile`, 'success');
                refreshLibrary();
            }
        } finally {
            setAddingToProfile(prev => { const n = new Set(prev); n.delete(track.id); return n; });
        }
    };

    const handleRemoveFromProfile = async (track) => {
        if (!activeProfile || activeProfile.id === 'master') return;
        try {
            const res = await api.removeTrackFromProfile(track.id, activeProfile.id);
            if (res.ok) {
                addToast(`"${track.title}" removed from your profile`, 'info');
                refreshLibrary();
            }
        } catch { /* ignore */ }
    };

    // Filter other tracks by current search query
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

    // --- Zip Modal Data ---
    const [isZipModalOpen, setIsZipModalOpen] = useState(false);

    // --- CC Browser Modal ---
    const [isCCBrowserOpen, setIsCCBrowserOpen] = useState(false);
    const handleCCDownload = useCallback((track) => {
        // Placeholder for handling CC track download
        console.log("Downloading CC track:", track);
        addToast(`Downloading ${track.title} from CC... (Not yet implemented)`, 'info');
    }, [addToast]);

    // --- Import Modal Data ---
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [droppedFiles, setDroppedFiles] = useState([]);

    // --- Panel resize ---
    const [leftWidth, setLeftWidth] = useState(240);
    const [rightWidth, setRightWidth] = useState(260);
    const leftResizingRef = useRef(false);
    const rightResizingRef = useRef(false);
    const wrapperRef = useRef(null);

    // Initialize left panel at 50% of space available after the setlists panel
    useLayoutEffect(() => {
        if (!wrapperRef.current) return;
        const totalW = wrapperRef.current.getBoundingClientRect().width;
        const available = totalW - 260 - 8; // initial rightWidth + 2 × 4px handles
        setLeftWidth(Math.max(140, Math.floor(available / 2)));
    }, []);

    const handleLeftResizeStart = (e) => {
        e.preventDefault();
        leftResizingRef.current = true;
        const startX = e.clientX;
        const startW = leftWidth;
        const handleMove = (ev) => {
            if (!leftResizingRef.current) return;
            const totalW = wrapperRef.current?.getBoundingClientRect().width ?? 1400;
            setLeftWidth(Math.max(140, Math.min(totalW - 320, startW + (ev.clientX - startX))));
        };
        const handleUp = () => {
            leftResizingRef.current = false;
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    };

    const handleRightResizeStart = (e) => {
        e.preventDefault();
        rightResizingRef.current = true;
        const startX = e.clientX;
        const startW = rightWidth;
        const handleMove = (ev) => {
            if (!rightResizingRef.current) return;
            const totalW = wrapperRef.current?.getBoundingClientRect().width ?? 1400;
            setRightWidth(Math.max(160, Math.min(totalW - 320, startW - (ev.clientX - startX))));
        };
        const handleUp = () => {
            rightResizingRef.current = false;
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    };

    // --- Setlist management ---
    const setlistFileInputRef = React.useRef(null);
    const [renamingSetlistId, setRenamingSetlistId] = useState(null);
    const [renameSetlistValue, setRenameSetlistValue] = useState('');

    const handleCreateSetlist = async () => {
        try {
            const res = await api.createSetlist({ name: 'New Setlist', profile_id: activeProfile?.id, tracks: [] });
            if (!res.ok) throw new Error();
            const data = await res.json();
            addToast('Setlist créée', 'success');
            refreshLibrary();
            setTimeout(() => { setRenamingSetlistId(data.id); setRenameSetlistValue(data.name); }, 120);
        } catch {
            addToast('Erreur création setlist', 'error');
        }
    };

    const handleImportSetlist = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        try {
            const res = await api.importSetlist(file, activeProfile?.id);
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Import failed');
            addToast(`"${data.name}" importée — ${data.matched}/${data.total} pistes trouvées`, 'success');
            refreshLibrary();
        } catch (err) {
            addToast('Erreur import: ' + err.message, 'error');
        }
    };

    const handleExportSetlist = (id) => {
        window.open(api.getSetlistExportUrl(id), '_blank');
    };

    const handleDeleteSetlist = async (id, name) => {
        if (!confirm(`Supprimer la setlist "${name}" ?`)) return;
        try {
            await api.deleteSetlist(id);
            addToast(`"${name}" supprimée`, 'success');
            refreshLibrary();
        } catch {
            addToast('Erreur suppression', 'error');
        }
    };

    const startRenameSetlist = (id, name) => {
        setRenamingSetlistId(id);
        setRenameSetlistValue(name);
    };

    const confirmRenameSetlist = async (setlist) => {
        if (!renameSetlistValue.trim()) return;
        try {
            const res = await api.updateSetlist(setlist.id, { ...setlist, name: renameSetlistValue.trim() });
            if (!res.ok) throw new Error();
            addToast('Setlist renommée', 'success');
            setRenamingSetlistId(null);
            refreshLibrary();
        } catch {
            addToast('Erreur renommage', 'error');
        }
    };

    // --- Drag state ---
    const [draggedTrackId, setDraggedTrackId] = useState(null);
    const [dragOverCategory, setDragOverCategory] = useState(null);

    const handleDragStart = (e, trackId) => {
        e.dataTransfer.setData('type', 'track');
        e.dataTransfer.setData('id', trackId);
        setDraggedTrackId(trackId);
    };

    const handleDragOverCategory = (e, category) => {
        e.preventDefault();
        setDragOverCategory(category);
    };

    const handleDropCategory = async (e, category = 'Uncategorized') => {
        e.preventDefault();
        setDragOverCategory(null);

        // Check if dropping files from outside
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setDroppedFiles(e.dataTransfer.files);
            setIsImportModalOpen(true);
            return;
        }

        const type = e.dataTransfer.getData('type');
        const id = e.dataTransfer.getData('id');

        if (type === 'track') {
            const track = tracks.find(t => t.id === id);
            if (track) {
                // If Shift is pressed, append the category. Otherwise, replace.
                if (e.shiftKey) {
                    const existingCats = (track.category || '').split(';').map(c => c.trim()).filter(Boolean);
                    if (category !== 'Uncategorized' && !existingCats.includes(category)) {
                        existingCats.push(category);
                        await updateTrackCategory(id, existingCats.join(' ; '));
                    } else if (category === 'Uncategorized') {
                        await updateTrackCategory(id, '');
                    }
                } else {
                    await updateTrackCategory(id, category === 'Uncategorized' ? '' : category);
                }
            }
        }
    };

    // --- Compute Category Hierarchy ---
    const fullTree = useMemo(() => buildCategoryTree(tracks, virtualFolders), [tracks, virtualFolders]);

    const displayTree = useMemo(() => {
        if (!catSearchQuery.trim()) return fullTree;
        return filterTree(fullTree, catSearchQuery).node;
    }, [fullTree, catSearchQuery]);

    // --- Filtered Tracks (Right Panel) ---
    const displayedTracks = useMemo(() => {
        const query = debouncedSearch.toLowerCase().trim();
        const now = Date.now();
        const DAY_MS = 86400000;

        let filtered = activeCategory
            ? tracks.filter(t => {
                if (!t.category) return false;
                const cats = t.category.split(';').map(c => c.trim()).filter(Boolean);
                return cats.some(c => c === activeCategory || c.startsWith(activeCategory + '/'));
            })
            : tracks;

        if (query) {
            filtered = filtered.filter(t =>
                (t.title || '').toLowerCase().includes(query) ||
                (t.author || '').toLowerCase().includes(query) ||
                (t.tags || []).some(tag => tag.toLowerCase().includes(query)) ||
                (t.category || '').toLowerCase().includes(query)
            );
        }

        if (highlightNewOn) {
            filtered = filtered.filter(t =>
                t.added_at && (now - new Date(t.added_at).getTime()) < DAY_MS
            );
        }

        const result = [...filtered];
        result.sort((a, b) => (b.added_at ? new Date(b.added_at).getTime() : 0) -
                               (a.added_at ? new Date(a.added_at).getTime() : 0));
        return result;
    }, [tracks, activeCategory, debouncedSearch, highlightNewOn]);

    const toggleFolder = (path) => setOpenFolders(prev => ({ ...prev, [path]: !prev[path] }));
    const isFolderOpen = (path) => catSearchQuery ? true : openFolders[path] !== false;

    // --- Zip Download Logic ---
    const handleDownloadClick = () => {
        setIsZipModalOpen(true);
    };

    const handleZipConfirm = async (flatStructure) => {
        setIsZipModalOpen(false);
        const folderId = activeCategory || '';
        const profileId = activeProfile?.id || '';

        // Trigger file download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = api.getZipDownloadUrl(flatStructure, profileId, folderId);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleTrackDownload = (e, track) => {
        e.stopPropagation(); // prevent clicking row 
        if (!track.is_downloaded) {
            addToast("Track not downloaded to server yet. Download it from the Playlist view first.", "error");
            return;
        }

        // Trigger file download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = api.getDownloadFileUrl(track.id);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const FolderNodeTree = ({ node, pathPrefix, depth }) => {
        const childKeys = Object.keys(node).filter(k => k !== '__tracks').sort();
        const tracks = node.__tracks || [];

        return (
            <>
                {childKeys.map(key => {
                    const childPath = pathPrefix ? `${pathPrefix}/${key}` : key;
                    const childNode = node[key];
                    const isOpen = isFolderOpen(childPath);
                    const isDragOver = dragOverCategory === childPath;
                    const isActive = activeCategory === childPath;

                    return (
                        <div key={childPath}>
                            <div
                                className={`lm-item ${isActive ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
                                style={{ paddingLeft: `${10 + depth * 15}px`, marginBottom: 4 }}
                                onClick={() => setActiveCategory(childPath)}
                                onDragOver={(e) => handleDragOverCategory(e, childPath)}
                                onDrop={(e) => handleDropCategory(e, childPath)}
                                onDragLeave={() => setDragOverCategory(null)}
                            >
                                <div className="lm-item-title">
                                    {(Object.keys(childNode).filter(k => k !== '__tracks').length > 0 || (childNode.__tracks && childNode.__tracks.length > 0)) ? (
                                        <span onClick={(e) => { e.stopPropagation(); toggleFolder(childPath); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                            <ChevronRight size={14} style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', marginRight: 4 }} />
                                            {isOpen ? <FolderOpen size={16} color="var(--primary)" /> : <Folder size={16} color="var(--text-muted)" />}
                                        </span>
                                    ) : (
                                        <span style={{ marginLeft: 18 }}><Folder size={16} color={isActive ? "var(--primary)" : "var(--text-muted)"} /></span>
                                    )}
                                    <span style={{ marginLeft: 6 }}>{key}</span>
                                </div>
                                <div className="lm-item-actions">
                                    <button onClick={(e) => { e.stopPropagation(); createSubfolder(childPath); }}
                                        title="Create subfolder">
                                        <FolderPlus size={12} />
                                    </button>
                                    <button onClick={(e) => {
                                        e.stopPropagation();
                                        const newName = prompt(`Rename Category path: ${childPath}\n(e.g., changing 'Rock' to 'Metal' in 'Music/Rock' makes it 'Music/Metal'):`, childPath);
                                        if (newName && newName !== childPath) {
                                            renameCategory(childPath, newName);
                                        }
                                    }} title="Rename Category (Affects all sub-items)">
                                        <Edit2 size={12} />
                                    </button>
                                    <button onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveCategory(childPath);
                                        handleDownloadClick();
                                    }} title="Download Folder as ZIP">
                                        <Download size={12} color="var(--text-muted)" />
                                    </button>
                                </div>
                            </div>

                            {isOpen && (
                                <>
                                    {Object.keys(childNode).filter(k => k !== '__tracks').length > 0 && (
                                        <FolderNodeTree node={childNode} pathPrefix={childPath} depth={depth + 1} />
                                    )}
                                    {childNode.__tracks && childNode.__tracks.length > 0 && childNode.__tracks.map(track => (
                                        <div
                                            key={`tree-track-${track.id}`}
                                            className="lm-item tree-track-item"
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, track.id)}
                                            onDragEnd={() => setDraggedTrackId(null)}
                                            title="Hold Shift while dropping to ADD category instead of moving"
                                            style={{
                                                paddingLeft: `${10 + (depth + 1) * 15 + 18}px`,
                                                opacity: draggedTrackId === track.id ? 0.5 : 1,
                                                cursor: 'grab',
                                                marginBottom: 2
                                            }}
                                        >
                                            <div className="lm-item-title" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: '0.85em', opacity: 0.8 }}>
                                                <Music size={12} style={{ marginRight: 6, opacity: 0.5 }} />
                                                <span>{track.title || 'Unknown Title'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    );
                })}
            </>
        );
    };

    return (
        <div ref={wrapperRef} className="library-manager-wrapper" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDropCategory(e, 'Uncategorized')}>
            {/* Pane 1: Categories Tree */}
            <div className="lm-panel" style={{ flex: `0 0 ${leftWidth}px`, display: 'flex', flexDirection: 'column' }}>
                <div className="lm-panel-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Folder size={18} /> <h2>Categories</h2>
                        <button
                            onClick={() => createSubfolder(null)}
                            title="Create root category"
                            style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem' }}
                        >
                            <FolderPlus size={12} /> New
                        </button>
                    </div>

                    <div className="lm-search-container">
                        <Search className="lm-search-icon" size={16} />
                        <input
                            type="text"
                            placeholder="Filter categories..."
                            value={catSearchQuery}
                            onChange={(e) => setCatSearchQuery(e.target.value)}
                            className="lm-search-input"
                        />
                        {catSearchQuery && (
                            <button
                                onClick={() => setCatSearchQuery('')}
                                className="lm-search-clear"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="lm-panel-content" style={{ flex: 1, overflowY: 'auto' }}>
                    <div
                        className={`lm-item ${!activeCategory ? 'active' : ''} ${dragOverCategory === null ? 'drag-over' : ''}`}
                        onClick={() => setActiveCategory(null)}
                        onDragOver={(e) => handleDragOverCategory(e, null)}
                        onDrop={(e) => handleDropCategory(e, 'Uncategorized')}
                        onDragLeave={() => setDragOverCategory(null)}
                        style={{ paddingLeft: '10px', marginBottom: '8px' }}
                    >
                        <div className="lm-item-title">
                            <span style={{ marginLeft: 18 }}><Folder size={16} color="var(--text-muted)" /></span>
                            <span style={{ marginLeft: 6 }}>All Tracks</span>
                        </div>
                    </div>

                    <FolderNodeTree node={displayTree} pathPrefix="" depth={0} />
                </div>
            </div>

            {/* Resize handle 1 */}
            <div className="lm-resize-handle" onMouseDown={handleLeftResizeStart} />

            {/* Pane 2: Tracks with Search */}
            <div className="lm-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="lm-panel-header" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <h2 style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Music size={18} />
                        <span style={{ opacity: 0.8, fontSize: '0.9em' }}>
                            {activeCategory ? activeCategory.split('/').pop() : 'All Tracks'}
                        </span>
                        <span style={{ fontSize: '0.7em', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 10 }}>
                            {displayedTracks.length}
                        </span>
                        <button
                            onClick={handleDownloadClick}
                            disabled={displayedTracks.length === 0}
                            style={{
                                marginLeft: '8px',
                                background: 'var(--primary)',
                                color: 'var(--bg-dark)',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: displayedTracks.length === 0 ? 'not-allowed' : 'pointer',
                                opacity: displayedTracks.length === 0 ? 0.5 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                            title="Download ZIP"
                        >
                            <Download size={14} /> ZIP
                        </button>
                        <button
                            onClick={() => setIsCCBrowserOpen(true)}
                            style={{
                                marginLeft: '4px',
                                background: 'rgba(74, 222, 128, 0.15)',
                                color: '#4ade80',
                                border: '1px solid rgba(74, 222, 128, 0.3)',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                            }}
                            title="Browse Creative Commons music"
                        >
                            CC
                        </button>
                    </h2>
                    {/* Source Selector */}
                    <div className="source-selector" title="Download source">
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
                        title="Download Settings"
                    >
                        <Settings size={18} />
                    </button>
                    <div className="lm-search-container" style={{ width: '300px' }}>
                        <Search className="lm-search-icon" size={16} />
                        <input
                            type="text"
                            placeholder="Search songs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="lm-search-input"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="lm-search-clear"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {
                    highlightNewOn && (
                        <div style={{ padding: '8px 16px', background: 'rgba(var(--primary-rgb, 100, 100, 255), 0.1)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>✨ Showing recently added sounds</span>
                            <button onClick={() => setHighlightNewOn(false)} style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>
                                Clear Filter
                            </button>
                        </div>
                    )
                }

                <div className="lm-panel-content" style={{ flex: 1, overflow: 'hidden', height: 0 }}>
                    {displayedTracks.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
                            No tracks match your search or category.
                        </div>
                    ) : (
                        <Virtuoso
                            style={{ height: '100%' }}
                            data={displayedTracks}
                            itemContent={(index, track) => {
                                const isDownloading = downloadingTracks.has(track.id);
                                const hasFailed = !track.is_downloaded && !!track.download_error;
                                const needsDownload = !track.is_downloaded && !isDownloading;
                                const hasUrl = !!track.youtube_url;
                                const addedAt = track.added_at ? new Date(track.added_at) : null;
                                const isRecentlyAdded = addedAt && (Date.now() - addedAt.getTime()) < 86400000;
                                const tooltipText = hasFailed
                                    ? `Download failed: ${track.download_error}\nHold Shift while dropping to ADD category instead of moving`
                                    : isRecentlyAdded
                                        ? `Recently Added (${addedAt.toLocaleDateString()})\nHold Shift while dropping to ADD category instead of moving`
                                        : "Hold Shift while dropping to ADD category instead of moving";
                                let rowClassName = 'lm-item';
                                if (hasFailed) rowClassName += ' lm-item--failed';
                                else if (needsDownload && !hasUrl) rowClassName += ' lm-item--needs-sync';
                                else if (needsDownload && hasUrl) rowClassName += ' lm-item--pending';
                                return (
                                    <div
                                        className={rowClassName}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, track.id)}
                                        onDragEnd={() => setDraggedTrackId(null)}
                                        title={tooltipText}
                                        style={{
                                            opacity: draggedTrackId === track.id ? 0.5 : (isDownloading ? 0.7 : 1),
                                            cursor: 'grab',
                                            borderLeft: hasFailed ? '3px solid #ef4444'
                                                : needsDownload && !hasUrl ? '3px solid #8b5cf6'
                                                : needsDownload && hasUrl ? '3px solid #f59e0b'
                                                : isRecentlyAdded ? '2px solid var(--primary)'
                                                : '2px solid transparent'
                                        }}
                                    >
                                        <div className="lm-item-title" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                            <GripVertical size={14} style={{ opacity: 0.5 }} />
                                            {isDownloading && (
                                                <Loader2 size={14} className="spin" style={{ opacity: 0.8, color: 'var(--primary)' }} />
                                            )}
                                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                                <img
                                                    src={track.thumbnail || 'https://via.placeholder.com/32'}
                                                    alt=""
                                                    onError={(e) => { e.target.onerror = null; e.target.src = '/music_placeholder.png'; }}
                                                    style={{
                                                        width: 32, height: 32, borderRadius: 4, objectFit: 'cover',
                                                        filter: needsDownload ? 'brightness(0.6) saturate(0.4)' : 'none'
                                                    }}
                                                />
                                                {needsDownload && !isDownloading && (
                                                    <Download size={12} style={{
                                                        position: 'absolute', bottom: 0, right: 0,
                                                        background: hasFailed ? '#ef4444' : '#f59e0b',
                                                        color: 'white', borderRadius: '50%',
                                                        padding: 2, boxSizing: 'content-box'
                                                    }} />
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', marginLeft: '8px' }}>
                                                <span style={{ fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title || 'Unknown Title'}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {track.author}
                                                    {addedAt && <span style={{ marginLeft: 6, opacity: 0.6 }}>· {addedAt.toLocaleDateString()}</span>}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px', maxWidth: '340px', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            {needsDownload && !isDownloading && (
                                                <span
                                                    className={hasFailed ? 'lm-badge lm-badge--failed lm-badge--clickable'
                                                        : !hasUrl ? 'lm-badge lm-badge--needs-sync lm-badge--clickable'
                                                        : 'lm-badge lm-badge--pending lm-badge--clickable'}
                                                    onClick={(e) => handleQuickDownload(e, track)}
                                                    title={!hasUrl ? 'Click to find YouTube URL and download' : 'Click to download'}
                                                >
                                                    {syncingTracks.has(track.id)
                                                        ? <><Loader2 size={10} className="spin" style={{ marginRight: 3 }} />Finding URL...</>
                                                        : hasFailed ? '↺ Retry Download'
                                                        : !hasUrl ? '🔍 Find & Download'
                                                        : '⬇ Download Now'}
                                                </span>
                                            )}
                                            {(track.tags || []).slice(0, 3).map(tag => (
                                                <span key={tag} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                                                    {tag}
                                                </span>
                                            ))}
                                            <button
                                                onClick={(e) => track.is_downloaded ? handleTrackDownload(e, track) : handleQuickDownload(e, track)}
                                                title={track.is_downloaded ? "Download MP3" : (!track.youtube_url ? "Find YouTube URL & Download to Server" : "Download to Server")}
                                                style={{
                                                    background: 'transparent', border: 'none',
                                                    color: track.is_downloaded ? 'var(--text-muted)' : (needsDownload && !hasUrl ? '#8b5cf6' : '#f59e0b'),
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '6px'
                                                }}
                                            >
                                                <Download size={16} />
                                            </button>
                                            {activeProfile && activeProfile.id !== 'master' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveFromProfile(track); }}
                                                    title="Remove from this profile"
                                                    style={{
                                                        background: 'transparent', border: 'none',
                                                        color: 'rgba(255,100,100,0.5)', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', marginLeft: '2px'
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            }}
                        />
                    )}

                    {/* "Available from library" section — non-master profiles only */}
                    {activeProfile && activeProfile.id !== 'master' && filteredOtherTracks.length > 0 && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 4 }}>
                            <button
                                onClick={() => setOtherTracksOpen(o => !o)}
                                style={{
                                    width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none',
                                    color: 'var(--text-muted)', padding: '8px 12px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem'
                                }}
                            >
                                <ChevronRight size={13} style={{ transform: otherTracksOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                                Also available — not in your profile ({filteredOtherTracks.length})
                            </button>
                            {otherTracksOpen && filteredOtherTracks.map(track => (
                                <div
                                    key={track.id}
                                    className="lm-item"
                                    style={{ opacity: 0.6, borderLeft: '2px solid rgba(255,255,255,0.12)' }}
                                >
                                    <div className="lm-item-title" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                        <img
                                            src={track.thumbnail || '/music_placeholder.png'}
                                            alt=""
                                            onError={e => { e.target.onerror = null; e.target.src = '/music_placeholder.png'; }}
                                            style={{ width: 28, height: 28, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden', marginLeft: 8 }}>
                                            <span style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title || 'Unknown'}</span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{track.author}</span>
                                        </div>
                                    </div>
                                    <button
                                        disabled={addingToProfile.has(track.id)}
                                        onClick={() => handleAddToProfile(track)}
                                        title="Add to my profile"
                                        style={{
                                            flexShrink: 0, background: 'rgba(var(--primary-rgb,99,102,241),0.15)',
                                            border: '1px solid rgba(var(--primary-rgb,99,102,241),0.3)',
                                            borderRadius: 5, padding: '3px 8px', cursor: 'pointer',
                                            color: 'var(--primary)', fontSize: '0.72rem', whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {addingToProfile.has(track.id) ? '…' : '+ Add'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Resize handle 2 */}
            <div className="lm-resize-handle" onMouseDown={handleRightResizeStart} />

            {/* Pane 3: Setlists */}
            <div className="lm-panel" style={{ flex: `0 0 ${rightWidth}px`, display: 'flex', flexDirection: 'column' }}>
                <div className="lm-panel-header" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ListMusic size={18} /> <h2>Setlists</h2>
                    </div>
                    <button
                        onClick={handleCreateSetlist}
                        title="Créer une nouvelle setlist"
                        style={{ background: 'rgba(var(--primary-rgb,99,102,241),0.18)', border: '1px solid rgba(var(--primary-rgb,99,102,241),0.35)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
                    >
                        <Plus size={13} /> Créer
                    </button>
                    <button
                        onClick={() => setlistFileInputRef.current?.click()}
                        title="Importer une playlist .txt"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
                    >
                        <Upload size={13} /> Importer
                    </button>
                    <input ref={setlistFileInputRef} type="file" accept=".txt" style={{ display: 'none' }} onChange={handleImportSetlist} />
                </div>
                <div className="lm-panel-content" style={{ flex: 1, overflowY: 'auto' }}>
                    {setlists.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>
                            Aucune setlist. Cliquez sur "Créer" ou importez un fichier .txt.
                        </div>
                    ) : (
                        setlists.filter(sl => {
                            const count = sl.tracks.length + (sl.sublists || []).reduce((a, s) => a + s.tracks.length, 0);
                            return count > 0;
                        }).map(sl => {
                            const trackCount = sl.tracks.length + (sl.sublists || []).reduce((a, s) => a + s.tracks.length, 0);
                            const isRenaming = renamingSetlistId === sl.id;
                            return (
                                <div key={sl.id} className="lm-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4, padding: '8px 10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <ListMusic size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
                                        {isRenaming ? (
                                            <input
                                                autoFocus
                                                value={renameSetlistValue}
                                                onChange={e => setRenameSetlistValue(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') confirmRenameSetlist(sl);
                                                    if (e.key === 'Escape') setRenamingSetlistId(null);
                                                }}
                                                style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid var(--primary)', borderRadius: 4, padding: '2px 6px', color: 'var(--text)', fontSize: '0.85rem' }}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span style={{ flex: 1, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sl.name}</span>
                                        )}
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>{trackCount}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                        {isRenaming ? (
                                            <>
                                                <SmallBtn title="Confirmer" onClick={() => confirmRenameSetlist(sl)} color="var(--success, #4ade80)"><Check size={12} /></SmallBtn>
                                                <SmallBtn title="Annuler" onClick={() => setRenamingSetlistId(null)}><X size={12} /></SmallBtn>
                                            </>
                                        ) : (
                                            <>
                                                <SmallBtn title="Renommer" onClick={() => startRenameSetlist(sl.id, sl.name)}><Pencil size={12} /></SmallBtn>
                                                <SmallBtn title="Exporter en .txt" onClick={() => handleExportSetlist(sl.id)} color="var(--primary)"><Download size={12} /></SmallBtn>
                                                <SmallBtn title="Supprimer" onClick={() => handleDeleteSetlist(sl.id, sl.name)} color="#ef4444"><Trash2 size={12} /></SmallBtn>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <ZipDownloadModal
                isOpen={isZipModalOpen}
                onClose={() => setIsZipModalOpen(false)}
                onConfirm={handleZipConfirm}
                folderName={activeCategory ? activeCategory.split('/').pop() : null}
            />

            <CCBrowserModal
                isOpen={isCCBrowserOpen}
                onClose={() => setIsCCBrowserOpen(false)}
                onDownload={handleCCDownload}
                profileId={activeProfile?.id}
            />

            <ConfigPanel
                isOpen={isConfigOpen}
                onClose={() => setIsConfigOpen(false)}
                currentMode={downloadMode}
                onModeChange={handleModeChange}
            />

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                files={droppedFiles}
                profileId={activeProfile?.id}
                onImportComplete={() => {
                    // Logic to refresh track list if needed, 
                    // though useLibrary should handle it if it polls or we trigger it.
                    window.location.reload(); // Simple refresh for now
                }}
            />
        </div>
    );
}
