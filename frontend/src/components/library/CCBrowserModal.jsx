import React, { useState } from 'react';
import { X, Search, Download, Loader2, CheckCircle } from 'lucide-react';
import { API_BASE } from '../../api';
import './CCBrowserModal.css';

// Map license strings to badge colors
function getLicenseBadgeClass(license) {
    const l = (license || '').toLowerCase();
    if (l.includes('cc0') || l.includes('public domain')) return 'cc-badge--cc0';
    if (l.includes('by-sa')) return 'cc-badge--bysa';
    if (l.includes('by-nc')) return 'cc-badge--bync';
    if (l.includes('by')) return 'cc-badge--by';
    return 'cc-badge--default';
}

export default function CCBrowserModal({ isOpen, onClose }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState(null);

    // Per-track state: { [trackId]: 'loading' | 'done' | null }
    const [trackStates, setTrackStates] = useState({});

    const handleSearch = async (e) => {
        e?.preventDefault();
        const q = query.trim();
        if (!q) return;

        setSearching(true);
        setError(null);
        setResults([]);
        setSearched(false);
        setTrackStates({});

        try {
            const res = await fetch(`${API_BASE}/cc/search?q=${encodeURIComponent(q)}&limit=10`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || `Search failed (${res.status})`);
            }
            const data = await res.json();
            setResults(data.tracks || []);
        } catch (err) {
            setError(err.message || 'Search failed');
        } finally {
            setSearching(false);
            setSearched(true);
        }
    };

    const handleDownload = async (track) => {
        setTrackStates(prev => ({ ...prev, [track.id]: 'loading' }));
        try {
            const res = await fetch(`${API_BASE}/cc/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track, category: 'Uncategorized' }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || `Download failed (${res.status})`);
            }
            setTrackStates(prev => ({ ...prev, [track.id]: 'done' }));
        } catch (err) {
            setTrackStates(prev => ({ ...prev, [track.id]: null }));
            alert(`Download failed: ${err.message}`);
        }
    };

    const handleClose = () => {
        setQuery('');
        setResults([]);
        setSearched(false);
        setError(null);
        setTrackStates({});
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="cc-modal-overlay" onClick={handleClose}>
            <div className="cc-modal" onClick={e => e.stopPropagation()}>
                <div className="cc-modal-header">
                    <div className="cc-modal-title">
                        <span className="cc-modal-icon">🎵</span>
                        <h2>Creative Commons Browser</h2>
                    </div>
                    <button className="cc-modal-close" onClick={handleClose} title="Close">
                        <X size={18} />
                    </button>
                </div>

                <form className="cc-search-bar" onSubmit={handleSearch}>
                    <div className="cc-search-input-wrap">
                        <Search className="cc-search-icon" size={16} />
                        <input
                            type="text"
                            placeholder="Search royalty-free music (e.g. jazz, ambient, upbeat)..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="cc-search-input"
                            autoFocus
                        />
                    </div>
                    <button
                        type="submit"
                        className="cc-search-btn"
                        disabled={searching || !query.trim()}
                    >
                        {searching ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                        Search
                    </button>
                </form>

                <div className="cc-results">
                    {error && (
                        <div className="cc-message cc-message--error">{error}</div>
                    )}

                    {!error && searched && results.length === 0 && (
                        <div className="cc-message">No tracks found. Try a different search term.</div>
                    )}

                    {!searched && !searching && (
                        <div className="cc-message cc-message--hint">
                            Search the Free Music Archive for Creative Commons licensed tracks.
                        </div>
                    )}

                    {results.map(track => {
                        const state = trackStates[track.id];
                        return (
                            <div key={track.id} className="cc-track-row">
                                <div className="cc-track-info">
                                    <span className="cc-track-title">{track.title}</span>
                                    <span className="cc-track-author">{track.author}</span>
                                </div>
                                <div className="cc-track-actions">
                                    <span className={`cc-badge ${getLicenseBadgeClass(track.license)}`}>
                                        {track.license}
                                    </span>
                                    {state === 'done' ? (
                                        <span className="cc-track-done">
                                            <CheckCircle size={14} /> Added to library
                                        </span>
                                    ) : (
                                        <button
                                            className="cc-download-btn"
                                            onClick={() => handleDownload(track)}
                                            disabled={state === 'loading'}
                                            title="Download to library"
                                        >
                                            {state === 'loading'
                                                ? <Loader2 size={14} className="spin" />
                                                : <Download size={14} />
                                            }
                                            {state === 'loading' ? 'Downloading...' : 'Download'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
