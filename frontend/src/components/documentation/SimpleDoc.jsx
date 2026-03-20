import React from 'react';
import { Heart, Music, Play, Star, Smile, Box, Radio, Search, Download, MousePointer2, Settings } from 'lucide-react';

const SimpleStep = ({ icon: Icon, title, description, color, bgColor }) => (
    <div style={{
        flex: 1,
        background: bgColor,
        padding: '30px',
        borderRadius: '35px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '15px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
        border: `2px solid ${color}22`
    }}>
        <div style={{
            background: 'white',
            padding: '15px',
            borderRadius: '50%',
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 5px 15px rgba(0,0,0,0.05)'
        }}>
            <Icon size={32} strokeWidth={2.5} />
        </div>
        <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#1a1a1a' }}>{title}</h3>
        <p style={{ margin: 0, fontSize: '1rem', color: '#444', lineHeight: '1.5', fontWeight: 500 }}>{description}</p>
    </div>
);

const SimpleDoc = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '60px', background: 'white', padding: '60px', borderRadius: '40px', color: '#1a1a1a' }}>
            {/* Header */}
            <section style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '15px', color: '#1a1a1a' }}>
                    Le Guide <span style={{ color: '#ec4899' }}>Débutant</span>
                </h1>
                <p style={{ fontSize: '1.2rem', color: '#666', maxWidth: '700px', margin: '0 auto' }}>
                    Voici comment utiliser l'application en quelques étapes simples.
                </p>
            </section>

            {/* Practical Steps */}
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px' }}>
                <SimpleStep
                    icon={Download}
                    title="1. Ajouter de la musique"
                    description="Cliquez sur 'Bibliothèque' puis sur 'Scan Folder' pour charger vos chansons."
                    color="#3b82f6"
                    bgColor="#eff6ff"
                />
                <SimpleStep
                    icon={MousePointer2}
                    title="2. Choisir ses morceaux"
                    description="Dans le 'Manager', glissez les chansons de la liste de droite vers vos dossiers à gauche."
                    color="#10b981"
                    bgColor="#ecfdf5"
                />
                <SimpleStep
                    icon={Play}
                    title="3. Écouter et Mixer"
                    description="Appuyez sur 'Virtual DJ', chargez une chanson et cliquez sur le bouton 'Play'."
                    color="#f59e0b"
                    bgColor="#fffbeb"
                />
            </section>

            {/* Visual Buttons Help */}
            <section style={{
                background: '#f8fafc',
                padding: '40px',
                borderRadius: '35px',
                border: '2px solid #e2e8f0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', justifyContent: 'center' }}>
                    <Settings size={24} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Les boutons importants</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{ padding: '10px', background: '#fef2f2', borderRadius: '12px' }}><Heart size={20} color="#ef4444" fill="#ef4444" /></div>
                        <span style={{ fontWeight: 700 }}>Favoris</span>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Garder le titre précieusement</span>
                    </div>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{ padding: '10px', background: '#ecfdf5', borderRadius: '12px' }}><Search size={20} color="#10b981" /></div>
                        <span style={{ fontWeight: 700 }}>Chercher</span>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Trouver une chanson vite</span>
                    </div>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{ padding: '10px', background: '#eff6ff', borderRadius: '12px' }}><Music size={20} color="#3b82f6" /></div>
                        <span style={{ fontWeight: 700 }}>Détails</span>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Voir les infos de la musique</span>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default SimpleDoc;
