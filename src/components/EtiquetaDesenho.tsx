import React from "react";

export type TipoDesenho = "retangulo" | "disco" | "flange" | "conf" | "generico";

/** Remove acentos e normaliza para comparação */
function norm(texto: string) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

/**
 * Detecta o tipo de desenho a partir do texto do produto / medida / observação.
 * - RETANGULO / RETANGULAR / CHAPA / BARRA  -> retângulo
 * - DISCO / REDONDO SEM FURO                -> círculo sem furo
 * - FLANGE / REDONDO COM FURO / ANEL        -> círculo com furo
 * - CONF DESENHO / CONFORME DESENHO         -> campo em branco (o usuário cola o desenho)
 */
export function detectarTipoDesenho(...textos: (string | undefined)[]): TipoDesenho {
  const t = norm(textos.filter(Boolean).join(" "));
  if (/\bCONF(ORME)?\.?\s*DESENHO\b|\bCONF\.?\s*DES\b/.test(t)) return "conf";
  if (/\bRETANGUL(O|AR|OS)\b|\bCHAPA\b|\bBARRA\b|\bQUADRAD/.test(t)) return "retangulo";
  if (/\bFLANGE(S)?\b|\bANEL\b|\bARRUELA\b|COM\s*FURO/.test(t)) return "flange";
  if (/\bDISCO(S)?\b|\bREDONDO\b|SEM\s*FURO/.test(t)) return "disco";
  return "generico";
}

interface Props {
  tipo: TipoDesenho;
  medida?: string | undefined;
  /** Imagem colada/enviada pelo usuário (dataURL ou URL). Tem prioridade sobre o desenho automático. */
  imagem?: string | undefined;
  /** Reforça (engrossa) os traços de imagens claras/finas. */
  engrossarTracos?: boolean | undefined;
}

/** Desenho técnico automático da etiqueta (SVG vetorial = traço sempre nítido na impressão). */
export default function EtiquetaDesenho({
  tipo,
  medida,
  imagem,
  engrossarTracos = true,
}: Props) {
  if (imagem) {
    return (
      <div className="desenho-box desenho-box--imagem">
        <img
          src={imagem}
          alt="Desenho da peça"
          className={engrossarTracos ? "desenho-img desenho-img--traco" : "desenho-img"}
        />
      </div>
    );
  }

  if (tipo === "conf") {
    return (
      <div className="desenho-box desenho-box--vazio">
        <span className="desenho-vazio-texto">CONF. DESENHO</span>
      </div>
    );
  }

  return (
    <div className="desenho-box">
      <svg viewBox="0 0 100 100" className="desenho-svg" role="img" aria-label={`Desenho ${tipo}`}>
        {tipo === "retangulo" ? (
          <>
            <rect x="10" y="24" width="80" height="52" fill="none" stroke="#000" strokeWidth="3" />
            <line x1="10" y1="50" x2="90" y2="50" stroke="#000" strokeWidth="0.8" strokeDasharray="4 3" />
            <line x1="50" y1="24" x2="50" y2="76" stroke="#000" strokeWidth="0.8" strokeDasharray="4 3" />
          </>
        ) : (
          <>
            <circle cx="50" cy="50" r="38" fill="none" stroke="#000" strokeWidth="3" />
            {tipo === "flange" && (
              <circle cx="50" cy="50" r="13" fill="none" stroke="#000" strokeWidth="3" />
            )}
            <line x1="8" y1="50" x2="92" y2="50" stroke="#000" strokeWidth="0.8" strokeDasharray="4 3" />
            <line x1="50" y1="8" x2="50" y2="92" stroke="#000" strokeWidth="0.8" strokeDasharray="4 3" />
          </>
        )}
      </svg>
      {medida && <span className="desenho-medida">{tipo === "retangulo" ? medida : `Ø ${medida}`}</span>}
    </div>
  );
}
