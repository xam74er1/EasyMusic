import React, { useState } from 'react';
import SpotlightCard from '../reactbits/SpotlightCard';
import { useToast } from '../ToastContext';
import './EditModal.css';
import api from '../../api';

export default function EditModal({ video, onClose, onSave }) {
    const { addToast } = useToast();
    const [formData, setFormData] = useState({ ...video });
    const [tagsInput, setTagsInput] = useState(video.tags.join(', '));
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const updatedVideo = {
            ...formData,
            tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean)
        };

        try {
            const res = await api.updateTrack(video.id, updatedVideo);

            if (res.ok) {
                onSave();
                onClose();
            } else {
                addToast("Failed to save changes.", "error");
            }
        } catch (err) {
            console.error(err);
            addToast("Error saving video", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <SpotlightCard className="modal-content" spotlightColor="rgba(157, 78, 221, 0.15)" onClick={e => e.stopPropagation()}>
                <div style={{ maxHeight: 'calc(90vh - 64px)', overflowY: 'auto', paddingRight: '8px' }}>
                    <h3 style={{ marginBottom: '20px' }}>Edit Video Details</h3>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Title</label>
                            <input name="title" value={formData.title} onChange={handleChange} required />
                        </div>

                        <div className="form-group">
                            <label>Author</label>
                            <input name="author" value={formData.author} onChange={handleChange} />
                        </div>

                        <div className="form-group">
                            <label>Category (semicolon separated)</label>
                            <input name="category" value={formData.category} onChange={handleChange} placeholder="e.g. Pop/Rock ; Célébration" />
                        </div>

                        <div className="form-group">
                            <label>Speed</label>
                            <select name="speed" value={formData.speed} onChange={handleChange}>
                                <option value="Slow">Slow</option>
                                <option value="Medium">Medium</option>
                                <option value="Fast">Fast</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Tags (comma separated)</label>
                            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} />
                        </div>

                        <div className="form-group">
                            <label>YouTube URL</label>
                            <input name="youtube_url" value={formData.youtube_url} onChange={handleChange} placeholder="https://youtube.com/..." />
                        </div>

                        <div className="form-group">
                            <label>Duration</label>
                            <input name="duration" value={formData.duration} onChange={handleChange} />
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={isSaving}>Save Changes</button>
                        </div>
                    </form>
                </div>
            </SpotlightCard>
        </div>
    );
}
