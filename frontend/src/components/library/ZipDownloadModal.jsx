import React, { useState } from 'react';
import './ZipDownloadModal.css';

const ZipDownloadModal = ({ isOpen, onClose, onConfirm, folderName }) => {
    const [flatStructure, setFlatStructure] = useState(false);

    if (!isOpen) return null;

    return (
        <div className="zip-modal-overlay">
            <div className="zip-modal-content">
                <h2>Download {folderName ? `"${folderName}"` : 'Library'}</h2>
                <p>Choose how you want to download the files:</p>

                <div className="zip-options">
                    <label className={`zip-option ${!flatStructure ? 'active' : ''}`}>
                        <input
                            type="radio"
                            name="structure"
                            checked={!flatStructure}
                            onChange={() => setFlatStructure(false)}
                        />
                        <div className="option-text">
                            <strong>Keep Folder Structure</strong>
                            <span>Organizes files into subfolders based on categories</span>
                        </div>
                    </label>

                    <label className={`zip-option ${flatStructure ? 'active' : ''}`}>
                        <input
                            type="radio"
                            name="structure"
                            checked={flatStructure}
                            onChange={() => setFlatStructure(true)}
                        />
                        <div className="option-text">
                            <strong>Flat Structure</strong>
                            <span>Places all files directly in the main folder</span>
                        </div>
                    </label>
                </div>

                <div className="zip-modal-actions">
                    <button className="zip-btn outline" onClick={onClose}>Cancel</button>
                    <button className="zip-btn primary" onClick={() => onConfirm(flatStructure)}>
                        Download ZIP
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ZipDownloadModal;
