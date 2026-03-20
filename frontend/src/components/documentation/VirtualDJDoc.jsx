import React from 'react';
import { Disc3, Sliders, Zap, PlayCircle, Info, ChevronRight, Share2, ShieldAlert, Cpu } from 'lucide-react';

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

const VirtualDJDoc = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                    <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '12px' }}>
                        <Disc3 size={24} color="white" />
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>Virtual <span style={{ color: 'var(--primary)' }}>DJ</span></h2>
                </div>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '40px' }}>
                    Le cockpit de performance. Deux decks haute précision pour un mixage sans faille.
                </p>
                <div style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                    <img src="/doc_images/virtual.png" alt="Vue Virtual DJ" style={{ width: '100%', display: 'block' }} />
                </div>
            </section>

            {/* TIER 1: SIMPLE ACTIONS */}
            <section style={{ background: 'rgba(107, 70, 193, 0.05)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(107, 70, 193, 0.2)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Zap size={18} /> Actions Rapides
                </h3>
                <ul style={{ color: 'var(--text-main)', paddingLeft: '20px', lineHeight: '2' }}>
                    <li><strong>Charger :</strong> Glissez un morceau sur le Deck A (Gauche) ou B (Droite).</li>
                    <li><strong>Mixer :</strong> Utilisez le Crossfader central pour passer d'un deck à l'autre.</li>
                    <li><strong>Équaliser :</strong> Tournez les potentiomètres Low/Mid/High pour ajuster le timbre.</li>
                </ul>
            </section>

            {/* TIER 2: EXPERT MODE */}
            <section>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24' }}>
                    <ShieldAlert size={20} /> Mode Expert & Fonctions Cachées
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <DocCard
                        icon={Zap}
                        title="Algorithme Sync"
                        description="La synchronisation ne se contente pas des BPM, elle aligne les 'beats' pour éviter les décalages de phase."
                        badge="Avancé"
                        color="var(--primary)"
                    />
                    <DocCard
                        icon={Cpu}
                        title="Priorité Auto-Play"
                        description="En mode auto, le moteur privilégie le deck inutilisé pour pré-charger la piste suivante et éviter les silences."
                        badge="Automatisation"
                        color="var(--primary)"
                    />
                    <DocCard
                        icon={ShieldAlert}
                        title="Scratch & Pitch"
                        description="Cliquez et glissez horizontalement sur la waveform principale pour simuler un mouvement de vinyle."
                        badge="Interaction"
                        color="var(--primary)"
                    />
                    <DocCard
                        icon={Share2}
                        title="Buffer de Streaming"
                        description="Si vous utilisez YouTube, le Deck télécharge systématiquement 30s d'avance pour parer aux chutes de réseau."
                        badge="Backend"
                        color="var(--primary)"
                    />
                </div>
            </section>
        </div>
    );
};

export default VirtualDJDoc;
