# EasyMusic Routing & URL State Management

## Route Structure

The application uses React Router v7 with the following routes:

- `/` - Library (AI Improv + Playlist Database)
- `/manager` - Library Manager
- `/sfx` - Sound Effects Setup
- `/simplified-dj` - Simplified DJ Interface
- `/dj` - Virtual DJ
- `/docs` - Help & Documentation

## Shareable URLs

Each route supports URL parameters for sharing state:

### Query Parameters

- `playlist` - The ID of the selected playlist
- `track` - The current track index (0-based)

### Examples

```
/dj?playlist=my-mix&track=3
/simplified-dj?playlist=workout&track=0
/?playlist=chill-vibes
```

## Using Shareable State in Components

Import the `useShareableState` hook:

```jsx
import { useShareableState } from '../hooks/useShareableState';

function MyComponent() {
  const { state, setState, clearState } = useShareableState();

  // Get current state
  const { playlistId, trackIndex } = state;

  // Update URL with new state
  const handleTrackChange = (newIndex) => {
    setState({ trackIndex: newIndex });
  };

  // Clear all URL parameters
  const handleReset = () => {
    clearState();
  };

  return (
    // component JSX
  );
}
```

## Implementation Steps

To add shareable state to a component:

1. Import the hook: `import { useShareableState } from '../hooks/useShareableState';`
2. Call the hook in your component
3. Update URL when state changes: `setState({ trackIndex: 5, playlistId: 'my-mix' })`
4. Read URL state on load/render: `const { playlistId, trackIndex } = state;`

## URL Sharing Workflow

1. User navigates to `/dj` and selects playlist "my-mix", track 3
2. Component calls `setState({ playlistId: 'my-mix', trackIndex: 3 })`
3. URL updates to `/dj?playlist=my-mix&track=3`
4. User copies URL and shares with friend
5. Friend opens URL and automatically loads the same state
