import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <aside aria-label="Modo Offline" className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-950/90 border border-amber-500/40 text-amber-200 px-3.5 py-2 text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
      <span>Modo Offline: trabalhando com dados em cache local.</span>
    </aside>
  );
};
