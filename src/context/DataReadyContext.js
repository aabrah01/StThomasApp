import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import * as SplashScreen from 'expo-splash-screen';

const DataReadyContext = createContext({ markScreenReady: () => {} });

// Home is the landing screen and renders straight from AuthContext, so it alone
// gates the splash. Profile is no longer a tab and never mounts at startup —
// leaving it here would make every cold start wait for the 6s timeout.
const SCREENS = ['home'];

export const DataReadyProvider = ({ children }) => {
  const readyRef = useRef(new Set());
  const dismissed = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const markScreenReady = useCallback((name) => {
    if (dismissed.current) return;
    readyRef.current.add(name);
    if (SCREENS.every(s => readyRef.current.has(s))) {
      dismiss();
    }
  }, [dismiss]);

  // Safety net: dismiss after 6s regardless (handles errors or slow network)
  useEffect(() => {
    const timer = setTimeout(dismiss, 6000);
    return () => clearTimeout(timer);
  }, [dismiss]);

  return (
    <DataReadyContext.Provider value={{ markScreenReady }}>
      {children}
    </DataReadyContext.Provider>
  );
};

export const useDataReady = () => useContext(DataReadyContext);
