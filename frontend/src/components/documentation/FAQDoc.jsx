import React, { useState } from 'react';
import { ChevronDown, ChevronRight, HelpCircle, Download, FolderTree, User, List, FileText, Music, Upload } from 'lucide-react';

const faqs = [
    {
        id: 'import-music',
        icon: Upload,
        color: '#4ade80',
        question: 'Comment importer mes musiques ?',
        answer: (
            <>
                <p>Il existe deux façons d'importer vos musiques dans EasyMusic :</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    <div style={{ background: 'rgba(74, 222, 128, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
                        <strong style={{ color: '#4ade80' }}>Option 1 — Fichiers locaux (Scan de dossier)</strong>
                        <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.8', color: 'var(--text-muted)' }}>
                            <li>Ouvrez la vue <strong>Bibliothèque</strong></li>
                            <li>Cliquez sur le bouton <strong>"Scan Folder"</strong></li>
                            <li>Sélectionnez le dossier contenant vos fichiers audio (MP3, WAV, FLAC…)</li>
                            <li>EasyMusic scanne et indexe automatiquement tous les titres trouvés</li>
                        </ol>
                    </div>
                    <div style={{ background: 'rgba(107, 70, 193, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(107, 70, 193, 0.2)' }}>
                        <strong style={{ color: 'var(--primary)' }}>Option 2 — Téléchargement depuis YouTube</strong>
                        <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.8', color: 'var(--text-muted)' }}>
                            <li>Ouvrez la <strong>Bibliothèque</strong> et cliquez sur <strong>"Ajouter via YouTube"</strong></li>
                            <li>Collez l'URL YouTube ou utilisez le chatbot IA pour chercher un titre</li>
                            <li>EasyMusic télécharge le fichier audio directement dans votre bibliothèque</li>
                        </ol>
                    </div>
                </div>
            </>
        ),
    },
    {
        id: 'export-music',
        icon: Download,
        color: '#3b82f6',
        question: 'Comment exporter toutes mes musiques ?',
        answer: (
            <>
                <p>EasyMusic propose deux niveaux d'export pour récupérer vos fichiers :</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <strong style={{ color: '#3b82f6' }}>Export d'un dossier (ZIP)</strong>
                        <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.8', color: 'var(--text-muted)' }}>
                            <li>Allez dans le <strong>Library Manager</strong></li>
                            <li>Faites un <strong>clic-droit</strong> sur le dossier ou la catégorie à exporter</li>
                            <li>Choisissez <strong>"Exporter en ZIP"</strong></li>
                            <li>Le système génère une archive ZIP avec tous les fichiers MP3 du dossier</li>
                        </ol>
                    </div>
                    <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <strong style={{ color: '#3b82f6' }}>Export complet de la bibliothèque</strong>
                        <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.8', color: 'var(--text-muted)' }}>
                            <li>Dans le <strong>Library Manager</strong>, ouvrez le menu <strong>"Télécharger ZIP"</strong> en haut à droite</li>
                            <li>Choisissez le mode <strong>Flat</strong> (tous les fichiers dans un seul dossier) ou <strong>Structuré</strong> (arborescence conservée)</li>
                            <li>Cliquez sur <strong>Télécharger</strong> pour récupérer l'intégralité de votre bibliothèque</li>
                        </ol>
                        <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Si un fichier est manquant, EasyMusic vous propose de le re-télécharger avant l'export.
                        </p>
                    </div>
                </div>
            </>
        ),
    },
    {
        id: 'use-profile',
        icon: User,
        color: '#ec4899',
        question: 'Comment utiliser un profil ?',
        answer: (
            <>
                <p>Les profils permettent à plusieurs DJ ou utilisateurs de partager la même installation EasyMusic avec des bibliothèques et setlists séparées.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    <div style={{ background: 'rgba(236, 72, 153, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
                        <strong style={{ color: '#ec4899' }}>Changer de profil</strong>
                        <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.8', color: 'var(--text-muted)' }}>
                            <li>Cliquez sur l'icône de <strong>profil</strong> dans le coin supérieur droit de l'interface</li>
                            <li>Sélectionnez un profil existant dans la liste déroulante</li>
                            <li>La bibliothèque et les setlists se rechargent automatiquement pour ce profil</li>
                        </ol>
                    </div>
                    <div style={{ background: 'rgba(236, 72, 153, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
                        <strong style={{ color: '#ec4899' }}>Créer un nouveau profil</strong>
                        <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.8', color: 'var(--text-muted)' }}>
                            <li>Ouvrez le menu profil et cliquez sur <strong>"+ Nouveau profil"</strong></li>
                            <li>Donnez-lui un nom (ex: "DJ Marc", "Soirée Privée"…)</li>
                            <li>Ce profil aura sa propre vue de la bibliothèque et ses propres setlists</li>
                        </ol>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <strong style={{ color: 'var(--text-main)' }}>Profil "Master"</strong>
                        <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                            Le profil <strong>Master</strong> voit l'intégralité de la bibliothèque. Les autres profils ne voient que les musiques qui leur ont été assignées via le Manager.
                        </p>
                    </div>
                </div>
            </>
        ),
    },
    {
        id: 'export-playlist-sas',
        icon: FileText,
        color: '#fbbf24',
        question: 'Comment exporter mes playlists pour le SAS de Didier ?',
        answer: (
            <>
                <p>Le SAS de Didier utilise un format texte spécifique (<code>BeginPlayList / BeginItem</code>). EasyMusic génère ce format automatiquement.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    <div style={{ background: 'rgba(251, 191, 36, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                        <strong style={{ color: '#fbbf24' }}>Étapes d'export</strong>
                        <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.8', color: 'var(--text-muted)' }}>
                            <li>Ouvrez l'onglet <strong>Playlists</strong> dans le Library Manager</li>
                            <li>Trouvez la playlist que vous souhaitez exporter</li>
                            <li>Cliquez sur l'icône <strong>Télécharger</strong> (flèche vers le bas) à droite de la playlist</li>
                            <li>Un fichier <code>.txt</code> est téléchargé avec le format compatible SAS</li>
                            <li>Importez ce fichier <code>.txt</code> directement dans le SAS de Didier</li>
                        </ol>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        <div style={{ color: '#fbbf24', marginBottom: '8px', fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.7 }}>Aperçu du format généré</div>
                        <div style={{ color: '#4ade80' }}>BeginPlayList</div>
                        <div style={{ paddingLeft: '16px', color: 'var(--text-muted)' }}>
                            <div>BeginItem</div>
                            <div style={{ paddingLeft: '16px' }}>
                                <div>ItemName "chemin\vers\morceau.mp3"</div>
                                <div>volumeMP3 1.000</div>
                                <div>posMusic 0.000</div>
                                <div>startLoop 0.000</div>
                                <div>endLoop 0.000</div>
                                <div>isLoop 0</div>
                            </div>
                            <div>EndItem</div>
                        </div>
                        <div style={{ color: '#4ade80' }}>EndPlayList</div>
                    </div>
                    <div style={{ background: 'rgba(251, 191, 36, 0.05)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(251, 191, 36, 0.15)' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                            <strong style={{ color: '#fbbf24' }}>Important :</strong> Les chemins dans le fichier sont <strong>relatifs à la racine de votre bibliothèque musicale</strong>.
                            Assurez-vous que le SAS de Didier pointe sur le même dossier racine, sinon les pistes ne seront pas trouvées.
                        </p>
                    </div>
                </div>
            </>
        ),
    },
];

const FAQItem = ({ faq }) => {
    const [open, setOpen] = useState(false);
    const Icon = faq.icon;

    return (
        <div style={{
            background: open ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${open ? faq.color + '40' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '16px',
            overflow: 'hidden',
            transition: 'border-color 0.2s',
        }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '22px 24px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                <div style={{ background: faq.color + '22', padding: '10px', borderRadius: '10px', color: faq.color, flexShrink: 0 }}>
                    <Icon size={20} />
                </div>
                <span style={{ flex: 1, fontSize: '1.05rem', fontWeight: 600 }}>{faq.question}</span>
                <div style={{ color: open ? faq.color : 'var(--text-muted)', transition: 'color 0.2s', flexShrink: 0 }}>
                    {open ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
            </button>

            {open && (
                <div style={{ padding: '0 24px 24px 24px', color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.95rem' }}>
                    <div style={{ borderTop: `1px solid ${faq.color}22`, paddingTop: '20px' }}>
                        {faq.answer}
                    </div>
                </div>
            )}
        </div>
    );
};

const FAQDoc = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>
            <section style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
                <div style={{ display: 'inline-flex', background: 'rgba(107,70,193,0.15)', padding: '12px', borderRadius: '16px', marginBottom: '24px' }}>
                    <HelpCircle size={32} color="var(--primary)" />
                </div>
                <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '16px' }}>
                    Questions <span style={{ color: 'var(--primary)' }}>Fréquentes</span>
                </h1>
                <p style={{ fontSize: '1.15rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    Les réponses aux questions les plus courantes sur l'utilisation d'EasyMusic.
                    Utilisez aussi le <strong style={{ color: 'var(--primary)' }}>Chat Documentation</strong> pour poser votre propre question.
                </p>
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {faqs.map(faq => <FAQItem key={faq.id} faq={faq} />)}
            </section>
        </div>
    );
};

export default FAQDoc;
