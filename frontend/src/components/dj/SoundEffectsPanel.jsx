import React, { useState, useEffect, useRef } from 'react';
import { Download, Play, Pause, Trash2, Link as LinkIcon, Edit2, X, Search, Globe, Folder, PlayCircle, Bot, Send, Check, Loader2 } from 'lucide-react';
import VisualKeyboard from './VisualKeyboard';
import { useToast } from '../ToastContext';
import './SoundEffectsPanel.css';

import api, { API_BASE } from '../../api';

export default function SoundEffectsPanel({
    keybindings = {},
    onUpdateKeybindings,
    onPlaySoundEffect
}) {
    const { addToast } = useToast();
    const [effects, setEffects] = useState([]);
    const [activeKeys, setActiveKeys] = useState(new Set());

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchSource, setSearchSource] = useState('youtube'); // 'youtube' | 'pixabay'
    const [isSearching, setIsSearching] = useState(false);
    const [activeTab, setActiveTab] = useState('local'); // 'local' | 'search' | 'ai'

    // AI Chat state
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Preview audio state
    const [previewingId, setPreviewingId] = useState(null);
    const audioRef = useRef(new Audio());

    const [url, setUrl] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const [isBindingMode, setIsBindingMode] = useState(false);
    const [selectedEffectId, setSelectedEffectId] = useState(null);

    const [editingEffect, setEditingEffect] = useState(null);
    const [editName, setEditName] = useState('');
    const [editCategory, setEditCategory] = useState('');

    const keybindingsRef = useRef({});
    useEffect(() => { keybindingsRef.current = keybindings; }, [keybindings]);

    useEffect(() => {
        fetchEffects();

        const handleGlobalKeyDown = (e) => {
            const keyChar = e.key.toLowerCase();
            setActiveKeys(prev => new Set(prev).add(keyChar));
        };

        const handleGlobalKeyUp = (e) => {
            const keyChar = e.key.toLowerCase();
            setActiveKeys(prev => {
                const next = new Set(prev);
                next.delete(keyChar);
                return next;
            });
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('keyup', handleGlobalKeyUp);

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('keyup', handleGlobalKeyUp);
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
        };
    }, []);

    useEffect(() => {
        if (activeTab === 'ai') scrollToBottom();
    }, [chatMessages, activeTab]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchEffects = async () => {
        try {
            const res = await api.getSoundEffects();
            const data = await res.json();
            setEffects(data || []);
        } catch (err) {
            console.error('Failed to fetch sound effects:', err);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const res = await api.searchSoundEffects(searchQuery, searchSource);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data.hits || []);
            } else {
                const err = await res.json();
                addToast(`Search failed: ${err.detail}`, "error");
            }
        } catch (err) {
            console.error('Search error:', err);
            addToast('Failed to connect to search API', "error");
        } finally {
            setIsSearching(false);
        }
    };

    const togglePreview = async (hit) => {
        if (previewingId === hit.id) {
            // Pause
            audioRef.current.pause();
            setPreviewingId(null);
        } else {
            // Play new
            audioRef.current.pause();
            setPreviewingId(hit.id);

            try {
                let finalUrl = hit.audio || hit.preview;
                if (!finalUrl && searchSource === 'youtube') {
                    const res = await api.previewYoutubeSfx(hit.id);
                    if (res.ok) {
                        const data = await res.json();
                        finalUrl = data.url;
                    } else {
                        addToast("Could not load YouTube preview. Try downloading instead.", "error");
                        setPreviewingId(null);
                        return;
                    }
                }

                if (finalUrl) {
                    audioRef.current.src = finalUrl;
                    audioRef.current.play().catch(e => {
                        console.warn(e);
                        setPreviewingId(null);
                    });

                    audioRef.current.onended = () => {
                        setPreviewingId(null);
                    };
                } else {
                    addToast("No preview audio available.", "error");
                    setPreviewingId(null);
                }
            } catch (err) {
                console.error("Preview error", err);
                setPreviewingId(null);
            }
        }
    };

    const downloadSearchResult = async (hit) => {
        setDownloadingId(hit.id);
        try {
            let res;
            if (searchSource === 'youtube') {
                const downloadName = hit.description || `YouTube-${hit.id}`;
                res = await api.downloadYoutubeSfx(hit.id, downloadName);
            } else {
                const bestAudioUrl = hit.audio || hit.preview;
                const downloadName = hit.tags ? hit.tags.split(',')[0].trim() : `Pixabay-${hit.id}`;
                res = await api.downloadUrlSfx(bestAudioUrl, downloadName);
            }

            if (res.ok) {
                fetchEffects();
                setActiveTab('local');
            } else {
                const err = await res.json();
                addToast(`Download failed: ${err.detail}`, "error");
            }
        } catch (err) {
            console.error('Download error:', err);
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDownloadUrl = async (e) => {
        e.preventDefault();
        if (!url) return;
        setDownloading(true);
        try {
            const res = await api.downloadUrlSfx(url);
            if (res.ok) {
                setUrl('');
                fetchEffects();
                setActiveTab('local');
            } else {
                addToast('Failed to download from URL. Check console for details.', "error");
            }
        } catch (err) {
            console.error('Download error:', err);
        } finally {
            setDownloading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this sound effect?')) return;
        try {
            await api.deleteSoundEffect(id);

            const newBindings = { ...keybindings };
            let updated = false;
            Object.entries(newBindings).forEach(([key, val]) => {
                if (val === id) {
                    delete newBindings[key];
                    updated = true;
                }
            });
            if (updated) onUpdateKeybindings(newBindings);

            if (selectedEffectId === id) setSelectedEffectId(null);
            fetchEffects();
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const startEditing = (effect) => {
        setEditingEffect(effect);
        setEditName(effect.name || '');
        setEditCategory(effect.category || 'Uncategorized');
    };

    const saveEdit = async () => {
        if (!editingEffect) return;
        try {
            await api.updateSoundEffect(editingEffect.id, { name: editName, category: editCategory });
            fetchEffects();
        } catch (err) {
            console.error('Edit error:', err);
        } finally {
            setEditingEffect(null);
        }
    };

    const handleChatSubmit = async (e) => {
        e.preventDefault();
        if (!chatInput.trim() || isAiLoading) return;

        const userMsg = { role: 'user', content: chatInput };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setIsAiLoading(true);

        try {
            const res = await api.chat({ message: userMsg.content, session_id: 'sfx_assistant' });
            const data = await res.json();

            setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
            // If the AI downloaded something, refresh list
            fetchEffects();
        } catch (err) {
            console.error('Chat error:', err);
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error.' }]);
        } finally {
            setIsAiLoading(false);
        }
    };

    const toggleBindMode = (effect) => {
        if (isBindingMode && selectedEffectId === effect.id) {
            setIsBindingMode(false);
            setSelectedEffectId(null);
        } else {
            setIsBindingMode(true);
            setSelectedEffectId(effect.id);
        }
    };

    const handleBindKey = (keyChar) => {
        if (!isBindingMode || !selectedEffectId) {
            const targetId = keybindings[keyChar];
            if (targetId) onPlaySoundEffect(targetId);
            return;
        }

        const currentBindingForThisEffect = Object.keys(keybindings).find(k => keybindings[k] === selectedEffectId);
        const newBindings = { ...keybindings };

        if (currentBindingForThisEffect) delete newBindings[currentBindingForThisEffect];

        if (currentBindingForThisEffect === keyChar) {
            delete newBindings[keyChar];
        } else {
            newBindings[keyChar] = selectedEffectId;
        }

        onUpdateKeybindings(newBindings);
        setIsBindingMode(false);
        setSelectedEffectId(null);
    };

    const handleUnbindEffect = (effectId) => {
        const newBindings = { ...keybindings };
        const keyToRemove = Object.keys(newBindings).find(k => newBindings[k] === effectId);
        if (keyToRemove) {
            delete newBindings[keyToRemove];
            onUpdateKeybindings(newBindings);
        }
    };

    // Listen for physical key presses while in binding mode
    useEffect(() => {
        if (!isBindingMode || !selectedEffectId) return;

        const handleKeyDownBind = (e) => {
            e.preventDefault();
            e.stopPropagation();
            let keyChar = e.key.toLowerCase();
            if (keyChar === ' ') keyChar = ' ';
            handleBindKey(keyChar);
        };

        // Use capture phase to intercept before VirtualDJ
        window.addEventListener('keydown', handleKeyDownBind, true);
        return () => window.removeEventListener('keydown', handleKeyDownBind, true);
    }, [isBindingMode, selectedEffectId, keybindings]);

    // Listen for playback keyboard triggers when NOT in bind mode
    useEffect(() => {
        if (isBindingMode) return;

        const handlePlaybackKeyDown = (e) => {
            if (e.repeat) return;
            const tag = document.activeElement?.tagName?.toLowerCase();
            const type = document.activeElement?.type?.toLowerCase();

            // Don't trigger if typing in an input field (like chat or search)
            if (tag === 'textarea' || tag === 'select') return;
            if (tag === 'input' && ['text', 'search', 'password', 'number', 'url'].includes(type || 'text')) return;

            let keyChar = e.key.toLowerCase();
            if (keyChar === ' ') keyChar = ' ';

            const boundEffectId = keybindingsRef.current[keyChar];
            if (boundEffectId) {
                e.preventDefault();
                onPlaySoundEffect(boundEffectId);
            }
        };

        window.addEventListener('keydown', handlePlaybackKeyDown);
        return () => window.removeEventListener('keydown', handlePlaybackKeyDown);
    }, [isBindingMode, onPlaySoundEffect]);

    const boundKeyObjects = {};
    Object.entries(keybindings).forEach(([keyStr, effectId]) => {
        const fx = effects.find(e => e.id === effectId);
        if (fx) {
            boundKeyObjects[keyStr] = { name: fx.name };
        }
    });

    // Grouping for Local sounds
    const groupedEffects = effects.reduce((acc, effect) => {
        const cat = effect.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(effect);
        return acc;
    }, {});

    return (
        <div className="se-panel">
            <div className="se-header">
                <h2 className="se-title">Sound Effects</h2>
                <div className="se-tabs">
                    <button
                        className={`se-tab ${activeTab === 'local' ? 'active' : ''}`}
                        onClick={() => setActiveTab('local')}
                    >
                        <Folder size={14} /> My Sounds
                    </button>
                    <button
                        className={`se-tab ${activeTab === 'search' ? 'active' : ''}`}
                        onClick={() => setActiveTab('search')}
                    >
                        <Globe size={14} /> Discover
                    </button>
                    <button
                        className={`se-tab ${activeTab === 'ai' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ai')}
                    >
                        <Bot size={14} /> AI Agent
                    </button>
                </div>
            </div>

            <div className="se-content-area">
                {activeTab === 'search' ? (
                    <div className="se-search-section">
                        <form className="se-search-form" onSubmit={handleSearch}>
                            <select
                                value={searchSource}
                                onChange={(e) => setSearchSource(e.target.value)}
                                className="se-input"
                                style={{ width: '120px', padding: '10px' }}
                            >
                                <option value="youtube">YouTube</option>
                                <option value="pixabay">Pixabay</option>
                            </select>
                            <div className="se-input-group">
                                <Search size={16} className="se-input-icon" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={`Search ${searchSource === 'youtube' ? 'YouTube' : 'Pixabay'}...`}
                                    className="se-input"
                                    disabled={isSearching}
                                />
                            </div>
                            <button type="submit" className="se-dl-btn" disabled={isSearching || !searchQuery}>
                                {isSearching ? '...' : 'Search'}
                            </button>
                        </form>

                        <div className="se-list-container">
                            {searchResults.length === 0 ? (
                                <div className="se-empty">Search for sounds to download and bind.</div>
                            ) : (
                                <div className="se-list">
                                    {searchResults.map((hit) => {
                                        const isPreviewing = previewingId === hit.id;

                                        // Check if already downloaded
                                        const expectedUrl = searchSource === 'youtube' ? `https://www.youtube.com/watch?v=${hit.id}` : (hit.audio || hit.preview);
                                        const isAlreadyDownloaded = effects.some(e => e.source_url === expectedUrl);
                                        const isDownloadingThis = downloadingId === hit.id;

                                        return (
                                            <div key={hit.id} className="se-item">
                                                <button className="se-play-btn" onClick={() => togglePreview(hit)}>
                                                    {isPreviewing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                                                </button>
                                                <div className="se-item-info">
                                                    <span className="se-item-name" title={hit.tags}>{hit.description || hit.tags || `${searchSource}-${hit.id}`}</span>
                                                    <span className="se-item-duration">{Math.round(hit.duration)}s</span>
                                                </div>
                                                <button
                                                    className="se-dl-btn-small"
                                                    onClick={() => downloadSearchResult(hit)}
                                                    disabled={downloadingId !== null || isAlreadyDownloaded}
                                                    title={isAlreadyDownloaded ? "Already downloaded" : "Save to My Sounds"}
                                                    style={{ opacity: isAlreadyDownloaded || isDownloadingThis ? 0.5 : 1, cursor: isAlreadyDownloaded ? 'default' : 'pointer' }}
                                                >
                                                    {isDownloadingThis ? <Loader2 size={14} className="se-spin" /> : (isAlreadyDownloaded ? <Check size={14} /> : <Download size={14} />)}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ) : activeTab === 'ai' ? (
                    <div className="se-ai-section">
                        <div className="se-chat-history">
                            {chatMessages.length === 0 ? (
                                <div className="se-empty">
                                    <Bot size={32} opacity={0.5} style={{ marginBottom: 10 }} />
                                    <div>Ask me to find sound effects!</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: 4 }}>Example: "Find me an explosion sound and put it in the Action category"</div>
                                </div>
                            ) : (
                                chatMessages.map((msg, i) => (
                                    <div key={i} className={`se-chat-msg ${msg.role}`}>
                                        <div className="se-chat-bubble">{msg.content}</div>
                                    </div>
                                ))
                            )}
                            {isAiLoading && <div className="se-chat-msg assistant"><div className="se-chat-bubble">Thinking...</div></div>}
                            <div ref={messagesEndRef} />
                        </div>
                        <form className="se-chat-form" onSubmit={handleChatSubmit}>
                            <input
                                type="text"
                                className="se-chat-input"
                                placeholder="Ask Gemini to find a sound effect..."
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                disabled={isAiLoading}
                            />
                            <button type="submit" className="se-chat-send" disabled={isAiLoading || !chatInput.trim()}>
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="se-local-section">
                        <form className="se-download-form" onSubmit={handleDownloadUrl}>
                            <div className="se-input-group">
                                <LinkIcon size={16} className="se-input-icon" />
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="Paste direct .mp3 URL..."
                                    className="se-input"
                                    disabled={downloading}
                                />
                            </div>
                            <button type="submit" className="se-dl-btn" disabled={downloading || !url}>
                                {downloading ? '...' : <Download size={16} />}
                            </button>
                        </form>

                        <div className="se-list-container">
                            {effects.length === 0 ? (
                                <div className="se-empty">No local sound effects yet.</div>
                            ) : (
                                <div className="se-list">
                                    {Object.entries(groupedEffects).map(([category, catEffects]) => (
                                        <div key={category} className="se-category-group">
                                            <div className="se-category-header">
                                                <Folder size={14} /> {category}
                                            </div>
                                            {catEffects.map((effect) => {
                                                const isSelected = selectedEffectId === effect.id;
                                                const boundKeys = Object.keys(keybindings).filter(k => keybindings[k] === effect.id);

                                                if (editingEffect?.id === effect.id) {
                                                    return (
                                                        <div key={effect.id} className="se-item se-editing">
                                                            <div className="se-edit-inputs">
                                                                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name" />
                                                                <input type="text" value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="Category" />
                                                            </div>
                                                            <div className="se-edit-actions">
                                                                <button onClick={saveEdit} className="se-save-btn">Save</button>
                                                                <button onClick={() => setEditingEffect(null)} className="se-cancel-btn"><X size={16} /></button>
                                                            </div>
                                                        </div>
                                                    )
                                                }

                                                return (
                                                    <div key={effect.id} className={`se-item ${isSelected ? 'se-item-selected' : ''}`}>
                                                        <button className="se-play-btn" onClick={() => onPlaySoundEffect(effect.id)}>
                                                            <Play size={16} fill="currentColor" />
                                                        </button>
                                                        <div className="se-item-info">
                                                            <span className="se-item-name" title={effect.name}>{effect.name}</span>
                                                            {boundKeys.length > 0 && (
                                                                <span className="se-item-bound-badge" style={{ color: '#fff', fontWeight: 'bold' }} title={`Bound to: ${boundKeys.join(', ').toUpperCase()}`}>
                                                                    ⌨️ {boundKeys[0].toUpperCase()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            className="se-bind-indicator"
                                                            onClick={() => startEditing(effect)}
                                                            title="Edit Details"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                        <button
                                                            className={`se-bind-indicator ${isSelected ? 'active' : ''}`}
                                                            onClick={() => toggleBindMode(effect)}
                                                            title={isSelected ? "Cancel Bind" : "Bind to Key"}
                                                        >
                                                            {isSelected ? <X size={14} /> : "⌨️"}
                                                        </button>
                                                        {boundKeys.length > 0 && (
                                                            <button
                                                                className="se-bind-indicator se-unbind-btn"
                                                                onClick={() => handleUnbindEffect(effect.id)}
                                                                title="Unbind Key"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                        <button className="se-del-btn" onClick={() => handleDelete(effect.id)}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="se-keyboard-container">
                <div className="se-keyboard-title">
                    {isBindingMode ? (
                        <span className="se-pulsing-text">SELECT A KEY FOR '{effects.find(e => e.id === selectedEffectId)?.name}'</span>
                    ) : (
                        'Keybindings'
                    )}
                </div>
                <VisualKeyboard
                    bindings={boundKeyObjects}
                    onBindKey={handleBindKey}
                    activeKeys={activeKeys}
                    isBindingMode={isBindingMode}
                />
            </div>
        </div>
    );
}
