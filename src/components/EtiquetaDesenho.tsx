import React from "react";

export type TipoDesenho = 
  | "retangulo" 
  | "flange" 
  | "disco" 
  | "bronze" 
  | "sextavado" 
  | "eixo-liso" 
  | "conf" 
  | "generico";

/** Remove acentos e normaliza para comparação em caixa alta */
export function norm(texto: string | undefined | null): string {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

/**
 * Detecta o tipo de desenho a partir do texto do Material, Medida, Observação e Descrição.
 * - CONF DESENHO / CONFORME DESENHO                 -> campo em branco / conf
 * - RETANGULO / RETANGULAR / CHAPA / QUADRADO       -> retângulo
 * - FLANGE / REDONDO COM FURO / ANEL / ARRUELA      -> círculo com furo (2 círculos)
 * - DISCO / REDONDO SEM FURO / SEM FURO             -> círculo simples
 * - BRONZE / TM-23 / EIXO DE BRONZE                 -> eixo de bronze simples
 * - SEXTAVADO / HEXAGONAL                           -> sextavado simples (hexágono)
 * - TREFILADO SAE, LAMINADO SAE, FERRO FFNODULAR,
 *   LATÃO, BUCHA, AÇO VC                            -> eixo liso simples
 */
export function detectarTipoDesenho(...textos: (string | undefined | null)[]): TipoDesenho {
  const t = norm(textos.filter(Boolean).join(" "));
  if (!t) return "eixo-liso";

  // 1. Conforme Desenho
  if (/\bCONF(ORME)?\.?\s*DES(ENHO)?\b|\bAMOSTRA\b|\bPROJETO\b/.test(t)) {
    return "conf";
  }

  // 2. Flange / Círculo com furo central (2 círculos)
  if (/\bFLANGE(S)?\b|\bARRUELA(S)?\b|\bANEL\b|COM\s*FURO|DISCO\s*COM\s*FURO/.test(t)) {
    return "flange";
  }

  // 3. Retângulo / Chapa / Quadrado / Bloco
  if (/\bRETANGUL(O|AR|OS)\b|\bCHAPA(S)?\b|\bBARRA\s*CHATA\b|\bQUADRAD(O|A|OS|AS)\b|\bBLOCO(S)?\b/.test(t)) {
    return "retangulo";
  }

  // 4. Sextavado / Hexagonal
  if (/\bSEXTAVAD(O|A|OS|AS)?\b|\bHEXAGONAL\b|\bBARRA\s*SEXTAVADA\b/.test(t)) {
    return "sextavado";
  }

  // 5. Disco / Círculo simples sem furo
  if (/\bDISCO(S)?\b|SEM\s*FURO|\bDISCO\s*SEM\s*FURO\b/.test(t)) {
    return "disco";
  }

  // 6. Bronze (Eixo de bronze simples)
  if (/\bBRONZE\b|\bTM\s*-?\s*23\b|\bTM\s*-?\s*620\b|\bBZ\b/.test(t)) {
    return "bronze";
  }

  // 7. Eixo liso simples: Trefilado SAE, Laminado SAE, Ferro FFNodular, Latão, Bucha, Aço VC
  if (
    /\bTREFILAD(O|A)?(\s*SAE)?\b|\bLAMINAD(O|A)?(\s*SAE)?\b|\bFERRO(\s*(FF\s*NODULAR|FUNDIDO|NODULAR))?\b|\bFF\s*NODULAR\b|\bFFNODULAR\b|\bLATAO\b|\bLATÃO\b|\bBUCHA(S)?\b|\b(AC?O\s*)?VC(\s*-?\s*(131|150))?\b|\bSAE\s*\d{4}\b|\bEIXO\b|\bTARUGO\b|\bREDONDO\b/.test(t)
  ) {
    return "eixo-liso";
  }

  // Fallback baseado em dimensões
  if (/\d+\s*[xX]\s*\d+\s*[xX]\s*\d+/.test(t)) {
    return "retangulo";
  }

  return "eixo-liso";
}

export interface EtiquetaDesenhoProps {
  tipo?: TipoDesenho;
  material?: string;
  medida?: string;
  observacao?: string;
  descricao?: string;
  textos?: (string | undefined | null)[];
  /** Imagem colada/enviada pelo usuário (dataURL ou URL). Tem prioridade sobre o desenho automático. */
  imagem?: string | undefined;
  /** Reforça (engrossa) os traços de imagens claras/finas. */
  engrossarTracos?: boolean | undefined;
  className?: string;
}

/** Desenho técnico automático da etiqueta (SVG vetorial = traço sempre nítido na impressão). */
export default function EtiquetaDesenho({
  tipo,
  material,
  medida,
  observacao,
  descricao,
  textos,
  imagem,
  engrossarTracos = true,
  className = "",
}: EtiquetaDesenhoProps) {
  if (imagem) {
    return (
      <div className={`desenho-box desenho-box--imagem w-full h-full flex items-center justify-center ${className}`}>
        <img
          src={imagem}
          alt="Desenho da peça"
          className={engrossarTracos ? "desenho-img desenho-img--traco max-h-full max-w-full object-contain print:contrast-[250%]" : "desenho-img max-h-full max-w-full object-contain"}
          style={{ filter: "contrast(200%) brightness(85%)" }}
        />
      </div>
    );
  }

  const tipoFinal: TipoDesenho =
    tipo ||
    detectarTipoDesenho(
      material,
      medida,
      observacao,
      descricao,
      ...(textos || [])
    );

  if (tipoFinal === "conf") {
    return (
      <div className={`desenho-box desenho-box--vazio w-full h-full border-2 border-dashed border-slate-400 p-2 flex flex-col items-center justify-center text-center bg-slate-50 rounded ${className}`}>
        <span className="desenho-vazio-texto text-[11px] font-black text-slate-800 uppercase tracking-wider">
          CONF. DESENHO
        </span>
        <span className="text-[8px] font-bold text-slate-500 uppercase mt-0.5 tracking-tight">
          Corte / Usinagem CNC
        </span>
      </div>
    );
  }

  return (
    <div className={`desenho-box w-full h-full flex flex-col items-center justify-center relative p-1 ${className}`}>
      <svg
        viewBox="0 0 100 100"
        className="desenho-svg w-full h-full max-h-[90px] max-w-[90px] text-black"
        role="img"
        aria-label={`Desenho ${tipoFinal}`}
      >
        {/* RETÂNGULO */}
        {tipoFinal === "retangulo" && (
          <>
            <rect x="12" y="24" width="76" height="52" fill="none" stroke="#000" strokeWidth="2.8" />
            <line x1="8" y1="50" x2="92" y2="50" stroke="#000" strokeWidth="0.9" strokeDasharray="4 3" />
            <line x1="50" y1="20" x2="50" y2="80" stroke="#000" strokeWidth="0.9" strokeDasharray="4 3" />
          </>
        )}

        {/* FLANGE (Círculo com Furo central) */}
        {tipoFinal === "flange" && (
          <>
            <circle cx="50" cy="50" r="38" fill="none" stroke="#000" strokeWidth="2.8" />
            <circle cx="50" cy="50" r="14" fill="none" stroke="#000" strokeWidth="2.5" />
            <line x1="6" y1="50" x2="94" y2="50" stroke="#000" strokeWidth="0.9" strokeDasharray="4 3" />
            <line x1="50" y1="6" x2="50" y2="94" stroke="#000" strokeWidth="0.9" strokeDasharray="4 3" />
          </>
        )}

        {/* DISCO (Círculo Simples) */}
        {tipoFinal === "disco" && (
          <>
            <circle cx="50" cy="50" r="38" fill="none" stroke="#000" strokeWidth="2.8" />
            <line x1="6" y1="50" x2="94" y2="50" stroke="#000" strokeWidth="0.9" strokeDasharray="4 3" />
            <line x1="50" y1="6" x2="50" y2="94" stroke="#000" strokeWidth="0.9" strokeDasharray="4 3" />
          </>
        )}

        {/* BRONZE (Eixo de Bronze Simples) */}
        {tipoFinal === "bronze" && (
          <>
            <rect x="14" y="32" width="72" height="36" rx="2" fill="none" stroke="#000" strokeWidth="2.8" />
            <line x1="36" y1="32" x2="36" y2="68" stroke="#000" strokeWidth="1.2" />
            <line x1="64" y1="32" x2="64" y2="68" stroke="#000" strokeWidth="1.2" />
            <line x1="14" y1="44" x2="22" y2="32" stroke="#000" strokeWidth="1" />
            <line x1="14" y1="56" x2="30" y2="32" stroke="#000" strokeWidth="1" />
            <line x1="6" y1="50" x2="94" y2="50" stroke="#000" strokeWidth="0.9" strokeDasharray="4 3" />
            <line x1="50" y1="26" x2="50" y2="74" stroke="#000" strokeWidth="0.9" strokeDasharray="4 3" />
          </>
        )}

        {/* SEXTAVADO (Sextavado Simples) */}
        {tipoFinal === "sextavado" && (
          <>
            <polygon points="50,12 83,31 83,69 50,88 17,69 17,31" fill="none" stroke="#000" strokeWidth="2.8" />
            <line x1="50" y1="6" x2="50" y2="94" stroke="#000" strokeWidth="0.9" strokeDasharray="4 3" />
            <line x1="10" y1="50" x2="90" y2="50" stroke="#000" strokeWidth="0.9" strokeDasharray="4 3" />
            <circle cx="50" cy="50" r="2.5" fill="#000" />
          </>
        )}

        {/* EIXO LISO SIMPLES (Trefilado SAE, Laminado SAE, Ferro FFNodular, Latão, Bucha, Aço VC) */}
        {(tipoFinal === "eixo-liso" || tipoFinal === "generico") && (
          <>
            <path d="M 18 32 L 82 32 L 86 36 L 86 64 L 82 68 L 18 68 L 14 64 L 14 36 Z" fill="none" stroke="#000" strokeWidth="2.8" />
            <line x1="6" y1="50" x2="94" y2="50" stroke="#000" strokeWidth="0.9" strokeDasharray="4 3" />
            <line x1="50" y1="26" x2="50" y2="74" stroke="#000" strokeWidth="0.9" strokeDasharray="4 3" />
          </>
        )}
      </svg>
      {medida && (
        <span className="desenho-medida text-[10px] font-bold font-mono text-slate-800 mt-1 block truncate max-w-full text-center">
          {medida}
        </span>
      )}
    </div>
  );
}

