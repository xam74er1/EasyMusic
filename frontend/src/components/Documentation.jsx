import React, { useState } from 'react';
import {
    Book, HelpCircle, ChevronRight, Library,
    FolderTree, Settings2, Disc3, Bot, LayoutGrid, Zap,
    ArrowRight, List, ShieldCheck, Activity, Music, Heart
} from 'lucide-react';

// Import sub-components
import SimpleDoc from './documentation/SimpleDoc';
import IntroDoc from './documentation/IntroDoc';
import LibraryDoc from './documentation/LibraryDoc';
import ManagerDoc from './documentation/ManagerDoc';
import SFXDoc from './documentation/SFXDoc';
import VirtualDJDoc from './documentation/VirtualDJDoc';
import AIDoc from './documentation/AIDoc';
import SimplifiedDJDoc from './documentation/SimplifiedDJDoc';

const Documentation = () => {
    const [activeTab, setActiveTab] = useState('intro');

    const navItems = [
        { id: 'intro', label: 'Bienvenue', icon: <HelpCircle size={18} />, color: '#fff' },
        { id: 'simple', label: 'Guide Débutant', icon: <Heart size={18} />, color: '#ec4899' },
        { id: 'library', label: 'Bibliothèque', icon: <Library size={18} />, color: 'var(--secondary)' },
        { id: 'manager', label: 'Manager', icon: <FolderTree size={18} />, color: '#4ade80' },
        { id: 'sfx', label: 'SFX Setup', icon: <Settings2 size={18} />, color: '#fbbf24' },
        { id: 'simplified', label: 'Simplified DJ', icon: <LayoutGrid size={18} />, color: '#ec4899' },
        { id: 'virtual', label: 'Virtual DJ', icon: <Disc3 size={18} />, color: 'var(--primary)' },
        { id: 'ai', label: 'Assistant IA', icon: <Bot size={18} />, color: '#ff6b6b' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'simple': return <SimpleDoc />;
            case 'intro': return <IntroDoc />;
            case 'library': return <LibraryDoc />;
            case 'manager': return <ManagerDoc />;
            case 'sfx': return <SFXDoc />;
            case 'simplified': return <SimplifiedDJDoc />;
            case 'virtual': return <VirtualDJDoc />;
            case 'ai': return <AIDoc />;
            default: return <SimpleDoc />;
        }
    };

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            height: '100%',
            background: 'var(--bg-dark)',
            color: 'var(--text-main)',
            fontFamily: 'Inter, system-ui, sans-serif',
            overflow: 'hidden'
        }}>
            {/* Sidebar Navigation */}
            <div style={{
                width: '300px',
                background: 'rgba(15, 15, 20, 0.98)',
                borderRight: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                flexDirection: 'column',
                padding: '40px 20px',
                gap: '10px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', padding: '0 10px' }}>
                    <div style={{ background: 'var(--primary)', padding: '8px', borderRadius: '12px' }}>
                        <Book size={24} color="white" />
                    </div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>Guide EM</h1>
                </div>

                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            background: activeTab === item.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                            border: 'none',
                            borderRadius: '12px',
                            color: activeTab === item.id ? item.color : 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'left',
                            fontWeight: activeTab === item.id ? 600 : 400
                        }}
                    >
                        {item.icon}
                        <span style={{ fontSize: '0.95rem' }}>{item.label}</span>
                        {activeTab === item.id && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: item.color }} />}
                    </button>
                ))}

                <div style={{ marginTop: 'auto', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h5 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', opacity: 0.5, textTransform: 'uppercase' }}>Besoin d'aide ?</h5>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        Utilisez l'Assistant IA pour des questions spécifiques sur votre bibliothèque.
                    </p>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '80px 60px' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    {renderContent()}

                    <footer style={{ marginTop: '100px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '60px 0', opacity: 0.3 }}>
                        <p style={{ fontSize: '0.8rem' }}>© 2026 EasyMusic - Documentation Technique Visuelle</p>
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default Documentation;
