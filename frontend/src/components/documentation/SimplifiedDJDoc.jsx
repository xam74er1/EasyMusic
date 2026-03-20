import React from 'react';
import { LayoutGrid, Palette, Edit3, Trash2, Info, CheckCircle2, Sliders, Zap, ShieldAlert } from 'lucide-react';

const DocCard = ({ icon: Icon, title, description, badge, color = 'var(--primary)' }) => (
    <div style={{
        background: 'rgba(255,255,255,0.03)',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ background: color + '33', padding: '8px', borderRadius: '10px', color: color }}>
                <Icon size={20} />
            </div>
            {badge && <span style={{ fontSize: '0.7rem', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', color: 'var(--text-muted)' }}>{badge}</span>}
        </div>
        <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>{title}</h4>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>{description}</p>
    </div>
);

const SimplifiedDJDoc = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                    <div style={{ background: '#ec4899', padding: '10px', borderRadius: '12px' }}>
                        <LayoutGrid size={24} color="white" />
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>Simplified <span style={{ color: '#ec4899' }}>DJ</span></h2>
                </div>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '40px' }}>
                    Performance instantanée. Transformez vos playlists en pads colorés pour un contrôle total sans technique.
                </p>
                <div style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                    <img src="/doc_images/simplified.png" alt="Vue Simplified DJ" style={{ width: '100%', display: 'block' }} />
                </div>
            </section>

            {/* TIER 1: SIMPLE ACTIONS */}
            <section style={{ background: 'rgba(236, 72, 153, 0.05)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#ec4899', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Zap size={20} /> Actions Rapides
                </h3>
                <ul style={{ color: 'var(--text-main)', paddingLeft: '20px', lineHeight: '2' }}>
                    <li><strong>Lancer :</strong> Cliquez sur un bouton pour démarrer une playlist complète.</li>
                    <li><strong>Naviguer :</strong> Changez de groupe d'onglets pour accéder à différentes ambiances.</li>
                    <li><strong>Couleur :</strong> Identifiez vos zones musicales grâce aux couleurs des boutons.</li>
                </ul>
            </section>

            {/* TIER 2: EXPERT MODE */}
            <section>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24' }}>
                    <ShieldAlert size={20} /> Mode Expert & Fonctions Cachées
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <DocCard
                        icon={Edit3}
                        title="Renommage Dynamique"
                        description="Modifiez les noms des playlists en direct. Les changements sont répercutés partout dans l'application."
                        badge="Expert"
                        color="#ec4899"
                    />
                    <DocCard
                        icon={Palette}
                        title="Persistence HSL"
                        description="Les couleurs utilisent le format HSL pour garantir une lisibilité optimale quel que soit le niveau de luminosité."
                        badge="Design"
                        color="#ec4899"
                    />
                    <DocCard
                        icon={ShieldAlert}
                        title="Mode 'Panic Button'"
                        description="L'IA réserve une catégorie invisible pour les morceaux d'urgence en cas de silence prolongé."
                        badge="Secret"
                        color="#ec4899"
                    />
                    <DocCard
                        icon={LayoutGrid}
                        title="Grid Auto-Scale"
                        description="La grille se réarrange selon la taille de votre écran (Responsive Mapping)."
                        badge="Moteur"
                        color="#ec4899"
                    />
                </div>
            </section>
        </div>
    );
};

export default SimplifiedDJDoc;
