import React from 'react';
import { Bot, MessageSquare, Terminal, Zap, Info, PlayCircle, Database, ShieldAlert, BrainCircuit } from 'lucide-react';

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

const AIDoc = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                    <div style={{ background: '#ff6b6b', padding: '10px', borderRadius: '12px' }}>
                        <Bot size={24} color="white" />
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>Assistant <span style={{ color: '#ff6b6b' }}>Impro (IA)</span></h2>
                </div>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '40px' }}>
                    Le copilote sémantique de votre bibliothèque. Pilotez EasyMusic en langage naturel.
                </p>
                <div style={{
                    height: '350px',
                    background: 'linear-gradient(45deg, #1a1a2e, #16213e)',
                    borderRadius: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '40px',
                    border: '1px solid rgba(255,107,107,0.1)'
                }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px 25px', borderRadius: '20px', alignSelf: 'flex-start', maxWidth: '80%', border: '1px solid rgba(255,255,255,0.05)' }}>
                        Assistant, trouve moi des musiques de Jazz à 120 BPM.
                    </div>
                </div>
            </section>

            {/* TIER 1: SIMPLE ACTIONS */}
            <section style={{ background: 'rgba(255, 107, 107, 0.05)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(255, 107, 107, 0.2)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#ff6b6b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Zap size={20} /> Actions Rapides
                </h3>
                <ul style={{ color: 'var(--text-main)', paddingLeft: '20px', lineHeight: '2' }}>
                    <li><strong>Chercher :</strong> Posez des questions larges ('Musique relaxante', 'Années 80').</li>
                    <li><strong>Organiser :</strong> Demandez-lui de créer des dossiers par genre ou artiste.</li>
                    <li><strong>Proposer :</strong> Demandez 'Quoi jouer après ?' pour des suggestions en temps réel.</li>
                </ul>
            </section>

            {/* TIER 2: EXPERT MODE */}
            <section>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24' }}>
                    <ShieldAlert size={20} /> Mode Expert & Fonctions Cachées
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <DocCard
                        icon={BrainCircuit}
                        title="Orchestration de Dossiers"
                        description="L'IA peut ré-organiser toute votre structure de dossiers virtuels en une seule commande massive."
                        badge="Puissance"
                        color="#ff6b6b"
                    />
                    <DocCard
                        icon={Terminal}
                        title="Mode Debug / Commandes"
                        description="Tapez '/help' pour voir les commandes système masquées accessibles uniquement aux développeurs."
                        badge="Interne"
                        color="#ff6b6b"
                    />
                    <DocCard
                        icon={Bot}
                        title="Conscience du Mix"
                        description="L'IA analyse le titre, la tonalité et l'énergie du deck actif pour affiner ses résultats de recherche."
                        badge="Contexte"
                        color="#ff6b6b"
                    />
                    <DocCard
                        icon={ShieldAlert}
                        title="Nettoyage IA"
                        description="Demandez 'Supprime les doublons évidents de ma bibliothèque' pour lancer un scan de nettoyage intelligent."
                        badge="Expert"
                        color="#ff6b6b"
                    />
                </div>
            </section>
        </div>
    );
};

export default AIDoc;
