// Utilitário para gerar código de barras Code 128C para Chave de Acesso NF-e (44 dígitos)

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (105=Start C, 106=Stop)
];

/**
 * Converte chave de acesso em SVG de código de barras Code 128C
 */
export function generateBarcodeSvg(chave44: string, width = 360, height = 46): string {
  const clean = (chave44 || '').replace(/\D/g, '');
  // Garante tamanho par de dígitos
  const digits = clean.length % 2 === 0 ? clean : '0' + clean;
  
  const START_C = 105;
  const STOP = 106;

  let checksum = START_C;
  let pattern = CODE128_PATTERNS[START_C];

  for (let i = 0; i < digits.length; i += 2) {
    const val = parseInt(digits.substr(i, 2), 10);
    const pos = (i / 2) + 1;
    checksum += val * pos;
    pattern += CODE128_PATTERNS[val] || CODE128_PATTERNS[0];
  }

  const checkDigit = checksum % 103;
  pattern += CODE128_PATTERNS[checkDigit];
  pattern += CODE128_PATTERNS[STOP];

  // Calcula largura total dos módulos
  let totalModules = 0;
  for (let i = 0; i < pattern.length; i++) {
    totalModules += parseInt(pattern[i], 10);
  }

  const quietZone = 10;
  const totalWidth = totalModules + (quietZone * 2);
  let currentX = quietZone;

  let rects = '';
  for (let i = 0; i < pattern.length; i++) {
    const barWidth = parseInt(pattern[i], 10);
    const isBar = i % 2 === 0;
    if (isBar) {
      rects += `<rect x="${currentX}" y="0" width="${barWidth}" height="${height}" fill="#000000" />`;
    }
    currentX += barWidth;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="${width}" height="${height}" preserveAspectRatio="none">
    <rect width="${totalWidth}" height="${height}" fill="#ffffff" />
    ${rects}
  </svg>`;
}
