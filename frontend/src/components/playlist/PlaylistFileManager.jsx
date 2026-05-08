import React, { useState, useEffect, useRef } from 'react';
import { ListMusic, Upload, Download, Trash2, Pencil, Check, X, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../../api';
import { useToast } from '../ToastContext';
import { useProfile } from '../ProfileContext';

export default function PlaylistFileManager() {
  const { addToast } = useToast();
  const { activeProfile } = useProfile();
  const [playlists, setPlaylists] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  const fetchPlaylists = async () => {
    try {
      const res = await api.getCustomPlaylists(activeProfile?.id);
      if (res.ok) setPlaylists(await res.json());
    } catch (err) {
      addToast('Erreur lors du chargement des playlists', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlaylists(); }, [activeProfile?.id]);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const res = await api.importCustomPlaylist(file, activeProfile?.id);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Import failed');
      addToast(`"${data.name}" importée — ${data.matched}/${data.total} pistes trouvées`, 'success');
      fetchPlaylists();
    } catch (err) {
      addToast('Erreur import: ' + err.message, 'error');
    }
  };

  const handleExport = (id) => {
    window.open(api.getCustomPlaylistExportUrl(id), '_blank');
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Supprimer la playlist "${name}" ?`)) return;
    try {
      await api.deleteCustomPlaylist(id);
      addToast(`"${name}" supprimée`, 'success');
      if (expandedId === id) setExpandedId(null);
      fetchPlaylists();
    } catch {
      addToast('Erreur suppression', 'error');
    }
  };

  const startRename = (id, name) => {
    setRenaming(id);
    setRenameValue(name);
  };

  const confirmRename = async (id) => {
    if (!renameValue.trim()) return;
    try {
      const res = await api.renameCustomPlaylist(id, renameValue.trim());
      if (!res.ok) throw new Error();
      addToast('Playlist renommée', 'success');
      setRenaming(null);
      fetchPlaylists();
    } catch {
      addToast('Erreur renommage', 'error');
    }
  };

  const handleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setExpandedData(null);
    try {
      const res = await api.getCustomPlaylist(id);
      if (res.ok) setExpandedData(await res.json());
    } catch {
      addToast('Erreur chargement détails', 'error');
    }
  };

  return (
    <div style={{ flex: 1, padding: '24px', overflowY: 'auto', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ListMusic size={28} color="var(--primary)" />
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Gestion des Playlists</h2>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={16} /> Importer une playlist
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>

      {/* Playlist list */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>
      ) : playlists.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)',
          border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px',
        }}>
          <ListMusic size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p style={{ margin: 0 }}>Aucune playlist. Importez un fichier <code>.txt</code></p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {playlists.map((pl) => (
            <PlaylistCard
              key={pl.id}
              playlist={pl}
              isExpanded={expandedId === pl.id}
              expandedData={expandedData}
              isRenaming={renaming === pl.id}
              renameValue={renameValue}
              onRenameChange={setRenameValue}
              onExpand={() => handleExpand(pl.id)}
              onExport={() => handleExport(pl.id)}
              onDelete={() => handleDelete(pl.id, pl.name)}
              onRenameStart={() => startRename(pl.id, pl.name)}
              onRenameConfirm={() => confirmRename(pl.id)}
              onRenameCancel={() => setRenaming(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlaylistCard({
  playlist, isExpanded, expandedData,
  isRenaming, renameValue, onRenameChange,
  onExpand, onExport, onDelete, onRenameStart, onRenameConfirm, onRenameCancel,
}) {
  const renameInputRef = useRef(null);

  useEffect(() => {
    if (isRenaming) renameInputRef.current?.focus();
  }, [isRenaming]);

  const handleRenameKey = (e) => {
    if (e.key === 'Enter') onRenameConfirm();
    if (e.key === 'Escape') onRenameCancel();
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 16px', cursor: 'pointer',
      }}>
        <div onClick={onExpand} style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>

        {/* Name or rename input */}
        <div style={{ flex: 1, minWidth: 0 }} onClick={!isRenaming ? onExpand : undefined}>
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={handleRenameKey}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid var(--primary)',
                borderRadius: '6px', padding: '4px 10px', color: 'var(--text)',
                fontSize: '0.95rem', width: '100%', maxWidth: '360px',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{playlist.name}</span>
          )}
        </div>

        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>
          {playlist.item_count} piste{playlist.item_count !== 1 ? 's' : ''}
        </span>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {isRenaming ? (
            <>
              <IconBtn title="Confirmer" onClick={onRenameConfirm} color="var(--success)"><Check size={15} /></IconBtn>
              <IconBtn title="Annuler" onClick={onRenameCancel} color="var(--text-muted)"><X size={15} /></IconBtn>
            </>
          ) : (
            <>
              <IconBtn title="Renommer" onClick={onRenameStart}><Pencil size={15} /></IconBtn>
              <IconBtn title="Exporter" onClick={onExport} color="var(--primary)"><Download size={15} /></IconBtn>
              <IconBtn title="Supprimer" onClick={onDelete} color="#ef4444"><Trash2 size={15} /></IconBtn>
            </>
          )}
        </div>
      </div>

      {/* Expanded items */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {!expandedData ? (
            <p style={{ padding: '12px 20px', color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Chargement…</p>
          ) : expandedData.items.length === 0 ? (
            <p style={{ padding: '12px 20px', color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Aucune piste.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['', 'Piste', 'Chemin original', 'Vol.', 'Pos.', 'Loop'].map((h, i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expandedData.items.map((item, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 12px', width: '24px' }}>
                      {item.track_id
                        ? <CheckCircle2 size={15} color="var(--success, #4ade80)" />
                        : <AlertTriangle size={15} color="#f59e0b" title="Piste non trouvée dans la bibliothèque" />}
                    </td>
                    <td style={{ padding: '8px 12px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.track_title
                        ? <><span>{item.track_title}</span>{item.track_author && <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>— {item.track_author}</span>}</>
                        : <span style={{ color: '#f59e0b' }}>Non trouvée</span>}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.item_name}>
                      {item.item_name}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{item.volume_mp3.toFixed(2)}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{item.pos_music.toFixed(1)}s</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                      {item.is_loop ? `${item.start_loop.toFixed(1)}–${item.end_loop.toFixed(1)}s` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title, color }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '6px', padding: '5px 7px', cursor: 'pointer',
        color: color || 'var(--text-muted)', display: 'flex', alignItems: 'center',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </button>
  );
}
