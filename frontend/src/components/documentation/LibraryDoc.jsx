import React from 'react';
import { Search, Download, Upload, List, Info, CheckCircle2, Music, Zap, ShieldAlert, MessageSquare, Youtube, FileSpreadsheet, FileArchive } from 'lucide-react';

const DocCard = ({ icon: Icon, title, description, badge }) => (
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
            <div style={{ background: 'rgba(107, 70, 193, 0.2)', padding: '8px', borderRadius: '10px', color: 'var(--primary)' }}>
                <Icon size={20} />
            </div>
            {badge && <span style={{ fontSize: '0.7rem', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', color: 'var(--text-muted)' }}>{badge}</span>}
        </div>
        <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>{title}</h4>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>{description}</p>
    </div>
);

const LibraryDoc = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                    <div style={{ background: 'var(--secondary)', padding: '10px', borderRadius: '12px' }}>
                        <List size={24} color="white" />
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>Bibliothèque <span style={{ color: 'var(--secondary)' }}>Musicale</span></h2>
                </div>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '40px' }}>
                    Le centre névralgique de votre collection. Gérez ici l'acquisition, le référencement et l'organisation de vos titres.
                </p>
                <div style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                    <img src="/doc_images/library.png" alt="Vue Bibliothèque" style={{ width: '100%', display: 'block' }} />
                </div>
            </section>

            {/* AI CHATBOT SECTION */}
            <section style={{ background: 'rgba(107, 70, 193, 0.05)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(107, 70, 193, 0.2)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <MessageSquare size={24} /> Mode Intelligent (Chatbot)
                </h3>
                <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '25px' }}>
                    Utilisez l'IA pour enrichir votre bibliothèque naturellement. Comme dans ChatGPT, vous pouvez discuter avec l'assistant pour trouver et organiser votre musique.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    <DocCard
                        icon={MessageSquare}
                        title="Recherche Naturelle"
                        description="Écrivez ce que vous cherchez (ex: 'Trouve moi du rock dynamique des années 80'). L'IA analyse votre demande et trouve les meilleures correspondances."
                        badge="IA"
                    />
                    <DocCard
                        icon={CheckCircle2}
                        title="Classification Auto"
                        description="Une fois les musiques trouvées, l'IA les classe automatiquement dans les bonnes catégories et ajoute les tags appropriés."
                        badge="Smart"
                    />
                    <DocCard
                        icon={Youtube}
                        title="Téléchargement Direct"
                        description="Si une musique vous plaît, cliquez sur 'Télécharger'. L'application récupère automatiquement l'audio depuis YouTube et l'ajoute à votre liste."
                        badge="Automation"
                    />
                </div>
            </section>

            {/* SEARCH & ORGANIZATION SECTION */}
            <section style={{ background: 'rgba(56, 178, 172, 0.05)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(56, 178, 172, 0.2)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Search size={24} /> Recherche & Organisation
                </h3>
                <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '25px' }}>
                    Trouvez instantanément vos morceaux grâce à la barre de recherche intelligente. Elle scanne plusieurs champs pour vous faire gagner du temps.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    <DocCard
                        icon={Search}
                        title="Recherche Multi-Critères"
                        description="La barre de recherche filtre automatiquement par titre, artiste ou catégorie. Commencez à taper et la liste se met à jour en temps réel."
                        badge="Indexation"
                    />
                    <DocCard
                        icon={Info}
                        title="Édition Manuelle"
                        description="Si les informations ne vous conviennent pas, vous pouvez tout modifier : le nom, l'artiste, la catégorie, les tags et même le lien YouTube source."
                        badge="Contrôle Total"
                    />
                    <DocCard
                        icon={Youtube}
                        title="Correction de Liens"
                        description="Un morceau ne se télécharge pas ? Modifiez simplement son lien YouTube pour pointer vers une autre version plus stable."
                        badge="Adaptabilité"
                    />
                </div>
            </section>

            {/* IMPORT & UPLOAD SECTION */}
            <section>
                <h3 style={{ fontSize: '1.8rem', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--secondary)' }}>
                    <Upload size={24} /> Importation & Ajout de Titres
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <DocCard
                        icon={FileSpreadsheet}
                        title="Import Excel / CSV"
                        description="Importez des listes massives via un fichier Excel. Si vous incluez un lien YouTube, vous pourrez télécharger la musique directement. Sinon, le système cherchera la meilleure vidéo pour vous."
                        badge="Batch"
                    />
                    <DocCard
                        icon={Music}
                        title="Fichiers MP3"
                        description="Ajoutez vos propres fichiers MP3 par simple glisser-déposer. Le système analysera les métadonnées pour identifier le titre et l'artiste."
                        badge="Local"
                    />
                    <DocCard
                        icon={FileArchive}
                        title="Archives ZIP"
                        description="Importez des dossiers complets via un fichier .zip contenant vos MP3. Parfait pour migrer une collection entière rapidement."
                        badge="Bulk"
                    />
                    <DocCard
                        icon={Zap}
                        title="Scan Automatique"
                        description="Utilisez 'Scan Folder' pour synchroniser un dossier local. Le système détectera les nouveaux fichiers et les ajoutera à la base."
                        badge="Rapid"
                    />
                </div>
            </section>

            {/* EXPERT TOOLS */}
            <section style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '40px' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24' }}>
                    <ShieldAlert size={20} /> Astuces d'Expert
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <DocCard
                        icon={Download}
                        title="Gestion des Doublons"
                        description="Le système détecte automatiquement les fichiers identiques via leur empreinte numérique (Hash) pour éviter les doublons."
                        badge="Intégrité"
                    />
                    <DocCard
                        icon={Search}
                        title="Filtres Avancés"
                        description="Utilisez la syntaxe 'tag:nom' ou 'cat:nom' dans la barre de recherche pour un filtrage ultra-précis."
                        badge="Recherche"
                    />
                </div>
            </section>
        </div>
    );
};

export default LibraryDoc;

