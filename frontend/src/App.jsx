import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Chatbot from './components/Chatbot';
import Playlist from './components/playlist/Playlist';
import VirtualDJ from './components/dj/VirtualDJ';
import LibraryManager from './components/library/LibraryManager';
import SoundEffectsPanel from './components/dj/SoundEffectsPanel';
import SimplifiedDJ from './components/dj/SimplifiedDJ';
import ProfileMenu from './components/ProfileMenu';
import { useProfile } from './components/ProfileContext';
import { useToast } from './components/ToastContext';
import ImportModal from './components/library/ImportModal';
import Documentation from './components/Documentation';
import { Bot, LibraryBig, Disc3, FolderTree, Settings2, LayoutGrid, Upload, HelpCircle } from 'lucide-react';

import api from './api';

function App() {
  const [playlist, setPlaylist] = useState([]);
  const { activeProfile, updateProfileConfig } = useProfile();
  const { addToast } = useToast();
  const importFileInputRef = React.useRef(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState([]);
  const location = useLocation();

  const fetchPlaylist = async () => {
    try {
      const res = await api.getPlaylist(activeProfile?.id);
      if (res.ok) {
        const data = await res.json();
        setPlaylist(data);
      }
    } catch (err) {
      console.error("Failed to fetch playlist", err);
    }
  };

  useEffect(() => {
    if (!activeProfile) return;
    fetchPlaylist();

    const handleUpdate = () => fetchPlaylist();
    window.addEventListener('playlist-updated', handleUpdate);
    return () => window.removeEventListener('playlist-updated', handleUpdate);
  }, [activeProfile?.id]);

  const routeConfig = [
    { path: '/', label: 'Library', icon: <LibraryBig size={16} />, color: 'var(--secondary)' },
    { path: '/manager', label: 'Library Manager', icon: <FolderTree size={16} />, color: '#4ade80' },
    { path: '/sfx', label: 'SFX Setup', icon: <Settings2 size={16} />, color: '#a855f7' },
    { path: '/simplified-dj', label: 'Simplified DJ', icon: <LayoutGrid size={16} />, color: '#f59e0b' },
    { path: '/dj', label: 'Virtual DJ', icon: <Disc3 size={16} />, color: 'var(--primary)' },
    { path: '/docs', label: 'Help/Doc', icon: <HelpCircle size={16} />, color: '#4ade80' },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Global Tab Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '10px 24px 0',
        background: 'var(--bg-dark)',
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        {routeConfig.map((route) => (
          <TabButton
            key={route.path}
            active={isActive(route.path)}
            to={route.path}
            icon={route.icon}
            label={route.label}
            activeColor={route.color}
          />
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ paddingBottom: '10px' }}>
          <ProfileMenu />
        </div>
        <div style={{
          fontSize: '0.65rem',
          color: 'var(--text-muted)',
          letterSpacing: '2px',
          fontWeight: 800,
          textTransform: 'uppercase',
          paddingBottom: '10px',
          marginLeft: '16px',
        }}>
          EasyMusic
        </div>
      </div>

      {/* Routes Content */}
      <Routes>
        <Route path="/" element={
          <div className="app-container" style={{ flex: 1, minHeight: 0 }}>
            <div className="left-panel">
              <div className="panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Bot size={28} color="var(--primary)" />
                  <h2>AI Improv Agent</h2>
                </div>
              </div>
              <Chatbot onUpdate={fetchPlaylist} />
            </div>

            <div className="right-panel">
              <div className="panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <LibraryBig size={28} color="var(--secondary)" />
                  <h2>Playlist Database</h2>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => document.getElementById('fileInput').click()}
                  >
                    Import CSV/XLSX
                  </button>
                  <input
                    type="file"
                    id="fileInput"
                    style={{ display: 'none' }}
                    accept=".csv, .xlsx"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append('file', file);
                      try {
                        const res = await api.importLegacy(formData);
                        const data = await res.json();
                        addToast(data.message || "Imported successfully!", "success");
                        fetchPlaylist();
                      } catch (err) {
                        console.error("Import failed", err);
                        addToast("Import failed: " + err.message, "error");
                      }
                    }}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={async () => {
                      try {
                        const res = await api.scanAudio();
                        const data = await res.json();
                        addToast(`Scan complete: ${data.matches_found} matches found.`, "success");
                        fetchPlaylist();
                      } catch (err) {
                        console.error("Scan failed", err);
                        addToast("Scan failed", "error");
                      }
                    }}
                  >
                    Scan Local Folder
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={async () => {
                      await api.downloadBatch();
                      addToast("Batch download started in the background!", "info");
                    }}
                  >
                    Download Missing
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ background: 'var(--primary)', color: 'var(--bg-dark)' }}
                    onClick={() => importFileInputRef.current?.click()}
                  >
                    <Upload size={16} /> Upload MP3/ZIP
                  </button>
                  <input
                    type="file"
                    multiple
                    accept=".mp3,.wav,.zip"
                    ref={importFileInputRef}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setDroppedFiles(e.target.files);
                        setIsImportModalOpen(true);
                      }
                    }}
                  />
                </div>
              </div>
              <Playlist
                playlist={playlist}
                onUpdate={fetchPlaylist}
              />
            </div>
          </div>
        } />

        <Route path="/manager" element={
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <LibraryManager />
          </div>
        } />

        <Route path="/sfx" element={
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <SoundEffectsPanel
              keybindings={activeProfile?.config?.keybindings || {}}
              onUpdateKeybindings={(newB) => updateProfileConfig(activeProfile.id, { keybindings: newB })}
              onPlaySoundEffect={(id) => {
                if (!window.__activeAudioNodes) window.__activeAudioNodes = new Set();
                const el = new Audio(api.getSoundEffectPlayUrl(id));
                window.__activeAudioNodes.add(el);
                el.onended = () => window.__activeAudioNodes.delete(el);
                el.onerror = () => window.__activeAudioNodes.delete(el);
                el.play().catch(e => {
                  console.warn('SFX Error:', e);
                  window.__activeAudioNodes.delete(el);
                });
              }}
            />
          </div>
        } />

        <Route path="/simplified-dj" element={
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <SimplifiedDJ playlist={playlist} />
          </div>
        } />

        <Route path="/dj" element={
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <VirtualDJ playlist={playlist} />
          </div>
        } />

        <Route path="/docs" element={
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Documentation />
          </div>
        } />
      </Routes>

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        files={droppedFiles}
        onImportComplete={() => {
          fetchPlaylist();
        }}
      />
    </div>
  );
}

function TabButton({ active, to, icon, label, activeColor }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        padding: '8px 20px',
        marginBottom: '-1px',
        border: 'none',
        borderRadius: '10px 10px 0 0',
        background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: active ? activeColor : 'var(--text-muted)',
        fontWeight: active ? 700 : 500,
        fontSize: '0.85rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderTop: active ? `2px solid ${activeColor}` : '2px solid transparent',
        borderLeft: active ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
        borderRight: active ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
        borderBottom: active ? '1px solid var(--bg-dark)' : '1px solid transparent',
        filter: active ? `drop-shadow(0 0 6px ${activeColor}55)` : 'none',
        textDecoration: 'none',
      }}
    >
      {icon}
      {label}
    </Link>
  );
}

export default App;

