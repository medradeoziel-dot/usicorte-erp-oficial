import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    deferredPWAInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function usePWAInstall() {
  // Começa estritamente como nulo / falso (oculto por padrão)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.deferredPWAInstallPrompt) {
      return window.deferredPWAInstallPrompt;
    }
    return null;
  });

  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://')
    );
  });

  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsInstalled(isStandalone);
    };

    checkInstalled();

    const mediaMatcher = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
        window.deferredPWAInstallPrompt = null;
      }
    };

    try {
      mediaMatcher.addEventListener('change', handleMediaChange);
    } catch {
      // Navegadores legados
    }

    // Se o evento foi capturado antes da inicialização do hook
    if (window.deferredPWAInstallPrompt && !deferredPrompt) {
      setDeferredPrompt(window.deferredPWAInstallPrompt);
    }

    // Captura o evento nativo beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.deferredPWAInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
      console.log('[PWA] Evento beforeinstallprompt capturado. Aplicação elegível para instalação.');
    };

    const handlePromptCaptured = () => {
      if (window.deferredPWAInstallPrompt) {
        setDeferredPrompt(window.deferredPWAInstallPrompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.deferredPWAInstallPrompt = null;
      console.log('[PWA] Aplicativo UsiCorte instalado com sucesso no dispositivo!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-captured', handlePromptCaptured);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-captured', handlePromptCaptured);
      window.removeEventListener('appinstalled', handleAppInstalled);
      try {
        mediaMatcher.removeEventListener('change', handleMediaChange);
      } catch {
        // ignore
      }
    };
  }, [deferredPrompt]);

  const install = useCallback(async () => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? window.deferredPWAInstallPrompt : null);
    if (!promptEvent) {
      console.warn('[PWA] Evento beforeinstallprompt não disponível para acionamento nativo.');
      return false;
    }

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      console.log('[PWA] Resposta do usuário ao prompt nativo:', outcome);
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        if (typeof window !== 'undefined') {
          window.deferredPWAInstallPrompt = null;
        }
        return true;
      }
    } catch (err) {
      console.error('[PWA] Erro ao disparar o prompt nativo de instalação:', err);
    }
    return false;
  }, [deferredPrompt]);

  // isInstallable é TRUE APENAS se o navegador disparou o evento e o app não está instalado
  const isInstallable = !isInstalled && !!(deferredPrompt || (typeof window !== 'undefined' && window.deferredPWAInstallPrompt));

  const isIOS =
    typeof window !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  return {
    isInstallable,
    isInstalled,
    isIOS,
    install,
  };
}
