import { useSearchParams } from 'react-router-dom';

export function useShareableState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const getState = () => ({
    playlistId: searchParams.get('playlist'),
    trackIndex: searchParams.get('track') ? parseInt(searchParams.get('track'), 10) : null,
  });

  const setState = (updates) => {
    const current = getState();
    const newParams = new URLSearchParams(searchParams);

    if (updates.playlistId !== undefined) {
      if (updates.playlistId) {
        newParams.set('playlist', updates.playlistId);
      } else {
        newParams.delete('playlist');
      }
    }

    if (updates.trackIndex !== undefined) {
      if (updates.trackIndex !== null) {
        newParams.set('track', updates.trackIndex);
      } else {
        newParams.delete('track');
      }
    }

    setSearchParams(newParams);
  };

  const clearState = () => {
    setSearchParams({});
  };

  return {
    state: getState(),
    setState,
    clearState,
  };
}
