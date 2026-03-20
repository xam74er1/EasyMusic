import React from 'react';
import { Play, Download, FolderTree, Disc3, ArrowRight, HelpCircle, Activity, Layout } from 'lucide-react';

const WorkflowStep = ({ icon: Icon, title, description, color }) => (
    <div style={{
        flex: 1,
        background: 'rgba(255,255,255,0.02)',
        padding: '30px',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '15px'
    }}>
        <div style={{
            background: color + '22',
            padding: '15px',
            borderRadius: '18px',
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <Icon size={32} />
        </div>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{title}</h3>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>{description}</p>
    </div>
);

const IntroDoc = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '80px' }}>
            {/* Hero Section */}
            <section style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '20px', lineHeight: '1.1' }}>
                    Bienvenue sur <span style={{ color: 'var(--primary)' }}>EasyMusic</span>
                </h1>
                <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    La station de travail audio nouvelle génération pour les DJ et les créateurs de contenu.
                    Une plateforme unique pour acquérir, organiser et mixer vos morceaux en quelques clics.
                </p>
            </section>

            {/* Workflow Schema */}
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px' }}>
                    <Activity size={24} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Parcours Global</h2>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: '20px',
                    position: 'relative'
                }}>
                    <WorkflowStep
                        icon={Download}
                        title="1. Acquisition"
                        description="Importez vos fichiers locaux ou téléchargez-les via YouTube directement dans la Bibliothèque."
                        color="var(--secondary)"
                    />
                    <div style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.1)' }}>
                        <ArrowRight size={24} />
                    </div>
                    <WorkflowStep
                        icon={FolderTree}
                        title="2. Organisation"
                        description="Créez vos dossiers virtuels dans le Manager et glissez vos morceaux pour structurer votre set."
                        color="#4ade80"
                    />
                    <div style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.1)' }}>
                        <ArrowRight size={24} />
                    </div>
                    <WorkflowStep
                        icon={Disc3}
                        title="3. Performance"
                        description="Chargez vos listes dans le Virtual DJ ou le Simplified DJ et commencez à mixer en live."
                        color="var(--primary)"
                    />
                </div>
            </section>

            {/* General Description */}
            <section style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '40px',
                background: 'rgba(255,255,255,0.02)',
                padding: '60px',
                borderRadius: '32px',
                border: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div>
                    <h3 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Qu'est-ce qu'EasyMusic ?</h3>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.8', margin: 0 }}>
                        EasyMusic est conçu pour simplifier le flux de travail des musiciens. Contrairement aux logiciels traditionnels,
                        nous avons intégré l'acquisition de fichiers et la gestion sémantique par IA directement dans l'interface de mixage.
                        <br /><br />
                        Que vous soyez un DJ cherchant à organiser des milliers de titres ou un créateur ayant besoin d'effets sonores rapides,
                        EasyMusic s'adapte à vos besoins via ses multiples vues spécialisées.
                    </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <Layout size={20} color="var(--primary)" />
                        <span style={{ fontSize: '0.95rem' }}>Interface modulaire personnalisable</span>
                    </div>
                    <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <Activity size={20} color="#4ade80" />
                        <span style={{ fontSize: '0.95rem' }}>Moteur de mixage basse latence</span>
                    </div>
                    <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <HelpCircle size={20} color="#fbbf24" />
                        <span style={{ fontSize: '0.95rem' }}>Aide contextuelle et IA intégrée</span>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default IntroDoc;
