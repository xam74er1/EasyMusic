import React from 'react';
import { FolderTree, MousePointer2, Layers, Info, CheckCircle2, PlusCircle, Trash2, Zap, ShieldAlert, Split, GripVertical, FolderPlus, Download, FileArchive } from 'lucide-react';

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

const ManagerDoc = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                    <div style={{ background: '#4ade80', padding: '10px', borderRadius: '12px' }}>
                        <FolderTree size={24} color="black" />
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>Library <span style={{ color: '#4ade80' }}>Manager</span></h2>
                </div>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '40px' }}>
                    L'atelier d'organisation. C'est ici que vous structurez votre collection musicale pour vos spectacles et sets.
                </p>
                <div style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                    <img src="/doc_images/manager.png" alt="Vue Manager" style={{ width: '100%', display: 'block' }} />
                </div>
            </section>

            {/* ORGANIZATION MECHANICS */}
            <section style={{ background: 'rgba(74, 222, 128, 0.05)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Split size={24} /> Organisation & Flux de Travail
                </h3>
                <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '25px' }}>
                    Le Manager utilise une vue scindée pour une productivité maximale : votre base de données à droite, et vos dossiers de setlist à gauche.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    <DocCard
                        icon={GripVertical}
                        title="Glisser-Déposer"
                        description="Saisissez un morceau dans la liste de droite et déposez-le sur un dossier à gauche pour le classer instantanément."
                        badge="Intuitif"
                        color="#4ade80"
                    />
                    <DocCard
                        icon={Layers}
                        title="Multi-Catégories (SHIFT)"
                        description="Maintenez la touche SHIFT lors du dépôt pour ajouter une catégorie sans supprimer les anciennes. Un morceau peut vivre dans plusieurs dossiers !"
                        badge="Expert"
                        color="#4ade80"
                    />
                    <DocCard
                        icon={MousePointer2}
                        title="Sélection en Masse"
                        description="Utilisez CTRL + Clic pour sélectionner plusieurs titres. Déplacez-les tous d'un coup vers votre destination."
                        badge="Batch"
                        color="#4ade80"
                    />
                </div>
            </section>

            {/* FOLDER MANAGEMENT */}
            <section>
                <h3 style={{ fontSize: '1.8rem', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px', color: '#4ade80' }}>
                    <FolderPlus size={24} /> Gestion des Dossiers
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <DocCard
                        icon={PlusCircle}
                        title="Création & Renommage"
                        description="Faites un clic-droit sur l'arborescence pour créer de nouveaux dossiers ou renommer l'existant. Organisez par ambiance, tempo ou moment du show."
                        badge="Arborescence"
                        color="#4ade80"
                    />
                    <DocCard
                        icon={Trash2}
                        title="Retrait de Dossier"
                        description="Sélectionnez un morceau dans un dossier et appuyez sur 'Delete'. Le morceau est retiré de ce dossier mais reste dans votre Bibliothèque Globale."
                        badge="Sécurité"
                        color="#4ade80"
                    />
                    <DocCard
                        icon={ShieldAlert}
                        title="Synchronisation Disque"
                        description="Le système surveille vos fichiers. Si vous renommez un dossier physique sur votre Windows, le Manager tente de maintenir le lien automatiquement."
                        badge="Stabilité"
                        color="#4ade80"
                    />
                </div>
            </section>

            {/* EXPORT & DOWNLOAD SECTION */}
            <section style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Download size={24} /> Export & Téléchargement
                </h3>
                <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '25px' }}>
                    Emportez votre musique partout. Le Manager vous permet de récupérer vos fichiers localement de manière individuelle ou groupée.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    <DocCard
                        icon={Download}
                        title="Téléchargement Unitaire"
                        description="Cliquez sur l'icône de téléchargement d'un morceau pour récupérer le fichier MP3 directement sur votre ordinateur avec son nom propre."
                        badge="Single"
                        color="#3b82f6"
                    />
                    <DocCard
                        icon={FileArchive}
                        title="Export de Dossier (ZIP)"
                        description="Faites un clic-droit sur un dossier ou une catégorie pour exporter l'intégralité de son contenu. Le système génère un ZIP structuré pour vous."
                        badge="Archive"
                        color="#3b82f6"
                    />
                    <DocCard
                        icon={ShieldAlert}
                        title="Intégrité des Exports"
                        description="Lors d'un export groupé, le système vérifie que tous les fichiers sont présents. En cas d'absence, il vous propose de les retélécharger."
                        badge="Vérification"
                        color="#3b82f6"
                    />
                </div>
            </section>

            {/* TIPS */}
            <section style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '40px' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24' }}>
                    <Zap size={20} /> Astuces de Pro
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <DocCard
                        icon={Info}
                        title="Vue Explorateur"
                        description="Double-cliquez sur un dossier pour voir son contenu filtré instantanément. C'est le moyen le plus rapide de préparer votre set."
                        badge="Rapidité"
                        color="#4ade80"
                    />
                    <DocCard
                        icon={CheckCircle2}
                        title="Validation Visuelle"
                        description="Les icônes indiquent l'état du fichier (localisé ou manquant). Un fichier manquant peut être retrouvé via le scan automatique."
                        badge="Status"
                        color="#4ade80"
                    />
                </div>
            </section>
        </div>
    );
};

export default ManagerDoc;

