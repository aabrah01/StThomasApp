import { useState, useEffect } from 'react';
import { AppState } from 'react-native';

export const useAppRefresh = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setRefreshKey(k => k + 1);
      }
    });
    return () => sub.remove();
  }, []);

  return { refreshKey };
};
