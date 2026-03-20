import React, { useState, useEffect } from 'react';
import { X, Music, Check, Loader2, Bot, AlertCircle, Trash2, Folder } from 'lucide-react';
import { useToast } from '../ToastContext';
import './ImportModal.css';
import api from '../../api';
export default function ImportModal({ isOpen, onClose, files, onImportComplete }) {
    const { addToast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [tracks, setTracks] = useState([]);
    const [useAI, setUseAI] = useState(false);

    useEffect(() => {
        if (isOpen && files.length > 0) {
            handleAnalyze(files);
        }
    }, [isOpen, files]);

    const handleAnalyze = async (fileList) => {
        setIsAnalyzing(true);
        const formData = new FormData();
        Array.from(fileList).forEach(file => {
            formData.append('files', file);
        });

        try {
            const response = await api.importAnalyze(formData, useAI);

            if (!response.ok) throw new Error('Failed to analyze files');
            const data = await response.json();
            setTracks(data.tracks);
        } catch (error) {
            console.error('Analysis error:', error);
            addToast('Error analyzing files', 'error');
            onClose();
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleRobotFill = async () => {
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        try {
            // Re-run analysis with AI forced on
            const formData = new FormData();
            // We don't have the original File objects here easily if we want to re-upload, 
            // but we can send the current titles to a metadata enrichment endpoint if we had one.
            // For now, let's assume the user can re-drop or we'd need a way to send filenames.
            // Actually, let's just re-run the same files if we had them or simple AI fill.

            // Simplified: let's re-run with current filenames
            const filenames = tracks.map(t => t.filename);
            const response = await api.chat({
                message: `Analyze these filenames and tell me the Title and Author for each: ${filenames.join(', ')}`
            });

            const data = await response.json();
            addToast('AI enrichment triggered. Check chat for details or re-import with AI toggle.', 'info');
        } catch (error) {
            addToast('AI enrichment failed', 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleConfirm = async () => {
        setIsFinalizing(true);
        try {
            const response = await api.importConfirm({ tracks });

            if (!response.ok) throw new Error('Failed to import tracks');
            const data = await response.json();
            addToast(`Successfully imported ${data.imported_count} tracks`, 'success');
            onImportComplete();
            onClose();
        } catch (error) {
            addToast('Import failed', 'error');
        } finally {
            setIsFinalizing(false);
        }
    };

    const updateTrack = (index, field, value) => {
        const newTracks = [...tracks];
        if (field.startsWith('metadata.')) {
            const metaField = field.split('.')[1];
            newTracks[index].metadata[metaField] = value;
        } else {
            newTracks[index][field] = value;
        }
        setTracks(newTracks);
    };

    const removeTrack = (index) => {
        setTracks(tracks.filter((_, i) => i !== index));
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="import-modal">
                <div className="modal-header">
                    <div className="header-title">
                        <Music size={20} />
                        <h2>Validate Import ({tracks.length} tracks)</h2>
                    </div>
                    <button className="close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-body">
                    <div className="import-controls">
                        <label className="ai-toggle">
                            <input
                                type="checkbox"
                                checked={useAI}
                                onChange={(e) => setUseAI(e.target.checked)}
                            />
                            <span>AI Metadata Help (Gemini)</span>
                        </label>
                        <button
                            className="robot-btn"
                            onClick={handleRobotFill}
                            disabled={isAnalyzing || tracks.length === 0}
                            title="Let the robot fill missing information"
                        >
                            <Bot size={16} /> Fill with AI
                        </button>
                    </div>

                    {isAnalyzing ? (
                        <div className="loading-state">
                            <Loader2 size={40} className="spin" />
                            <p>Analyzing files...</p>
                        </div>
                    ) : (
                        <div className="tracks-list">
                            {tracks.map((track, index) => (
                                <div key={index} className="track-item-edit">
                                    <div className="track-file-info">
                                        <Folder size={14} color="var(--text-muted)" />
                                        <span className="filename">{track.filename}</span>
                                        <button className="remove-track" onClick={() => removeTrack(index)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="edit-fields">
                                        <div className="input-group">
                                            <label>Title</label>
                                            <input
                                                type="text"
                                                value={track.metadata.title}
                                                onChange={(e) => updateTrack(index, 'metadata.title', e.target.value)}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Artist</label>
                                            <input
                                                type="text"
                                                value={track.metadata.author}
                                                onChange={(e) => updateTrack(index, 'metadata.author', e.target.value)}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Category</label>
                                            <input
                                                type="text"
                                                value={track.metadata.category}
                                                onChange={(e) => updateTrack(index, 'metadata.category', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="tags-row">
                                        <label>Tags (comma separated)</label>
                                        <input
                                            type="text"
                                            value={track.metadata.tags.join(', ')}
                                            onChange={(e) => updateTrack(index, 'metadata.tags', e.target.value.split(',').map(s => s.trim()))}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button
                        className="confirm-btn"
                        onClick={handleConfirm}
                        disabled={isAnalyzing || isFinalizing || tracks.length === 0}
                    >
                        {isFinalizing ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                        Import to Library
                    </button>
                </div>
            </div>
        </div>
    );
}
