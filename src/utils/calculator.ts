// Currency and number formatters for Brazilian Real (R$)
export function formatCurrency(value: number): string {
  const num = typeof value === 'number' && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

export function formatNumberBR(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value || 0);
}

export function formatWeightKg(value: number, decimals: number = 3): string {
  const num = typeof value === 'number' && !isNaN(value) ? value : 0;
  return `${formatNumberBR(num, decimals)} Kg`;
}

/**
 * Formata com segurança uma data recebida (seja ISO, YYYY-MM-DD, DD/MM/YYYY, timestamp ou nulo/inválido).
 * Se a data for inválida, vazia ou nula, usa a data atual (new Date()) como fallback seguro, impedindo o texto '(Invalid Date)'.
 */
export function formatSafeDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) {
    return new Date().toLocaleDateString('pt-BR');
  }

  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime())
      ? new Date().toLocaleDateString('pt-BR')
      : dateInput.toLocaleDateString('pt-BR');
  }

  const str = String(dateInput).trim();
  if (!str || str.toLowerCase() === 'invalid date' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return new Date().toLocaleDateString('pt-BR');
  }

  // Se já está no formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }

  // Se estiver no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }

  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) {
    return new Date().toLocaleDateString('pt-BR');
  }

  return parsed.toLocaleDateString('pt-BR');
}

/**
 * Retorna uma data válida no formato ISO (YYYY-MM-DD) para inputs e registros no banco.
 * Se a data for nula ou inválida, usa a data atual (new Date()) como fallback.
 */
export function getSafeISODate(dateInput?: string | number | Date | null): string {
  if (!dateInput) {
    return new Date().toISOString().split('T')[0];
  }

  const str = String(dateInput).trim();
  if (!str || str.toLowerCase() === 'invalid date' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return new Date().toISOString().split('T')[0];
  }

  // Se já está no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Se está no formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/');
    return `${y}-${m}-${d}`;
  }

  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) {
    return new Date().toISOString().split('T')[0];
  }

  return parsed.toISOString().split('T')[0];
}

export function parseNumberBR(input: string | number): number {
  if (typeof input === 'number') return isNaN(input) ? 0 : input;
  if (!input) return 0;
  
  let str = input.toString().trim();
  if (!str) return 0;

  // If string contains both '.' and ',', assume '.' is thousand separator and ',' is decimal (e.g. 1.250,50)
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // If only comma, convert ',' to '.' (e.g. 0,00785 -> 0.00785)
    str = str.replace(',', '.');
  }
  // If only dot or no separators, preserve dot for decimal parsing (e.g. 0.00785 -> 0.00785)

  const clean = str.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Converte uma string de entrada (em milímetros, decimais ou frações de polegada)
 * para o valor numérico equivalente em milímetros.
 * 
 * Exemplos de entradas aceitas:
 * - "32"       -> 32 mm
 * - "12.7"     -> 12.7 mm
 * - "1/2"      -> 12.7 mm
 * - "1/2\""    -> 12.7 mm
 * - "1.1/2"    -> 38.1 mm
 * - "1 1/2"    -> 38.1 mm
 * - "3/8 pol"  -> 9.525 mm
 */
export function parseDimensionToMm(input: string | number | undefined | null): number {
  if (input === undefined || input === null) {
    return 0;
  }

  if (typeof input === 'number') {
    return isNaN(input) ? 0 : input;
  }

  if (typeof input !== 'string') {
    return 0;
  }

  // Limpa o texto: remove aspas de polegada ("), a palavra 'pol', 'in', 'mm', 'ø', espaços extras nas pontas
  let cleanInput = input
    .replace(/["'”’]|pol|in|mm|ø/gi, '')
    .replace(',', '.')
    .trim();

  if (!cleanInput) return 0;

  // 1. Caso de fração mista com espaço (Ex: "1 1/2")
  if (cleanInput.includes(' ')) {
    const parts = cleanInput.split(/\s+/);
    if (parts.length === 2 && parts[1].includes('/')) {
      const whole = parseFloat(parts[0]);
      const [num, den] = parts[1].split('/').map(Number);
      if (!isNaN(whole) && !isNaN(num) && !isNaN(den) && den !== 0) {
        return (whole + num / den) * 25.4;
      }
    }
  }

  // 2. Caso de fração mista com ponto (Ex: "1.1/2")
  if (cleanInput.includes('.')) {
    const parts = cleanInput.split('.');
    if (parts.length === 2 && parts[1].includes('/')) {
      const whole = parseFloat(parts[0]);
      const [num, den] = parts[1].split('/').map(Number);
      if (!isNaN(whole) && !isNaN(num) && !isNaN(den) && den !== 0) {
        return (whole + num / den) * 25.4;
      }
    }
  }

  // 3. Caso de fração simples (Ex: "1/2" ou "3/8")
  if (cleanInput.includes('/')) {
    const [num, den] = cleanInput.split('/').map(Number);
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      return (num / den) * 25.4;
    }
  }

  // 4. Se for apenas um número decimal/inteiro normal
  const parsedValue = parseFloat(cleanInput);
  if (isNaN(parsedValue)) return 0;

  // Se o usuário digitou apenas um número decimal e você quer tratar como mm diretamente:
  return parsedValue;
}

/**
 * Normaliza a constante informada:
 * - Se for '0.00785' ou 0.00785 (< 0.1), mantém o valor diretamente.
 * - Se for informada como 7.85 ou 6.17 (>= 0.1), divide por 1000 para converter para 0.00785 ou 0.00617.
 * - Se for vazia ou inválida, assume o padrão 0.00785.
 */
export function normalizeConstant(constant: number | string): number {
  if (constant === 0 || constant === '0' || constant === '0,0' || constant === '0.0') return 0;
  const k = typeof constant === 'number' ? (isNaN(constant) ? 0 : constant) : parseNumberBR(constant);
  if (k < 0) return 0.00785;
  if (k >= 0.1) {
    return Number((k / 1000).toFixed(6));
  }
  return k;
}

// 3. Subtotal = Math.ceil(Valor_Unitario * Qtd) (Valores inteiros arredondados para cima)
export function calculateItemSubtotal(unitPrice: number, quantity: number): number {
  const price = typeof unitPrice === 'number' && !isNaN(unitPrice) ? unitPrice : 0;
  const qty = typeof quantity === 'number' && !isNaN(quantity) ? quantity : 0;
  return Math.ceil(price * qty);
}

export type GeometryType = 'REDONDO_QUADRADO' | 'CHAPA_RETANGULO' | 'TUBO_BUCHA' | 'chapa' | 'macico' | 'bucha';

export interface MaterialProfile {
  id: string;
  name: string;
  tipo: 'chapa' | 'macico' | 'bucha';
  k: number;
  defaultPriceKg: number;
  description: string;
}

export interface TabelaConstanteItem {
  nome: string;
  k: number;
  precoKg: number;
  tipo: 'chapa' | 'macico' | 'bucha';
}

// Tabela canônica oficial de Materiais / Constantes e Preços/Kg
export const tabelaConstantes: TabelaConstanteItem[] = [
  { nome: "BRONZE TM 620", k: 0.0072, precoKg: 200.00, tipo: "macico" },
  { nome: "BRONZE TM 23", k: 0.0072, precoKg: 150.00, tipo: "macico" },
  { nome: "NYLON REDONDO", k: 0.00094, precoKg: 90.00, tipo: "macico" },
  { nome: "ALUMINIO REDONDO", k: 0.00214, precoKg: 75.00, tipo: "macico" },
  { nome: "FFNODULAR REDONDO", k: 0.00567, precoKg: 26.00, tipo: "macico" },
  { nome: "AÇO VC REDONDO", k: 0.00617, precoKg: 80.00, tipo: "macico" },
  { nome: "SEXTAVADO AÇO", k: 0.0068, precoKg: 35.00, tipo: "macico" },
  { nome: "SEXTAVADO LATÃO", k: 0.00791, precoKg: 115.00, tipo: "macico" },
  { nome: "RETALHO", k: 0, precoKg: 15.00, tipo: "chapa" },
  { nome: "QUADRADO", k: 0.00785, precoKg: 35.00, tipo: "macico" },
  { nome: "P.U REDONDO", k: 0.00094, precoKg: 205.00, tipo: "macico" },
  { nome: "BUCHA REDONDO", k: 0.00617, precoKg: 45.00, tipo: "bucha" },
  { nome: "BARRA CHATA", k: 0.00785, precoKg: 18.00, tipo: "chapa" },
  { nome: "CHAVETA", k: 0.00785, precoKg: 205.00, tipo: "chapa" },
  { nome: "QUADRADO ALUMINIO", k: 0.0027, precoKg: 75.00, tipo: "macico" },
  { nome: "QUADRADO NYLON", k: 0.0013, precoKg: 100.00, tipo: "macico" },
  { nome: "LATAO REDONDO", k: 0.0069, precoKg: 115.00, tipo: "macico" },
  { nome: "POLIURETANO REDONDO", k: 0.0009, precoKg: 205.00, tipo: "macico" },
  { nome: "OXICORTE A36", k: 0.00785, precoKg: 22.00, tipo: "chapa" },
  { nome: "LASER A36", k: 0.00785, precoKg: 22.00, tipo: "chapa" },
  { nome: "SEXTAVADO INOX", k: 0.00617, precoKg: 75.00, tipo: "macico" },
  { nome: "PAGAMENTO", k: 0, precoKg: 0.00, tipo: "chapa" },
  { nome: "MÃO DE OBRA", k: 0, precoKg: 0.00, tipo: "chapa" },
  { nome: "AÇO REDONDO SAE 1045", k: 0.00617, precoKg: 22.00, tipo: "macico" },
  { nome: "AÇO REDONDO SAE 4140", k: 0.00617, precoKg: 28.00, tipo: "macico" },
  { nome: "AÇO REDONDO SAE 8620", k: 0.00617, precoKg: 28.00, tipo: "macico" },
  { nome: "AÇO REDONDO SAE 4340", k: 0.00617, precoKg: 35.00, tipo: "macico" },
  { nome: "AÇO REDONDO SAE 1020", k: 0.00617, precoKg: 22.00, tipo: "macico" }
];

export const TABELA_CONSTANTES = tabelaConstantes;

// Lista canônica de nomes para o autocompletar em linha
export const LISTA_MATERIAIS_INLINE = tabelaConstantes.map(item => item.nome);

// Mapeamento dos valores de K e tipo para o cálculo rápido e dinâmico (suporta chave exata e em minúsculas)
export const DADOS_MATERIAIS_MAP: Record<string, { tipo: 'chapa' | 'macico' | 'bucha'; k: number; precoKg: number; id: string; nome: string }> = {};

tabelaConstantes.forEach(item => {
  const slug = item.nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const data = {
    tipo: item.tipo,
    k: item.k,
    precoKg: item.precoKg,
    id: slug,
    nome: item.nome
  };

  DADOS_MATERIAIS_MAP[item.nome] = data;
  DADOS_MATERIAIS_MAP[item.nome.toLowerCase()] = data;
  DADOS_MATERIAIS_MAP[slug] = data;
});

// Perfis de materiais completos com IDs e descrições para visualização rica
export const MATERIAL_PROFILES: MaterialProfile[] = tabelaConstantes.map(item => {
  const slug = item.nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return {
    id: slug,
    name: item.nome,
    tipo: item.tipo,
    k: item.k,
    defaultPriceKg: item.precoKg,
    description: `${item.nome} (k=${item.k} | R$ ${item.precoKg.toFixed(2).replace('.', ',')}/Kg)`
  };
});

/**
 * CÁLCULO DIRETO DO PESO E VALORES (REGRAS OFICIAIS USICORTE):
 *
 * 1. CÁLCULO 1: CHAPA
 *    pesoUnitario = (espessura * largura * comprimento * k) / 1000;
 *
 * 2. CÁLCULO 2: MACIÇO (Redondo / Sextavado / Bronze / Inox / Latão)
 *    const d = diametro || espessura;
 *    pesoUnitario = (d * d * comprimento * k) / 1000;
 *
 * 3. CÁLCULO 3: TUBO MECÂNICO / BUCHA (Subtração do Furo)
 *    const dExt = diametro;
 *    const dInt = espessura;
 *    if (dExt > dInt && dInt > 0) {
 *      pesoBruto = (dExt * dExt * comprimento * k) / 1000;
 *      pesoFuro = (dInt * dInt * comprimento * k) / 1000;
 *      pesoUnitario = pesoBruto - pesoFuro;
 *    } else {
 *      pesoUnitario = (dExt * dExt * comprimento * k) / 1000;
 *    }
 *
 * 4. CÁLCULO DOS VALORES
 *    valorUnitario = pesoUnitario * precoKg;
 *    valorTotal = valorUnitario * qtd;
 *    pesoTotal = pesoUnitario * qtd;
 */
export function calculateItemWeightKg({
  geometryType,
  constant,
  diameterMm = 0,
  thicknessMm = 0,
  widthMm = 0,
  lengthMm = 0,
  quantity = 1,
  diameterStr = '',
  thicknessStr = '',
  measureStr = ''
}: {
  geometryType: GeometryType;
  constant: number | string;
  diameterMm?: number;
  thicknessMm?: number;
  widthMm?: number;
  lengthMm?: number;
  quantity?: number;
  diameterStr?: string;
  thicknessStr?: string;
  measureStr?: string;
}): { unitWeightKg: number; totalWeightKg: number; effectiveDiameterMm: number; effectiveThicknessMm: number } {
  const k = normalizeConstant(constant);
  const l = typeof lengthMm === 'number' && !isNaN(lengthMm) ? lengthMm : 0;
  const w = typeof widthMm === 'number' && !isNaN(widthMm) ? widthMm : 0;
  const qty = typeof quantity === 'number' && !isNaN(quantity) ? quantity : 1;

  // Resolve espessura e diâmetro em mm
  let thick = typeof thicknessMm === 'number' && !isNaN(thicknessMm) && thicknessMm > 0
    ? thicknessMm
    : parseDiameterOrThicknessMm(thicknessStr, diameterStr, measureStr);

  let dia = typeof diameterMm === 'number' && !isNaN(diameterMm) && diameterMm > 0
    ? diameterMm
    : parseDiameterOrThicknessMm(diameterStr, thicknessStr, measureStr);

  const effectiveThick = thick > 0 ? thick : 0;
  const effectiveDia = dia > 0 ? dia : 0;

  let unitWeightKg = 0;

  if (geometryType === 'bucha' || geometryType === 'TUBO_BUCHA') {
    // CÁLCULO 3: TUBO MECÂNICO / BUCHA (Subtração do Furo)
    const dExt = effectiveDia > 0 ? effectiveDia : effectiveThick;
    const dInt = (effectiveDia > 0 && effectiveThick > 0) ? effectiveThick : 0;

    if (dExt > dInt && dInt > 0) {
      const pesoBruto = (dExt * dExt * l * k) / 1000;
      const pesoFuro = (dInt * dInt * l * k) / 1000;
      unitWeightKg = Number((pesoBruto - pesoFuro).toFixed(3));
    } else {
      const rawPeso = (dExt * dExt * l * k) / 1000;
      unitWeightKg = Number(rawPeso.toFixed(3));
    }
  } else if (geometryType === 'macico' || geometryType === 'REDONDO_QUADRADO') {
    // CÁLCULO 2: MACIÇO (Redondo / Sextavado / Bronze / Inox / Latão)
    // Aceita digitação em qualquer um dos dois campos (diâmetro ou espessura)
    const d = effectiveDia > 0 ? effectiveDia : effectiveThick;
    const rawPeso = (d * d * l * k) / 1000;
    unitWeightKg = Number(rawPeso.toFixed(3));
  } else {
    // CÁLCULO 1: CHAPA
    const t = effectiveThick > 0 ? effectiveThick : (effectiveDia > 0 ? effectiveDia : 1);
    const rawPeso = (t * w * l * k) / 1000;
    unitWeightKg = Number(rawPeso.toFixed(3));
  }

  unitWeightKg = Math.max(0, unitWeightKg);
  const totalWeightKg = Number((unitWeightKg * qty).toFixed(3));

  return {
    unitWeightKg,
    totalWeightKg,
    effectiveDiameterMm: effectiveDia,
    effectiveThicknessMm: effectiveThick
  };
}

export function calculateItemUnitPrice({
  geometryType,
  constant,
  diameterMm = 0,
  thicknessMm = 0,
  widthMm = 0,
  lengthMm = 0,
  pricePerKg = 0,
  diameterStr = '',
  thicknessStr = '',
  measureStr = ''
}: {
  geometryType: GeometryType;
  constant: number | string;
  diameterMm?: number;
  thicknessMm?: number;
  widthMm?: number;
  lengthMm?: number;
  pricePerKg: number;
  diameterStr?: string;
  thicknessStr?: string;
  measureStr?: string;
}): number {
  const { unitWeightKg } = calculateItemWeightKg({
    geometryType,
    constant,
    diameterMm,
    thicknessMm,
    widthMm,
    lengthMm,
    diameterStr,
    thicknessStr,
    measureStr
  });

  const pKg = typeof pricePerKg === 'number' && !isNaN(pricePerKg) ? pricePerKg : 0;

  // Valor_Unitario = Math.ceil(Peso_Kg * Preco_Por_Kg) (Inteiro arredondado para cima)
  const unitPrice = Math.ceil(unitWeightKg * pKg);
  return Math.max(0, unitPrice);
}

/**
 * Normaliza uma string de medidas: quebra em tokens por "x"/"×", remove
 * tokens repetidos (causa da duplicidade tipo 5" x 300 x 5" x 300) e rejunta.
 */
export function normalizarMedida(valor: string | undefined | null): string {
  if (!valor) return "";

  const partes = valor
    .replace(/×/g, "x")
    .split("x")
    .map((p) => p.trim())
    .filter(Boolean);

  const vistas = new Set<string>();
  const unicas: string[] = [];

  for (const parte of partes) {
    const chave = parte.toLowerCase().replace(/\s+/g, "");
    if (!vistas.has(chave)) {
      vistas.add(chave);
      unicas.push(parte);
    }
  }

  return unicas.join(" x ");
}

export function formatarMedidasLimpa(item: Record<string, any>): string {
  const {
    geometry,
    diameter,
    measure,
    widthLength,
    width,
    length,
    unit = "mm",
  } = item || {};

  let resultado = "";

  // BUCHA / TUBO: medida composta por diâmetro externo x diâmetro interno x comprimento
  if (geometry === "bucha" || geometry === "tubo") {
    const externo = diameter || measure;
    const interno = widthLength || width;
    const comp = length;
    resultado = normalizarMedida(
      [externo, interno, comp].filter(Boolean).join(" x ")
    );
  }
  // MACIÇO / REDONDO: medida composta por diâmetro x comprimento
  else if (geometry === "macico" || geometry === "redondo") {
    const diam = diameter || measure;
    const comp = widthLength || length;
    resultado = normalizarMedida([diam, comp].filter(Boolean).join(" x "));
  }
  // CHAPA / PLACA / RETANGULAR: medida composta por espessura x largura x comprimento
  else if (
    geometry === "chapa" ||
    geometry === "placa" ||
    geometry === "retangular"
  ) {
    const espessura = diameter || measure;
    const dimensoes = widthLength || [width, length].filter(Boolean).join(" x ");
    resultado = normalizarMedida(
      [espessura, dimensoes].filter(Boolean).join(" x ")
    );
  }
  // Fallback genérico
  else {
    resultado = normalizarMedida(
      [diameter || measure, widthLength || [width, length].filter(Boolean).join(" x ")]
        .filter(Boolean)
        .join(" x ")
    );
  }

  if (!resultado) return "";

  // Adiciona o prefixo Ø quando o resultado começa com diâmetro (geometria redonda)
  if (
    (geometry === "macico" ||
      geometry === "redondo" ||
      geometry === "bucha" ||
      geometry === "tubo") &&
    !resultado.startsWith("Ø")
  ) {
    resultado = `Ø ${resultado}`;
  }

  // Adiciona a unidade apenas se ainda não estiver presente
  if (!resultado.toLowerCase().includes(unit.toLowerCase())) {
    resultado = `${resultado} ${unit}`;
  }

  return resultado.trim();
}

// Alias para compatibilidade, se necessário
export const formatarMedida = formatarMedidasLimpa;

export function renderizarTabelaRelatorio(listaItens: any[]): void {
  if (typeof document === 'undefined') return;
  const tbody = document.getElementById('tbody-relatorio');
  if (!tbody) return;

  tbody.innerHTML = '';

  (listaItens || []).forEach(item => {
    // 1. Nome do Material (Constante)
    const produtoMaterial = item.constanteNome || item.constantName || item.material || "MATERIAL";
    
    // 2. Medidas limpas
    const medidasFormatadas = formatarMedidasLimpa(item);

    // 3. Descrição
    const descricaoItem = item.descricao || item.description || "-";

    // 4. Informações (Campo Observação)
    const informacoesObs = item.observacao || item.notes || item.info || "-";

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: left; font-weight: bold;">${produtoMaterial}</td>
      <td style="text-align: center;">${medidasFormatadas}</td>
      <td style="text-align: left;">${descricaoItem}</td>
      <td style="text-align: left; font-style: italic; color: #555;">${informacoesObs}</td>
      <td style="text-align: right;">R$ ${Number(item.valorUnitario !== undefined ? item.valorUnitario : (item.unitPrice || 0)).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
      <td style="text-align: center;">${item.qtd || item.quantity || 1}</td>
      <td style="text-align: right; font-weight: bold;">${Number(item.pesoTotal !== undefined ? item.pesoTotal : (item.totalWeightKg || 0)).toFixed(3)} Kg</td>
      <td style="text-align: right; font-weight: bold;">R$ ${Number(item.subtotal !== undefined ? item.subtotal : ((item.unitPrice || 0) * (item.quantity || 1))).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Preset metallurgical constants for UsiCorte com valores decimais estritos
export interface MaterialConstantPreset {
  name: string;
  category: 'Aços' | 'Inox' | 'Não-Ferrosos' | 'Plásticos' | 'Ferro Fundido' | 'Fatores de Corte';
  constant: number;
  defaultPriceKg: number;
  description: string;
  keywords?: string[];
}

export const MATERIAL_PRESETS: MaterialConstantPreset[] = [
  { 
    name: 'Laser Chapa / Corte Laser (k=0.00785)', 
    category: 'Fatores de Corte', 
    constant: 0.00785, 
    defaultPriceKg: 22.00, 
    description: 'Corte a Laser CNC Alta Precisão - Aço Carbono (k=0.00785)',
    keywords: ['laser', 'corte laser', 'chapa laser', 'cnc', 'plasma', 'fibra', '0.00785', '7.85']
  },
  { 
    name: 'Oxicorte CNC / Plasma HD (k=0.00785)', 
    category: 'Fatores de Corte', 
    constant: 0.00785, 
    defaultPriceKg: 18.50, 
    description: 'Corte CNC Oxicorte Pesado / Plasma Alta Definição (k=0.00785)',
    keywords: ['oxicorte', 'plasma', 'corte pesado', 'chapa grossa', '0.00785', '7.85']
  },
  { 
    name: 'Aço Carbono SAE 1020 / A36 (k=0.00785)', 
    category: 'Aços', 
    constant: 0.00785, 
    defaultPriceKg: 14.50, 
    description: 'Aço Estrutural e Laminado Padrão (k=0.00785)',
    keywords: ['1020', 'a36', 'sae 1020', 'chapa 1020', 'aço carbono', 'ferro', '0.00785', '7.85']
  },
  { 
    name: 'Aço SAE 1045 Redondo / Trefilado (k=0.00617)', 
    category: 'Aços', 
    constant: 0.00617, 
    defaultPriceKg: 17.80, 
    description: 'Aço SAE 1045 Redondo / Trefilado UsiCorte (k=0.00617)',
    keywords: ['1045', 'sae 1045', 'trefilado', 'eixo', 'tarugo 1045', 'redondo', '0.00617', '6.17']
  },
  { 
    name: 'Aço SAE 1045 Chapa / Bloco (k=0.00785)', 
    category: 'Aços', 
    constant: 0.00785, 
    defaultPriceKg: 17.80, 
    description: 'Aço Mecânico Beneficiável para Peças e Chapas (k=0.00785)',
    keywords: ['1045', 'sae 1045', 'bloco', 'chapa 1045', '0.00785', '7.85']
  },
  { 
    name: 'Aço SAE 4140 / 4340 Tratado (k=0.00785)', 
    category: 'Aços', 
    constant: 0.00785, 
    defaultPriceKg: 32.00, 
    description: 'Aço Liga Cromo-Molibdênio de Alta Resistência (k=0.00785)',
    keywords: ['4140', '4340', 'cromo', 'molibdenio', '0.00785', '7.85']
  },
  { 
    name: 'Aço Inox AISI 304 / 304L (k=0.00800)', 
    category: 'Inox', 
    constant: 0.00800, 
    defaultPriceKg: 45.00, 
    description: 'Aço Inoxidável Austenítico Sanitário e Alimentício (k=0.00800)',
    keywords: ['inox', '304', '304l', 'aisi 304', 'inox 304', 'sanitario', '0.00800', '8.00', '8.0']
  },
  { 
    name: 'Aço Inox AISI 316 / 316L (k=0.00800)', 
    category: 'Inox', 
    constant: 0.00800, 
    defaultPriceKg: 68.00, 
    description: 'Aço Inoxidável Resistente à Corrosão Química e Marinha (k=0.00800)',
    keywords: ['inox 316', '316', '316l', 'marinho', 'quimico', '0.00800', '8.00']
  },
  { 
    name: 'Aço Inox AISI 410 / 420 / 430 (k=0.00775)', 
    category: 'Inox', 
    constant: 0.00775, 
    defaultPriceKg: 36.00, 
    description: 'Aço Inoxidável Ferrítico / Martensítico Magnético (k=0.00775)',
    keywords: ['410', '420', '430', 'inox 430', 'ferritico', '0.00775', '7.75']
  },
  { 
    name: 'Alumínio Naval 5052 / 6061 / 6351 (k=0.00270)', 
    category: 'Não-Ferrosos', 
    constant: 0.00270, 
    defaultPriceKg: 38.00, 
    description: 'Liga de Alumínio Leve e Usinável (k=0.00270)',
    keywords: ['aluminio', '5052', '6061', '6351', 'naval', 'chapa aluminio', '0.00270', '2.70']
  },
  { 
    name: 'Bronze TM 23 / Grafitado / Fosforoso (k=0.00880)', 
    category: 'Não-Ferrosos', 
    constant: 0.00880, 
    defaultPriceKg: 85.00, 
    description: 'Bronze Nobre para Buchas Autolubrificantes e Mancais (k=0.00880)',
    keywords: ['bronze', 'tm 23', 'tm23', 'grafitado', 'bucha', 'mancal', '0.00880', '8.80']
  },
  { 
    name: 'Latão CLA / Redondo / Chapa (k=0.00850)', 
    category: 'Não-Ferrosos', 
    constant: 0.00850, 
    defaultPriceKg: 75.00, 
    description: 'Liga Cobre-Zinco de Fácil Usinagem e Corte (k=0.00850)',
    keywords: ['latao', 'cla', 'amarelo', 'cobre zinco', '0.00850', '8.50']
  },
  { 
    name: 'Cobre Eletrolítico / Barramento (k=0.00890)', 
    category: 'Não-Ferrosos', 
    constant: 0.00890, 
    defaultPriceKg: 92.00, 
    description: 'Cobre Puro 99.9% para Contatos Elétricos e Dissipadores (k=0.00890)',
    keywords: ['cobre', 'eletrolitico', 'barramento', 'eletrico', '0.00890', '8.90']
  },
  { 
    name: 'Ferro Fundido Cinzento FC 200/250 (k=0.00720)', 
    category: 'Ferro Fundido', 
    constant: 0.00720, 
    defaultPriceKg: 19.50, 
    description: 'Ferro Fundido Cinzento para Blocos e Polias (k=0.00720)',
    keywords: ['ferro fundido', 'cinzento', 'fc 200', 'fc 250', 'polia', '0.00720', '7.20']
  },
  { 
    name: 'Ferro Fundido Nodular FE 45012/50007 (k=0.00710)', 
    category: 'Ferro Fundido', 
    constant: 0.00710, 
    defaultPriceKg: 24.00, 
    description: 'Ferro Fundido Nodular de Alta Ductilidade e Impacto (k=0.00710)',
    keywords: ['nodular', 'fe 45012', 'fe 50007', 'ductil', '0.00710', '7.10']
  },
  { 
    name: 'Nylon 6.0 / Poliacetal POM / Tecnil (k=0.00140)', 
    category: 'Plásticos', 
    constant: 0.00140, 
    defaultPriceKg: 55.00, 
    description: 'Plástico de Engenharia Termoplástico Usinável (k=0.00140)',
    keywords: ['nylon', 'poliacetal', 'pom', 'tecnil', 'plastico', 'engrenagem', '0.00140', '1.40']
  },
  { 
    name: 'PTFE / Teflon Puro / Grafite (k=0.00220)', 
    category: 'Plásticos', 
    constant: 0.00220, 
    defaultPriceKg: 120.00, 
    description: 'Polímero de Alto Desempenho Térmico e Químico (k=0.00220)',
    keywords: ['teflon', 'ptfe', 'vedacao', 'quimico', '0.00220', '2.20']
  },
  { 
    name: 'Unitário Direto (Padrão 0.00100)', 
    category: 'Fatores de Corte', 
    constant: 0.00100, 
    defaultPriceKg: 1.00, 
    description: 'Multiplicador Unitário Neutro (Sem conversão)',
    keywords: ['unitario', '1.0', '0.001', 'neutro', 'direto', 'servico']
  }
];

export interface StandardMeasurePreset {
  label: string;
  displayValue: string;
  thicknessMm: number;
  category: 'Polegadas (Frações)' | 'Bitolas MSG / Chapas' | 'Milímetros (Métrico)' | 'Diâmetros (Ø)';
  description: string;
  keywords: string[];
}

export const STANDARD_MEASURE_PRESETS: StandardMeasurePreset[] = [
  // Polegadas / Frações
  { label: '1/16" (1,58 mm)', displayValue: '1/16"', thicknessMm: 1.58, category: 'Polegadas (Frações)', description: 'Chapa fina 1/16 pol (1.58 mm)', keywords: ['1/16', '1.58', 'fina'] },
  { label: '5/64" (1,98 mm)', displayValue: '5/64"', thicknessMm: 1.98, category: 'Polegadas (Frações)', description: 'Chapa 5/64 pol (1.98 mm)', keywords: ['5/64', '1.98'] },
  { label: '3/32" (2,38 mm)', displayValue: '3/32"', thicknessMm: 2.38, category: 'Polegadas (Frações)', description: 'Chapa 3/32 pol (2.38 mm)', keywords: ['3/32', '2.38'] },
  { label: '1/8" (3,18 mm)', displayValue: '1/8"', thicknessMm: 3.18, category: 'Polegadas (Frações)', description: 'Chapa / Barra 1/8 pol (3.18 mm)', keywords: ['1/8', '3.18', '3,18', '3mm', 'chapa 1/8'] },
  { label: '5/32" (3,97 mm)', displayValue: '5/32"', thicknessMm: 3.97, category: 'Polegadas (Frações)', description: 'Chapa 5/32 pol (3.97 mm)', keywords: ['5/32', '3.97', '4mm'] },
  { label: '3/16" (4,76 mm)', displayValue: '3/16"', thicknessMm: 4.76, category: 'Polegadas (Frações)', description: 'Chapa / Barra 3/16 pol (4.76 mm)', keywords: ['3/16', '4.76', '4,76', '4.75', 'chapa 3/16', '#3/16'] },
  { label: '7/32" (5,56 mm)', displayValue: '7/32"', thicknessMm: 5.56, category: 'Polegadas (Frações)', description: 'Chapa 7/32 pol (5.56 mm)', keywords: ['7/32', '5.56'] },
  { label: '1/4" (6,35 mm)', displayValue: '1/4"', thicknessMm: 6.35, category: 'Polegadas (Frações)', description: 'Chapa / Barra 1/4 pol (6.35 mm)', keywords: ['1/4', '6.35', '6,35', '6mm', 'chapa 1/4', '#1/4'] },
  { label: '5/16" (7,94 mm)', displayValue: '5/16"', thicknessMm: 7.94, category: 'Polegadas (Frações)', description: 'Chapa / Barra 5/16 pol (7.94 mm)', keywords: ['5/16', '7.94', '7,94', '8mm', 'chapa 5/16', '#5/16'] },
  { label: '3/8" (9,53 mm)', displayValue: '3/8"', thicknessMm: 9.53, category: 'Polegadas (Frações)', description: 'Chapa / Barra 3/8 pol (9.53 mm)', keywords: ['3/8', '9.53', '9,53', '9.5', 'chapa 3/8', '#3/8'] },
  { label: '7/16" (11,11 mm)', displayValue: '7/16"', thicknessMm: 11.11, category: 'Polegadas (Frações)', description: 'Chapa 7/16 pol (11.11 mm)', keywords: ['7/16', '11.11', '11mm'] },
  { label: '1/2" (12,70 mm)', displayValue: '1/2"', thicknessMm: 12.70, category: 'Polegadas (Frações)', description: 'Chapa / Barra 1/2 pol (12.70 mm)', keywords: ['1/2', '12.70', '12,7', '12.7', '1/2 pol', 'meia polegada', '#1/2'] },
  { label: '9/16" (14,29 mm)', displayValue: '9/16"', thicknessMm: 14.29, category: 'Polegadas (Frações)', description: 'Chapa 9/16 pol (14.29 mm)', keywords: ['9/16', '14.29'] },
  { label: '5/8" (15,88 mm)', displayValue: '5/8"', thicknessMm: 15.88, category: 'Polegadas (Frações)', description: 'Chapa / Barra 5/8 pol (15.88 mm)', keywords: ['5/8', '15.88', '15,88', '16mm', '5/8 pol'] },
  { label: '11/16" (17,46 mm)', displayValue: '11/16"', thicknessMm: 17.46, category: 'Polegadas (Frações)', description: 'Chapa 11/16 pol (17.46 mm)', keywords: ['11/16', '17.46'] },
  { label: '3/4" (19,05 mm)', displayValue: '3/4"', thicknessMm: 19.05, category: 'Polegadas (Frações)', description: 'Chapa / Barra 3/4 pol (19.05 mm)', keywords: ['3/4', '19.05', '19,05', '19mm', '3/4 pol'] },
  { label: '13/16" (20,64 mm)', displayValue: '13/16"', thicknessMm: 20.64, category: 'Polegadas (Frações)', description: 'Chapa 13/16 pol (20.64 mm)', keywords: ['13/16', '20.64'] },
  { label: '7/8" (22,23 mm)', displayValue: '7/8"', thicknessMm: 22.23, category: 'Polegadas (Frações)', description: 'Chapa / Barra 7/8 pol (22.23 mm)', keywords: ['7/8', '22.23', '22,23', '22mm', '7/8 pol'] },
  { label: '1" (25,40 mm)', displayValue: '1"', thicknessMm: 25.40, category: 'Polegadas (Frações)', description: 'Chapa Grossa / Tarugo 1 pol (25.40 mm)', keywords: ['1"', '1 pol', '25.40', '25.4', '25,4', 'uma polegada', '25mm'] },
  { label: '1.1/8" (28,58 mm)', displayValue: '1.1/8"', thicknessMm: 28.58, category: 'Polegadas (Frações)', description: 'Chapa 1.1/8 pol (28.58 mm)', keywords: ['1.1/8', '1 1/8', '28.58'] },
  { label: '1.1/4" (31,75 mm)', displayValue: '1.1/4"', thicknessMm: 31.75, category: 'Polegadas (Frações)', description: 'Chapa Grossa 1.1/4 pol (31.75 mm)', keywords: ['1.1/4', '1 1/4', '31.75', '32mm'] },
  { label: '1.3/8" (34,93 mm)', displayValue: '1.3/8"', thicknessMm: 34.93, category: 'Polegadas (Frações)', description: 'Chapa 1.3/8 pol (34.93 mm)', keywords: ['1.3/8', '1 3/8', '34.93'] },
  { label: '1.1/2" (38,10 mm)', displayValue: '1.1/2"', thicknessMm: 38.10, category: 'Polegadas (Frações)', description: 'Chapa Grossa 1.1/2 pol (38.10 mm)', keywords: ['1.1/2', '1 1/2', '38.10', '38mm', 'uma e meia'] },
  { label: '1.3/4" (44,45 mm)', displayValue: '1.3/4"', thicknessMm: 44.45, category: 'Polegadas (Frações)', description: 'Chapa Grossa 1.3/4 pol (44.45 mm)', keywords: ['1.3/4', '1 3/4', '44.45', '45mm'] },
  { label: '2" (50,80 mm)', displayValue: '2"', thicknessMm: 50.80, category: 'Polegadas (Frações)', description: 'Chapa Grossa / Tarugo 2 pol (50.80 mm)', keywords: ['2"', '2 pol', '50.80', '50.8', '50mm', 'duas polegadas'] },
  { label: '2.1/4" (57,15 mm)', displayValue: '2.1/4"', thicknessMm: 57.15, category: 'Polegadas (Frações)', description: 'Chapa Grossa 2.1/4 pol (57.15 mm)', keywords: ['2.1/4', '2 1/4', '57.15'] },
  { label: '2.1/2" (63,50 mm)', displayValue: '2.1/2"', thicknessMm: 63.50, category: 'Polegadas (Frações)', description: 'Chapa Grossa 2.1/2 pol (63.50 mm)', keywords: ['2.1/2', '2 1/2', '63.50', '64mm'] },
  { label: '3" (76,20 mm)', displayValue: '3"', thicknessMm: 76.20, category: 'Polegadas (Frações)', description: 'Chapa Grossa / Tarugo 3 pol (76.20 mm)', keywords: ['3"', '3 pol', '76.20', '76mm', 'tres polegadas'] },
  { label: '3.1/2" (88,90 mm)', displayValue: '3.1/2"', thicknessMm: 88.90, category: 'Polegadas (Frações)', description: 'Chapa Grossa 3.1/2 pol (88.90 mm)', keywords: ['3.1/2', '3 1/2', '88.90', '89mm'] },
  { label: '4" (101,60 mm)', displayValue: '4"', thicknessMm: 101.60, category: 'Polegadas (Frações)', description: 'Bloco / Chapa 4 pol (101.60 mm)', keywords: ['4"', '4 pol', '101.60', '100mm', 'quatro polegadas'] },
  { label: '5" (127,00 mm)', displayValue: '5"', thicknessMm: 127.00, category: 'Polegadas (Frações)', description: 'Bloco / Chapa 5 pol (127.00 mm)', keywords: ['5"', '5 pol', '127.00', '127mm'] },
  { label: '6" (152,40 mm)', displayValue: '6"', thicknessMm: 152.40, category: 'Polegadas (Frações)', description: 'Bloco / Chapa 6 pol (152.40 mm)', keywords: ['6"', '6 pol', '152.40', '150mm'] },

  // Bitolas MSG / USG
  { label: '#26 (0,45 mm)', displayValue: '#26 (0.45mm)', thicknessMm: 0.45, category: 'Bitolas MSG / Chapas', description: 'Bitola MSG #26 - Chapa Fina 0.45 mm', keywords: ['#26', '26', '0.45', 'msg 26'] },
  { label: '#24 (0,60 mm)', displayValue: '#24 (0.60mm)', thicknessMm: 0.60, category: 'Bitolas MSG / Chapas', description: 'Bitola MSG #24 - Chapa Fina 0.60 mm', keywords: ['#24', '24', '0.60', '0.6', 'msg 24'] },
  { label: '#22 (0,75 mm)', displayValue: '#22 (0.75mm)', thicknessMm: 0.75, category: 'Bitolas MSG / Chapas', description: 'Bitola MSG #22 - Chapa Fina 0.75 mm', keywords: ['#22', '22', '0.75', 'msg 22'] },
  { label: '#20 (0,90 mm)', displayValue: '#20 (0.90mm)', thicknessMm: 0.90, category: 'Bitolas MSG / Chapas', description: 'Bitola MSG #20 - Chapa Fina 0.90 mm', keywords: ['#20', '20', '0.90', '0.9', 'msg 20'] },
  { label: '#18 (1,20 mm)', displayValue: '#18 (1.20mm)', thicknessMm: 1.20, category: 'Bitolas MSG / Chapas', description: 'Bitola MSG #18 - Chapa Fina 1.20 mm', keywords: ['#18', '18', '1.20', '1.2', 'msg 18'] },
  { label: '#16 (1,50 mm)', displayValue: '#16 (1.50mm)', thicknessMm: 1.50, category: 'Bitolas MSG / Chapas', description: 'Bitola MSG #16 - Chapa Fina 1.50 mm', keywords: ['#16', '16', '1.50', '1.5', 'msg 16', 'chapa 16'] },
  { label: '#14 (1,90 mm)', displayValue: '#14 (1.90mm)', thicknessMm: 1.90, category: 'Bitolas MSG / Chapas', description: 'Bitola MSG #14 - Chapa Média 1.90 mm', keywords: ['#14', '14', '1.90', '1.9', 'msg 14', 'chapa 14', '2mm'] },
  { label: '#13 (2,25 mm)', displayValue: '#13 (2.25mm)', thicknessMm: 2.25, category: 'Bitolas MSG / Chapas', description: 'Bitola MSG #13 - Chapa Média 2.25 mm', keywords: ['#13', '13', '2.25', 'msg 13'] },
  { label: '#12 (2,65 mm)', displayValue: '#12 (2.65mm)', thicknessMm: 2.65, category: 'Bitolas MSG / Chapas', description: 'Bitola MSG #12 - Chapa Média 2.65 mm', keywords: ['#12', '12', '2.65', 'msg 12', 'chapa 12'] },
  { label: '#11 (3,00 mm)', displayValue: '#11 (3.00mm)', thicknessMm: 3.00, category: 'Bitolas MSG / Chapas', description: 'Bitola MSG #11 - Chapa 3.00 mm', keywords: ['#11', '11', '3.00', '3.0', '3mm', 'msg 11', 'chapa 11'] },
  { label: '#10 (3,40 mm)', displayValue: '#10 (3.40mm)', thicknessMm: 3.40, category: 'Bitolas MSG / Chapas', description: 'Bitola MSG #10 - Chapa 3.40 mm', keywords: ['#10', '10', '3.40', '3.4', 'msg 10', 'chapa 10'] },
  { label: '#8 (4,25 mm)', displayValue: '#8 (4.25mm)', thicknessMm: 4.25, category: 'Bitolas MSG / Chapas', description: 'Bitola MSG #8 - Chapa 4.25 mm', keywords: ['#8', '8', '4.25', 'msg 8', 'chapa 8'] },
  { label: '#3/16" (4,75 mm)', displayValue: '#3/16" (4.75mm)', thicknessMm: 4.75, category: 'Bitolas MSG / Chapas', description: 'Chapa Grossa #3/16" (4.75 mm)', keywords: ['#3/16', '3/16', '4.75', '4.76'] },
  { label: '#1/4" (6,35 mm)', displayValue: '#1/4" (6.35mm)', thicknessMm: 6.35, category: 'Bitolas MSG / Chapas', description: 'Chapa Grossa #1/4" (6.35 mm)', keywords: ['#1/4', '1/4', '6.35', '6.3'] },
  { label: '#5/16" (8,00 mm)', displayValue: '#5/16" (8.00mm)', thicknessMm: 8.00, category: 'Bitolas MSG / Chapas', description: 'Chapa Grossa #5/16" (8.00 mm)', keywords: ['#5/16', '5/16', '8.00', '8mm'] },
  { label: '#3/8" (9,50 mm)', displayValue: '#3/8" (9.50mm)', thicknessMm: 9.50, category: 'Bitolas MSG / Chapas', description: 'Chapa Grossa #3/8" (9.50 mm)', keywords: ['#3/8', '3/8', '9.50', '9.5'] },
  { label: '#1/2" (12,70 mm)', displayValue: '#1/2" (12.70mm)', thicknessMm: 12.70, category: 'Bitolas MSG / Chapas', description: 'Chapa Grossa #1/2" (12.70 mm)', keywords: ['#1/2', '1/2', '12.70', '12.7'] },

  // Milímetros Diretos (Métrico)
  { label: '1,0 mm', displayValue: '1.0 mm', thicknessMm: 1.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 1.0 mm', keywords: ['1.0', '1mm', '1,0'] },
  { label: '1,5 mm', displayValue: '1.5 mm', thicknessMm: 1.5, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 1.5 mm', keywords: ['1.5', '1.5mm', '1,5'] },
  { label: '2,0 mm', displayValue: '2.0 mm', thicknessMm: 2.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 2.0 mm', keywords: ['2.0', '2mm', '2,0'] },
  { label: '2,5 mm', displayValue: '2.5 mm', thicknessMm: 2.5, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 2.5 mm', keywords: ['2.5', '2.5mm', '2,5'] },
  { label: '3,0 mm', displayValue: '3.0 mm', thicknessMm: 3.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 3.0 mm', keywords: ['3.0', '3mm', '3,0'] },
  { label: '4,0 mm', displayValue: '4.0 mm', thicknessMm: 4.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 4.0 mm', keywords: ['4.0', '4mm', '4,0'] },
  { label: '5,0 mm', displayValue: '5.0 mm', thicknessMm: 5.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 5.0 mm', keywords: ['5.0', '5mm', '5,0'] },
  { label: '6,0 mm', displayValue: '6.0 mm', thicknessMm: 6.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 6.0 mm', keywords: ['6.0', '6mm', '6,0'] },
  { label: '8,0 mm', displayValue: '8.0 mm', thicknessMm: 8.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 8.0 mm', keywords: ['8.0', '8mm', '8,0'] },
  { label: '10,0 mm', displayValue: '10.0 mm', thicknessMm: 10.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 10.0 mm', keywords: ['10.0', '10mm', '10,0'] },
  { label: '12,0 mm', displayValue: '12.0 mm', thicknessMm: 12.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 12.0 mm', keywords: ['12.0', '12mm', '12,0'] },
  { label: '15,0 mm', displayValue: '15.0 mm', thicknessMm: 15.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 15.0 mm', keywords: ['15.0', '15mm', '15,0'] },
  { label: '16,0 mm', displayValue: '16.0 mm', thicknessMm: 16.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 16.0 mm', keywords: ['16.0', '16mm', '16,0'] },
  { label: '20,0 mm', displayValue: '20.0 mm', thicknessMm: 20.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 20.0 mm', keywords: ['20.0', '20mm', '20,0'] },
  { label: '25,0 mm', displayValue: '25.0 mm', thicknessMm: 25.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 25.0 mm', keywords: ['25.0', '25mm', '25,0'] },
  { label: '30,0 mm', displayValue: '30.0 mm', thicknessMm: 30.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 30.0 mm', keywords: ['30.0', '30mm', '30,0'] },
  { label: '40,0 mm', displayValue: '40.0 mm', thicknessMm: 40.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 40.0 mm', keywords: ['40.0', '40mm', '40,0'] },
  { label: '50,0 mm', displayValue: '50.0 mm', thicknessMm: 50.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 50.0 mm', keywords: ['50.0', '50mm', '50,0'] },
  { label: '60,0 mm', displayValue: '60.0 mm', thicknessMm: 60.0, category: 'Milímetros (Métrico)', description: 'Espessura Milimétrica 60.0 mm', keywords: ['60.0', '60mm', '60,0'] },
  { label: '80,0 mm', displayValue: '80.0 mm', thicknessMm: 80.0, category: 'Milímetros (Métrico)', description: 'Bloco Milimétrico 80.0 mm', keywords: ['80.0', '80mm', '80,0'] },
  { label: '100,0 mm', displayValue: '100.0 mm', thicknessMm: 100.0, category: 'Milímetros (Métrico)', description: 'Bloco Milimétrico 100.0 mm', keywords: ['100.0', '100mm', '100,0'] },

  // Diâmetros / Tarugos (Ø)
  { label: 'Ø 1/4" (6,35 mm)', displayValue: 'Ø 1/4"', thicknessMm: 6.35, category: 'Diâmetros (Ø)', description: 'Barra Redonda / Eixo Ø 1/4" (6.35 mm)', keywords: ['ø 1/4', 'redondo 1/4', 'eixo 1/4', 'tarugo 1/4'] },
  { label: 'Ø 3/8" (9,53 mm)', displayValue: 'Ø 3/8"', thicknessMm: 9.53, category: 'Diâmetros (Ø)', description: 'Barra Redonda / Eixo Ø 3/8" (9.53 mm)', keywords: ['ø 3/8', 'redondo 3/8', 'eixo 3/8'] },
  { label: 'Ø 1/2" (12,70 mm)', displayValue: 'Ø 1/2"', thicknessMm: 12.70, category: 'Diâmetros (Ø)', description: 'Barra Redonda / Eixo Ø 1/2" (12.70 mm)', keywords: ['ø 1/2', 'redondo 1/2', 'eixo 1/2', 'tarugo 1/2'] },
  { label: 'Ø 5/8" (15,88 mm)', displayValue: 'Ø 5/8"', thicknessMm: 15.88, category: 'Diâmetros (Ø)', description: 'Barra Redonda / Eixo Ø 5/8" (15.88 mm)', keywords: ['ø 5/8', 'redondo 5/8', 'eixo 5/8'] },
  { label: 'Ø 3/4" (19,05 mm)', displayValue: 'Ø 3/4"', thicknessMm: 19.05, category: 'Diâmetros (Ø)', description: 'Barra Redonda / Eixo Ø 3/4" (19.05 mm)', keywords: ['ø 3/4', 'redondo 3/4', 'eixo 3/4'] },
  { label: 'Ø 7/8" (22,23 mm)', displayValue: 'Ø 7/8"', thicknessMm: 22.23, category: 'Diâmetros (Ø)', description: 'Barra Redonda / Eixo Ø 7/8" (22.23 mm)', keywords: ['ø 7/8', 'redondo 7/8', 'eixo 7/8'] },
  { label: 'Ø 1" (25,40 mm)', displayValue: 'Ø 1"', thicknessMm: 25.40, category: 'Diâmetros (Ø)', description: 'Tarugo Redondo Ø 1" (25.40 mm)', keywords: ['ø 1"', 'redondo 1', 'tarugo 1"', 'eixo 1"'] },
  { label: 'Ø 1.1/4" (31,75 mm)', displayValue: 'Ø 1.1/4"', thicknessMm: 31.75, category: 'Diâmetros (Ø)', description: 'Tarugo Redondo Ø 1.1/4" (31.75 mm)', keywords: ['ø 1.1/4', 'tarugo 1.1/4', 'redondo 32'] },
  { label: 'Ø 1.1/2" (38,10 mm)', displayValue: 'Ø 1.1/2"', thicknessMm: 38.10, category: 'Diâmetros (Ø)', description: 'Tarugo Redondo Ø 1.1/2" (38.10 mm)', keywords: ['ø 1.1/2', 'tarugo 1.1/2', 'redondo 38'] },
  { label: 'Ø 2" (50,80 mm)', displayValue: 'Ø 2"', thicknessMm: 50.80, category: 'Diâmetros (Ø)', description: 'Tarugo Redondo Ø 2" (50.80 mm)', keywords: ['ø 2"', 'tarugo 2"', 'redondo 50'] },
  { label: 'Ø 2.1/2" (63,50 mm)', displayValue: 'Ø 2.1/2"', thicknessMm: 63.50, category: 'Diâmetros (Ø)', description: 'Tarugo Redondo Ø 2.1/2" (63.50 mm)', keywords: ['ø 2.1/2', 'tarugo 2.1/2', 'redondo 63'] },
  { label: 'Ø 3" (76,20 mm)', displayValue: 'Ø 3"', thicknessMm: 76.20, category: 'Diâmetros (Ø)', description: 'Tarugo Redondo Ø 3" (76.20 mm)', keywords: ['ø 3"', 'tarugo 3"', 'redondo 76'] },
  { label: 'Ø 4" (101,60 mm)', displayValue: 'Ø 4"', thicknessMm: 101.60, category: 'Diâmetros (Ø)', description: 'Tarugo Redondo Ø 4" (101.60 mm)', keywords: ['ø 4"', 'tarugo 4"', 'redondo 100'] },
  { label: 'Ø 5" (127,00 mm)', displayValue: 'Ø 5"', thicknessMm: 127.00, category: 'Diâmetros (Ø)', description: 'Tarugo Redondo Ø 5" (127.00 mm)', keywords: ['ø 5"', 'tarugo 5"'] },
  { label: 'Ø 6" (152,40 mm)', displayValue: 'Ø 6"', thicknessMm: 152.40, category: 'Diâmetros (Ø)', description: 'Tarugo Redondo Ø 6" (152.40 mm)', keywords: ['ø 6"', 'tarugo 6"'] }
];

// Helper to parse diameter or thickness in mm from standard presets, fractions, or metric numbers
export function parseDiameterOrThicknessMm(...inputs: (string | undefined | null)[]): number {
  const findInPresets = (str: string): number | null => {
    if (!str || !str.trim()) return null;
    const clean = str.trim().toLowerCase();

    // 1. Direct display value, label, or keyword match in STANDARD_MEASURE_PRESETS
    const found = STANDARD_MEASURE_PRESETS.find(p =>
      p.displayValue.toLowerCase() === clean ||
      p.label.toLowerCase() === clean ||
      p.keywords.some(k => k.toLowerCase() === clean)
    );
    if (found) return found.thicknessMm;

    // 2. Value in parentheses with mm: e.g. "1/8" (3,18 mm)", "(3.2 mm)"
    const parenMmMatch = clean.match(/\(([\d.,]+)\s*mm\)/);
    if (parenMmMatch) {
      const val = parseFloat(parenMmMatch[1].replace(',', '.'));
      if (!isNaN(val) && val > 0) return val;
    }

    // 3. Mixed fractions: e.g. "1.1/2", "1 1/2", "2.1/4", "1-1/2"
    const mixedMatch = clean.match(/^(\d+)[\s\.\-]+(\d+)\/(\d+)/);
    if (mixedMatch) {
      const whole = parseFloat(mixedMatch[1]);
      const num = parseFloat(mixedMatch[2]);
      const den = parseFloat(mixedMatch[3]);
      if (den > 0) {
        return Math.round((whole + num / den) * 25.4 * 100) / 100;
      }
    }

    // 4. Simple fractions: e.g. "1/8", "3/16", "1/4", "1/2", "5/8", "3/4"
    const fracMatch = clean.match(/(\d+)\/(\d+)/);
    if (fracMatch) {
      const num = parseFloat(fracMatch[1]);
      const den = parseFloat(fracMatch[2]);
      if (den > 0) {
        return Math.round((num / den) * 25.4 * 100) / 100;
      }
    }

    // 5. Gauge pattern: e.g. "#14", "#16", "#20", "#1/4"
    const gaugeMatch = clean.match(/#\s*(\d+)/);
    if (gaugeMatch) {
      const gNum = gaugeMatch[1];
      const gPreset = STANDARD_MEASURE_PRESETS.find(p => p.keywords.includes(`#${gNum}`) || p.label.startsWith(`#${gNum}`));
      if (gPreset) return gPreset.thicknessMm;
    }

    // 6. Explicit inch indicator: e.g. '2"', '1.5 pol', '3 pol'
    if (clean.includes('"') || clean.includes('pol')) {
      const numMatch = clean.match(/(\d+[\.,]?\d*)/);
      if (numMatch) {
        const val = parseFloat(numMatch[1].replace(',', '.'));
        if (!isNaN(val) && val > 0) {
          return Math.round(val * 25.4 * 100) / 100;
        }
      }
    }

    // 7. Metric number: e.g. "50", "50mm", "Ø 50", "12.7", "12,7 mm", "3.2", "3,2"
    const metricMatch = clean.match(/(\d+[\.,]?\d*)/);
    if (metricMatch) {
      const val = parseFloat(metricMatch[1].replace(',', '.'));
      if (!isNaN(val) && val > 0) return val;
    }

    return null;
  };

  for (const input of inputs) {
    if (input) {
      const val = findInPresets(input);
      if (val !== null && val > 0) return val;
      const mmFallback = parseDimensionToMm(input);
      if (mmFallback > 0) return mmFallback;
    }
  }

  return 0;
}

// Helper to parse dimensions from strings (e.g., "1200 x 2400", "500 mm", "Ø 150")
export function parseDimensionStrings(
  widthLengthStr: string = '',
  diameterStr: string = '',
  measureStr: string = ''
): { parsedWidthMm: number; parsedLengthMm: number; parsedDiameterMm: number } {
  let parsedWidthMm = 0;
  let parsedLengthMm = 0;
  let parsedDiameterMm = parseDiameterOrThicknessMm(diameterStr, measureStr);

  // Check widthLength (e.g., "1200 x 2400 mm" or "500")
  const dims = widthLengthStr.split(/[xX*]/).map(d => d.trim());
  if (dims.length >= 2) {
    const w = parseFloat(dims[0].replace(/[^\d.,]/g, '').replace(',', '.'));
    const l = parseFloat(dims[1].replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(w) && w > 0) parsedWidthMm = dims[0].toLowerCase().includes('m') && !dims[0].toLowerCase().includes('mm') ? w * 1000 : w;
    if (!isNaN(l) && l > 0) parsedLengthMm = dims[1].toLowerCase().includes('m') && !dims[1].toLowerCase().includes('mm') ? l * 1000 : l;
  } else if (dims.length === 1 && dims[0]) {
    const single = parseFloat(dims[0].replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(single) && single > 0) {
      parsedLengthMm = dims[0].toLowerCase().includes('m') && !dims[0].toLowerCase().includes('mm') ? single * 1000 : single;
    }
  }

  // If measure contains width/length dimension when width is 0
  if (parsedWidthMm === 0 && measureStr && !parsedDiameterMm) {
    const mMatch = measureStr.match(/(\d+[\.,]?\d*)/);
    if (mMatch) {
      parsedWidthMm = parseFloat(mMatch[1].replace(',', '.'));
    }
  }

  return { parsedWidthMm, parsedLengthMm, parsedDiameterMm };
}

// Helper to auto-detect geometry type based on text
export function detectGeometryTypeFromText(text: string): GeometryType {
  const lower = text.toLowerCase();
  if (
    lower.includes('redondo') ||
    lower.includes('sextavado') ||
    lower.includes('quadrado') ||
    lower.includes('disco') ||
    lower.includes('eixo') ||
    lower.includes('tarugo') ||
    lower.includes('flange') ||
    lower.includes('tubo') ||
    lower.includes('ø')
  ) {
    return 'REDONDO_QUADRADO';
  }
  return 'CHAPA_RETANGULO';
}

// Calculation formula helper for UsiCorte (Plate / Bar / Cut theoretical weight and estimated price)
export function calculateTheoreticalWeightAndPrice({
  geometryType = 'CHAPA_RETANGULO',
  constant,
  measureStr,
  widthLengthStr,
  diameterStr,
  widthMm,
  lengthMm,
  quantity = 1,
  baseKgPrice = 22.00
}: {
  geometryType?: GeometryType;
  constant: number | string;
  measureStr?: string;
  widthLengthStr?: string;
  diameterStr?: string;
  widthMm?: number;
  lengthMm?: number;
  quantity?: number;
  baseKgPrice?: number;
}): { estimatedWeightKg: number; totalEstimatedWeightKg: number; suggestedUnitPrice: number } {
  const k = normalizeConstant(constant);

  const parsedDia = parseDiameterOrThicknessMm(diameterStr || '', measureStr || '');
  let finalWidth = typeof widthMm === 'number' && widthMm > 0 ? widthMm : 0;
  let finalLength = typeof lengthMm === 'number' && lengthMm > 0 ? lengthMm : 0;

  if (finalWidth === 0 || finalLength === 0) {
    const parsed = parseDimensionStrings(widthLengthStr || '', diameterStr || '', measureStr || '');
    if (finalWidth === 0) finalWidth = parsed.parsedWidthMm || 100;
    if (finalLength === 0) finalLength = parsed.parsedLengthMm || 1000;
  }

  const { unitWeightKg, totalWeightKg } = calculateItemWeightKg({
    geometryType,
    constant: k,
    diameterMm: parsedDia,
    widthMm: finalWidth,
    lengthMm: finalLength,
    quantity
  });

  const suggestedUnitPrice = Math.ceil(unitWeightKg * baseKgPrice);

  return {
    estimatedWeightKg: unitWeightKg,
    totalEstimatedWeightKg: totalWeightKg,
    suggestedUnitPrice
  };
}

export interface ProductDescriptionPreset {
  name: string;
  category: 'Trefilados & Eixos' | 'Chapas & Desenhos' | 'Inox' | 'Bronze & Latão' | 'Tubos & Buchas' | 'Alumínio & Plásticos';
  geometryType: GeometryType;
  constant: number;
  constantSelect: string;
  defaultPriceKg: number;
  badge: string;
  description: string;
  keywords: string[];
}

// Lista canônica de opções de autocompletar em linha estilo Access/Excel
export const INLINE_PRODUCT_OPTIONS: string[] = [
  "CONF DESENHO",
  "TREFILADO SAE 1045",
  "TREFILADO SAE 1020",
  "ALUMINIO",
  "FFNODULAR",
  "LAMINADO SAE 1045",
  "RETÂNGULO",
  "INOX 304",
  "BRONZE TM 620",
  "LATÃO CLA",
  "BUCHA ST52",
  "TREFILADO SAE 4140",
  "TREFILADO SAE 8620",
  "TREFILADO SAE 1045 SEXTAVADO",
  "TREFILADO SAE 1045 QUADRADO",
  "CHAPA AÇO CARBONO A36",
  "CORTE A LASER CNC",
  "CORTE PLASMA HD CNC",
  "OXICORTE CNC CHAPA GROSSA",
  "BARRA CHATA AÇO 1020",
  "INOX 304L",
  "INOX 316",
  "INOX 316L",
  "INOX 410",
  "INOX 420",
  "INOX 430",
  "BARRA CHATA INOX 304",
  "BRONZE TM 23",
  "BRONZE SAE 660",
  "BRONZE GRAFITADO",
  "TUBO MECÂNICO ST 52",
  "ALUMÍNIO NAVAL 5052",
  "ALUMÍNIO ESTRUTURAL 6061 T6",
  "NYLON 6.0",
  "POLIACETAL (POM / TECNIL)",
  "CELERON MALHA FINA",
  "TEFLON (PTFE PURO)"
];

export const PRODUCT_DESCRIPTION_PRESETS: ProductDescriptionPreset[] = [
  // 1. Trefilados & Eixos
  {
    name: 'TREFILADO SAE 1045',
    category: 'Trefilados & Eixos',
    geometryType: 'macico',
    constant: 0.00617,
    constantSelect: 'redondo_aco',
    defaultPriceKg: 17.80,
    badge: 'SAE 1045',
    description: 'Aço carbono trefilado SAE 1045 de alta usinabilidade e resistência mecânica (k=0.00617)',
    keywords: ['trefilado', '1045', 'sae 1045', 'eixo', 'redondo 1045', 'aco 1045', 'barra']
  },
  {
    name: 'TREFILADO SAE 1020',
    category: 'Trefilados & Eixos',
    geometryType: 'macico',
    constant: 0.00617,
    constantSelect: 'redondo_aco',
    defaultPriceKg: 15.50,
    badge: 'SAE 1020',
    description: 'Aço carbono trefilado SAE 1020 para conformação e usinagem leve (k=0.00617)',
    keywords: ['trefilado', '1020', 'sae 1020', 'redondo 1020', 'aco 1020', 'barra']
  },
  {
    name: 'LAMINADO SAE 1045',
    category: 'Trefilados & Eixos',
    geometryType: 'macico',
    constant: 0.00617,
    constantSelect: 'redondo_aco',
    defaultPriceKg: 16.50,
    badge: '1045 Laminado',
    description: 'Barra laminada a quente SAE 1045 para forjamento e usinagem pesada (k=0.00617)',
    keywords: ['laminado', '1045', 'laminado sae 1045', 'aco laminado', 'tarugo']
  },
  {
    name: 'FFNODULAR',
    category: 'Chapas & Desenhos',
    geometryType: 'macico',
    constant: 0.00710,
    constantSelect: 'redondo_aco',
    defaultPriceKg: 24.00,
    badge: 'FF Nodular',
    description: 'Ferro Fundido Nodular FE 45012 / 50007 para peças de alta ductilidade e impacto (k=0.00710)',
    keywords: ['ffnodular', 'nodular', 'ferro fundido', 'fe 45012', 'fe 50007', 'ductil']
  },
  {
    name: 'ALUMINIO',
    category: 'Alumínio & Plásticos',
    geometryType: 'chapa',
    constant: 0.00270,
    constantSelect: 'aluminio',
    defaultPriceKg: 38.00,
    badge: 'Alumínio',
    description: 'Alumínio em chapa ou bloco naval 5052 / 6061 usinável (k=0.00270)',
    keywords: ['aluminio', 'alumínio', 'chapa aluminio', '5052', '6061']
  },
  {
    name: 'LATÃO CLA',
    category: 'Bronze & Latão',
    geometryType: 'macico',
    constant: 0.00850,
    constantSelect: 'latao',
    defaultPriceKg: 75.00,
    badge: 'Latão CLA',
    description: 'Latão liga CuZn39Pb3 CLA para torneamento e usinagem de alta velocidade (k=0.00850)',
    keywords: ['latao cla', 'latão cla', 'cla', 'corte livre', 'amarelo', 'cobre zinco']
  },
  {
    name: 'BUCHA ST52',
    category: 'Tubos & Buchas',
    geometryType: 'bucha',
    constant: 0.00617,
    constantSelect: 'tubo_mecanico',
    defaultPriceKg: 24.00,
    badge: 'Bucha ST52',
    description: 'Bucha usinada de precisão em aço estrutural sem costura ST 52 (k=0.00617)',
    keywords: ['bucha st52', 'st52', 'bucha de aco', 'bucha aco', 'tubo mecanico']
  },
  {
    name: 'TREFILADO SAE 4140',
    category: 'Trefilados & Eixos',
    geometryType: 'macico',
    constant: 0.00617,
    constantSelect: 'redondo_aco',
    defaultPriceKg: 32.00,
    badge: 'SAE 4140',
    description: 'Aço ligado Cromo-Molibdênio SAE 4140 para engrenagens e eixos pesados (k=0.00617)',
    keywords: ['trefilado', '4140', 'sae 4140', 'cromo molibdenio', 'beneficiado']
  },
  {
    name: 'TREFILADO SAE 8620',
    category: 'Trefilados & Eixos',
    geometryType: 'macico',
    constant: 0.00617,
    constantSelect: 'redondo_aco',
    defaultPriceKg: 28.00,
    badge: 'SAE 8620',
    description: 'Aço para cementação e alta tenacidade superficial SAE 8620 (k=0.00617)',
    keywords: ['trefilado', '8620', 'sae 8620', 'cementacao', 'pinhao']
  },
  {
    name: 'TREFILADO SAE 1045 SEXTAVADO',
    category: 'Trefilados & Eixos',
    geometryType: 'macico',
    constant: 0.00617,
    constantSelect: 'redondo_aco',
    defaultPriceKg: 19.50,
    badge: '1045 Sext.',
    description: 'Barra trefilada sextavada SAE 1045 para porcas e peças de fixação (k=0.00617)',
    keywords: ['sextavado', '1045', 'trefilado sextavado', 'porca', 'parafuso']
  },
  {
    name: 'TREFILADO SAE 1045 QUADRADO',
    category: 'Trefilados & Eixos',
    geometryType: 'macico',
    constant: 0.00617,
    constantSelect: 'redondo_aco',
    defaultPriceKg: 19.50,
    badge: '1045 Quad.',
    description: 'Barra trefilada quadrada SAE 1045 para chavetas e estruturas (k=0.00617)',
    keywords: ['quadrado', '1045', 'chaveta', 'barra quadrada', 'trefilado quadrado']
  },
  {
    name: 'AÇO LAMINADO SAE 1045 REDONDO',
    category: 'Trefilados & Eixos',
    geometryType: 'macico',
    constant: 0.00617,
    constantSelect: 'redondo_aco',
    defaultPriceKg: 16.50,
    badge: '1045 Laminado',
    description: 'Barra laminada a quente SAE 1045 para forjamento e usinagem pesada (k=0.00617)',
    keywords: ['laminado', '1045', 'aco laminado', 'tarugo']
  },
  {
    name: 'AÇO LAMINADO SAE 1020 REDONDO',
    category: 'Trefilados & Eixos',
    geometryType: 'macico',
    constant: 0.00617,
    constantSelect: 'redondo_aco',
    defaultPriceKg: 14.50,
    badge: '1020 Laminado',
    description: 'Barra laminada a quente SAE 1020 comercial estrutural (k=0.00617)',
    keywords: ['laminado', '1020', 'aco laminado 1020']
  },

  // 2. Chapas & Desenhos
  {
    name: 'CONF DESENHO',
    category: 'Chapas & Desenhos',
    geometryType: 'chapa',
    constant: 0.00785,
    constantSelect: 'chapa_aco',
    defaultPriceKg: 22.00,
    badge: 'Conforme Desenho',
    description: 'Peça usinada ou cortada sob medida conforme projeto e especificações técnicas (k=0.00785)',
    keywords: ['conf desenho', 'desenho', 'conforme desenho', 'amostra', 'projeto', 'especial', 'custom']
  },
  {
    name: 'RETÂNGULO',
    category: 'Chapas & Desenhos',
    geometryType: 'chapa',
    constant: 0.00785,
    constantSelect: 'chapa_aco',
    defaultPriceKg: 22.00,
    badge: 'Retângulo / Chapa',
    description: 'Chapa cortada em formato retangular / bloco sob medida (k=0.00785)',
    keywords: ['retangulo', 'retângulo', 'chapa', 'bloco', 'chata', 'placa', 'corte']
  },
  {
    name: 'CHAPA RETÂNGULO AÇO 1020',
    category: 'Chapas & Desenhos',
    geometryType: 'chapa',
    constant: 0.00785,
    constantSelect: 'chapa_aco',
    defaultPriceKg: 18.00,
    badge: 'Chapa 1020',
    description: 'Chapa cortada em retângulo no aço carbono SAE 1020 / A36 (k=0.00785)',
    keywords: ['chapa retangulo', '1020', 'retangulo 1020', 'chapa 1020']
  },
  {
    name: 'CHAPA RETÂNGULO AÇO 1045',
    category: 'Chapas & Desenhos',
    geometryType: 'chapa',
    constant: 0.00785,
    constantSelect: 'chapa_aco',
    defaultPriceKg: 20.00,
    badge: 'Chapa 1045',
    description: 'Chapa cortada em retângulo no aço mecânico SAE 1045 (k=0.00785)',
    keywords: ['chapa retangulo 1045', '1045', 'retangulo 1045', 'bloco 1045']
  },
  {
    name: 'CHAPA AÇO CARBONO A36',
    category: 'Chapas & Desenhos',
    geometryType: 'chapa',
    constant: 0.00785,
    constantSelect: 'chapa_aco',
    defaultPriceKg: 16.50,
    badge: 'ASTM A36',
    description: 'Chapa estrutural ASTM A36 soldável para caldeiraria e bases (k=0.00785)',
    keywords: ['a36', 'astm a36', 'chapa a36', 'estrutural', 'solda']
  },
  {
    name: 'CORTE A LASER CNC',
    category: 'Chapas & Desenhos',
    geometryType: 'chapa',
    constant: 0.00785,
    constantSelect: 'laser_chapa',
    defaultPriceKg: 22.00,
    badge: 'Laser CNC',
    description: 'Corte de alta precisão em máquina de fibra óptica / laser CNC (k=0.00785)',
    keywords: ['laser', 'corte a laser', 'cnc', 'fibra', 'laser chapa']
  },
  {
    name: 'CORTE PLASMA HD CNC',
    category: 'Chapas & Desenhos',
    geometryType: 'chapa',
    constant: 0.00785,
    constantSelect: 'laser_chapa',
    defaultPriceKg: 19.00,
    badge: 'Plasma HD',
    description: 'Corte a plasma de alta definição para chapas de média e grossa espessura (k=0.00785)',
    keywords: ['plasma', 'plasma hd', 'corte plasma', 'chapa media']
  },
  {
    name: 'OXICORTE CNC CHAPA GROSSA',
    category: 'Chapas & Desenhos',
    geometryType: 'chapa',
    constant: 0.00785,
    constantSelect: 'chapa_aco',
    defaultPriceKg: 18.00,
    badge: 'Oxicorte',
    description: 'Corte térmico oxicorte pantógrafo CNC para blocos e chapas grossas (k=0.00785)',
    keywords: ['oxicorte', 'chapa grossa', 'pantografo', 'bloco grosso']
  },
  {
    name: 'DISCO',
    category: 'Chapas & Desenhos',
    geometryType: 'chapa',
    constant: 0.00785,
    constantSelect: 'laser_chapa',
    defaultPriceKg: 24.00,
    badge: 'Disco',
    description: 'Disco circular ou flange com furação cortada a laser (k=0.00785)',
    keywords: ['disco', 'flange', 'circular', 'furacao', 'laser']
  },
  {
    name: 'FLANGE',
    category: 'Chapas & Desenhos',
    geometryType: 'chapa',
    constant: 0.00785,
    constantSelect: 'laser_chapa',
    defaultPriceKg: 24.00,
    badge: 'Flange',
    description: 'Disco circular ou flange com furação cortada a laser (k=0.00785)',
    keywords: ['disco', 'flange', 'circular', 'furacao', 'laser']
  },
  {
    name: 'BARRA CHATA AÇO 1020',
    category: 'Chapas & Desenhos',
    geometryType: 'chapa',
    constant: 0.00785,
    constantSelect: 'chapa_aco',
    defaultPriceKg: 16.00,
    badge: 'Barra Chata',
    description: 'Barra chata laminada SAE 1020 / A36 (k=0.00785)',
    keywords: ['barra chata', 'chata', '1020', 'perfil chato']
  },
  {
    name: 'CHAPA XADREZ ANTIDERRAPANTE',
    category: 'Chapas & Desenhos',
    geometryType: 'chapa',
    constant: 0.00785,
    constantSelect: 'chapa_aco',
    defaultPriceKg: 17.50,
    badge: 'Piso Xadrez',
    description: 'Chapa estampada antiderrapante piso xadrez (k=0.00785)',
    keywords: ['xadrez', 'antiderrapante', 'piso', 'chapa xadrez']
  },

  // 3. Inox (Aços Inoxidáveis)
  {
    name: 'INOX 304',
    category: 'Inox',
    geometryType: 'macico',
    constant: 0.00800,
    constantSelect: 'inox',
    defaultPriceKg: 45.00,
    badge: 'AISI 304',
    description: 'Aço inoxidável austenítico AISI 304 para indústria alimentícia e química (k=0.00800)',
    keywords: ['inox', '304', 'inox 304', 'aisi 304', 'redondo 304', 'inoxidavel']
  },
  {
    name: 'INOX 304L',
    category: 'Inox',
    geometryType: 'macico',
    constant: 0.00800,
    constantSelect: 'inox',
    defaultPriceKg: 48.00,
    badge: 'AISI 304L',
    description: 'Aço inoxidável AISI 304L com extra baixo teor de carbono para soldagem (k=0.00800)',
    keywords: ['inox', '304l', 'inox 304l', 'aisi 304l']
  },
  {
    name: 'INOX 316',
    category: 'Inox',
    geometryType: 'macico',
    constant: 0.00800,
    constantSelect: 'inox',
    defaultPriceKg: 68.00,
    badge: 'AISI 316',
    description: 'Aço inoxidável austenítico com Molibdênio AISI 316 para ambiente marítimo e ácido (k=0.00800)',
    keywords: ['inox', '316', 'inox 316', 'aisi 316', 'marinho', 'molibdenio']
  },
  {
    name: 'INOX 316L',
    category: 'Inox',
    geometryType: 'macico',
    constant: 0.00800,
    constantSelect: 'inox',
    defaultPriceKg: 72.00,
    badge: 'AISI 316L',
    description: 'Aço inoxidável grau cirúrgico e farmacêutico AISI 316L (k=0.00800)',
    keywords: ['inox', '316l', 'aisi 316l', 'farmaceutico', 'cirurgico']
  },
  {
    name: 'INOX 410',
    category: 'Inox',
    geometryType: 'macico',
    constant: 0.00775,
    constantSelect: 'inox',
    defaultPriceKg: 35.00,
    badge: 'AISI 410',
    description: 'Aço inoxidável martensítico temperável AISI 410 para eixos e lâminas (k=0.00775)',
    keywords: ['inox', '410', 'inox 410', 'aisi 410', 'martensitico']
  },
  {
    name: 'INOX 420',
    category: 'Inox',
    geometryType: 'macico',
    constant: 0.00775,
    constantSelect: 'inox',
    defaultPriceKg: 38.00,
    badge: 'AISI 420',
    description: 'Aço inoxidável martensítico de alta dureza AISI 420 para cutelaria e moldes (k=0.00775)',
    keywords: ['inox', '420', 'inox 420', 'aisi 420', 'dureza']
  },
  {
    name: 'INOX 430',
    category: 'Inox',
    geometryType: 'chapa',
    constant: 0.00775,
    constantSelect: 'inox',
    defaultPriceKg: 34.00,
    badge: 'AISI 430',
    description: 'Aço inoxidável ferrítico magnético AISI 430 para utilidades e painéis (k=0.00775)',
    keywords: ['inox', '430', 'inox 430', 'ferritico', 'magnetico']
  },
  {
    name: 'BARRA CHATA INOX 304',
    category: 'Inox',
    geometryType: 'chapa',
    constant: 0.00800,
    constantSelect: 'inox',
    defaultPriceKg: 47.00,
    badge: 'Chata 304',
    description: 'Barra chata em aço inox AISI 304 para estruturas e suportes sanitários (k=0.00800)',
    keywords: ['barra chata inox', 'chata 304', 'inox barra']
  },

  // 4. Bronze & Latão
  {
    name: 'BRONZE TM 620',
    category: 'Bronze & Latão',
    geometryType: 'macico',
    constant: 0.00880,
    constantSelect: 'bronze',
    defaultPriceKg: 85.00,
    badge: 'TM 620',
    description: 'Bronze nobre TM 620 de alta resistência para buchas pesadas, coroas e mancais (k=0.00880)',
    keywords: ['bronze', 'tm 620', 'tm620', 'bronze tm 620', 'mancal', 'coroa', 'tarugo bronze']
  },
  {
    name: 'BRONZE TM 23',
    category: 'Bronze & Latão',
    geometryType: 'macico',
    constant: 0.00880,
    constantSelect: 'bronze',
    defaultPriceKg: 82.00,
    badge: 'TM 23',
    description: 'Bronze para buchas antifricção TM 23 de excelente usinabilidade (k=0.00880)',
    keywords: ['bronze', 'tm 23', 'tm23', 'bronze tm 23', 'antifriccao']
  },
  {
    name: 'BRONZE SAE 660',
    category: 'Bronze & Latão',
    geometryType: 'macico',
    constant: 0.00880,
    constantSelect: 'bronze',
    defaultPriceKg: 80.00,
    badge: 'SAE 660',
    description: 'Bronze SAE 660 padrão industrial para buchas e guias de deslizamento (k=0.00880)',
    keywords: ['bronze', 'sae 660', '660', 'bronze sae 660', 'deslizamento']
  },
  {
    name: 'BRONZE GRAFITADO (AUTOLUBRIFICANTE)',
    category: 'Bronze & Latão',
    geometryType: 'macico',
    constant: 0.00880,
    constantSelect: 'bronze',
    defaultPriceKg: 95.00,
    badge: 'Grafitado',
    description: 'Bronze sinterizado autolubrificante com grafite para locais de difícil acesso (k=0.00880)',
    keywords: ['bronze grafitado', 'grafitado', 'autolubrificante', 'sinterizado']
  },
  {
    name: 'BRONZE FOSFOROSO SAE 65',
    category: 'Bronze & Latão',
    geometryType: 'macico',
    constant: 0.00880,
    constantSelect: 'bronze',
    defaultPriceKg: 88.00,
    badge: 'SAE 65',
    description: 'Bronze fosforoso SAE 65 de alta elasticidade e resistência à fadiga (k=0.00880)',
    keywords: ['bronze fosforoso', 'sae 65', 'fosforoso']
  },
  {
    name: 'BUCHA DE BRONZE TM 620',
    category: 'Bronze & Latão',
    geometryType: 'bucha',
    constant: 0.00680,
    constantSelect: 'bronze',
    defaultPriceKg: 85.00,
    badge: 'Bucha TM 620',
    description: 'Bucha usinada com furo em Bronze TM 620 sob medida (k=0.00680)',
    keywords: ['bucha bronze', 'bucha tm 620', 'tm 620', 'furo']
  },
  {
    name: 'BUCHA DE BRONZE TM 23',
    category: 'Bronze & Latão',
    geometryType: 'bucha',
    constant: 0.00680,
    constantSelect: 'bronze',
    defaultPriceKg: 82.00,
    badge: 'Bucha TM 23',
    description: 'Bucha usinada com furo em Bronze TM 23 (k=0.00680)',
    keywords: ['bucha bronze tm 23', 'bucha tm 23', 'tm 23']
  },
  {
    name: 'LATÃO CLA (CORTE LIVRE)',
    category: 'Bronze & Latão',
    geometryType: 'macico',
    constant: 0.00850,
    constantSelect: 'latao',
    defaultPriceKg: 75.00,
    badge: 'Latão CLA',
    description: 'Latão liga CuZn39Pb3 CLA para torneamento e usinagem de alta velocidade (k=0.00850)',
    keywords: ['latao', 'latão', 'cla', 'latao cla', 'corte livre', 'amarelo', 'cobre zinco']
  },
  {
    name: 'LATÃO FORJAMENTO',
    category: 'Bronze & Latão',
    geometryType: 'macico',
    constant: 0.00850,
    constantSelect: 'latao',
    defaultPriceKg: 78.00,
    badge: 'Latão Forja',
    description: 'Latão especial para forjamento a quente e matrizes (k=0.00850)',
    keywords: ['latao forjamento', 'forjamento', 'latão forja']
  },
  {
    name: 'LATÃO REDONDO / SEXTAVADO',
    category: 'Bronze & Latão',
    geometryType: 'macico',
    constant: 0.00666,
    constantSelect: 'latao',
    defaultPriceKg: 75.00,
    badge: 'Latão Barra',
    description: 'Barra redonda ou sextavada em Latão CLA para conexões e pinos (k=0.00666)',
    keywords: ['latao redondo', 'latao sextavado', 'barra latao']
  },
  {
    name: 'COBRE ELETROLÍTICO 99.9%',
    category: 'Bronze & Latão',
    geometryType: 'macico',
    constant: 0.00890,
    constantSelect: 'latao',
    defaultPriceKg: 92.00,
    badge: 'Cobre 99.9%',
    description: 'Cobre eletrolítico puro de alta condutividade elétrica e térmica (k=0.00890)',
    keywords: ['cobre', 'cobre eletrolitico', 'barramento cobre', 'eletrico']
  },

  // 5. Tubos & Buchas
  {
    name: 'TUBO MECÂNICO ST 52',
    category: 'Tubos & Buchas',
    geometryType: 'bucha',
    constant: 0.00617,
    constantSelect: 'tubo_mecanico',
    defaultPriceKg: 24.00,
    badge: 'Tubo ST 52',
    description: 'Tubo mecânico sem costura ST 52 para camisas de cilindro e usinagem interna (k=0.00617)',
    keywords: ['tubo mecanico', 'tubo', 'st 52', 'st52', 'sem costura', 'camisa']
  },
  {
    name: 'BUCHA DE AÇO ST 52',
    category: 'Tubos & Buchas',
    geometryType: 'bucha',
    constant: 0.00617,
    constantSelect: 'tubo_mecanico',
    defaultPriceKg: 24.00,
    badge: 'Bucha ST 52',
    description: 'Bucha usinada de precisão em aço estrutural ST 52 (k=0.00617)',
    keywords: ['bucha st52', 'bucha de aco', 'bucha aco', 'st52', 'cilindro']
  },
  {
    name: 'TUBO MECÂNICO SAE 1020',
    category: 'Tubos & Buchas',
    geometryType: 'bucha',
    constant: 0.00617,
    constantSelect: 'tubo_mecanico',
    defaultPriceKg: 21.00,
    badge: 'Tubo 1020',
    description: 'Tubo de aço carbono SAE 1020 para buchas e espaçadores (k=0.00617)',
    keywords: ['tubo 1020', 'tubo mecanico 1020', 'sae 1020']
  },
  {
    name: 'BUCHA AÇO SAE 1045',
    category: 'Tubos & Buchas',
    geometryType: 'bucha',
    constant: 0.00617,
    constantSelect: 'tubo_mecanico',
    defaultPriceKg: 23.00,
    badge: 'Bucha 1045',
    description: 'Bucha usinada em aço mecânico SAE 1045 (k=0.00617)',
    keywords: ['bucha 1045', 'bucha sae 1045', 'bucha']
  },
  {
    name: 'TUBO INDUSTRIAL SCHEDULE 40',
    category: 'Tubos & Buchas',
    geometryType: 'bucha',
    constant: 0.00617,
    constantSelect: 'tubo_mecanico',
    defaultPriceKg: 19.50,
    badge: 'SCH 40',
    description: 'Tubo de condução Schedule 40 para tubulações de pressão e estruturas (k=0.00617)',
    keywords: ['sch 40', 'schedule 40', 'tubo sch 40', 'conducao']
  },

  // 6. Alumínio & Plásticos
  {
    name: 'ALUMÍNIO NAVAL 5052',
    category: 'Alumínio & Plásticos',
    geometryType: 'chapa',
    constant: 0.00270,
    constantSelect: 'aluminio',
    defaultPriceKg: 38.00,
    badge: 'Alumínio 5052',
    description: 'Chapa de liga leve de Alumínio Naval 5052 resistente à corrosão salina (k=0.00270)',
    keywords: ['aluminio', 'aluminio naval', '5052', 'chapa aluminio']
  },
  {
    name: 'ALUMÍNIO ESTRUTURAL 6061 T6',
    category: 'Alumínio & Plásticos',
    geometryType: 'macico',
    constant: 0.00270,
    constantSelect: 'aluminio',
    defaultPriceKg: 42.00,
    badge: 'Alumínio 6061',
    description: 'Tarugo ou barra de Alumínio 6061 T6 de alta resistência mecânica para usinagem (k=0.00270)',
    keywords: ['aluminio 6061', '6061 t6', 'tarugo aluminio', 'redondo aluminio']
  },
  {
    name: 'NYLON 6.0 (POLIAMIDA)',
    category: 'Alumínio & Plásticos',
    geometryType: 'macico',
    constant: 0.00115,
    constantSelect: 'nylon',
    defaultPriceKg: 48.00,
    badge: 'Nylon 6.0',
    description: 'Plástico de engenharia Poliamida Nylon 6.0 para engrenagens, roldanas e buchas (k=0.00115)',
    keywords: ['nylon', 'nylon 6.0', 'poliamida', 'plastico de engenharia', 'tarugo nylon']
  },
  {
    name: 'POLIACETAL (POM / TECNIL)',
    category: 'Alumínio & Plásticos',
    geometryType: 'macico',
    constant: 0.00140,
    constantSelect: 'nylon',
    defaultPriceKg: 55.00,
    badge: 'POM Tecnil',
    description: 'Termoplástico de alta estabilidade dimensional Poliacetal POM / Tecnil (k=0.00140)',
    keywords: ['poliacetal', 'pom', 'tecnil', 'tarugo pom']
  },
  {
    name: 'CELERON MALHA FINA',
    category: 'Alumínio & Plásticos',
    geometryType: 'chapa',
    constant: 0.00140,
    constantSelect: 'nylon',
    defaultPriceKg: 70.00,
    badge: 'Celeron',
    description: 'Laminado técnico termorrígido à base de tecido de algodão e resina fenólica (k=0.00140)',
    keywords: ['celeron', 'malha fina', 'isolante', 'resina fenolica']
  },
  {
    name: 'TEFLON (PTFE PURO)',
    category: 'Alumínio & Plásticos',
    geometryType: 'macico',
    constant: 0.00220,
    constantSelect: 'nylon',
    defaultPriceKg: 120.00,
    badge: 'PTFE',
    description: 'Polímero antiaderente e resistente a altas temperaturas PTFE Teflon (k=0.00220)',
    keywords: ['teflon', 'ptfe', 'tarugo teflon', 'vedacao']
  }
];