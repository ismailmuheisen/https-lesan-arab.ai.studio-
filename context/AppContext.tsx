import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ServerHealthStatus = 'online' | 'warning' | 'offline';

interface AppContextType {
  pendingSearchText: string;
  setPendingSearchText: (text: string) => void;
  consumePendingSearchText: () => string;

  pendingTtsText: string;
  setPendingTtsText: (text: string) => void;
  consumePendingTtsText: () => string;

  isDictionaryModalOpen: boolean;
  setIsDictionaryModalOpen: (open: boolean) => void;

  serverHealth: ServerHealthStatus;
  serverHealthMessage: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingSearchText, setPendingSearchTextState] = useState<string>('');
  const [pendingTtsText, setPendingTtsTextState] = useState<string>('');
  const [isDictionaryModalOpen, setIsDictionaryModalOpen] = useState<boolean>(false);
  const [serverHealth, setServerHealth] = useState<ServerHealthStatus>('online');
  const [serverHealthMessage, setServerHealthMessage] = useState<string>('متصل بالخادم');

  const setPendingSearchText = useCallback((text: string) => {
    setPendingSearchTextState(text);
  }, []);

  const consumePendingSearchText = useCallback(() => {
    const text = pendingSearchText;
    if (text) {
      setPendingSearchTextState('');
    }
    return text;
  }, [pendingSearchText]);

  const setPendingTtsText = useCallback((text: string) => {
    setPendingTtsTextState(text);
  }, []);

  const consumePendingTtsText = useCallback(() => {
    const text = pendingTtsText;
    if (text) {
      setPendingTtsTextState('');
    }
    return text;
  }, [pendingTtsText]);

  // Poll /healthz every 60s to reflect real server status (green/amber/red)
  const checkHealth = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const startTime = performance.now();

    try {
      const response = await fetch('/healthz', {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache',
      });
      clearTimeout(timeoutId);

      const latency = performance.now() - startTime;

      if (response.ok) {
        if (latency > 3000) {
          setServerHealth('warning');
          setServerHealthMessage('استجابة بطيئة');
        } else {
          setServerHealth('online');
          setServerHealthMessage('الخادم نشط');
        }
      } else {
        setServerHealth('warning');
        setServerHealthMessage('استجابة غير مستقرة');
      }
    } catch {
      clearTimeout(timeoutId);
      setServerHealth('offline');
      setServerHealthMessage('الخادم غير متصل');
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <AppContext.Provider
      value={{
        pendingSearchText,
        setPendingSearchText,
        consumePendingSearchText,
        pendingTtsText,
        setPendingTtsText,
        consumePendingTtsText,
        isDictionaryModalOpen,
        setIsDictionaryModalOpen,
        serverHealth,
        serverHealthMessage,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
