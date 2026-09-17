/**
 * Utilitários e cálculos para Entrada de Nota Fiscal e Estoque em Barras de 6 Metros
 * Padrão UsiCorte Metais
 */

export type TipoPerfilNF = 
  | 'Quadrado' 
  | 'Redondo/Barra Maciça' 
  | 'Chapa' 
  | 'Tubo' 
  | 'Barra Chata';

export interface ProdutoPadraoNF {
  id: string;
  nome: string;
  tipoPerfil: TipoPerfilNF;
  tipo: 'barra' | 'perfil' | 'tubo' | 'chapa';
  constanteK: number;
  ncm: string;
  descricao: string;
  exemploBitola?: string;
}

/**
 * 5 Tipos Oficiais solicitados para o dropdown de perfis:
 * 1. Quadrado (k = 0.00785, NCM: 7214.99.10)
 * 2. Redondo/Barra Maciça (k = 0.00617, NCM: 7214.99.10)
 * 3. Chapa (k = 0.00785, NCM: 7208.51.00)
 * 4. Tubo (k = 0.00617, NCM: 7304.39.90)
 * 5. Barra Chata (k = 0.00785, NCM: 7214.91.00)
 */
export const PRODUTOS_PADRAO_NF: ProdutoPadraoNF[] = [
  {
    id: 'quadrado',
    nome: 'Quadrado',
    tipoPerfil: 'Quadrado',
    tipo: 'barra',
    constanteK: 0.00785,
    ncm: '7214.99.10',
    descricao: 'Barra de aço seção quadrada (k = 0,00785)',
    exemploBitola: '50.8'
  },
  {
    id: 'redondo',
    nome: 'Redondo/Barra Maciça',
    tipoPerfil: 'Redondo/Barra Maciça',
    tipo: 'barra',
    constanteK: 0.00617,
    ncm: '7214.99.10',
    descricao: 'Barra redonda maciça de aço carbono / SAE 1020/1045 (k = 0,00617)',
    exemploBitola: '76.2'
  },
  {
    id: 'chapa',
    nome: 'Chapa',
    tipoPerfil: 'Chapa',
    tipo: 'chapa',
    constanteK: 0.00785,
    ncm: '7208.51.00',
    descricao: 'Chapa de aço carbono laminada (k = 0,00785)',
    exemploBitola: '6.35'
  },
  {
    id: 'tubo',
    nome: 'Tubo',
    tipoPerfil: 'Tubo',
    tipo: 'tubo',
    constanteK: 0.00617,
    ncm: '7304.39.90',
    descricao: 'Tubo de aço mecânico / sem costura (k = 0,00617)',
    exemploBitola: '60.3'
  },
  {
    id: 'barra_chata',
    nome: 'Barra Chata',
    tipoPerfil: 'Barra Chata',
    tipo: 'perfil',
    constanteK: 0.00785,
    ncm: '7214.91.00',
    descricao: 'Barra chata de aço carbono laminada (k = 0,00785)',
    exemploBitola: '25.4'
  }
];

export interface CalculoEntradaNFParams {
  bitolaMm: number;
  constanteK: number;
  pesoTotalKgNF: number;
  valorKgNF: number;
  freteTotalNF: number;
  qtdItensNF: number;
  precoVendaKg: number;
  aliquotaIPI?: number; // padrão 3.25% (0.0325)
}

export interface ResultadoCalculoEntradaNF {
  // 1. Peso Teórico de 1 Barra de 6m = (Bitola²) × k × 6
  pesoBarra6m: number;
  // 3. Cálculos automáticos
  qtdBarras6m: number;
  metroLinearTotal: number;
  subtotal: number;
  aliquotaIpiPercent: number;
  ipiValor: number;
  freteRateado: number;
  custoTotalItem: number;
  custoRealKg: number;
  lucroKg: number;
  margemLucroPercent: number;
}

/**
 * Executa todos os cálculos automáticos solicitados para a entrada de Nota Fiscal e estoque em barras de 6m
 */
export function calcularEntradaNotaFiscal({
  bitolaMm,
  constanteK,
  pesoTotalKgNF,
  valorKgNF,
  freteTotalNF,
  qtdItensNF,
  precoVendaKg,
  aliquotaIPI = 0.0325
}: CalculoEntradaNFParams): ResultadoCalculoEntradaNF {
  const bitola = Number(bitolaMm) || 0;
  const k = Number(constanteK) || 0;
  const pesoNF = Number(pesoTotalKgNF) || 0;
  const valorKg = Number(valorKgNF) || 0;
  const frete = Number(freteTotalNF) || 0;
  const qtdItens = Math.max(1, Number(qtdItensNF) || 1);
  const precoVenda = Number(precoVendaKg) || 0;

  // 1. Peso Teórico de 1 Barra de 6 Metros = (Bitola²) × k × 6
  const pesoBarra6m = bitola > 0 && k > 0
    ? Number(((bitola * bitola) * k * 6).toFixed(3))
    : 0;

  // 3.1 Quantidade de Barras de 6 Metros = (Peso Total Kg NF) ÷ (Peso da Barra 6m)
  const qtdBarras6m = pesoBarra6m > 0 && pesoNF > 0
    ? Number((pesoNF / pesoBarra6m).toFixed(2))
    : 0;

  // 3.2 Metro Linear Total = (Quantidade de Barras) × 6
  const metroLinearTotal = Number((qtdBarras6m * 6).toFixed(2));

  // 3.3 Subtotal = Peso Total Kg × Valor Kg NF
  const subtotal = Number((pesoNF * valorKg).toFixed(2));

  // 3.4 IPI (3,25%) = Subtotal × 0,0325
  const ipiValor = Number((subtotal * aliquotaIPI).toFixed(2));

  // 3.5 Frete Rateado por Item = Frete Total ÷ Qtd de Itens na NF
  const freteRateado = Number((frete / qtdItens).toFixed(2));

  // 3.6 Custo Total do Item = Subtotal + IPI + Frete Rateado
  const custoTotalItem = Number((subtotal + ipiValor + freteRateado).toFixed(2));

  // 3.7 Custo Real do Kg = Custo Total ÷ Peso Total Kg
  const custoRealKg = pesoNF > 0
    ? Number((custoTotalItem / pesoNF).toFixed(2))
    : 0;

  // 3.8 Lucro por Kg (R$) = Preço Venda Kg - Custo Real Kg
  const lucroKg = Number((precoVenda - custoRealKg).toFixed(2));

  // 3.9 Margem de Lucro (%) = (Lucro por Kg ÷ Preço Venda Kg) × 100
  const margemLucroPercent = precoVenda > 0
    ? Number(((lucroKg / precoVenda) * 100).toFixed(2))
    : 0;

  return {
    pesoBarra6m,
    qtdBarras6m,
    metroLinearTotal,
    subtotal,
    aliquotaIpiPercent: Number((aliquotaIPI * 100).toFixed(2)),
    ipiValor,
    freteRateado,
    custoTotalItem,
    custoRealKg,
    lucroKg,
    margemLucroPercent
  };
}
