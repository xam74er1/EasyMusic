import React from 'react';
import { useShareableState } from '../../hooks/useShareableState';

// Example component showing how to use shareable state for URL parameters
function ShareableStateExample() {
  const { state, setState, clearState } = useShareableState();
  const { playlistId, trackIndex } = state;

  const handleSelectPlaylist = (id) => {
    setState({ playlistId: id, trackIndex: 0 });
  };

  const handleSelectTrack = (index) => {
    setState({ trackIndex: index });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h3>Shareable State Example</h3>

      <div style={{ marginBottom: '20px' }}>
        <h4>Current URL State:</h4>
        <pre style={{
          background: 'rgba(255,255,255,0.05)',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '0.9rem'
        }}>
          {JSON.stringify({
            playlistId: playlistId || '(none)',
            trackIndex: trackIndex !== null ? trackIndex : '(none)'
          }, null, 2)}
        </pre>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4>Select a Playlist:</h4>
        <button onClick={() => handleSelectPlaylist('my-mix')} style={{ marginRight: '8px' }}>
          My Mix
        </button>
        <button onClick={() => handleSelectPlaylist('workout')} style={{ marginRight: '8px' }}>
          Workout
        </button>
        <button onClick={() => handleSelectPlaylist('chill-vibes')} style={{ marginRight: '8px' }}>
          Chill Vibes
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4>Select a Track:</h4>
        {[0, 1, 2, 3, 4].map((idx) => (
          <button
            key={idx}
            onClick={() => handleSelectTrack(idx)}
            style={{
              marginRight: '8px',
              background: trackIndex === idx ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Track {idx}
          </button>
        ))}
      </div>

      <div>
        <h4>Share URL:</h4>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Current URL: <code>{window.location.href}</code>
        </p>
        <button onClick={clearState}>Clear State</button>
      </div>
    </div>
  );
}

export default ShareableStateExample;
