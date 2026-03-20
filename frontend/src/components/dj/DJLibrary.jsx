import React, { useState, useMemo } from 'react';
import { Folder, FolderOpen, List, Search, ChevronRight, Plus } from 'lucide-react';

import api from '../../api';

function buildCategoryTree(tracks) {
    const root = {};
    for (const t of tracks) {
        const categories = (t.category || 'Uncategorized').split(';').map(c => c.trim()).filter(Boolean);
        if (categories.length === 0) categories.push('Uncategorized');

        for (const cat of categories) {
            const path = cat.split('/').map(s => s.trim()).filter(Boolean);
            let node = root;
            for (const seg of path) {
                if (!node[seg]) node[seg] = {};
                node = node[seg];
            }
            if (!node.__tracks) node.__tracks = [];
            // Avoid duplicates if track falls into same node via multiple tags
            if (!node.__tracks.find(x => x.id === t.id)) {
                node.__tracks.push(t);
            }
        }
    }
    return root;
}

export default function DJLibrary({ playlist, onLoadToDeck, showAddToSetlist = false, onAddToSetlist }) {
    const [viewMode, setViewMode] = useState('folder');
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('All');
    const [sortCol, setSortCol] = useState('title');
    const [sortDir, setSortDir] = useState('asc');
    const [openFolders, setOpenFolders] = useState({});

    const categories = useMemo(() => {
        const cats = new Set();
        playlist.forEach(t => {
            if (t.category) {
                t.category.split(';').forEach(c => {
                    const trimmed = c.trim();
                    if (trimmed) cats.add(trimmed);
                });
            }
        });
        return ['All', ...Array.from(cats).sort()];
    }, [playlist]);

    const filtered = useMemo(() => {
        let arr = [...playlist];
        if (search.trim()) {
            const q = search.toLowerCase();
            arr = arr.filter(t => {
                return t.title?.toLowerCase().includes(q)
                    || t.author?.toLowerCase().includes(q)
                    || t.tags?.some(tag => tag.toLowerCase().includes(q));
            });
        }
        if (filterCat !== 'All') {
            arr = arr.filter(t => {
                if (!t.category) return false;
                const cats = t.category.split(';').map(c => c.trim()).filter(Boolean);
                return cats.some(c => c === filterCat || c.startsWith(filterCat + '/'));
            });
        }
        return arr;
    }, [playlist, search, filterCat]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const va = (a[sortCol] ?? '').toString().toLowerCase();
            const vb = (b[sortCol] ?? '').toString().toLowerCase();
            return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        });
    }, [filtered, sortCol, sortDir]);

    const tree = useMemo(() => buildCategoryTree(filtered), [filtered]);

    const toggleFolder = (path) => setOpenFolders(prev => ({ ...prev, [path]: !prev[path] }));
    const isFolderOpen = (path) => openFolders[path] !== false;

    const handleSort = (col) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };

    const sortIcon = (col) => sortCol !== col ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓';

    // Always use /api/play/ since we only show downloaded tracks
    const getPlayUrl = (t) => api.getPlayUrl(t.id);

    const handleDragStart = (e, trackId) => {
        e.dataTransfer.setData('text/track-id', trackId);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const TrackRow = ({ track }) => {
        const url = getPlayUrl(track);
        return (
            <div className="lib-track-row" draggable onDragStart={e => handleDragStart(e, track.id)}>
                <img
                    className="lib-track-thumb"
                    src={track.thumbnail || '/music_placeholder.png'}
                    alt=""
                    onError={(e) => { e.target.onerror = null; e.target.src = '/music_placeholder.png'; }}
                />
                <div className="lib-track-info">
                    <div className="lib-track-title">{track.title}</div>
                    <div className="lib-track-author">{track.author}</div>
                </div>
                {track.tags && track.tags.length > 0 && (
                    <div className="lib-track-tags">
                        {track.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="dj-badge badge-tag">#{tag}</span>
                        ))}
                        {track.tags.length > 3 && (
                            <span className="dj-badge badge-tag" style={{ opacity: 0.6 }}>+{track.tags.length - 3}</span>
                        )}
                    </div>
                )}
                <div className="lib-load-btns">
                    {showAddToSetlist && (
                        <button className="sl-add-btn" onClick={() => onAddToSetlist(track.id)} title="Add to setlist">
                            <Plus size={10} />
                        </button>
                    )}
                    <button className="load-to-deck deck-a-btn" onClick={() => onLoadToDeck('a', track, url)}>→ A</button>
                    <button className="load-to-deck deck-b-btn" onClick={() => onLoadToDeck('b', track, url)}>→ B</button>
                </div>
            </div>
        );
    };

    const FolderNode = ({ node, pathPrefix, depth }) => {
        const childKeys = Object.keys(node).filter(k => k !== '__tracks').sort();
        const tracks = node.__tracks || [];

        return (
            <>
                {childKeys.map(key => {
                    const childPath = pathPrefix ? `${pathPrefix}/${key}` : key;
                    const childNode = node[key];
                    const isOpen = isFolderOpen(childPath);

                    const countTracks = (n) => {
                        let c = (n.__tracks || []).length;
                        for (const k of Object.keys(n).filter(k => k !== '__tracks')) c += countTracks(n[k]);
                        return c;
                    };
                    const total = countTracks(childNode);

                    return (
                        <div className="folder-group" key={childPath}>
                            <div className="folder-header" style={{ paddingLeft: `${16 + depth * 16}px` }} onClick={() => toggleFolder(childPath)}>
                                <span className={`folder-icon ${isOpen ? 'open' : ''}`}><ChevronRight size={13} /></span>
                                {isOpen ? <FolderOpen size={15} color="var(--primary)" /> : <Folder size={15} color="var(--text-muted)" />}
                                <span className="folder-name">{key}</span>
                                <span className="folder-count">{total}</span>
                            </div>
                            {isOpen && (
                                <div className="folder-children">
                                    <FolderNode node={childNode} pathPrefix={childPath} depth={depth + 1} />
                                    {(childNode.__tracks || []).map(t => (
                                        <div key={t.id} style={{ paddingLeft: `${(depth + 1) * 16}px` }}>
                                            <TrackRow track={t} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
                {depth === 0 && tracks.length > 0 && tracks.map(t => (
                    <TrackRow key={t.id} track={t} />
                ))}
            </>
        );
    };

    return (
        <div className="vdj-library">
            <div className="library-toolbar">
                <span className="library-title">Library</span>

                <button className={`lib-view-btn ${viewMode === 'folder' ? 'active' : ''}`} onClick={() => setViewMode('folder')}>
                    <Folder size={13} /> Folders
                </button>
                <button className={`lib-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                    <List size={13} /> List
                </button>

                <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input className="lib-search" style={{ paddingLeft: 28 }} placeholder="Search title, artist, tag..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                <select className="lib-filter" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <span className="lib-count">{filtered.length} track{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="library-body">
                {filtered.length === 0 && (
                    <div className="no-tracks-msg">No downloaded tracks match your search.</div>
                )}

                {viewMode === 'folder' && <FolderNode node={tree} pathPrefix="" depth={0} />}

                {viewMode === 'list' && (
                    <table className="lib-list-table">
                        <thead>
                            <tr>
                                <th className={sortCol === 'title' ? 'sorted' : ''} onClick={() => handleSort('title')}>Title{sortIcon('title')}</th>
                                <th className={sortCol === 'author' ? 'sorted' : ''} onClick={() => handleSort('author')}>Artist{sortIcon('author')}</th>
                                <th className={sortCol === 'category' ? 'sorted' : ''} onClick={() => handleSort('category')}>Category{sortIcon('category')}</th>
                                <th>Tags</th>
                                <th>Load</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map(t => {
                                const url = getPlayUrl(t);
                                return (
                                    <tr key={t.id} draggable onDragStart={e => handleDragStart(e, t.id)}>
                                        <td className="col-title">{t.title}</td>
                                        <td className="col-author">{t.author}</td>
                                        <td><span className="dj-badge badge-cat">{t.category}</span></td>
                                        <td className="col-tags">
                                            {t.tags?.slice(0, 3).map(tag => (
                                                <span key={tag} className="dj-badge badge-tag">#{tag}</span>
                                            ))}
                                        </td>
                                        <td className="col-actions">
                                            {showAddToSetlist && (
                                                <button className="sl-add-btn" onClick={() => onAddToSetlist(t.id)} title="Add to setlist" style={{ marginRight: 3 }}>
                                                    <Plus size={10} />
                                                </button>
                                            )}
                                            <button className="load-to-deck deck-a-btn" onClick={() => onLoadToDeck('a', t, url)}>→ A</button>{' '}
                                            <button className="load-to-deck deck-b-btn" onClick={() => onLoadToDeck('b', t, url)}>→ B</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
