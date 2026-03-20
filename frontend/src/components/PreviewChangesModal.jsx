import React from 'react';
import './PreviewChangesModal.css';

export default function PreviewChangesModal({ plan, onConfirm, onCancel, isProcessing }) {
    if (!plan || plan.length === 0) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Preview Library Changes</h2>
                <p>The AI proposes the following reorganization:</p>
                <div className="plan-list">
                    {plan.map((op, i) => (
                        <div key={i} className="plan-item">
                            <span className="move-item">{op.move}</span>
                            <span className="arrow"> ➔ </span>
                            <span className="dest-item">{op.to}</span>
                        </div>
                    ))}
                </div>
                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={onCancel} disabled={isProcessing}>Cancel</button>
                    <button className="btn btn-primary" onClick={onConfirm} disabled={isProcessing}>
                        {isProcessing ? "Applying..." : "Confirm Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}
