import React, { useState, useRef, useEffect } from 'react';
import PreviewChangesModal from './PreviewChangesModal';
import './Chatbot.css';

const API_BASE = 'http://localhost:8000/api';

export default function Chatbot({ onUpdate }) {
    const [messages, setMessages] = useState([
        { role: 'bot', text: 'Hello! I am your Improv Assistant. I can help you find videos on YouTube and add them to your playlist.' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pendingPlan, setPendingPlan] = useState(null);
    const [isProcessingPlan, setIsProcessingPlan] = useState(false);
    const [lastUndoAvailable, setLastUndoAvailable] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: userMessage })
            });

            const data = await res.json();

            setMessages(prev => [...prev, { role: 'bot', text: data.reply?.reply || data.reply, debug: data.debug || data.reply?.debug }]);

            if (data.change_plan && data.change_plan.length > 0) {
                setPendingPlan(data.change_plan);
            }

            // Tell App to refresh the playlist in case the bot added something
            onUpdate();

        } catch (err) {
            setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, I encountered an error connecting to the server.' }]);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const [showDebug, setShowDebug] = useState(false);

    const confirmPlan = async () => {
        setIsProcessingPlan(true);
        try {
            const res = await fetch(`${API_BASE}/library/reorganize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: pendingPlan })
            });
            if (res.ok) {
                setPendingPlan(null);
                setLastUndoAvailable(true);
                setMessages(prev => [...prev, { role: 'bot', text: 'Changes applied successfully! You can undo if needed.' }]);
                onUpdate();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessingPlan(false);
        }
    };

    const undoPlan = async () => {
        try {
            const res = await fetch(`${API_BASE}/library/undo`, { method: 'POST' });
            if (res.ok) {
                setLastUndoAvailable(false);
                setMessages(prev => [...prev, { role: 'bot', text: 'Successfully reversed the last reorganization.' }]);
                onUpdate();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const parseMessage = (text) => {
        if (!text) return null;
        const highlightRegex = /\[Highlight New Sounds\]\(#new\)/g;

        if (!highlightRegex.test(text)) {
            return text;
        }

        const parts = text.split(highlightRegex);
        return (
            <>
                {parts.map((part, index) => (
                    <React.Fragment key={index}>
                        {part}
                        {index < parts.length - 1 && (
                            <button
                                className="highlight-new-btn"
                                onClick={() => {
                                    window.dispatchEvent(new CustomEvent('highlight-new'));
                                }}
                                style={{
                                    background: 'var(--primary)',
                                    color: '#000',
                                    border: 'none',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    marginLeft: '4px',
                                    marginRight: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center'
                                }}
                            >
                                ✨ View New Sounds
                            </button>
                        )}
                    </React.Fragment>
                ))}
            </>
        );
    };

    return (
        <>
            <div style={{ padding: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {lastUndoAvailable ? (
                    <button onClick={undoPlan} className="btn" style={{ background: '#d9534f', color: '#fff', fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                        Undo Last Reorganization
                    </button>
                ) : <div />}
                <label style={{ fontSize: '0.8rem', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} />
                    Show Debug Info
                </label>
            </div>
            <div className="chat-messages" style={{ overflowY: 'auto', flex: 1 }}>
                {messages.map((msg, i) => (
                    <div key={i} style={{ marginBottom: '1rem' }}>
                        <div className={`message ${msg.role}`}>
                            {parseMessage(msg.text)}
                        </div>
                        {showDebug && msg.debug && (
                            <div style={{ fontSize: '0.75rem', background: '#1e1e1e', color: '#0f0', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                                <strong>AI Debug Info:</strong>
                                <pre style={{ margin: 0, overflowX: 'auto' }}>
                                    {JSON.stringify(msg.debug, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="message bot">Thinking...</div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-container" onSubmit={handleSend}>
                <input
                    type="text"
                    className="chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g. Add a fast happy pop song..."
                    disabled={isLoading}
                />
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                    Send
                </button>
            </form>

            <PreviewChangesModal
                plan={pendingPlan}
                onConfirm={confirmPlan}
                onCancel={() => setPendingPlan(null)}
                isProcessing={isProcessingPlan}
            />
        </>
    );
}
