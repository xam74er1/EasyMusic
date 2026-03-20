import React from 'react';
import { Settings2, Keyboard, Palette, Play, Info, AlertCircle, Save, Zap, ShieldAlert } from 'lucide-react';

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

const SFXDoc = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                    <div style={{ background: '#fbbf24', padding: '10px', borderRadius: '12px' }}>
                        <Settings2 size={24} color="black" />
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>SFX <span style={{ color: '#fbbf24' }}>Setup</span></h2>
                </div>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '40px' }}>
                    Le tableau de bord de vos bruitages. Liez votre clavier à vos sons préférés.
                </p>
                <div style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                    <img src="/doc_images/sfx.png" alt="Vue SFX Setup" style={{ width: '100%', display: 'block' }} />
                </div>
            </section>

            {/* TIER 1: SIMPLE ACTIONS */}
            <section style={{ background: 'rgba(251, 191, 36, 0.05)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Zap size={20} /> Actions Rapides
                </h3>
                <ul style={{ color: 'var(--text-main)', paddingLeft: '20px', lineHeight: '2' }}>
                    <li><strong>Assigner :</strong> Cliquez sur 'Set Key', puis tapez la touche clavier souhaitée.</li>
                    <li><strong>Choisir :</strong> Cliquez sur l'icône Dossier pour uploader ou choisir votre son.</li>
                    <li><strong>Jouer :</strong> Allez dans 'Virtual DJ' et appuyez sur la touche.</li>
                </ul>
            </section>

            {/* TIER 2: EXPERT MODE */}
            <section>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24' }}>
                    <ShieldAlert size={20} /> Mode Expert & Fonctions Cachées
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <DocCard
                        icon={AlertCircle}
                        title="Priorité de Focus"
                        description="L'application doit être la fenêtre active. Si vous cliquez sur un autre logiciel, les raccourcis clavier SFX sont désactivés."
                        badge="Hardware"
                        color="#fbbf24"
                    />
                    <DocCard
                        icon={Save}
                        title="Profils Cloud"
                        description="Vos pads sont liés à votre profil. Si vous changez de machine, le mappage vous suit via le backend."
                        badge="Cloud Sync"
                        color="#fbbf24"
                    />
                    <DocCard
                        icon={ShieldAlert}
                        title="Limites Audio"
                        description="Le moteur supporte jusqu'à 32 sons simultanés. Au-delà, le son le plus ancien est coupé (Polyphonie)."
                        badge="Technique"
                        color="#fbbf24"
                    />
                    <DocCard
                        icon={Palette}
                        title="Groupes de Couleurs"
                        description="Utilisez les couleurs pour créer des zones (ex: Rouge pour urgence, Bleu pour ambiance)."
                        badge="Design"
                        color="#fbbf24"
                    />
                </div>
            </section>
        </div>
    );
};

export default SFXDoc;
