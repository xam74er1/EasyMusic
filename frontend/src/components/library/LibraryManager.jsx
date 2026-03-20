import React, { useState, useMemo } from 'react';
import { useLibrary } from '../LibraryContext';
import { useToast } from '../ToastContext';
import { Folder, Music, Edit2, GripVertical, Search, X, ChevronRight, FolderOpen, Download, Loader2 } from 'lucide-react';
import './LibraryManager.css';
import ZipDownloadModal from './ZipDownloadModal';
import ImportModal from './ImportModal';
import api from '../../api';

// Build a nested tree from track categories
function buildCategoryTree(tracks) {
    const root = {};
    for (const t of tracks) {
        if (!t.category) continue;
        const categories = t.category.split(';').map(c => c.trim()).filter(Boolean);
        for (const cat of categories) {
            const path = cat.split('/').map(s => s.trim()).filter(Boolean);
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

export default function LibraryManager() {
    const {
        tracks,
        updateTrackCategory,
        renameCategory,
        downloadingTracks
    } = useLibrary();

    const { addToast } = useToast();

    const [activeCategory, setActiveCategory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [catSearchQuery, setCatSearchQuery] = useState('');

    // Default open all if searching, else track manually
    const [openFolders, setOpenFolders] = useState({});

    // Highlight new sounds toggle
    const [highlightNewOn, setHighlightNewOn] = useState(false);

    React.useEffect(() => {
        const handleHighlight = () => {
            setHighlightNewOn(true);
            setActiveCategory(null); // Go to all tracks
            setSearchQuery('');      // Clear search so we see everything
        };
        window.addEventListener('highlight-new', handleHighlight);
        return () => window.removeEventListener('highlight-new', handleHighlight);
    }, []);

    // --- Zip Modal Data ---
    const [isZipModalOpen, setIsZipModalOpen] = useState(false);

    // --- Import Modal Data ---
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [droppedFiles, setDroppedFiles] = useState([]);

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

    const handleDropCategory = async (e, category) => {
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
    const fullTree = useMemo(() => buildCategoryTree(tracks), [tracks]);

    const displayTree = useMemo(() => {
        if (!catSearchQuery.trim()) return fullTree;
        return filterTree(fullTree, catSearchQuery).node;
    }, [fullTree, catSearchQuery]);

    // --- Filtered Tracks (Right Panel) ---
    const displayedTracks = useMemo(() => {
        let filtered = tracks;

        // Filter by category or its subcategories
        if (activeCategory) {
            filtered = filtered.filter(t => {
                if (!t.category) return false;
                const cats = t.category.split(';').map(c => c.trim()).filter(Boolean);
                return cats.some(c => c === activeCategory || c.startsWith(activeCategory + '/'));
            });
        } else {
            // If Uncategorized is clicked? Actually we use activeCategory = null for All Tracks. 
            // To view 'Uncategorized' only we use activeCategory = 'Uncategorized'.
            filtered = tracks;
        }

        // Filter by search query
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(t =>
                (t.title || '').toLowerCase().includes(query) ||
                (t.author || '').toLowerCase().includes(query) ||
                (t.tags || []).some(tag => tag.toLowerCase().includes(query))
            );
        }

        // Apply highlight-new filter
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

        return filtered;
    }, [tracks, activeCategory, searchQuery]);

    const toggleFolder = (path) => setOpenFolders(prev => ({ ...prev, [path]: !prev[path] }));
    const isFolderOpen = (path) => catSearchQuery ? true : openFolders[path] !== false;

    // --- Zip Download Logic ---
    const handleDownloadClick = () => {
        setIsZipModalOpen(true);
    };

    const handleZipConfirm = async (flatStructure) => {
        setIsZipModalOpen(false);
        const folderId = activeCategory || '';
        // In a real app we might pass the active profile ID. We will leave it empty as backend supports it.
        const profileId = '';

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
                                        setActiveCategory(childPath); // switch to this category
                                        handleDownloadClick(); // trigger download modal
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
        <div className="library-manager-wrapper" onDragOver={(e) => e.preventDefault()} onDrop={handleDropCategory}>
            {/* Pane 1: Categories Tree */}
            <div className="lm-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="lm-panel-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Folder size={18} /> <h2>Categories</h2>
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

            {/* Pane 2: Tracks with Search */}
            <div className="lm-panel" style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
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
                    </h2>
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

                <div className="lm-panel-content">
                    {displayedTracks.map(track => {
                        const isDownloading = downloadingTracks.has(track.id);

                        // Check if added within the last 24 hours
                        const addedAt = track.added_at ? new Date(track.added_at) : null;
                        const isRecentlyAdded = addedAt && (new Date() - addedAt) < 24 * 60 * 60 * 1000;
                        const tooltipText = isRecentlyAdded ? `Recently Added (${addedAt.toLocaleDateString()})\nHold Shift while dropping to ADD category instead of moving` : "Hold Shift while dropping to ADD category instead of moving";

                        return (
                            <div
                                key={track.id}
                                className="lm-item"
                                draggable
                                onDragStart={(e) => handleDragStart(e, track.id)}
                                onDragEnd={() => setDraggedTrackId(null)}
                                title={tooltipText}
                                style={{
                                    opacity: draggedTrackId === track.id ? 0.5 : (isDownloading ? 0.7 : 1),
                                    cursor: 'grab',
                                    borderLeft: isRecentlyAdded ? '2px solid var(--primary)' : '2px solid transparent'
                                }}
                            >
                                <div className="lm-item-title" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                    <GripVertical size={14} style={{ opacity: 0.5 }} />
                                    {isDownloading && (
                                        <Loader2 size={14} className="spin" style={{ opacity: 0.8, color: 'var(--primary)' }} />
                                    )}
                                    <img
                                        src={track.thumbnail || 'https://via.placeholder.com/32'}
                                        alt=""
                                        onError={(e) => { e.target.onerror = null; e.target.src = '/music_placeholder.png'; }}
                                        style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', marginLeft: '8px' }}>
                                        <span style={{ fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title || 'Unknown Title'}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{track.author}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', maxWidth: '300px', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    {(track.tags || []).slice(0, 3).map(tag => (
                                        <span key={tag} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                                            {tag}
                                        </span>
                                    ))}
                                    <button
                                        onClick={(e) => handleTrackDownload(e, track)}
                                        title="Download MP3"
                                        style={{
                                            background: 'transparent', border: 'none',
                                            color: track.is_downloaded ? 'var(--text-muted)' : 'rgba(255,255,255,0.2)',
                                            cursor: track.is_downloaded ? 'pointer' : 'not-allowed',
                                            display: 'flex', alignItems: 'center', marginLeft: '6px'
                                        }}
                                    >
                                        <Download size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {displayedTracks.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
                            No tracks match your search or category.
                        </div>
                    )}
                </div>
            </div>

            <ZipDownloadModal
                isOpen={isZipModalOpen}
                onClose={() => setIsZipModalOpen(false)}
                onConfirm={handleZipConfirm}
                folderName={activeCategory ? activeCategory.split('/').pop() : null}
            />

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                files={droppedFiles}
                onImportComplete={() => {
                    // Logic to refresh track list if needed, 
                    // though useLibrary should handle it if it polls or we trigger it.
                    window.location.reload(); // Simple refresh for now
                }}
            />
        </div>
    );
}
