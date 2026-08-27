import React from 'react';
import Logo from './Logo';

interface CompanyHeaderProps {
  className?: string;
  showBorder?: boolean;
  documentType?: string;
  documentNumber?: string;
  documentDate?: string;
  compact?: boolean;
  tag?: string;
  tagColor?: 'blue' | 'amber' | 'emerald' | 'slate';
  showLogo?: boolean;
  rightContent?: React.ReactNode;
}

export default function CompanyHeader({
  className = '',
  showBorder = true,
  documentType,
  documentNumber,
  documentDate,
  compact = false,
  tag,
  tagColor = 'blue',
  showLogo = true,
  rightContent,
}: CompanyHeaderProps) {
  const getTagClasses = () => {
    switch (tagColor) {
      case 'amber':
        return 'bg-amber-100 text-amber-950 border border-amber-300';
      case 'emerald':
        return 'bg-emerald-100 text-emerald-950 border border-emerald-300';
      case 'slate':
        return 'bg-slate-200 text-slate-950 border border-slate-300';
      case 'blue':
      default:
        return 'bg-blue-100 text-blue-950 border border-blue-300';
    }
  };

  const logoWidthClass = compact ? 'w-[100px] sm:w-[125px]' : 'w-[120px] sm:w-[155px]';

  return (
    <header
      className={`company-header-centralizado w-full select-none ${
        showBorder ? 'border-b-2 border-black pb-2.5 mb-3' : 'mb-2'
      } ${className}`}
    >
      {/* Top Bar: Left Logo, Perfectly Centered Text Block, Right Balance/Metadata */}
      <div className="relative flex items-center justify-between w-full">
        {/* Left Side: Logo da Usi Corte Metais */}
        <div className={`flex items-center justify-start shrink-0 ${logoWidthClass}`}>
          {showLogo ? (
            <div className="logo-impressao">
              <Logo variant="light" className={`${compact ? 'h-8 sm:h-10' : 'h-10 sm:h-12'} w-auto`} />
            </div>
          ) : (
            <div className="w-full" />
          )}
        </div>

        {/* Center: Informações Centralizadas da Empresa */}
        <div className="flex-1 text-center px-1 sm:px-3 mx-auto">
          {/* Linha 1 */}
          <h1
            className={`font-black tracking-wide uppercase text-slate-950 font-sans leading-tight ${
              compact ? 'text-xs sm:text-sm md:text-base' : 'text-sm sm:text-base md:text-lg lg:text-xl'
            }`}
          >
            L.M BANZATTO METAIS - ME
          </h1>

          {/* Linha 2 */}
          <p
            className={`font-bold text-slate-900 leading-tight mt-0.5 font-sans ${
              compact ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'
            }`}
          >
            SOB CNPJ: 25.038.430/0001-23
          </p>

          {/* Linha 3 */}
          <p
            className={`font-semibold text-slate-800 leading-tight mt-0.5 font-sans ${
              compact ? 'text-[8.5px] sm:text-[10px]' : 'text-[9.5px] sm:text-xs'
            }`}
          >
            FONE:(14) 3203-1742 Fixo / (14) 99880-9362 Luan - Proprietário / (14) 99819-6873 / (14) 99925-7633 /
          </p>
        </div>

        {/* Right Side: Balancer or Right Metadata to preserve 100% optical center */}
        <div className={`shrink-0 text-right ${logoWidthClass}`}>
          {rightContent ? (
            rightContent
          ) : (
            /* Spacer with same width as logo ensures true center alignment */
            <div className="w-full text-right text-[11px]">
              {documentNumber && !documentType && (
                <div className="hidden sm:block">
                  <span className="text-[10px] text-slate-600 block">Nº PEDIDO</span>
                  <span className="font-mono font-bold text-slate-950 text-xs">{documentNumber}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sub-bar with document tags, type, order number and date */}
      {(documentType || documentNumber || documentDate || tag) && (
        <div className="flex flex-wrap justify-between items-center mt-2 pt-1.5 border-t border-slate-300 text-xs text-slate-800 font-sans gap-1">
          <div className="flex items-center gap-2">
            {tag && (
              <span className={`px-2 py-0.5 rounded font-black text-[10.5px] uppercase tracking-wide ${getTagClasses()}`}>
                {tag}
              </span>
            )}
            {documentType && (
              <span className="font-bold uppercase tracking-wider text-slate-700">
                {documentType}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs">
            {documentNumber && (
              <span>
                <strong>PEDIDO Nº:</strong> <span className="font-mono font-bold text-slate-950">{documentNumber}</span>
              </span>
            )}
            {documentDate && (
              <span>
                <strong>DATA:</strong> <span className="font-mono font-semibold">{documentDate}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
