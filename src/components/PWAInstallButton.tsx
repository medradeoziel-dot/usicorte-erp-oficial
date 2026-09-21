import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Laptop, Share, X, CheckCircle2, Sparkles } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'topbar' | 'sidebar' | 'banner';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'topbar', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Se já estiver rodando em modo standalone (PWA instalado), oculta o botão de instalação
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        await install();
      } finally {
        setIsInstalling(false);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Navegador que ainda não disparou o evento beforeinstallprompt
      // Exibe orientação rápida
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {variant === 'topbar' && (
        <button
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm shadow-emerald-600/20 border border-emerald-400/30 active:scale-95 ${className}`}
          title="Instalar Usi Corte como Aplicativo (PWA) no Celular ou Computador"
        >
          <Download className="w-3.5 h-3.5 shrink-0 animate-bounce" />
          <span className="hidden sm:inline">Instalar App</span>
          <span className="sm:hidden">Instalar</span>
        </button>
      )}

      {variant === 'sidebar' && (
        <div className={`p-3 bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-900 border border-emerald-500/30 rounded-2xl text-left shadow-md ${className}`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Instalar Aplicativo</span>
            </div>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold uppercase">
              PWA
            </span>
          </div>
          <p className="text-[10.5px] text-slate-300 leading-tight mb-2.5">
            Instale a UsiCorte no seu celular ou computador para acesso instantâneo e offline.
          </p>
          <button
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all cursor-pointer shadow-sm shadow-emerald-600/20 border border-emerald-400/40 active:scale-98"
          >
            {isInstalling ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Instalando...
              </span>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span>Instalar no Dispositivo</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Modal / Guia de Instalação para iOS Safari ou quando o navegador requer adição manual */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100 relative">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30 shrink-0 border border-blue-400/30">
                <img src="/icon-192.png" alt="UsiCorte" className="w-9 h-9 rounded-xl object-contain" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Instalar Usi Corte Metais</h3>
                <p className="text-xs text-blue-300">Como aplicativo no seu celular ou PC</p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-300 mb-5">
                <p className="text-slate-200 font-medium">
                  Para instalar no seu <strong className="text-white">iPhone ou iPad</strong>:
                </p>
                <div className="flex items-start gap-3 p-3 bg-slate-800/70 rounded-xl border border-slate-700">
                  <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-400/40 text-blue-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    No Safari, toque no botão de <strong className="text-white">Compartilhar</strong> (ícone de um quadrado com uma seta para cima <Share className="w-3.5 h-3.5 inline text-blue-400 mx-0.5" />).
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-800/70 rounded-xl border border-slate-700">
                  <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-400/40 text-blue-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    Role a lista para baixo e toque em <strong className="text-emerald-400">Adicionar à Tela de Início</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-800/70 rounded-xl border border-slate-700">
                  <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-400/40 text-blue-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    Toque em <strong className="text-white">Adicionar</strong> no canto superior direito. O ícone do UsiCorte ficará disponível direto nos seus apps!
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-300 mb-5">
                <p className="text-slate-200 font-medium">
                  Instalação no <strong className="text-white">Computador ou Android</strong>:
                </p>
                <div className="p-3 bg-slate-800/70 rounded-xl border border-slate-700 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                    <Laptop className="w-4 h-4 text-emerald-400" />
                    <span>No Computador (Chrome / Edge / Opera)</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Clique no ícone de instalação (um computador com seta para baixo) na barra de endereços do seu navegador ou abra o menu do navegador (três pontinhos) e clique em <strong className="text-white">"Instalar Usi Corte Metais"</strong>.
                  </p>
                </div>

                <div className="p-3 bg-slate-800/70 rounded-xl border border-slate-700 space-y-2">
                  <div className="flex items-center gap-2 text-blue-300 font-semibold">
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    <span>No Celular Android</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Abra o menu do Chrome (três pontinhos no canto superior direito) e selecione <strong className="text-white">"Adicionar à tela inicial"</strong> ou <strong className="text-white">"Instalar aplicativo"</strong>.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-md shadow-blue-600/30"
            >
              Entendi, fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
};
