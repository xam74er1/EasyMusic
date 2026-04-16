# Integrating Shareable State in DJ Components

## Quick Integration Example

Here's how to add shareable URL support to SimplifiedDJ or VirtualDJ:

### Before (Current State Management)
```jsx
function VirtualDJ({ playlist }) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  
  return (
    // component renders currentTrackIndex
  );
}
```

### After (With Shareable URLs)
```jsx
import { useShareableState } from '../../hooks/useShareableState';

function VirtualDJ({ playlist }) {
  const { state, setState } = useShareableState();
  
  // Initialize from URL if present, else use 0
  const currentTrackIndex = state.trackIndex ?? 0;
  
  const handleTrackChange = (newIndex) => {
    setState({ trackIndex: newIndex });
  };
  
  return (
    // component renders currentTrackIndex
    // calls handleTrackChange instead of setCurrentTrackIndex
  );
}
```

## Step-by-Step Integration

### 1. Import the hook
```jsx
import { useShareableState } from '../../hooks/useShareableState';
```

### 2. Call it in your component
```jsx
const { state, setState } = useShareableState();
```

### 3. Replace state reads
```jsx
// OLD:
const trackIndex = currentTrackIndex;

// NEW:
const trackIndex = state.trackIndex ?? 0;
```

### 4. Update state changes
```jsx
// OLD:
setCurrentTrackIndex(newIndex);

// NEW:
setState({ trackIndex: newIndex });
```

### 5. (Optional) Handle playlist switching
```jsx
const handlePlaylistSelect = (playlistId) => {
  setState({ 
    playlistId: playlistId,
    trackIndex: 0  // Reset to first track
  });
};
```

## Example: Updated VirtualDJ Component

```jsx
import React, { useState } from 'react';
import { useShareableState } from '../../hooks/useShareableState';

function VirtualDJ({ playlist }) {
  const { state, setState } = useShareableState();
  const currentTrackIndex = state.trackIndex ?? 0;
  const selectedPlaylist = state.playlistId;

  const handleNext = () => {
    const nextIndex = (currentTrackIndex + 1) % playlist.length;
    setState({ trackIndex: nextIndex });
  };

  const handlePrevious = () => {
    const prevIndex = currentTrackIndex === 0 ? playlist.length - 1 : currentTrackIndex - 1;
    setState({ trackIndex: prevIndex });
  };

  const handleSelectTrack = (index) => {
    setState({ trackIndex: index });
  };

  const currentTrack = playlist[currentTrackIndex];

  return (
    <div>
      {/* Your DJ UI */}
      <div>Now Playing: {currentTrack?.title}</div>
      <button onClick={handlePrevious}>← Previous</button>
      <button onClick={handleNext}>Next →</button>
      
      {/* Share URL */}
      <p>Share: {window.location.href}</p>
    </div>
  );
}

export default VirtualDJ;
```

## Benefits

✅ **Shareable URLs** - Users can share exact track positions  
✅ **Bookmarkable** - Save favorite DJ sets with URLs  
✅ **Deep Linking** - Links preserve playback state  
✅ **Browser History** - Back/forward buttons work properly  

## Notes

- The hook automatically handles URL encoding/decoding
- `state.trackIndex` is `null` if not in URL
- Use the `??` (nullish coalescing) operator for default values
- `setState` only updates URL params you pass to it
