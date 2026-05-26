import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Zap } from 'lucide-react';

// ─── Knowledge base ───────────────────────────────────────────────────────────
// Each entry has keyword arrays and bilingual responses.
const KB = [
    {
        keywords: ['import', 'importer', 'ajouter', 'add', 'scan', 'charger', 'load', 'dossier', 'folder', 'fichier', 'file'],
        fr: `Pour **importer vos musiques** dans EasyMusic, deux options s'offrent à vous :\n\n**1. Scan de dossier local**\n- Ouvrez la vue **Bibliothèque**\n- Cliquez sur **"Scan Folder"**\n- Sélectionnez votre dossier audio\n- EasyMusic indexe automatiquement tous les fichiers trouvés\n\n**2. Téléchargement YouTube**\n- Dans la Bibliothèque, cliquez sur **"Ajouter via YouTube"**\n- Collez l'URL ou utilisez le chatbot IA pour chercher un titre\n\n📖 Consultez l'onglet **Bibliothèque** dans ce guide pour les détails.`,
        en: `To **import music** into EasyMusic, you have two options:\n\n**1. Local folder scan**\n- Open the **Library** view\n- Click **"Scan Folder"**\n- Select your audio folder\n- EasyMusic indexes all found files automatically\n\n**2. YouTube download**\n- In the Library, click **"Add via YouTube"**\n- Paste the URL or use the AI chatbot to search\n\n📖 Check the **Library** tab in this guide for details.`,
    },
    {
        keywords: ['export', 'exporter', 'télécharger', 'download', 'zip', 'archive', 'récupérer', 'backup'],
        fr: `Pour **exporter vos musiques**, allez dans le **Library Manager** :\n\n**Export d'un dossier**\n- Faites un **clic-droit** sur un dossier ou une catégorie\n- Choisissez **"Exporter en ZIP"**\n- Une archive ZIP avec tous les MP3 est générée\n\n**Export complet**\n- Utilisez le bouton **"Télécharger ZIP"** en haut du Manager\n- Choisissez entre mode **Flat** (tout à plat) ou **Structuré** (arborescence)\n\n⚠️ Si un fichier est manquant, le système propose de le re-télécharger avant l'export.`,
        en: `To **export your music**, go to the **Library Manager**:\n\n**Folder export**\n- **Right-click** on a folder or category\n- Select **"Export as ZIP"**\n- A ZIP archive with all MP3s is generated\n\n**Full export**\n- Use the **"Download ZIP"** button at the top of the Manager\n- Choose **Flat** (all files in one folder) or **Structured** (preserves folder tree)\n\n⚠️ If a file is missing, the system offers to re-download it before exporting.`,
    },
    {
        keywords: ['profil', 'profile', 'utilisateur', 'user', 'compte', 'account', 'changer', 'switch', 'créer', 'create', 'nouveau', 'new'],
        fr: `Les **profils** permettent à plusieurs DJ de partager la même installation avec des bibliothèques séparées.\n\n**Changer de profil**\n- Cliquez sur l'icône **profil** en haut à droite\n- Sélectionnez un profil dans la liste\n- La bibliothèque se recharge automatiquement\n\n**Créer un profil**\n- Ouvrez le menu profil → **"+ Nouveau profil"**\n- Donnez-lui un nom (ex: "DJ Marc")\n\n**Profil Master**\nVoit toute la bibliothèque. Les autres profils ne voient que leurs musiques assignées.`,
        en: `**Profiles** allow multiple DJs to share the same installation with separate libraries.\n\n**Switch profile**\n- Click the **profile icon** in the top right\n- Select a profile from the list\n- The library reloads automatically\n\n**Create a profile**\n- Open profile menu → **"+ New profile"**\n- Give it a name (e.g., "DJ Marc")\n\n**Master profile**\nSees the entire library. Other profiles only see their assigned tracks.`,
    },
    {
        keywords: ['sas', 'didier', 'playlist', 'exporter playlist', 'export playlist', 'txt', 'beginplaylist', 'logiciel'],
        fr: `Pour **exporter une playlist compatible avec le SAS de Didier** :\n\n1. Ouvrez l'onglet **Playlists** dans le Library Manager\n2. Trouvez votre playlist et cliquez sur l'icône **Télécharger** (↓)\n3. Un fichier **.txt** est généré au format **BeginPlayList/BeginItem**\n4. Importez ce fichier directement dans le SAS\n\n⚠️ **Important** : Les chemins dans le fichier sont relatifs à la racine de votre bibliothèque. Le SAS doit pointer sur le **même dossier racine** pour que les pistes soient trouvées.`,
        en: `To **export a playlist compatible with Didier's SAS**:\n\n1. Open the **Playlists** tab in the Library Manager\n2. Find your playlist and click the **Download** icon (↓)\n3. A **.txt** file is generated in **BeginPlayList/BeginItem** format\n4. Import this file directly into the SAS\n\n⚠️ **Important**: Paths in the file are relative to your library root. The SAS must point to the **same root folder** for tracks to be found.`,
    },
    {
        keywords: ['setlist', 'dossier', 'organiser', 'organizer', 'organize', 'classer', 'categorise', 'catégoriser', 'manager'],
        fr: `Le **Library Manager** est votre outil d'organisation :\n\n- **Glisser-déposer** : faites glisser un morceau depuis la liste de droite vers un dossier à gauche\n- **SHIFT + dépôt** : ajouter à plusieurs catégories sans retirer les anciennes\n- **CTRL + clic** : sélection multiple pour déplacer plusieurs titres d'un coup\n- **Clic-droit** : créer, renommer ou exporter un dossier\n\n📖 Consultez l'onglet **Manager** pour le guide complet.`,
        en: `The **Library Manager** is your organization tool:\n\n- **Drag & drop**: drag a track from the right list onto a left-side folder\n- **SHIFT + drop**: add to multiple categories without removing existing ones\n- **CTRL + click**: multi-select to move several tracks at once\n- **Right-click**: create, rename or export a folder\n\n📖 Check the **Manager** tab for the full guide.`,
    },
    {
        keywords: ['dj', 'mixer', 'mix', 'virtual', 'simplified', 'platine', 'deck', 'jouer', 'play', 'live'],
        fr: `EasyMusic propose deux modes DJ :\n\n**Simplified DJ** 🎵\n- Interface simple pour débuter\n- Contrôles de base : lecture, volume, BPM\n- Idéal pour les sets directs sans préparation\n\n**Virtual DJ** 🎚️\n- Interface complète avec platines\n- Fonctions avancées : EQ, effets, waveform\n- Pour les DJ expérimentés\n\nChargez vos setlists depuis le Manager pour préparer vos morceaux à l'avance.`,
        en: `EasyMusic offers two DJ modes:\n\n**Simplified DJ** 🎵\n- Simple interface for beginners\n- Basic controls: play, volume, BPM\n- Ideal for live sets without preparation\n\n**Virtual DJ** 🎚️\n- Full interface with decks\n- Advanced features: EQ, effects, waveform\n- For experienced DJs\n\nLoad your setlists from the Manager to prepare your tracks in advance.`,
    },
    {
        keywords: ['sfx', 'effet', 'effet sonore', 'sound effect', 'bruitage', 'son', 'jingle'],
        fr: `Le panneau **SFX** vous permet de déclencher des effets sonores en live :\n\n- Ajoutez vos effets depuis la **Bibliothèque SFX** (YouTube ou fichiers locaux)\n- Utilisez le **clavier virtuel** pour les déclencher au clavier\n- Ajustez le volume indépendamment de la musique principale\n\n📖 Consultez l'onglet **SFX Setup** pour la configuration complète.`,
        en: `The **SFX panel** lets you trigger sound effects live:\n\n- Add effects from the **SFX Library** (YouTube or local files)\n- Use the **virtual keyboard** to trigger them with keyboard shortcuts\n- Adjust volume independently from the main music\n\n📖 Check the **SFX Setup** tab for full configuration.`,
    },
    {
        keywords: ['ia', 'ai', 'assistant', 'chatbot', 'intelligence', 'intelligente', 'chercher', 'search', 'trouver', 'find'],
        fr: `L'**Assistant IA** d'EasyMusic vous aide à enrichir votre bibliothèque naturellement :\n\n- Dites par exemple : *"Ajoute un morceau pop rapide et joyeux"*\n- L'IA recherche sur YouTube et propose des titres correspondants\n- Elle peut aussi réorganiser votre bibliothèque en langage naturel\n\nAccédez-y via l'onglet **Bibliothèque** → mode Chatbot.\n\n📖 Consultez l'onglet **Assistant IA** pour les détails.`,
        en: `EasyMusic's **AI Assistant** helps you enrich your library naturally:\n\n- Say for example: *"Add a fast and happy pop song"*\n- The AI searches YouTube and suggests matching tracks\n- It can also reorganize your library in natural language\n\nAccess it via the **Library** tab → Chatbot mode.\n\n📖 Check the **AI Assistant** tab for details.`,
    },
    {
        keywords: ['youtube', 'télécharger', 'download', 'url', 'lien', 'link', 'vidéo', 'video'],
        fr: `Pour **télécharger depuis YouTube** :\n\n1. Ouvrez la **Bibliothèque**\n2. Cliquez sur **"Ajouter via YouTube"** ou utilisez le chatbot IA\n3. Collez l'URL YouTube du morceau\n4. EasyMusic télécharge l'audio (MP3) directement dans votre bibliothèque\n\nVous pouvez aussi demander au chatbot : *"Télécharge [nom du morceau]"* et il trouvera la vidéo correspondante.`,
        en: `To **download from YouTube**:\n\n1. Open the **Library**\n2. Click **"Add via YouTube"** or use the AI chatbot\n3. Paste the YouTube URL\n4. EasyMusic downloads the audio (MP3) directly to your library\n\nYou can also ask the chatbot: *"Download [track name]"* and it will find the right video.`,
    },
];

const SUGGESTIONS_FR = [
    'Comment importer mes musiques ?',
    'Comment exporter en ZIP ?',
    'Comment utiliser un profil ?',
    'Comment exporter pour le SAS de Didier ?',
];

const SUGGESTIONS_EN = [
    'How do I import music?',
    'How do I export a ZIP?',
    'How do I use profiles?',
    'How to export for the SAS?',
];

// ─── Language detection ───────────────────────────────────────────────────────
const EN_MARKERS = ['how', 'what', 'where', 'can', 'do', 'does', 'the', 'my', 'i ', "i'", 'help', 'export', 'import', 'use', 'create', 'find'];
function detectLang(text) {
    const lower = text.toLowerCase();
    const score = EN_MARKERS.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);
    return score >= 2 ? 'en' : 'fr';
}

// ─── Find best KB match ───────────────────────────────────────────────────────
function findAnswer(text, lang) {
    const lower = text.toLowerCase();
    let best = null;
    let bestScore = 0;
    for (const entry of KB) {
        const score = entry.keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
        if (score > bestScore) { bestScore = score; best = entry; }
    }
    if (!best || bestScore === 0) {
        return lang === 'en'
            ? `I didn't quite understand your question. Try asking about:\n- Importing music\n- Exporting music or playlists\n- Using profiles\n- SAS de Didier export\n- DJ modes or SFX`
            : `Je n'ai pas bien compris votre question. Essayez de demander :\n- Importer des musiques\n- Exporter des musiques ou playlists\n- Utiliser les profils\n- Export pour le SAS de Didier\n- Les modes DJ ou les SFX`;
    }
    return lang === 'en' ? best.en : best.fr;
}

// ─── Simple markdown-ish renderer ────────────────────────────────────────────
function renderText(text) {
    return text.split('\n').map((line, i) => {
        const parts = line.split(/\*\*(.*?)\*\*/g).map((part, j) =>
            j % 2 === 1
                ? <strong key={j} style={{ color: 'var(--text-main)' }}>{part}</strong>
                : part
        );
        const isListItem = line.trimStart().startsWith('-') || /^\d+\./.test(line.trimStart());
        return (
            <span key={i} style={{ display: 'block', marginBottom: isListItem ? '2px' : '6px', paddingLeft: isListItem ? '4px' : 0 }}>
                {parts}
            </span>
        );
    });
}

// ─── Component ────────────────────────────────────────────────────────────────
const DocChat = () => {
    const [messages, setMessages] = useState([
        {
            role: 'bot',
            text: 'Bonjour ! Je suis l\'assistant de la documentation EasyMusic. Posez-moi une question en français ou en anglais et je vous guiderai.\n\n*Hello! Ask me anything in French or English about EasyMusic.*',
        },
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [lang, setLang] = useState('fr');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const sendMessage = (text) => {
        if (!text.trim()) return;
        const detectedLang = detectLang(text);
        setLang(detectedLang);

        setMessages(prev => [...prev, { role: 'user', text }]);
        setInput('');
        setIsTyping(true);

        setTimeout(() => {
            const answer = findAnswer(text, detectedLang);
            setMessages(prev => [...prev, { role: 'bot', text: answer }]);
            setIsTyping(false);
        }, 500);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage(input);
    };

    const suggestions = lang === 'en' ? SUGGESTIONS_EN : SUGGESTIONS_FR;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>
            {/* Header */}
            <section style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
                <div style={{ display: 'inline-flex', background: 'rgba(107,70,193,0.15)', padding: '12px', borderRadius: '16px', marginBottom: '24px' }}>
                    <Bot size={32} color="var(--primary)" />
                </div>
                <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '16px' }}>
                    Chat <span style={{ color: 'var(--primary)' }}>Documentation</span>
                </h1>
                <p style={{ fontSize: '1.15rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    Posez vos questions sur EasyMusic en français ou en anglais.
                    L'assistant adapte sa réponse à votre langue automatiquement.
                </p>
            </section>

            {/* Chat window */}
            <section style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '24px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                height: '560px',
            }}>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            style={{
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'flex-start',
                                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                            }}
                        >
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: msg.role === 'bot' ? 'rgba(107,70,193,0.3)' : 'rgba(255,255,255,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                {msg.role === 'bot'
                                    ? <Bot size={16} color="var(--primary)" />
                                    : <User size={16} color="var(--text-muted)" />
                                }
                            </div>
                            <div style={{
                                maxWidth: '75%',
                                background: msg.role === 'bot' ? 'rgba(107,70,193,0.1)' : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${msg.role === 'bot' ? 'rgba(107,70,193,0.2)' : 'rgba(255,255,255,0.08)'}`,
                                padding: '14px 18px',
                                borderRadius: msg.role === 'bot' ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                                fontSize: '0.9rem',
                                color: 'var(--text-muted)',
                                lineHeight: '1.6',
                            }}>
                                {renderText(msg.text)}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(107,70,193,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Bot size={16} color="var(--primary)" />
                            </div>
                            <div style={{ background: 'rgba(107,70,193,0.1)', border: '1px solid rgba(107,70,193,0.2)', padding: '14px 18px', borderRadius: '4px 18px 18px 18px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {[0, 1, 2].map(j => (
                                    <span key={j} style={{
                                        width: '6px', height: '6px', borderRadius: '50%',
                                        background: 'var(--primary)', opacity: 0.7,
                                        animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite`,
                                    }} />
                                ))}
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Suggestions */}
                <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => sendMessage(s)}
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '20px',
                                padding: '6px 14px',
                                color: 'var(--text-muted)',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.target.style.background = 'rgba(107,70,193,0.15)'; e.target.style.borderColor = 'rgba(107,70,193,0.3)'; e.target.style.color = 'var(--primary)'; }}
                            onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.04)'; e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.color = 'var(--text-muted)'; }}
                        >
                            <Zap size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                            {s}
                        </button>
                    ))}
                </div>

                {/* Input */}
                <form
                    onSubmit={handleSubmit}
                    style={{ display: 'flex', gap: '12px', padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder={lang === 'en' ? 'Ask a question about EasyMusic…' : 'Posez votre question sur EasyMusic…'}
                        disabled={isTyping}
                        style={{
                            flex: 1,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            color: 'var(--text-main)',
                            fontSize: '0.9rem',
                            outline: 'none',
                        }}
                    />
                    <button
                        type="submit"
                        disabled={isTyping || !input.trim()}
                        style={{
                            background: 'var(--primary)',
                            border: 'none',
                            borderRadius: '12px',
                            width: '44px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
                            opacity: input.trim() && !isTyping ? 1 : 0.4,
                            transition: 'opacity 0.2s',
                            flexShrink: 0,
                        }}
                    >
                        <Send size={18} color="white" />
                    </button>
                </form>
            </section>

            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.4); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default DocChat;
