import { useState, useEffect } from 'react';

export function useClock() {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      setCurrentTime(new Date().toLocaleTimeString('pt-BR'));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  return currentTime;
}