import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, ExternalLink, Copy, Check, X, Smartphone, Laptop, Info } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'topbar' | 'sidebar' | 'banner';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'sidebar', className = '' }) => {
  const { isInstallable, isIOS, install } = usePWAInstall();
  const [isInstalling, setIsInstalling] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Detecta se a aplicação está rodando embutida dentro de um iframe (ex: preview do AI Studio)
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Trata-vento de Clique (Fallback):
  // • Se o evento 'beforeinstallprompt' estiver disponível (e fora de restrição de iframe), aciona o prompt nativo.
  // • Caso esteja no ambiente de preview/iframe (ou navegador sem suporte direto a prompt nativo), exibe orientação informativa.
  const handleInstallClick = async () => {
    if (isInstallable && !isInIframe) {
      setIsInstalling(true);
      try {
        await install();
      } catch (err) {
        console.warn('[PWA] Prompt nativo indisponível ou rejeitado:', err);
        setShowModal(true);
      } finally {
        setIsInstalling(false);
      }
    } else {
      // Abre o modal informativo com orientações e link para nova aba
      setShowModal(true);
    }
  };

  const handleCopyUrl = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Silencioso se clipboard restrito
    }
  };

  return (
    <>
      {/* 1. Barra Superior (Header): Botão verde arredondado no canto superior direito */}
      {variant === 'topbar' && (
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white shadow-md shadow-emerald-500/30 border border-emerald-300/40 shrink-0 ${className}`}
          title="Instalar Usi Corte Metais no celular ou computador"
        >
          <img 
            src="/icon-192.png" 
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/icon.svg'; }} 
            alt="Usi Corte Metais" 
            className="w-4 h-4 rounded-md object-contain shrink-0" 
          />
          <Download className="w-3.5 h-3.5 text-white shrink-0" />
          <span>Instalar App</span>
        </button>
      )}

      {/* 2. Barra Lateral (Sidebar): Bloco verde escuro (#062c1d) SEMPRE VISÍVEL */}
      {variant === 'sidebar' && (
        <div className={`relative overflow-hidden p-3.5 bg-[#062c1d] border border-emerald-500/50 rounded-2xl text-left shadow-xl shadow-emerald-950/60 ring-1 ring-emerald-500/20 ${className}`}>
          {/* Brilho decorativo sutil de fundo */}
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-emerald-500/15 rounded-full blur-xl pointer-events-none" />

          {/* Cabeçalho com Logotipo Oficial da UsiCorte: "Usi" em branco, "corte" em vermelho, "Metais" em branco */}
          <div className="flex items-center gap-2.5 mb-2 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-slate-900/90 border border-emerald-500/40 p-1 flex items-center justify-center shrink-0 shadow-md">
              <img 
                src="/icon-192.png" 
                onError={(e) => { 
                  (e.currentTarget as HTMLImageElement).src = '/icon.svg'; 
                }} 
                alt="Usi Corte Metais" 
                className="w-full h-full object-contain rounded-lg" 
              />
            </div>
            <div className="flex flex-col min-w-0">
              <h4 className="text-xs font-bold text-emerald-300 leading-tight truncate">
                Instalar Aplicativo (PWA)
              </h4>
              <div className="text-[10px] font-bold tracking-tight flex items-center gap-0.5 mt-0.5">
                <span className="text-white">Usi</span>
                <span className="text-[#ef4444]">corte</span>
                <span className="text-white">Metais</span>
              </div>
            </div>
          </div>

          {/* Descrição Exata Requisitada: "Instale a UsiCorte no seu telemóvel ou computador para acesso instantâneo." */}
          <p className="text-[11px] text-emerald-100/90 leading-snug mb-3 font-normal relative z-10">
            Instale a UsiCorte no seu telemóvel ou computador para acesso instantâneo.
          </p>

          {/* Botão de Ação: "Instalar no Dispositivo" */}
          <button
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-white font-bold text-xs shadow-md shadow-emerald-500/30 transition-all cursor-pointer border border-emerald-300/40 relative z-10"
          >
            {isInstalling ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Instalando...</span>
              </span>
            ) : (
              <>
                <img 
                  src="/icon-192.png" 
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/icon.svg'; }} 
                  alt="" 
                  className="w-4 h-4 rounded-md object-contain shrink-0" 
                />
                <Download className="w-4 h-4 text-white shrink-0" />
                <span>Instalar no Dispositivo</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Modal Informativo / Orientação de Instalação (Fallback para Preview/Iframe e Dispositivos) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-emerald-500/30 p-5 sm:p-6 shadow-2xl text-slate-100 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabeçalho do Modal */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-emerald-500/40 p-1.5 flex items-center justify-center shadow-lg shadow-emerald-950/50 shrink-0">
                <img 
                  src="/icon-192.png" 
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/icon.svg'; }} 
                  alt="Usi Corte Metais" 
                  className="w-full h-full object-contain rounded-xl" 
                />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                  <span>Instalar</span>
                  <span className="text-white">Usi</span>
                  <span className="text-[#ef4444]">corte</span>
                  <span className="text-white">Metais</span>
                </h3>
                <p className="text-xs text-emerald-400">Aplicativo PWA para Celular e Computador</p>
              </div>
            </div>

            {/* Conteúdo Contextual: Se estiver dentro do Iframe do AI Studio */}
            {isInIframe ? (
              <div className="space-y-3.5 mb-5 text-xs text-slate-200">
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-[11.5px] text-emerald-200">
                    Você está no modo de <strong>pré-visualização (iframe)</strong>. Por segurança do navegador, a instalação nativa como app requer que a página seja aberta em uma <strong>aba própria</strong>.
                  </p>
                </div>

                <div className="space-y-2 text-slate-300">
                  <p className="font-semibold text-white">Como instalar em 2 passos:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed pl-1">
                    <li>Abra a aplicação em uma nova aba usando o botão verde abaixo.</li>
                    <li>Na nova aba, clique em <strong>"Instalar no Dispositivo"</strong> ou no ícone de instalação na barra de endereços do seu navegador.</li>
                  </ol>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all text-center cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span>Abrir em Nova Aba</span>
                  </a>

                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
                    title="Copiar link direto"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : isIOS ? (
              /* Orientações para iPhone / iPad */
              <div className="space-y-3 mb-5 text-xs text-slate-300">
                <p className="text-slate-200 font-semibold">Instalação no iPhone / iPad (Safari):</p>
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-300 font-medium">
                    <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>No menu de compartilhamento do Safari:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    Toque no botão de <strong>Compartilhar</strong> (ícone de quadrado com seta para cima), role a tela para baixo e selecione <strong>"Adicionar à Tela de Início"</strong>.
                  </p>
                </div>
              </div>
            ) : (
              /* Orientações para Desktop / Android fora de Iframe */
              <div className="space-y-3 mb-5 text-xs text-slate-300">
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-medium">
                    <Laptop className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>No Computador (Chrome / Edge / Opera):</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    Clique no ícone de instalação (um monitor com seta para baixo) na <strong>barra de endereços</strong> do navegador, ou abra o menu (três pontos) e clique em <strong>"Instalar Usi Corte Metais"</strong>.
                  </p>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
                  <div className="flex items-center gap-2 text-blue-300 font-medium">
                    <Smartphone className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>No Celular Android:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    Abra o menu do Chrome (três pontos) e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors border border-slate-700 cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
};
