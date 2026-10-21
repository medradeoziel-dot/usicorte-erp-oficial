import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MaterialEstoque } from '../types';
import { 
  PRODUTOS_PADRAO_NF, 
  ProdutoPadraoNF 
} from '../utils/notaFiscalCalculator';
import { formatCurrency, formatWeightKg, formatNumberBR, parseDimensionToMm } from '../utils/calculator';
import { supabase } from '../lib/db';
import { calcularDvModulo11, recalcularChaveAcessoComDvCorreto, formatarChaveAcesso } from '../services/nfeService';
import { 
  FileText, 
  Calculator, 
  Package, 
  Boxes, 
  Truck, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  X, 
  ArrowRight, 
  ShieldCheck, 
  Scale, 
  Barcode, 
  ScanLine, 
  Sparkles, 
  Search, 
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  Layers,
  Loader2,
  Upload,
  FileCode
} from 'lucide-react';

export interface ItemNotaFiscalGrid {
  id: string;
  tipoPerfilId: string;
  nomeItem: string;
  bitolaInput: string;
  constanteK: number;
  ncm: string;
  pesoKg: number | string;
  valorKgNF: number | string;
  precoVendaKg: number | string;
  modoDestino: 'novo' | 'existente';
  materialExistenteId?: string;
  localizacao?: string;
}

export interface EntradaNotaFiscalMultiplosItensDados {
  numeroNF: string;
  fornecedor: string;
  freteTotal: number;
  gerarFinanceiro: boolean;
  custoTotalGeral: number;
  pesoTotalGeralKg: number;
  itens: Array<{
    material: MaterialEstoque;
    isNovo: boolean;
    movimentacao: {
      numeroNF: string;
      pesoKg: number;
      custoTotal: number;
      observacao: string;
      quantidadeBarras: number;
      metroLinear: number;
    };
    custoRealKg: number;
    precoVendaKg: number;
    lucroKg: number;
    margemPercent: number;
  }>;
}

interface DanfeChaveInfoMulti {
  chave: string;
  numeroNF: string;
  emitente: string;
  cnpj: string;
  freteTotal: number;
  valorTotalNota?: number;
  aliquotaIPI?: number;
  isSimulado?: boolean;
  itens: Array<{
    tipoPerfilId: string;
    nomeItem?: string;
    bitolaInput: string;
    constanteK: number;
    ncm: string;
    pesoKg: number;
    valorKgNF: number;
    precoVendaKg: number;
    localizacao?: string;
  }>;
}

const EXEMPLOS_DANFE_MULTI: DanfeChaveInfoMulti[] = [
  {
    chave: '35260904025452000189550010000168371902861370',
    numeroNF: '16837',
    emitente: 'MIEL A.N.E. AÇOS LTDA',
    cnpj: '04.025.452/0001-89',
    freteTotal: 0.00,
    valorTotalNota: 12970.93,
    aliquotaIPI: 0,
    itens: [
      {
        tipoPerfilId: 'quadrado',
        nomeItem: 'QUADRADO 25.40mm TREFILADO SAE 1045',
        bitolaInput: '25.4',
        constanteK: 0.00785,
        ncm: '7215.50.00',
        pesoKg: 183.40,
        valorKgNF: 19.00,
        precoVendaKg: 28.50,
        localizacao: 'Pátio de Barras - Rack B1'
      },
      {
        tipoPerfilId: 'quadrado',
        nomeItem: 'QUADRADO 38.10mm TREFILADO SAE 1045',
        bitolaInput: '38.1',
        constanteK: 0.00785,
        ncm: '7215.50.00',
        pesoKg: 188.30,
        valorKgNF: 19.25,
        precoVendaKg: 28.90,
        localizacao: 'Pátio de Barras - Rack B1'
      },
      {
        tipoPerfilId: 'sextavado',
        nomeItem: 'SEXTAVADO 38.10mm TREFILADO SAE 1045',
        bitolaInput: '38.1',
        constanteK: 0.0068,
        ncm: '7215.50.00',
        pesoKg: 193.00,
        valorKgNF: 16.98,
        precoVendaKg: 25.50,
        localizacao: 'Pátio de Perfis - Rack S1'
      },
      {
        tipoPerfilId: 'redondo',
        nomeItem: 'REDONDO 25.40mm TREFILADO SAE 1045',
        bitolaInput: '25.4',
        constanteK: 0.00617,
        ncm: '7215.50.00',
        pesoKg: 218.00,
        valorKgNF: 11.72,
        precoVendaKg: 21.00,
        localizacao: 'Pátio de Barras - Rack B2'
      }
    ]
  },
  {
    chave: '35240833611500000119550010001048201987654329',
    numeroNF: '104820',
    emitente: 'Gerdau Aços Longos S.A.',
    cnpj: '33.611.500/0001-19',
    freteTotal: 240.00,
    aliquotaIPI: 0.0325,
    itens: [
      {
        tipoPerfilId: 'redondo',
        nomeItem: 'Barra Redonda Laminada 1020/1045 Ø 2" (50.8mm)',
        bitolaInput: '50.8',
        constanteK: 0.00617,
        ncm: '7214.99.10',
        pesoKg: 650.00,
        valorKgNF: 11.20,
        precoVendaKg: 22.00,
        localizacao: 'Pátio de Barras - Rack B1'
      },
      {
        tipoPerfilId: 'quadrado',
        nomeItem: 'Barra Quadrada Laminada A36 50mm',
        bitolaInput: '50',
        constanteK: 0.00785,
        ncm: '7214.99.10',
        pesoKg: 480.00,
        valorKgNF: 11.40,
        precoVendaKg: 21.50,
        localizacao: 'Pátio de Barras - Rack B2'
      },
      {
        tipoPerfilId: 'tubo',
        nomeItem: 'Tubo Mecânico sem Costura ST 52 Ø 60.3mm',
        bitolaInput: '60.3',
        constanteK: 0.00617,
        ncm: '7304.39.90',
        pesoKg: 420.00,
        valorKgNF: 12.80,
        precoVendaKg: 24.00,
        localizacao: 'Pátio de Tubos - Rack T1'
      },
      {
        tipoPerfilId: 'barra_chata',
        nomeItem: 'Barra Chata Laminada 25.4mm x 6000mm',
        bitolaInput: '25.4',
        constanteK: 0.00785,
        ncm: '7214.91.00',
        pesoKg: 300.00,
        valorKgNF: 10.90,
        precoVendaKg: 20.00,
        localizacao: 'Pátio de Perfis - Rack C1'
      }
    ]
  },
  {
    chave: '31240917469701000177550020002154301123456786',
    numeroNF: '215430',
    emitente: 'ArcelorMittal Brasil S.A.',
    cnpj: '17.469.701/0001-77',
    freteTotal: 180.00,
    itens: [
      {
        tipoPerfilId: 'quadrado',
        nomeItem: 'Barra Quadrada Laminada 1045 50mm',
        bitolaInput: '50',
        constanteK: 0.00785,
        ncm: '7214.99.10',
        pesoKg: 1100.00,
        valorKgNF: 10.90,
        precoVendaKg: 21.00,
        localizacao: 'Pátio de Barras - Rack B1'
      },
      {
        tipoPerfilId: 'redondo',
        nomeItem: 'Barra Redonda Aço Especial 4140 Ø 3" (76.2mm)',
        bitolaInput: '76.2',
        constanteK: 0.00617,
        ncm: '7214.99.10',
        pesoKg: 850.00,
        valorKgNF: 16.50,
        precoVendaKg: 29.50,
        localizacao: 'Pátio de Barras - Rack B3'
      },
      {
        tipoPerfilId: 'barra_chata',
        nomeItem: 'Barra Chata 50.8mm',
        bitolaInput: '50.8',
        constanteK: 0.00785,
        ncm: '7214.91.00',
        pesoKg: 500.00,
        valorKgNF: 11.20,
        precoVendaKg: 22.00,
        localizacao: 'Pátio de Perfis - Rack C2'
      }
    ]
  },
  {
    chave: '35240901732997000104550030003412001554433220',
    numeroNF: '341200',
    emitente: 'Açotubo Indústria e Comércio Ltda',
    cnpj: '01.732.997/0001-04',
    freteTotal: 220.00,
    itens: [
      {
        tipoPerfilId: 'tubo',
        nomeItem: 'Tubo Mecânico sem Costura ST 52 Ø 50mm',
        bitolaInput: '50',
        constanteK: 0.00617,
        ncm: '7304.39.90',
        pesoKg: 520.00,
        valorKgNF: 12.80,
        precoVendaKg: 24.50,
        localizacao: 'Pátio de Tubos - Rack T1'
      },
      {
        tipoPerfilId: 'redondo',
        nomeItem: 'Barra Redonda Maciça 1045 Ø 63.5mm (2.1/2")',
        bitolaInput: '63.5',
        constanteK: 0.00617,
        ncm: '7214.99.10',
        pesoKg: 600.00,
        valorKgNF: 12.10,
        precoVendaKg: 23.00,
        localizacao: 'Pátio de Barras - Rack B2'
      },
      {
        tipoPerfilId: 'quadrado',
        nomeItem: 'Barra Quadrada A36 60mm',
        bitolaInput: '60',
        constanteK: 0.00785,
        ncm: '7214.99.10',
        pesoKg: 400.00,
        valorKgNF: 11.60,
        precoVendaKg: 22.00,
        localizacao: 'Pátio de Barras - Rack B1'
      },
      {
        tipoPerfilId: 'barra_chata',
        nomeItem: 'Barra Chata Laminada 38.1mm',
        bitolaInput: '38.1',
        constanteK: 0.00785,
        ncm: '7214.91.00',
        pesoKg: 300.00,
        valorKgNF: 11.30,
        precoVendaKg: 21.00,
        localizacao: 'Pátio de Perfis - Rack C1'
      }
    ]
  },
  {
    chave: '35240761074829000185550010000895401998877667',
    numeroNF: '089540',
    emitente: 'Villares Metals S.A.',
    cnpj: '61.074.829/0001-85',
    freteTotal: 150.00,
    itens: [
      {
        tipoPerfilId: 'redondo',
        nomeItem: 'Barra Redonda Aço Especial 4140 Ø 76.2mm',
        bitolaInput: '76.2',
        constanteK: 0.00617,
        ncm: '7214.99.10',
        pesoKg: 780.00,
        valorKgNF: 17.20,
        precoVendaKg: 31.00,
        localizacao: 'Pátio de Barras - Rack B3'
      },
      {
        tipoPerfilId: 'quadrado',
        nomeItem: 'Barra Quadrada Especial VC131 70mm',
        bitolaInput: '70',
        constanteK: 0.00785,
        ncm: '7214.99.10',
        pesoKg: 520.00,
        valorKgNF: 16.80,
        precoVendaKg: 30.00,
        localizacao: 'Pátio de Barras - Rack B2'
      }
    ]
  },
  {
    chave: '31240901234567000188550010000452301987654320',
    numeroNF: '45230',
    emitente: 'Usiminas Siderúrgica S.A.',
    cnpj: '60.870.004/0001-40',
    freteTotal: 380.00,
    aliquotaIPI: 0.0325,
    valorTotalNota: 28450.00,
    itens: [
      {
        tipoPerfilId: 'chapa',
        nomeItem: 'CHAPA GROSSA CGR 25,00X2440X2900',
        bitolaInput: '25',
        constanteK: 0.00785,
        ncm: '7208.51.00',
        pesoKg: 1385.00,
        valorKgNF: 9.80,
        precoVendaKg: 16.50,
        localizacao: 'Pátio de Chapas'
      },
      {
        tipoPerfilId: 'chapa',
        nomeItem: 'PLACA DE AÇO A36 31,75X1500X3000',
        bitolaInput: '31.75',
        constanteK: 0.00785,
        ncm: '7208.51.00',
        pesoKg: 1120.00,
        valorKgNF: 10.20,
        precoVendaKg: 17.50,
        localizacao: 'Pátio de Chapas'
      }
    ]
  }
];

/**
 * Formata valor numérico de espessura/bitola:
 * - Se número inteiro (ex: "25,00" ou "25.00"), retorna "25"
 * - Se decimal relevante (ex: "25.40", "6,35"), retorna "25.4", "6.35"
 */
function formatarEspessuraNumerica(valStr: string): string {
  if (!valStr) return '50';
  const clean = valStr.replace(',', '.').trim();
  const num = parseFloat(clean);
  if (isNaN(num) || num <= 0) return valStr.trim();
  if (num % 1 === 0) {
    return String(Math.round(num));
  }
  return String(parseFloat(num.toFixed(3)));
}

/**
 * Extração Automática da Espessura / Bitola (mm):
 * - Identifica e extrai a espessura numérica do texto (ex: de "25,00X2440" ou "25.4mm", extrai 25 ou 25.4).
 * - Preenche o campo Bitola/Espessura com o valor extraído (25 mm) em vez de manter o valor padrão de 50 mm.
 */
function extrairEspessuraOuBitola(descricao: string): string {
  if (!descricao) return '50';
  const d = descricao.trim();

  // 1. Padrão dimensional clássico de chapas e perfis (ex: 25,00X2440, 25,00 X 2440 X 2900, 25X2440)
  const matchDimX = d.match(/(?:^|[\sA-Za-z/_-])(\d+(?:[.,]\d+)?)\s*[xX*]\s*\d+/);
  if (matchDimX && matchDimX[1]) {
    const val = formatarEspessuraNumerica(matchDimX[1]);
    if (val && val !== '0') return val;
  }

  // 2. Padrão explícito com indicação de milímetros (ex: 25.4mm, 25,00 mm, 19MM)
  const matchMm = d.match(/(?:^|[\sA-Za-z/_-])(\d+(?:[.,]\d+)?)\s*(?:mm|MM)\b/);
  if (matchMm && matchMm[1]) {
    const val = formatarEspessuraNumerica(matchMm[1]);
    if (val && val !== '0') return val;
  }

  // 3. Rótulo textual explícito de espessura ou bitola (ex: ESP: 25,00, ESP. 25, BITOLA 38.1, E=25)
  const matchRotulo = d.match(/(?:ESP|ESP\.|ESPESSURA|BITOLA|BIT\.|E\s*=)\s*:?\s*(\d+(?:[.,]\d+)?)/i);
  if (matchRotulo && matchRotulo[1]) {
    const val = formatarEspessuraNumerica(matchRotulo[1]);
    if (val && val !== '0') return val;
  }

  // 4. Símbolo de diâmetro (ex: Ø 63.5, Ø25, DIAM 50.8)
  const matchDiam = d.match(/(?:Ø|DIAM|DIÂM|DIAMETRO|DIÂMETRO)\.?\s*:?\s*(\d+(?:[.,]\d+)?)/i);
  if (matchDiam && matchDiam[1]) {
    const val = formatarEspessuraNumerica(matchDiam[1]);
    if (val && val !== '0') return val;
  }

  // 5. Padrão em polegadas fracionárias ou inteiras (ex: 1/2", 2.1/2", 1", 2")
  const matchPol = d.match(/(?:^|[\sA-Za-z])(\d+(?:\s+\d+\/\d+|\/\d+)?|\d+\/\d+|\d+(?:[.,]\d+)?)\s*"/);
  if (matchPol && matchPol[1]) {
    const mmVal = parseDimensionToMm(matchPol[1] + '"');
    if (mmVal > 0) {
      return formatarEspessuraNumerica(String(mmVal));
    }
  }

  return '50';
}

/**
 * Leitura e Mapeamento Inteligente da Descrição (<xProd>):
 * Analisa o texto do produto (ex: "CHAPA GROSSA CGR 25,00X2440X2900"):
 * • Se contiver "CHAPA", "CGR" ou "PLACA", seleciona automaticamente o Perfil: 'Chapa / Placa'.
 * • Se contiver "QUADRADO", seleciona: 'Quadrado (k=0.00785)'.
 * • Se contiver "REDONDO", seleciona: 'Redondo/Barra Maciça (k=0.00617)'.
 * • Se contiver "SEXTAVADO", seleciona: 'Sextavado (k=0.0068)'.
 * • Se contiver "TUBO", seleciona: 'Tubo (k=0.00617)'.
 */
function detectarPerfilEBitola(descricao: string): { 
  tipoPerfilId: string; 
  tipoPerfilNome: string; 
  bitola: string; 
  constanteK: number; 
  ncm: string; 
  isChapa: boolean;
} {
  const d = (descricao || '').toUpperCase();
  let tipoId = 'quadrado';

  // 1. Mapeamento Inteligente por palavras-chave com precedência:
  if (d.includes('CHAPA') || d.includes('CGR') || d.includes('PLACA') || d.includes('CH.') || d.includes('BOBINA')) {
    tipoId = 'chapa';
  } else if (d.includes('QUADRADO') || d.includes('QUADRAD')) {
    tipoId = 'quadrado';
  } else if (d.includes('REDONDO') || d.includes('REDOND') || d.includes('BARRA REDONDA') || d.includes('Ø') || d.includes('CIRCULAR')) {
    tipoId = 'redondo';
  } else if (d.includes('SEXTAVADO') || d.includes('SEXTAVAD')) {
    tipoId = 'sextavado';
  } else if (d.includes('TUBO') || d.includes('TUBULAR') || d.includes('DIN 2391') || d.includes('ST 52')) {
    tipoId = 'tubo';
  } else if (d.includes('CHATO') || d.includes('BARRA CHATA')) {
    tipoId = 'barra_chata';
  } else if (d.includes('CANTONEIRA')) {
    tipoId = 'barra_chata';
  } else if (d.includes('VIGA')) {
    tipoId = 'barra_chata';
  }

  const prod = PRODUTOS_PADRAO_NF.find(p => p.id === tipoId) || PRODUTOS_PADRAO_NF[0];
  const bitola = extrairEspessuraOuBitola(descricao);
  const isChapa = prod.id === 'chapa' || tipoId === 'chapa' || prod.tipoPerfil === 'Chapa / Placa';

  return {
    tipoPerfilId: prod.id,
    tipoPerfilNome: prod.nome,
    bitola,
    constanteK: prod.constanteK,
    ncm: prod.ncm,
    isChapa
  };
}

/**
 * Parser de arquivo XML de NF-e (Padrão SEFAZ)
 */
function parseNFeXml(xmlString: string) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Arquivo XML inválido ou formato corrompido.');
  }

  const infNFe = xmlDoc.querySelector('infNFe');
  const chaveAttr = infNFe?.getAttribute('Id') || '';
  const chave = chaveAttr.replace(/^NFe/, '').replace(/\D/g, '') || (xmlDoc.querySelector('chNFe')?.textContent?.replace(/\D/g, '') || '');

  const nNF = xmlDoc.querySelector('ide > nNF')?.textContent || '';
  const xNome = xmlDoc.querySelector('emit > xNome')?.textContent || '';
  const cnpjRaw = xmlDoc.querySelector('emit > CNPJ')?.textContent || '';
  const cnpj = cnpjRaw.length === 14 
    ? `${cnpjRaw.slice(0, 2)}.${cnpjRaw.slice(2, 5)}.${cnpjRaw.slice(5, 8)}/${cnpjRaw.slice(8, 12)}-${cnpjRaw.slice(12, 14)}`
    : cnpjRaw;

  const vFrete = parseFloat(xmlDoc.querySelector('total > ICMSTot > vFrete')?.textContent || '0') || 0;
  const vNF = parseFloat(xmlDoc.querySelector('total > ICMSTot > vNF')?.textContent || '0') || 0;
  const pesoL = parseFloat(xmlDoc.querySelector('transp > vol > pesoL')?.textContent || '0') || 0;
  const pesoB = parseFloat(xmlDoc.querySelector('transp > vol > pesoB')?.textContent || '0') || 0;
  const vIPI = parseFloat(xmlDoc.querySelector('total > ICMSTot > vIPI')?.textContent || '0') || 0;

  const dets = Array.from(xmlDoc.querySelectorAll('det'));
  const itens: ItemNotaFiscalGrid[] = dets.map((det, idx) => {
    const xProd = det.querySelector('prod > xProd')?.textContent || `Item ${idx + 1}`;
    const ncm = det.querySelector('prod > NCM')?.textContent || '7214.99.10';
    const qCom = parseFloat(det.querySelector('prod > qCom')?.textContent || det.querySelector('prod > qTrib')?.textContent || '0') || 0;
    const vUnCom = parseFloat(det.querySelector('prod > vUnCom')?.textContent || det.querySelector('prod > vUnTrib')?.textContent || '0') || 0;
    const pIPI = parseFloat(det.querySelector('imposto > IPI > IPITrib > pIPI')?.textContent || '0') || 0;

    const perfilInfo = detectarPerfilEBitola(xProd);

    return {
      id: `item-xml-${idx}-${Date.now()}`,
      tipoPerfilId: perfilInfo.tipoPerfilId,
      nomeItem: xProd,
      bitolaInput: perfilInfo.bitola,
      constanteK: perfilInfo.constanteK,
      ncm: ncm || perfilInfo.ncm,
      pesoKg: qCom > 0 ? qCom : '',
      valorKgNF: vUnCom > 0 ? vUnCom : '',
      precoVendaKg: vUnCom > 0 ? Number((vUnCom * 1.85).toFixed(2)) : '',
      modoDestino: 'novo',
      localizacao: perfilInfo.isChapa ? 'Pátio de Chapas' : 'Pátio de Barras'
    };
  });

  return {
    chave,
    numeroNF: nNF,
    fornecedor: cnpj ? `${xNome} (CNPJ: ${cnpj})` : xNome,
    emitente: xNome,
    cnpj,
    freteTotal: vFrete,
    valorTotalNota: vNF,
    pesoLiquido: pesoL,
    pesoBruto: pesoB,
    aliquotaIPI: vNF > 0 && vIPI > 0 ? (vIPI / vNF) : 0,
    itens
  };
}

function decodificarChaveAcessoDanfeMulti(chaveInput: string): DanfeChaveInfoMulti | null {
  const digits = chaveInput.replace(/\D/g, '');
  if (!digits) return null;

  // 1. Preset conhecido pré-cadastrado na simulação
  const preset = EXEMPLOS_DANFE_MULTI.find(
    ex => ex.chave === digits || 
          (digits.length >= 4 && digits.length < 44 && ex.chave.includes(digits)) || 
          digits === ex.numeroNF ||
          digits === ex.numeroNF.replace(/\D/g, '') ||
          digits === ex.cnpj.replace(/\D/g, '')
  );
  if (preset) {
    return { ...preset, isSimulado: true };
  }

  // 2. Chave de 44 dígitos oficial de NF-e NÃO cadastrada na simulação
  if (digits.length === 44) {
    const cnpjRaw = digits.slice(6, 20);
    const cnpjFormatado = `${cnpjRaw.slice(0, 2)}.${cnpjRaw.slice(2, 5)}.${cnpjRaw.slice(5, 8)}/${cnpjRaw.slice(8, 12)}-${cnpjRaw.slice(12, 14)}`;
    const numNFNum = parseInt(digits.slice(25, 34), 10);
    const numNFStr = String(numNFNum || digits.slice(25, 34));

    return {
      chave: digits,
      numeroNF: numNFStr,
      emitente: `Fornecedor (CNPJ: ${cnpjFormatado})`,
      cnpj: cnpjFormatado,
      freteTotal: 0,
      valorTotalNota: undefined,
      aliquotaIPI: 0,
      isSimulado: false,
      itens: [] // Grade vazia para preenchimento manual
    };
  }

  // 3. Usuário digitou o número da NF diretamente (não simulada)
  if (digits.length >= 4 && digits.length <= 10) {
    return {
      chave: digits,
      numeroNF: digits,
      emitente: '',
      cnpj: '',
      freteTotal: 0,
      isSimulado: false,
      itens: []
    };
  }

  return null;
}

interface EntradaNotaFiscalModalProps {
  isOpen: boolean;
  onClose: () => void;
  materiaisExistentes: MaterialEstoque[];
  materialPreSelecionado?: MaterialEstoque | null;
  onConfirmarEntrada?: (dados: {
    material: MaterialEstoque;
    isNovo: boolean;
    movimentacao: {
      numeroNF: string;
      pesoKg: number;
      custoTotal: number;
      observacao: string;
      quantidadeBarras: number;
      metroLinear: number;
    };
    gerarFinanceiro: boolean;
    dadosFinanceiro?: {
      descricao: string;
      fornecedor: string;
      valor: number;
      numeroNF: string;
    };
  }) => void;
  onConfirmarMultiplosItens?: (dados: EntradaNotaFiscalMultiplosItensDados) => Promise<void> | void;
}

function criarItemPadrao(index: number, tipoId = 'quadrado', bitola = ''): ItemNotaFiscalGrid {
  const prod = PRODUTOS_PADRAO_NF.find(p => p.id === tipoId) || PRODUTOS_PADRAO_NF[0];
  return {
    id: `item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    tipoPerfilId: prod.id,
    nomeItem: '',
    bitolaInput: bitola,
    constanteK: prod.constanteK,
    ncm: prod.ncm,
    pesoKg: '',
    valorKgNF: '',
    precoVendaKg: '',
    modoDestino: 'novo',
    localizacao: 'Pátio de Barras'
  };
}

export default function EntradaNotaFiscalModal({
  isOpen,
  onClose,
  materiaisExistentes,
  materialPreSelecionado,
  onConfirmarEntrada,
  onConfirmarMultiplosItens
}: EntradaNotaFiscalModalProps) {
  // 1. Cabeçalho Geral da NF (Topo)
  const [chaveAcessoInput, setChaveAcessoInput] = useState<string>('35260904025452000189550010000168371902861370');
  const [isConsultandoSefaz, setIsConsultandoSefaz] = useState<boolean>(false);
  const [leituraStatus, setLeituraStatus] = useState<{
    tipo: 'idle' | 'sucesso' | 'erro' | 'aviso' | 'carregando';
    mensagem: string;
    detalhes?: {
      numeroNF: string;
      emitente: string;
      cnpj?: string;
      qtdItens: number;
      valorTotalNota?: number;
      pesoTotalKg?: number;
      pesoLiquido?: number;
      pesoBruto?: number;
    };
  }>({
    tipo: 'sucesso',
    mensagem: 'DANFE NF-16837 carregado: MIEL A.N.E. AÇOS LTDA (4 itens trefilados SAE 1045 - 782,70 Kg)',
    detalhes: {
      numeroNF: '16837',
      emitente: 'MIEL A.N.E. AÇOS LTDA',
      cnpj: '04.025.452/0001-89',
      qtdItens: 4,
      valorTotalNota: 12970.93,
      pesoTotalKg: 782.70,
      pesoLiquido: 782.70,
      pesoBruto: 785.00
    }
  });
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const fileXmlInputRef = useRef<HTMLInputElement>(null);

  // Campos Globais da NF
  const [numeroNF, setNumeroNF] = useState<string>('NF-16837');
  const [fornecedor, setFornecedor] = useState<string>('MIEL A.N.E. AÇOS LTDA (CNPJ: 04.025.452/0001-89)');
  const [freteTotalNF, setFreteTotalNF] = useState<number | string>(0.00);
  const [pesoLiquidoNF, setPesoLiquidoNF] = useState<number | string>(782.70);
  const [pesoBrutoNF, setPesoBrutoNF] = useState<number | string>(785.00);
  const [valorTotalDanfeDeclarado, setValorTotalDanfeDeclarado] = useState<number | string>(12970.93);
  const [aliquotaIpiPercent, setAliquotaIpiPercent] = useState<number | string>(0);
  const [gerarContasPagar, setGerarContasPagar] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Toast / Notificação de Sucesso após Salvar
  const [toastSucesso, setToastSucesso] = useState<{
    visivel: boolean;
    mensagem: string;
    detalhe?: string;
  }>({ visivel: false, mensagem: '' });

  useEffect(() => {
    if (toastSucesso.visivel) {
      const timer = setTimeout(() => {
        setToastSucesso(prev => ({ ...prev, visivel: false }));
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [toastSucesso.visivel]);

  // Função unificada de Reset Geral da Nota Fiscal
  const handleResetGeral = (manterFoco = true) => {
    setChaveAcessoInput('');
    setNumeroNF('');
    setFornecedor('');
    setFreteTotalNF('');
    setPesoLiquidoNF('');
    setPesoBrutoNF('');
    setValorTotalDanfeDeclarado('');
    setAliquotaIpiPercent(0);
    setItens([]);
    setIsConsultandoSefaz(false);
    setLeituraStatus({ tipo: 'idle', mensagem: '' });
    if (manterFoco) {
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 80);
    }
  };

  // 2. Tabela de Itens da NF (Grade Multi-Itens)
  const [itens, setItens] = useState<ItemNotaFiscalGrid[]>([
    {
      id: 'item-danfe-16837-1',
      tipoPerfilId: 'quadrado',
      nomeItem: 'QUADRADO 25.40mm TREFILADO SAE 1045',
      bitolaInput: '25.4',
      constanteK: 0.00785,
      ncm: '7215.50.00',
      pesoKg: 183.40,
      valorKgNF: 19.00,
      precoVendaKg: 28.50,
      modoDestino: 'novo',
      localizacao: 'Pátio de Barras - Rack B1'
    },
    {
      id: 'item-danfe-16837-2',
      tipoPerfilId: 'quadrado',
      nomeItem: 'QUADRADO 38.10mm TREFILADO SAE 1045',
      bitolaInput: '38.1',
      constanteK: 0.00785,
      ncm: '7215.50.00',
      pesoKg: 188.30,
      valorKgNF: 19.25,
      precoVendaKg: 28.90,
      modoDestino: 'novo',
      localizacao: 'Pátio de Barras - Rack B1'
    },
    {
      id: 'item-danfe-16837-3',
      tipoPerfilId: 'sextavado',
      nomeItem: 'SEXTAVADO 38.10mm TREFILADO SAE 1045',
      bitolaInput: '38.1',
      constanteK: 0.0068,
      ncm: '7215.50.00',
      pesoKg: 193.00,
      valorKgNF: 16.98,
      precoVendaKg: 25.50,
      modoDestino: 'novo',
      localizacao: 'Pátio de Perfis - Rack S1'
    },
    {
      id: 'item-danfe-16837-4',
      tipoPerfilId: 'redondo',
      nomeItem: 'REDONDO 25.40mm TREFILADO SAE 1045',
      bitolaInput: '25.4',
      constanteK: 0.00617,
      ncm: '7215.50.00',
      pesoKg: 218.00,
      valorKgNF: 11.72,
      precoVendaKg: 21.00,
      modoDestino: 'novo',
      localizacao: 'Pátio de Barras - Rack B2'
    }
  ]);

  // Foco inicial no campo de código de barras
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setChaveAcessoInput('');
      setLeituraStatus({ tipo: 'idle', mensagem: '' });
    }
  }, [isOpen]);

  // Se abrir com um material pré-selecionado pelo usuário
  useEffect(() => {
    if (isOpen && materialPreSelecionado) {
      const prod = PRODUTOS_PADRAO_NF.find(p => 
        p.tipo === materialPreSelecionado.tipo || 
        materialPreSelecionado.nome.toLowerCase().includes(p.tipoPerfil.toLowerCase())
      ) || PRODUTOS_PADRAO_NF[0];

      const itemPreSel: ItemNotaFiscalGrid = {
        id: `item-pre-${Date.now()}`,
        tipoPerfilId: prod.id,
        nomeItem: materialPreSelecionado.nome,
        bitolaInput: materialPreSelecionado.espessuraMm ? String(materialPreSelecionado.espessuraMm) : '50',
        constanteK: materialPreSelecionado.constanteK || prod.constanteK,
        ncm: materialPreSelecionado.ncm || prod.ncm,
        pesoKg: 600.00,
        valorKgNF: materialPreSelecionado.custoKg > 0 ? materialPreSelecionado.custoKg : 11.50,
        precoVendaKg: materialPreSelecionado.precoVendaKg > 0 ? materialPreSelecionado.precoVendaKg : 22.00,
        modoDestino: 'existente',
        materialExistenteId: materialPreSelecionado.id,
        localizacao: materialPreSelecionado.localizacao || 'Pátio de Barras'
      };

      setItens([itemPreSel]);
      if (materialPreSelecionado.fornecedor) {
        setFornecedor(materialPreSelecionado.fornecedor);
      }
    }
  }, [isOpen, materialPreSelecionado]);

  // Processa a leitura do código de barras ou chave de 44 dígitos
  const handleProcessarLeituraDanfe = async (chaveParaProcessar?: string) => {
    const chave = (chaveParaProcessar !== undefined ? chaveParaProcessar : chaveAcessoInput).trim();
    const digits = chave.replace(/\D/g, '');

    if (!digits) {
      setLeituraStatus({
        tipo: 'erro',
        mensagem: 'Por favor, bipe o código de barras ou digite a chave de acesso da NF-e (44 dígitos).'
      });
      barcodeInputRef.current?.focus();
      return;
    }

    // 1. Chave de 44 dígitos: Aciona Supabase Edge Function 'consulta-nfe'
    if (digits.length === 44) {
      setIsConsultandoSefaz(true);
      setLeituraStatus({
        tipo: 'carregando',
        mensagem: 'Consultando SEFAZ via Edge Function...'
      });

      try {
        const chaveAcesso = digits;
        // Chamada oficial à Supabase Edge Function conforme especificação
        const { data, error } = await supabase.functions.invoke('consulta-nfe', {
          body: { chave: chaveAcesso }
        });

        if (error) {
          throw error;
        }

        const payload = data?.nfe || data?.dados || data?.data || data;

        if (!payload || payload?.erro || payload?.error || payload?.sucesso === false) {
          throw new Error(payload?.mensagem || payload?.error || payload?.erro || 'Erro retornado pela SEFAZ.');
        }

        // Extrai informações do cabeçalho
        const cnpjRaw = String(payload.cnpj || payload.cnpjEmitente || payload.emit?.CNPJ || digits.slice(6, 20)).replace(/\D/g, '');
        const cnpjFormatado = cnpjRaw.length === 14
          ? `${cnpjRaw.slice(0, 2)}.${cnpjRaw.slice(2, 5)}.${cnpjRaw.slice(5, 8)}/${cnpjRaw.slice(8, 12)}-${cnpjRaw.slice(12, 14)}`
          : cnpjRaw;

        const numNFNum = parseInt(String(payload.numeroNF || payload.numero || payload.nNF || payload.ide?.nNF || digits.slice(25, 34)), 10);
        const numNFStr = String(numNFNum || digits.slice(25, 34));
        const nfFormatada = numNFStr.startsWith('NF-') ? numNFStr : `NF-${numNFStr}`;

        const razaoSocial = String(payload.razaoSocial || payload.fornecedor || payload.razao_social || payload.emitente || payload.emit?.xNome || `Fornecedor (${cnpjFormatado})`);
        const frete = parseFloat(String(payload.freteTotal ?? payload.frete ?? payload.valorFrete ?? payload.vFrete ?? 0)) || 0;
        const pesoLiq = parseFloat(String(payload.pesoLiquido ?? payload.peso_liquido ?? payload.pesoLiq ?? payload.transp?.vol?.pesoL ?? 0)) || 0;
        const pesoBruto = parseFloat(String(payload.pesoBruto ?? payload.peso_bruto ?? payload.pesoB ?? payload.transp?.vol?.pesoB ?? 0)) || 0;
        const valorTotalNota = parseFloat(String(payload.valorTotalNota ?? payload.valorTotal ?? payload.vNF ?? 0)) || undefined;
        const aliqIPI = parseFloat(String(payload.aliquotaIPI ?? payload.aliquota_ipi ?? 0)) || 0;

        // Atualiza campos gerais
        setNumeroNF(nfFormatada);
        setFornecedor(cnpjFormatado ? `${razaoSocial} (CNPJ: ${cnpjFormatado})` : razaoSocial);
        setFreteTotalNF(frete > 0 ? frete : '');
        setPesoLiquidoNF(pesoLiq > 0 ? pesoLiq : '');
        setPesoBrutoNF(pesoBruto > 0 ? pesoBruto : '');
        if (valorTotalNota !== undefined) {
          setValorTotalDanfeDeclarado(valorTotalNota);
        }
        if (aliqIPI > 0) {
          setAliquotaIpiPercent(aliqIPI > 1 ? aliqIPI : Number((aliqIPI * 100).toFixed(2)));
        }

        // Itens retornados pela API
        const rawItens: any[] = payload.itens || payload.produtos || payload.det || payload.items || [];

        if (rawItens.length > 0) {
          const novasLinhas: ItemNotaFiscalGrid[] = rawItens.map((it: any, idx: number) => {
            const desc = String(it.descricao || it.nome || it.nomeItem || it.xProd || it.produto || `Item ${idx + 1}`);
            const perfilAuto = detectarPerfilEBitola(desc);
            const tipoPerfilId = it.tipoPerfilId || perfilAuto.tipoPerfilId;
            const prod = PRODUTOS_PADRAO_NF.find(p => p.id === tipoPerfilId) || PRODUTOS_PADRAO_NF[0];
            const bitolaInput = String(it.bitolaInput || it.bitola || perfilAuto.bitola);
            const ncm = String(it.ncm || it.NCM || perfilAuto.ncm);
            const pesoKg = parseFloat(String(it.pesoKg ?? it.peso ?? it.peso_kg ?? it.qCom ?? it.quantidade ?? 0)) || 0;
            const valorKgNF = parseFloat(String(it.valorKgNF ?? it.valorKg ?? it.valor_kg ?? it.valorUnitario ?? it.vUnCom ?? 0)) || 0;
            const precoVendaKg = parseFloat(String(it.precoVendaKg ?? it.precoVenda ?? 0)) || (valorKgNF > 0 ? Number((valorKgNF * 1.85).toFixed(2)) : '');
            const aliqIPIItem = parseFloat(String(it.aliquotaIPI ?? it.ipi ?? it.pIPI ?? 0)) || undefined;

            return {
              id: `item-sefaz-${idx}-${Date.now()}`,
              tipoPerfilId: prod.id,
              nomeItem: desc,
              bitolaInput,
              constanteK: it.constanteK || prod.constanteK,
              ncm,
              pesoKg: pesoKg > 0 ? pesoKg : '',
              valorKgNF: valorKgNF > 0 ? valorKgNF : '',
              precoVendaKg,
              aliquotaIPI: aliqIPIItem,
              modoDestino: 'novo',
              localizacao: perfilAuto.isChapa ? 'Pátio de Chapas' : 'Pátio de Barras'
            };
          });

          setItens(novasLinhas);

          setLeituraStatus({
            tipo: 'sucesso',
            mensagem: `SEFAZ: NF-${numNFStr} consultada com sucesso via Edge Function! ${novasLinhas.length} itens importados.`,
            detalhes: {
              numeroNF: numNFStr,
              emitente: razaoSocial,
              cnpj: cnpjFormatado,
              qtdItens: novasLinhas.length,
              valorTotalNota,
              pesoTotalKg: novasLinhas.reduce((acc, it) => acc + (Number(it.pesoKg) || 0), 0),
              pesoLiquido: pesoLiq,
              pesoBruto: pesoBruto
            }
          });
        } else {
          setItens([]);
          setLeituraStatus({
            tipo: 'aviso',
            mensagem: `Dados da NF-${numNFStr} obtidos na SEFAZ. Nenhum produto discriminado no retorno. Adicione as linhas manualmente ou importe o XML.`,
            detalhes: {
              numeroNF: numNFStr,
              emitente: razaoSocial,
              cnpj: cnpjFormatado,
              qtdItens: 0,
              pesoLiquido: pesoLiq,
              pesoBruto: pesoBruto
            }
          });
        }
      } catch (err: any) {
        console.warn('Erro na chamada da Edge Function "consulta-nfe":', err);
        const errStr = String(err?.message || err?.error_description || err || '').toLowerCase();

        // Verifica se a chave corresponde a um preset de simulação cadastrado para testes
        const preset = EXEMPLOS_DANFE_MULTI.find(ex => ex.chave === digits);
        if (preset) {
          const nfFormatada = preset.numeroNF.startsWith('NF-') ? preset.numeroNF : `NF-${preset.numeroNF}`;
          setNumeroNF(nfFormatada);
          setFornecedor(preset.cnpj ? `${preset.emitente} (CNPJ: ${preset.cnpj})` : preset.emitente);
          setFreteTotalNF(preset.freteTotal || '');
          setPesoLiquidoNF(782.70);
          setPesoBrutoNF(785.00);
          if (preset.valorTotalNota !== undefined) setValorTotalDanfeDeclarado(preset.valorTotalNota);
          if (preset.aliquotaIPI !== undefined) setAliquotaIpiPercent(Number((preset.aliquotaIPI * 100).toFixed(2)));

          const novasLinhas: ItemNotaFiscalGrid[] = preset.itens.map((it, idx) => {
            const prod = PRODUTOS_PADRAO_NF.find(p => p.id === it.tipoPerfilId) || PRODUTOS_PADRAO_NF[0];
            const bitolaMm = parseDimensionToMm(it.bitolaInput);
            const prefix = prod.tipoPerfil === 'Redondo/Barra Maciça' ? 'Redondo Maciço' : prod.tipoPerfil;
            return {
              id: `item-danfe-${idx}-${Date.now()}`,
              tipoPerfilId: prod.id,
              nomeItem: it.nomeItem || `${prefix} ${bitolaMm > 0 ? `${bitolaMm}mm` : ''} x 6000mm`.trim(),
              bitolaInput: it.bitolaInput,
              constanteK: it.constanteK || prod.constanteK,
              ncm: it.ncm || prod.ncm,
              pesoKg: it.pesoKg,
              valorKgNF: it.valorKgNF,
              precoVendaKg: it.precoVendaKg,
              modoDestino: 'novo',
              localizacao: it.localizacao || 'Pátio de Barras'
            };
          });

          setItens(novasLinhas);

          setLeituraStatus({
            tipo: 'sucesso',
            mensagem: `DANFE NF-${preset.numeroNF} carregado (simulação com ${preset.itens.length} itens). Em produção com Certificado A1 ativo, a SEFAZ é consultada em tempo real.`,
            detalhes: {
              numeroNF: preset.numeroNF,
              emitente: preset.emitente,
              cnpj: preset.cnpj,
              qtdItens: preset.itens.length,
              valorTotalNota: preset.valorTotalNota,
              pesoTotalKg: preset.itens.reduce((acc, it) => acc + (Number(it.pesoKg) || 0), 0),
              pesoLiquido: 782.70,
              pesoBruto: 785.00
            }
          });
          return;
        }

        // Tratamento de Erros conforme especificação do usuário:
        // "Se a nota ainda não foi manifestada ou o Certificado A1 não estiver configurado, exiba um aviso orientando a importar o arquivo XML ou preencher manualmente."
        const cnpjRaw = digits.slice(6, 20);
        const cnpjFormatado = `${cnpjRaw.slice(0, 2)}.${cnpjRaw.slice(2, 5)}.${cnpjRaw.slice(5, 8)}/${cnpjRaw.slice(8, 12)}-${cnpjRaw.slice(12, 14)}`;
        const numNFNum = parseInt(digits.slice(25, 34), 10);
        const numNFStr = String(numNFNum || digits.slice(25, 34));

        setNumeroNF(`NF-${numNFStr}`);
        setFornecedor(`Fornecedor (CNPJ: ${cnpjFormatado})`);
        setItens([]);

        let avisoCustomizado = 'Não foi possível consultar a SEFAZ diretamente: a nota ainda não foi manifestada ou o Certificado A1 não está configurado na Edge Function. Importe o arquivo XML da NF-e abaixo ou adicione e preencha os itens manualmente.';

        if (errStr.includes('manifest') || errStr.includes('ciencia') || errStr.includes('ciência') || errStr.includes('evento')) {
          avisoCustomizado = 'A nota fiscal ainda não foi manifestada na SEFAZ. É necessário realizar a Manifestação do Destinatário (Ciência da Emissão ou Confirmação da Operação) para liberar a consulta do XML completo. Importe o arquivo XML da NF-e ou preencha a grade manualmente abaixo.';
        } else if (errStr.includes('certificad') || errStr.includes('a1') || errStr.includes('pfx')) {
          avisoCustomizado = 'Certificado Digital A1 não configurado na Edge Function do Supabase. Para consulta automatizada de qualquer nota em tempo real, configure o Certificado A1. Você pode importar o arquivo XML da NF-e diretamente ou preencher os itens manualmente.';
        }

        setLeituraStatus({
          tipo: 'aviso',
          mensagem: avisoCustomizado,
          detalhes: {
            numeroNF: numNFStr,
            emitente: `CNPJ: ${cnpjFormatado}`,
            cnpj: cnpjFormatado,
            qtdItens: 0
          }
        });
      } finally {
        setIsConsultandoSefaz(false);
      }
      return;
    }

    // 2. Chaves menores ou presets locais
    const info = decodificarChaveAcessoDanfeMulti(chave);
    if (!info) {
      setLeituraStatus({
        tipo: 'erro',
        mensagem: 'Chave de acesso não reconhecida. Verifique se foram digitados ou bipados os 44 dígitos da NF-e.'
      });
      return;
    }

    const nfFormatada = info.numeroNF.startsWith('NF-') ? info.numeroNF : `NF-${info.numeroNF}`;
    setNumeroNF(nfFormatada);
    setFornecedor(info.cnpj ? `${info.emitente} (CNPJ: ${info.cnpj})` : info.emitente);
    setFreteTotalNF(info.freteTotal || '');
    if (info.valorTotalNota !== undefined) setValorTotalDanfeDeclarado(info.valorTotalNota);
    if (info.aliquotaIPI !== undefined) setAliquotaIpiPercent(Number((info.aliquotaIPI * 100).toFixed(2)));

    if (!info.isSimulado || info.itens.length === 0) {
      setItens([]);
      setLeituraStatus({
        tipo: 'aviso',
        mensagem: 'Chave de Acesso informada! A nota ainda não foi manifestada ou o Certificado A1 não está configurado. Importe o arquivo XML ou preencha os itens manualmente abaixo.',
        detalhes: {
          numeroNF: info.numeroNF,
          emitente: info.emitente,
          cnpj: info.cnpj,
          qtdItens: 0
        }
      });
      return;
    }

    const novasLinhas: ItemNotaFiscalGrid[] = info.itens.map((it, idx) => {
      const prod = PRODUTOS_PADRAO_NF.find(p => p.id === it.tipoPerfilId) || PRODUTOS_PADRAO_NF[0];
      const bitolaMm = parseDimensionToMm(it.bitolaInput);
      const prefix = prod.tipoPerfil === 'Redondo/Barra Maciça' ? 'Redondo Maciço' : prod.tipoPerfil;
      return {
        id: `item-danfe-${idx}-${Date.now()}`,
        tipoPerfilId: prod.id,
        nomeItem: it.nomeItem || `${prefix} ${bitolaMm > 0 ? `${bitolaMm}mm` : ''} x 6000mm`.trim(),
        bitolaInput: it.bitolaInput,
        constanteK: it.constanteK || prod.constanteK,
        ncm: it.ncm || prod.ncm,
        pesoKg: it.pesoKg,
        valorKgNF: it.valorKgNF,
        precoVendaKg: it.precoVendaKg,
        modoDestino: 'novo',
        localizacao: it.localizacao || 'Pátio de Barras'
      };
    });

    setItens(novasLinhas);
    setLeituraStatus({
      tipo: 'sucesso',
      mensagem: `DANFE NF-${info.numeroNF} carregado com sucesso! ${info.itens.length} itens na grade com peso e valores reais da NF.`,
      detalhes: {
        numeroNF: info.numeroNF,
        emitente: info.emitente,
        cnpj: info.cnpj,
        qtdItens: info.itens.length,
        valorTotalNota: info.valorTotalNota,
        pesoTotalKg: info.itens.reduce((acc, it) => acc + (Number(it.pesoKg) || 0), 0)
      }
    });
  };

  const handleXmlFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const xmlText = event.target?.result as string;
        const parsed = parseNFeXml(xmlText);

        if (parsed.chave) setChaveAcessoInput(parsed.chave);
        if (parsed.numeroNF) setNumeroNF(parsed.numeroNF.startsWith('NF-') ? parsed.numeroNF : `NF-${parsed.numeroNF}`);
        if (parsed.fornecedor) setFornecedor(parsed.fornecedor);
        if (parsed.freteTotal > 0) setFreteTotalNF(parsed.freteTotal);
        if (parsed.pesoLiquido > 0) setPesoLiquidoNF(parsed.pesoLiquido);
        if (parsed.pesoBruto > 0) setPesoBrutoNF(parsed.pesoBruto);
        if (parsed.valorTotalNota > 0) setValorTotalDanfeDeclarado(parsed.valorTotalNota);
        if (parsed.aliquotaIPI > 0) setAliquotaIpiPercent(Number((parsed.aliquotaIPI * 100).toFixed(2)));

        if (parsed.itens && parsed.itens.length > 0) {
          setItens(parsed.itens);
          setLeituraStatus({
            tipo: 'sucesso',
            mensagem: `Arquivo XML importado com sucesso! NF-${parsed.numeroNF} (${parsed.itens.length} itens adicionados à grade).`,
            detalhes: {
              numeroNF: parsed.numeroNF,
              emitente: parsed.emitente,
              cnpj: parsed.cnpj,
              qtdItens: parsed.itens.length,
              valorTotalNota: parsed.valorTotalNota,
              pesoTotalKg: parsed.itens.reduce((acc, it) => acc + (Number(it.pesoKg) || 0), 0),
              pesoLiquido: parsed.pesoLiquido,
              pesoBruto: parsed.pesoBruto
            }
          });
        } else {
          setItens([]);
          setLeituraStatus({
            tipo: 'aviso',
            mensagem: `XML lido (NF-${parsed.numeroNF}), porém nenhum produto foi localizado na tag <det>. Preencha a grade manualmente.`,
            detalhes: {
              numeroNF: parsed.numeroNF,
              emitente: parsed.emitente,
              cnpj: parsed.cnpj,
              qtdItens: 0
            }
          });
        }
      } catch (err: any) {
        setLeituraStatus({
          tipo: 'erro',
          mensagem: `Erro ao processar arquivo XML da NF-e: ${err.message || 'Formato XML inválido.'}`
        });
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleChaveInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setChaveAcessoInput(val);
    
    // Ao apagar a Chave de Acesso (campo vazio), executa a mesma função de reset geral
    if (!val.trim()) {
      handleResetGeral(true);
      return;
    }

    const digits = val.replace(/\D/g, '');
    if (digits.length === 44) {
      handleProcessarLeituraDanfe(val);
    }
  };

  // Manipulação de Linhas na Tabela
  const handleAddItemLinha = () => {
    const novo = criarItemPadrao(itens.length + 1, 'quadrado', '');
    setItens(prev => [...prev, novo]);
  };

  const handleDuplicarLinha = (item: ItemNotaFiscalGrid) => {
    const copia: ItemNotaFiscalGrid = {
      ...item,
      id: `item-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nomeItem: `${item.nomeItem} (Cópia)`
    };
    setItens(prev => [...prev, copia]);
  };

  const handleRemoverLinha = (id: string) => {
    setItens(prev => prev.filter(i => i.id !== id));
  };

  const handleUpdateItem = (id: string, campo: keyof ItemNotaFiscalGrid, valor: any) => {
    setItens(prev => prev.map(item => {
      if (item.id !== id) return item;

      const atualizado = { ...item, [campo]: valor };

      // Se mudou o tipo de perfil, atualiza automaticamente k, ncm e sugestão de nome
      if (campo === 'tipoPerfilId') {
        const prod = PRODUTOS_PADRAO_NF.find(p => p.id === valor);
        if (prod) {
          atualizado.constanteK = prod.constanteK;
          atualizado.ncm = prod.ncm;
          const bitolaMm = parseDimensionToMm(atualizado.bitolaInput);
          const prefix = prod.tipoPerfil === 'Redondo/Barra Maciça' ? 'Redondo Maciço' : prod.tipoPerfil;
          if (!atualizado.nomeItem.trim() || atualizado.nomeItem.includes('x 6000mm')) {
            atualizado.nomeItem = `${prefix} ${bitolaMm > 0 ? `${bitolaMm}mm` : ''} x 6000mm`.trim();
          }
        }
      }

      // Se mudou a bitola, atualiza sugestão de nome se estiver no modo novo
      if (campo === 'bitolaInput') {
        const prod = PRODUTOS_PADRAO_NF.find(p => p.id === atualizado.tipoPerfilId);
        const bitolaMm = parseDimensionToMm(String(valor));
        const prefix = prod?.tipoPerfil === 'Redondo/Barra Maciça' ? 'Redondo Maciço' : (prod?.tipoPerfil || 'Barra');
        if (atualizado.modoDestino === 'novo' && (!atualizado.nomeItem.trim() || atualizado.nomeItem.includes('x 6000mm'))) {
          atualizado.nomeItem = `${prefix} ${bitolaMm > 0 ? `${bitolaMm}mm` : ''} x 6000mm`.trim();
        }
      }

      // Se mudou para material existente
      if (campo === 'materialExistenteId' && valor) {
        const mat = materiaisExistentes.find(m => m.id === valor);
        if (mat) {
          atualizado.nomeItem = mat.nome;
          if (mat.espessuraMm > 0) atualizado.bitolaInput = String(mat.espessuraMm);
          if (mat.constanteK) atualizado.constanteK = mat.constanteK;
          if (mat.ncm) atualizado.ncm = mat.ncm;
          if (mat.precoVendaKg > 0) atualizado.precoVendaKg = mat.precoVendaKg;
          if (mat.localizacao) atualizado.localizacao = mat.localizacao;
        }
      }

      return atualizado;
    }));
  };

  // Cálculos consolidados e por linha da Nota Fiscal
  const pesoTotalNFGlobal = useMemo(() => {
    return Number(itens.reduce((acc, it) => acc + (Number(it.pesoKg) || 0), 0).toFixed(2));
  }, [itens]);

  const freteTotalNum = useMemo(() => {
    return Math.max(0, Number(freteTotalNF) || 0);
  }, [freteTotalNF]);

  const valorTotalDanfeNum = useMemo(() => {
    return Math.max(0, Number(valorTotalDanfeDeclarado) || 0);
  }, [valorTotalDanfeDeclarado]);

  const aliquotaIpiNum = useMemo(() => {
    return Math.max(0, Number(aliquotaIpiPercent) || 0);
  }, [aliquotaIpiPercent]);

  // Cálculos detalhados de cada linha da grade
  const linhasCalculadas = useMemo(() => {
    const aliquotaIPI = aliquotaIpiNum / 100;

    // Subtotal geral preliminar dos itens
    const subtotalGeral = itens.reduce((acc, it) => {
      const p = Math.max(0, Number(it.pesoKg) || 0);
      const v = Math.max(0, Number(it.valorKgNF) || 0);
      return acc + (p * v);
    }, 0);

    const ipiGeralCalculado = subtotalGeral * aliquotaIPI;
    const custoBaseGeral = subtotalGeral + ipiGeralCalculado + freteTotalNum;

    // Diferença fiscal para bater exatamente com o DANFE (outras despesas / arredondamentos)
    const diferencaDanfe = valorTotalDanfeNum > 0 ? (valorTotalDanfeNum - custoBaseGeral) : 0;

    return itens.map(item => {
      const bitolaMm = parseDimensionToMm(item.bitolaInput);
      const k = Number(item.constanteK) || 0.00785;
      const pesoItem = Math.max(0, Number(item.pesoKg) || 0);
      const valorKg = Math.max(0, Number(item.valorKgNF) || 0);
      const precoVenda = Math.max(0, Number(item.precoVendaKg) || 0);

      // Regra para Chapas / Placas:
      // Para perfis do tipo 'Chapa / Placa', não força a conversão para barras de 6 metros
      const descUpper = (item.nomeItem || '').toUpperCase();
      const isChapa = item.tipoPerfilId === 'chapa' ||
                      descUpper.includes('CHAPA') ||
                      descUpper.includes('PLACA') ||
                      descUpper.includes('CGR');

      // 1. Peso Teórico de 1 Barra de 6 Metros = (Bitola²) * k * 6 (Apenas perfis lineares)
      const pesoBarra6m = isChapa || bitolaMm <= 0 || k <= 0
        ? 0
        : Number(((bitolaMm * bitolaMm) * k * 6).toFixed(3));

      // 2. Qtd Barras (6m) = Peso do Item / Peso 1 Barra 6m (Não se aplica a Chapas/Placas)
      const qtdBarras6m = isChapa || pesoBarra6m <= 0 || pesoItem <= 0
        ? 0
        : Number((pesoItem / pesoBarra6m).toFixed(2));

      // 3. Metros Lineares = Qtd Barras * 6 (Não se aplica a Chapas/Placas)
      const metroLinear = isChapa
        ? 0
        : Number((qtdBarras6m * 6).toFixed(2));

      // 4. Subtotal Item = Peso * Valor Unitário NF
      const subtotal = Number((pesoItem * valorKg).toFixed(2));

      // 5. IPI = Subtotal * aliquotaIPI
      const ipiValor = Number((subtotal * aliquotaIPI).toFixed(2));

      // 6. Rateio Proporcional do Frete:
      // Se pesoTotalNFGlobal > 0: rateio baseado no peso do item (kgItem / kgTotal * freteTotal)
      // Se pesoTotalNFGlobal == 0: rateio igualitário (freteTotal / qtdItens)
      const freteProporcional = pesoTotalNFGlobal > 0
        ? Number(((pesoItem / pesoTotalNFGlobal) * freteTotalNum).toFixed(2))
        : Number((freteTotalNum / Math.max(1, itens.length)).toFixed(2));

      // 7. Rateio Proporcional de Ajuste do DANFE (outras despesas acessórias)
      const ajusteProporcional = pesoTotalNFGlobal > 0 && Math.abs(diferencaDanfe) > 0.01
        ? Number(((pesoItem / pesoTotalNFGlobal) * diferencaDanfe).toFixed(2))
        : 0;

      // 8. Custo Total Item = Subtotal + IPI + Frete Rateado + Ajuste Proporcional
      const custoTotalItem = Number((subtotal + ipiValor + freteProporcional + ajusteProporcional).toFixed(2));

      // 9. Custo Real por Kg = Custo Total Item / Peso do Item
      const custoRealKg = pesoItem > 0
        ? Number((custoTotalItem / pesoItem).toFixed(2))
        : 0;

      // 10. Lucro por Kg (R$) = Preço de Venda Pretendido - Custo Real por Kg
      const lucroKg = Number((precoVenda - custoRealKg).toFixed(2));

      // 11. Margem (%) = (Lucro por Kg / Preço de Venda) * 100
      const margemPercent = precoVenda > 0
        ? Number(((lucroKg / precoVenda) * 100).toFixed(2))
        : 0;

      return {
        item,
        isChapa,
        bitolaMm,
        pesoBarra6m,
        qtdBarras6m,
        metroLinear,
        subtotal,
        ipiValor,
        freteProporcional,
        ajusteProporcional,
        custoTotalItem,
        custoRealKg,
        lucroKg,
        margemPercent
      };
    });
  }, [itens, pesoTotalNFGlobal, freteTotalNum, valorTotalDanfeNum, aliquotaIpiNum]);

  // Totais Gerais da Nota Fiscal
  const totaisNF = useMemo(() => {
    const subtotalTotal = Number(linhasCalculadas.reduce((acc, l) => acc + l.subtotal, 0).toFixed(2));
    const ipiTotal = Number(linhasCalculadas.reduce((acc, l) => acc + l.ipiValor, 0).toFixed(2));
    const freteTotal = freteTotalNum;
    const custoTotalGeral = valorTotalDanfeNum > 0
      ? valorTotalDanfeNum
      : Number((subtotalTotal + ipiTotal + freteTotal).toFixed(2));
    const totalBarras6m = Number(linhasCalculadas.filter(l => !l.isChapa).reduce((acc, l) => acc + l.qtdBarras6m, 0).toFixed(2));
    const totalMetrosLineares = Number(linhasCalculadas.filter(l => !l.isChapa).reduce((acc, l) => acc + l.metroLinear, 0).toFixed(2));
    const qtdChapas = linhasCalculadas.filter(l => l.isChapa).length;
    const valorVendaTotal = Number(linhasCalculadas.reduce((acc, l) => acc + (Number(l.item.pesoKg) * Number(l.item.precoVendaKg)), 0).toFixed(2));
    const lucroTotal = Number((valorVendaTotal - custoTotalGeral).toFixed(2));
    const margemMediaPercent = valorVendaTotal > 0 ? Number(((lucroTotal / valorVendaTotal) * 100).toFixed(2)) : 0;

    return {
      pesoTotalKg: pesoTotalNFGlobal,
      subtotalTotal,
      ipiTotal,
      freteTotal,
      custoTotalGeral,
      valorTotalDanfeDeclarado: valorTotalDanfeNum,
      totalBarras6m,
      totalMetrosLineares,
      qtdChapas,
      valorVendaTotal,
      lucroTotal,
      margemMediaPercent
    };
  }, [linhasCalculadas, pesoTotalNFGlobal, freteTotalNum, valorTotalDanfeNum]);

  if (!isOpen) return null;

  // Submissão Final e Gravação no Estoque
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (itens.length === 0) {
      alert('Nenhum item na grade da nota fiscal. Bipe uma chave de acesso (44 dígitos) ou adicione itens manualmente.');
      barcodeInputRef.current?.focus();
      return;
    }

    if (pesoTotalNFGlobal <= 0) {
      alert('Por favor, informe pelo menos um item com Peso Total em KG válido na tabela.');
      return;
    }

    if (!numeroNF.trim()) {
      alert('Por favor, informe o Número da Nota Fiscal.');
      return;
    }

    if (!fornecedor.trim()) {
      alert('Por favor, informe o Fornecedor da Nota Fiscal.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Constrói os dados de todos os materiais e movimentações da grade
      const itensPreparados = linhasCalculadas.map((l, index) => {
        const { item, isChapa, bitolaMm, pesoBarra6m, qtdBarras6m, metroLinear, custoRealKg, custoTotalItem, lucroKg, margemPercent } = l;
        const pesoKg = Number(item.pesoKg) || 0;
        const precoVendaKg = Number(item.precoVendaKg) || 0;
        const isNovo = item.modoDestino === 'novo' || !item.materialExistenteId;

        let materialFinal: MaterialEstoque;

        if (!isNovo && item.materialExistenteId) {
          const matExistente = materiaisExistentes.find(m => m.id === item.materialExistenteId);
          if (matExistente) {
            const novoSaldoKg = Number((matExistente.pesoTotalKg + pesoKg).toFixed(2));
            const isChapaItem = isChapa || matExistente.tipo === 'chapa';
            const pesoUnit = isChapaItem ? 0 : (pesoBarra6m > 0 ? pesoBarra6m : matExistente.pesoUnitarioKg);
            const novaQtdBarras = isChapaItem ? (matExistente.quantidade || 1) : (pesoUnit > 0 ? Number((novoSaldoKg / pesoUnit).toFixed(2)) : matExistente.quantidade);

            materialFinal = {
              ...matExistente,
              pesoTotalKg: novoSaldoKg, // SALDO PRINCIPAL ESTRITAMENTE EM KG
              quantidade: novaQtdBarras, // Barras para conferência física (ou 1 para chapas)
              pesoUnitarioKg: pesoUnit,
              custoKg: custoRealKg > 0 ? custoRealKg : matExistente.custoKg,
              precoVendaKg: precoVendaKg > 0 ? precoVendaKg : matExistente.precoVendaKg,
              comprimentoMm: isChapaItem ? matExistente.comprimentoMm : 6000,
              ncm: item.ncm.trim() || matExistente.ncm,
              constanteK: item.constanteK || matExistente.constanteK,
              bitolaMm: bitolaMm || matExistente.bitolaMm,
              metroLinearTotal: isChapaItem ? 0 : Number((novaQtdBarras * 6).toFixed(2)),
              atualizadoEm: new Date().toISOString()
            };
          } else {
            // Se não encontrou o existente, cria como novo
            const prod = PRODUTOS_PADRAO_NF.find(p => p.id === item.tipoPerfilId);
            const isChapaItem = isChapa || item.tipoPerfilId === 'chapa';
            materialFinal = {
              id: `mat-${Date.now()}-${index}`,
              codigo: isChapaItem 
                ? `CHP-${Math.round(bitolaMm || 25)}-${Date.now().toString().slice(-4)}`
                : `BAR-${item.tipoPerfilId.slice(0, 4).toUpperCase()}-${Math.round(bitolaMm)}-${Date.now().toString().slice(-4)}`,
              nome: item.nomeItem,
              tipo: isChapaItem ? 'chapa' : (prod?.tipo || 'barra'),
              material: prod ? prod.nome.split(' ')[0] : (isChapaItem ? 'Aço Carbono' : 'Aço'),
              espessuraMm: bitolaMm,
              larguraMm: isChapaItem ? 0 : bitolaMm,
              comprimentoMm: isChapaItem ? 0 : 6000,
              densidade: item.constanteK || 0.00785,
              pesoUnitarioKg: isChapaItem ? 0 : pesoBarra6m,
              quantidade: isChapaItem ? 1 : qtdBarras6m,
              pesoTotalKg: pesoKg, // SALDO PRINCIPAL ESTRITAMENTE EM KG
              estoqueMinimoKg: isChapaItem ? 200 : Number((pesoBarra6m * 2).toFixed(2)),
              estoqueMinimoQtd: isChapaItem ? 1 : 2,
              custoKg: custoRealKg,
              precoVendaKg: precoVendaKg || Number((custoRealKg * 1.5).toFixed(2)),
              localizacao: item.localizacao || (isChapaItem ? 'Pátio de Chapas' : 'Pátio de Barras'),
              fornecedor: fornecedor.trim() || undefined,
              ncm: item.ncm.trim() || undefined,
              constanteK: item.constanteK,
              bitolaMm: bitolaMm,
              metroLinearTotal: isChapaItem ? 0 : metroLinear,
              observacoes: isChapaItem
                ? `Entrada NF ${numeroNF} (Item ${index + 1}/${itens.length}): ${pesoKg} Kg (Chapa / Placa ${bitolaMm}mm - Foco Estrito em KG) | Custo Real: ${formatCurrency(custoRealKg)}/Kg`
                : `Entrada NF ${numeroNF} (Item ${index + 1}/${itens.length}): ${pesoKg} Kg (${qtdBarras6m} barras de 6m) | Custo Real: ${formatCurrency(custoRealKg)}/Kg`,
              atualizadoEm: new Date().toISOString()
            };
          }
        } else {
          // Cadastra novo material
          const prod = PRODUTOS_PADRAO_NF.find(p => p.id === item.tipoPerfilId);
          const isChapaItem = isChapa || item.tipoPerfilId === 'chapa';
          materialFinal = {
            id: `mat-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
            codigo: isChapaItem 
              ? `CHP-${Math.round(bitolaMm || 25)}-${Date.now().toString().slice(-4)}`
              : `BAR-${item.tipoPerfilId.slice(0, 4).toUpperCase()}-${Math.round(bitolaMm)}-${Date.now().toString().slice(-4)}`,
            nome: item.nomeItem,
            tipo: isChapaItem ? 'chapa' : (prod?.tipo || 'barra'),
            material: prod ? prod.nome.split(' ')[0] : (isChapaItem ? 'Aço Carbono' : 'Aço'),
            espessuraMm: bitolaMm,
            larguraMm: isChapaItem ? 0 : bitolaMm,
            comprimentoMm: isChapaItem ? 0 : 6000,
            densidade: item.constanteK || 0.00785,
            pesoUnitarioKg: isChapaItem ? 0 : pesoBarra6m,
            quantidade: isChapaItem ? 1 : qtdBarras6m, // Para chapas, não força barras de 6m
            pesoTotalKg: pesoKg, // SALDO PRINCIPAL ESTRITAMENTE EM KG
            estoqueMinimoKg: isChapaItem ? 200 : Number((pesoBarra6m * 2).toFixed(2)),
            estoqueMinimoQtd: isChapaItem ? 1 : 2,
            custoKg: custoRealKg,
            precoVendaKg: precoVendaKg || Number((custoRealKg * 1.5).toFixed(2)),
            localizacao: item.localizacao || (isChapaItem ? 'Pátio de Chapas' : 'Pátio de Barras'),
            fornecedor: fornecedor.trim() || undefined,
            ncm: item.ncm.trim() || undefined,
            constanteK: item.constanteK,
            bitolaMm: bitolaMm,
            metroLinearTotal: isChapaItem ? 0 : metroLinear,
            observacoes: isChapaItem
              ? `Entrada via NF ${numeroNF} (Item ${index + 1}/${itens.length}): ${pesoKg} Kg (Chapa / Placa ${bitolaMm}mm - Foco Estrito em KG) | Custo Real: ${formatCurrency(custoRealKg)}/Kg`
              : `Entrada via NF ${numeroNF} (Item ${index + 1}/${itens.length}): ${pesoKg} Kg (${qtdBarras6m} barras de 6m / ${metroLinear}m) | Custo Real: ${formatCurrency(custoRealKg)}/Kg`,
            atualizadoEm: new Date().toISOString()
          };
        }

        const movimentacao = {
          numeroNF: numeroNF.trim(),
          pesoKg: pesoKg,
          custoTotal: custoTotalItem,
          quantidadeBarras: isChapa ? 0 : qtdBarras6m,
          metroLinear: isChapa ? 0 : metroLinear,
          observacao: isChapa
            ? `Entrada NF ${numeroNF} (${materialFinal.nome}): ${formatWeightKg(pesoKg)} (Chapa / Placa - Foco em KG) - Custo Real: ${formatCurrency(custoRealKg)}/Kg`
            : `Entrada NF ${numeroNF} (${materialFinal.nome}): ${formatWeightKg(pesoKg)} (${qtdBarras6m} barras 6m / ${metroLinear}m) - Custo Real: ${formatCurrency(custoRealKg)}/Kg`
        };

        return {
          material: materialFinal,
          isNovo,
          movimentacao,
          custoRealKg,
          precoVendaKg,
          lucroKg,
          margemPercent
        };
      });

      const payloadMulti: EntradaNotaFiscalMultiplosItensDados = {
        numeroNF: numeroNF.trim(),
        fornecedor: fornecedor.trim() || 'Fornecedor de Aço',
        freteTotal: freteTotalNum,
        gerarFinanceiro: gerarContasPagar,
        custoTotalGeral: totaisNF.custoTotalGeral,
        pesoTotalGeralKg: totaisNF.pesoTotalKg,
        itens: itensPreparados
      };

      if (onConfirmarMultiplosItens) {
        await onConfirmarMultiplosItens(payloadMulti);
      } else if (onConfirmarEntrada) {
        // Fallback de compatibilidade: salva item por item
        for (const it of itensPreparados) {
          onConfirmarEntrada({
            material: it.material,
            isNovo: it.isNovo,
            movimentacao: it.movimentacao,
            gerarFinanceiro: gerarContasPagar && it.movimentacao.custoTotal > 0,
            dadosFinanceiro: gerarContasPagar ? {
              descricao: `Compra Matéria-Prima NF ${numeroNF} (${it.material.nome})`,
              fornecedor: fornecedor.trim() || 'Fornecedor de Aço',
              valor: it.movimentacao.custoTotal,
              numeroNF: numeroNF.trim()
            } : undefined
          });
        }
      }

      const nfConfirmada = numeroNF.trim() || 'NF';
      const qtdItensConfirmados = itens.length;
      const pesoTotalConfirmado = totaisNF.pesoTotalKg;
      const valorTotalConfirmado = totaisNF.custoTotalGeral;

      // 1. Exibir mensagem de sucesso (Toast / Notificação)
      setToastSucesso({
        visivel: true,
        mensagem: `Entrada da ${nfConfirmada} confirmada e gravada no estoque!`,
        detalhe: `${qtdItensConfirmados} itens cadastrados com sucesso (${formatWeightKg(pesoTotalConfirmado)} | ${formatCurrency(valorTotalConfirmado)}). Formulário reinicializado e pronto para bipar a próxima NF.`
      });

      // 2. Resete completo do formulário:
      //    - Limpa a Chave de Acesso / Código de Barras
      //    - Limpa todos os cabeçalhos globais (Número da NF, Fornecedor, Frete Total, Qtd de Itens)
      //    - Esvazie completamente a tabela/grade de itens ([])
      //    - Mantenha o campo de Código de Barras focado e pronto para a bipagem da próxima nota fiscal
      handleResetGeral(true);
    } catch (err) {
      console.error('Erro ao confirmar entrada de múltiplos itens da NF:', err);
      alert('Erro ao processar e cadastrar os itens no estoque. Verifique os dados informados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      id="modal-entrada-nf-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
    >
      <div 
        id="modal-entrada-nf-container"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-7xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden my-auto"
      >
        {/* =====================================================================
            CABEÇALHO DO MODAL
            ===================================================================== */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950/60 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Entrada de Nota Fiscal & Estoque em Barras (6 Metros)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Grade Multi-Itens
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Controle Estrito em KG
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Suporte a múltiplos itens na mesma NF, rateio proporcional de frete, IPI 3,25%, cálculo de barras de 6m e margem em tempo real.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =====================================================================
            CONTEÚDO PRINCIPAL DO FORMULÁRIO (SCROLLÁVEL)
            ===================================================================== */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          
          {/* Toast / Notificação de Sucesso após Salvar */}
          {toastSucesso.visivel && (
            <div 
              id="toast-sucesso-entrada-nf"
              className="p-3.5 bg-emerald-950/90 border-2 border-emerald-500/70 rounded-xl shadow-xl flex items-center justify-between gap-3 text-emerald-200 animate-in fade-in slide-in-from-top-2 duration-300"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    {toastSucesso.mensagem}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                      Estoque Atualizado
                    </span>
                  </h4>
                  {toastSucesso.detalhe && (
                    <p className="text-xs text-emerald-300/90 mt-0.5 font-medium">{toastSucesso.detalhe}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToastSucesso({ visivel: false, mensagem: '' })}
                className="p-1.5 text-emerald-400 hover:text-white hover:bg-emerald-900/60 rounded-lg transition-colors cursor-pointer"
                title="Fechar notificação"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* =====================================================================
              1. CABEÇALHO GERAL DA NF (TOPO): LEITOR + CAMPOS GLOBAIS
              ===================================================================== */}
          <div 
            id="secao-cabecalho-geral-nf"
            className="p-4 sm:p-5 bg-gradient-to-br from-blue-950/70 via-slate-900 to-indigo-950/70 rounded-2xl border-2 border-blue-500/40 shadow-xl shadow-blue-950/30 space-y-3.5"
          >
            {/* Linha 1: Título e Status de Bipagem */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-500/20 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    Leitor de Código de Barras / Chave de Acesso (44 Dígitos)
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      DANFE NF-E
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Bipe a chave de acesso para auto-preencher o fornecedor, número da nota e carregar as linhas de itens na tabela.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Leitor Ótico Pronto (USB / Teclado)</span>
              </div>
            </div>

            {/* Linha 2: Input de Leitura da Chave */}
            <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
              <div className="relative flex-1">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={chaveAcessoInput}
                  onChange={handleChaveInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleProcessarLeituraDanfe();
                    }
                  }}
                  placeholder="Bipe com o leitor ou cole a Chave de Acesso da NF-e (44 dígitos)..."
                  className="w-full pl-10 pr-20 py-2.5 bg-slate-950 border-2 border-blue-500/40 rounded-xl text-xs sm:text-sm text-white font-mono tracking-wider placeholder:text-slate-500 focus:border-blue-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 transition-all"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none">
                  <ScanLine className="w-4 h-4" />
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded-md border border-slate-800">
                  {chaveAcessoInput.replace(/\D/g, '').length}/44
                </div>
              </div>

              {/* Indicador e correção de cDV Módulo 11 */}
              {(() => {
                const clean = chaveAcessoInput.replace(/\D/g, '');
                if (clean.length < 43) return null;
                const base43 = clean.slice(0, 43);
                const trueDv = calcularDvModulo11(base43);
                const digitado = clean.length >= 44 ? clean[43] : null;
                const isMismatch = digitado !== null && digitado !== String(trueDv);

                if (isMismatch) {
                  return (
                    <div className="w-full sm:col-span-12 flex items-center justify-between gap-2 text-[11px] text-amber-200 bg-amber-950/60 border border-amber-500/40 p-2 rounded-xl">
                      <span>
                        ⚠️ <strong>Dígito Verificador incorreto:</strong> digitado '{digitado}', mas o Módulo 11 da SEFAZ calcula '{trueDv}'.
                      </span>
                      <button
                        type="button"
                        onClick={() => setChaveAcessoInput(recalcularChaveAcessoComDvCorreto(chaveAcessoInput))}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-[10px] shrink-0 cursor-pointer transition-colors shadow-xs"
                      >
                        Corrigir Chave para terminar em '{trueDv}'
                      </button>
                    </div>
                  );
                }

                if (digitado !== null && digitado === String(trueDv)) {
                  return (
                    <div className="w-full sm:col-span-12 flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Chave íntegra: cDV = <strong>{trueDv}</strong> rigorosamente conferido pelo Módulo 11 da SEFAZ (Produção).</span>
                    </div>
                  );
                }

                return null;
              })()}

              {/* Input oculto para upload de arquivo XML */}
              <input
                type="file"
                ref={fileXmlInputRef}
                onChange={handleXmlFileUpload}
                accept=".xml,text/xml"
                className="hidden"
              />

              <button
                type="button"
                id="btn-buscar-nota-fiscal"
                disabled={isConsultandoSefaz}
                onClick={() => handleProcessarLeituraDanfe()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/80 disabled:cursor-not-allowed active:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer shrink-0"
              >
                {isConsultandoSefaz ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Consultando SEFAZ...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Carregar Itens da NF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn-importar-xml-nfe"
                onClick={() => fileXmlInputRef.current?.click()}
                title="Importar arquivo XML da NF-e baixado da SEFAZ ou Fornecedor"
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 hover:text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 border border-slate-700 shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>Importar XML</span>
              </button>

              <button
                type="button"
                id="btn-limpar-nota-fiscal"
                onClick={() => handleResetGeral(true)}
                title="Limpar toda a nota fiscal e esvaziar itens"
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 hover:text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 border border-slate-700 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Limpar</span>
              </button>
            </div>

            {/* Feedback Visual da Consulta SEFAZ em andamento */}
            {isConsultandoSefaz && (
              <div className="p-3.5 bg-blue-950/80 border-2 border-blue-500/60 rounded-xl flex items-center gap-3 text-xs text-blue-200 animate-in fade-in duration-200 shadow-lg">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                <div>
                  <p className="text-blue-100 font-bold text-sm">Consultando SEFAZ...</p>
                  <p className="text-[11px] text-blue-300/80 font-mono">
                    Acionando Supabase Edge Function (consulta-nfe) para a chave: {chaveAcessoInput.replace(/\D/g, '')}
                  </p>
                </div>
              </div>
            )}

            {/* Feedback Visual da Leitura */}
            {!isConsultandoSefaz && leituraStatus.tipo === 'sucesso' && (
              <div className="p-3 bg-emerald-950/70 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-300 animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-white">{leituraStatus.mensagem}</span>
                    {leituraStatus.detalhes && (
                      <div className="text-[11px] text-emerald-300/90 font-mono mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>NF: <strong className="text-white">{leituraStatus.detalhes.numeroNF}</strong></span>
                        <span>Fornecedor: <strong className="text-white">{leituraStatus.detalhes.emitente}</strong></span>
                        {leituraStatus.detalhes.cnpj && <span>CNPJ: <strong className="text-white">{leituraStatus.detalhes.cnpj}</strong></span>}
                        <span>Itens na Grade: <strong className="text-white">{leituraStatus.detalhes.qtdItens}</strong></span>
                        {leituraStatus.detalhes.pesoTotalKg !== undefined && (
                          <span>Peso Total: <strong className="text-white">{formatWeightKg(leituraStatus.detalhes.pesoTotalKg)}</strong></span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-500/30 shrink-0">
                  Itens na Grade
                </span>
              </div>
            )}

            {!isConsultandoSefaz && leituraStatus.tipo === 'aviso' && (
              <div className="p-3.5 bg-amber-950/80 border-2 border-amber-500/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200 animate-in fade-in duration-200 shadow-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-amber-100 leading-relaxed font-semibold">
                      {leituraStatus.mensagem}
                    </p>
                    {leituraStatus.detalhes && (
                      <div className="text-[11px] text-amber-300/90 font-mono mt-1 pt-1 border-t border-amber-500/20 flex flex-wrap gap-x-3">
                        <span>NF: <strong className="text-white">{leituraStatus.detalhes.numeroNF}</strong></span>
                        {leituraStatus.detalhes.cnpj && <span>CNPJ: <strong className="text-white">{leituraStatus.detalhes.cnpj}</strong></span>}
                        <span>Grade: <strong className="text-white">Preenchimento liberado</strong></span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => fileXmlInputRef.current?.click()}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Importar XML</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddItemLinha}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Linha Manual</span>
                  </button>
                </div>
              </div>
            )}

            {!isConsultandoSefaz && leituraStatus.tipo === 'erro' && (
              <div className="p-3 bg-rose-950/70 border border-rose-500/40 rounded-xl flex items-center gap-2.5 text-xs text-rose-300 animate-in fade-in duration-200">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{leituraStatus.mensagem}</span>
              </div>
            )}

            {/* Simulação rápida com DANFEs reais com múltiplos itens */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] text-slate-400">
              <span className="text-slate-500 font-medium mr-1">Simular bipagem de NF com múltiplos itens:</span>
              {EXEMPLOS_DANFE_MULTI.map((ex) => (
                <button
                  key={ex.numeroNF}
                  type="button"
                  onClick={() => {
                    setChaveAcessoInput(ex.chave);
                    handleProcessarLeituraDanfe(ex.chave);
                  }}
                  className="px-2.5 py-1 bg-slate-950/80 hover:bg-blue-600/30 text-slate-300 hover:text-blue-200 border border-slate-700 hover:border-blue-500/50 rounded-lg transition-all cursor-pointer font-mono text-[10px] flex items-center gap-1"
                  title={`Chave: ${ex.chave} (${ex.itens.length} itens)`}
                >
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <span>{ex.emitente.split(' ')[0]} ({ex.itens.length} itens - NF-{ex.numeroNF})</span>
                </button>
              ))}
            </div>

            {/* Linha 3: CAMPOS GLOBAIS DA NOTA FISCAL (Número, Fornecedor, Frete Total, Peso Líquido/Bruto, Quantidade de Itens) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-blue-500/20">
              {/* Número da Nota */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Número da Nota Fiscal *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={numeroNF}
                    onChange={(e) => setNumeroNF(e.target.value)}
                    placeholder="Ex: NF-104820"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                    required
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">
                    NF-e
                  </div>
                </div>
              </div>

              {/* Fornecedor */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Fornecedor (Razão Social / CNPJ) *
                </label>
                <input
                  type="text"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Ex: Gerdau Aços, ArcelorMittal..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-medium focus:border-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              {/* Frete Total (R$) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Frete Total da NF (R$)</span>
                  <span className="text-[10px] text-blue-400">Rateio Proporcional</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={freteTotalNF}
                    onChange={(e) => setFreteTotalNF(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-emerald-400 font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                    R$
                  </span>
                </div>
              </div>

              {/* Peso Líquido / Bruto (Kg) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Peso Líq. / Bruto (Kg)</span>
                  <span className="text-[10px] text-slate-400">SEFAZ / NF-e</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pesoLiquidoNF}
                      onChange={(e) => setPesoLiquidoNF(e.target.value)}
                      placeholder="Líq. Kg"
                      title="Peso Líquido informado na NF-e"
                      className="w-full px-2 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-mono">
                      Líq
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pesoBrutoNF}
                      onChange={(e) => setPesoBrutoNF(e.target.value)}
                      placeholder="Bruto Kg"
                      title="Peso Bruto informado na NF-e"
                      className="w-full px-2 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-mono">
                      Brt
                    </span>
                  </div>
                </div>
              </div>

              {/* Quantidade Total de Itens */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Qtd Total de Itens</span>
                  <span className="text-[10px] text-slate-400">Linhas na Grade</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-white flex items-center justify-between">
                    <span className="text-slate-400">Itens:</span>
                    <span className="text-blue-400 text-sm">{itens.length}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItemLinha}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-md shadow-emerald-600/20"
                    title="Adicionar Linha de Item"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Item</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              2. TABELA DE ITENS DA NF (GRADE MULTI-ITENS)
              ===================================================================== */}
          <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800/90 space-y-3 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Tabela de Itens da Nota Fiscal ({itens.length} {itens.length === 1 ? 'item' : 'itens'})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Edite os campos, ajuste os pesos em KG e informe o Preço de Venda Pretendido (R$/Kg) para calcular a margem em tempo real.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
                  Peso Total NF: <strong className="text-emerald-400">{formatWeightKg(pesoTotalNFGlobal)}</strong>
                </span>
                <button
                  type="button"
                  id="btn-adicionar-linha-nf"
                  onClick={handleAddItemLinha}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Adicionar Linha</span>
                </button>
              </div>
            </div>

            {/* TABELA SCROLLÁVEL */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-left border-collapse min-w-[1080px]">
                <thead>
                  <tr className="bg-slate-950/90 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[240px]">Descrição do Material / Perfil</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Bitola / Constante / NCM</th>
                    <th className="py-2.5 px-3 w-32 text-right">Peso Item (Kg) *</th>
                    <th className="py-2.5 px-3 w-32 text-right">Valor NF (R$/Kg) *</th>
                    <th className="py-2.5 px-3 min-w-[150px] text-center">Barras (6m) / Regra Chapa</th>
                    <th className="py-2.5 px-3 min-w-[150px] text-right">Custo Real (R$/Kg)</th>
                    <th className="py-2.5 px-3 min-w-[140px] text-right bg-amber-950/20 border-x border-amber-500/20">
                      <span className="text-amber-400 font-bold">Venda Pretendido (R$/Kg) *</span>
                    </th>
                    <th className="py-2.5 px-3 min-w-[140px] text-right">Lucro & Margem (%)</th>
                    <th className="py-2.5 px-3 w-16 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs text-slate-200">
                  {linhasCalculadas.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 px-4 text-center">
                        <div className="max-w-md mx-auto flex flex-col items-center justify-center text-slate-400 space-y-3">
                          <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 text-slate-500 shadow-inner">
                            <Layers className="w-8 h-8 text-blue-400" />
                          </div>
                          <div className="text-sm font-bold text-slate-200">Grade de Itens Vazia</div>
                          <p className="text-xs text-slate-400 text-center leading-relaxed">
                            Nenhum item na nota fiscal no momento. Bipe a chave de acesso (44 dígitos), recarregue a nota fiscal de exemplo ou adicione itens manualmente.
                          </p>
                          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                            <button
                              type="button"
                              id="btn-adicionar-linha-nf-vazio"
                              onClick={handleAddItemLinha}
                              className="px-3.5 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Adicionar Linha</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleProcessarLeituraDanfe('35260904025452000189550010000168371902861370')}
                              className="px-3.5 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Carregar DANFE NF-16837 (Barras)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleProcessarLeituraDanfe('31240901234567000188550010000452301987654320')}
                              className="px-3.5 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Carregar NF-45230 (Chapas CGR)
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    linhasCalculadas.map((l, index) => {
                      const { item, isChapa, bitolaMm, pesoBarra6m, qtdBarras6m, metroLinear, subtotal, ipiValor, freteProporcional, custoRealKg, lucroKg, margemPercent } = l;

                      return (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-slate-800/40 transition-colors ${index % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-950/20'}`}
                        >
                        {/* 1. Número da linha */}
                        <td className="py-3 px-3 text-center font-mono text-slate-400 font-bold">
                          {index + 1}
                        </td>

                        {/* 2. Descrição do Material / Tipo de Perfil (Dropdown) */}
                        <td className="py-3 px-3 space-y-1.5">
                          <select
                            value={item.tipoPerfilId}
                            onChange={(e) => handleUpdateItem(item.id, 'tipoPerfilId', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-medium focus:border-blue-500 focus:outline-hidden"
                          >
                            {PRODUTOS_PADRAO_NF.map(prod => (
                              <option key={prod.id} value={prod.id}>
                                {prod.nome}
                              </option>
                            ))}
                          </select>

                          <input
                            type="text"
                            value={item.nomeItem}
                            onChange={(e) => handleUpdateItem(item.id, 'nomeItem', e.target.value)}
                            placeholder="Descrição detalhada do material..."
                            className="w-full px-2.5 py-1 bg-slate-950/70 border border-slate-800 rounded-lg text-[11px] text-slate-200 focus:border-blue-500 focus:outline-hidden font-medium"
                          />

                          {/* Seletor rápido: Novo Item vs Somar ao Existente */}
                          <div className="flex items-center gap-2 pt-0.5 text-[10px]">
                            <select
                              value={item.modoDestino === 'existente' ? (item.materialExistenteId || '') : 'novo'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'novo') {
                                  handleUpdateItem(item.id, 'modoDestino', 'novo');
                                  handleUpdateItem(item.id, 'materialExistenteId', '');
                                } else {
                                  handleUpdateItem(item.id, 'modoDestino', 'existente');
                                  handleUpdateItem(item.id, 'materialExistenteId', val);
                                }
                              }}
                              className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-300 focus:outline-hidden"
                            >
                              <option value="novo">+ Cadastrar Novo Material</option>
                              <optgroup label="Somar ao Saldo Existente:">
                                {materiaisExistentes.map(m => (
                                  <option key={m.id} value={m.id}>
                                    {m.nome} (Saldo atual: {formatWeightKg(m.pesoTotalKg)})
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                        </td>

                        {/* 3. Bitola / Espessura (mm) / Constante (k) / NCM */}
                        <td className="py-3 px-3 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-semibold w-16">
                              {isChapa ? 'Espessura:' : 'Bitola:'}
                            </span>
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={item.bitolaInput}
                                onChange={(e) => handleUpdateItem(item.id, 'bitolaInput', e.target.value)}
                                placeholder={isChapa ? "25" : "50"}
                                className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                                required
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
                                mm
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                            <span>k = {item.constanteK}</span>
                            <span>NCM: {item.ncm}</span>
                          </div>

                          <div className="text-[10px] font-mono text-center">
                            {isChapa ? (
                              <span className="text-amber-400 font-semibold">Chapa / Placa (Controle em KG)</span>
                            ) : (
                              <span className="text-blue-400">1 barra 6m = {pesoBarra6m.toFixed(2)} Kg</span>
                            )}
                          </div>
                        </td>

                        {/* 4. Peso do Item (Kg) */}
                        <td className="py-3 px-3 text-right">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.pesoKg}
                              onChange={(e) => handleUpdateItem(item.id, 'pesoKg', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                              placeholder="0.00"
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold text-right focus:border-blue-500 focus:outline-hidden"
                              required
                            />
                            <span className="text-[10px] text-emerald-400 font-mono mt-0.5 block">
                              {formatWeightKg(Number(item.pesoKg) || 0)}
                            </span>
                          </div>
                        </td>

                        {/* 5. Valor Unitário NF (R$/Kg) */}
                        <td className="py-3 px-3 text-right">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.valorKgNF}
                              onChange={(e) => handleUpdateItem(item.id, 'valorKgNF', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                              placeholder="0.00"
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold text-right focus:border-blue-500 focus:outline-hidden"
                              required
                            />
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                              Sub: {formatCurrency(subtotal)}
                            </span>
                          </div>
                        </td>

                        {/* 6. Qtd Barras (6m) e Metros Lineares ou Regra Chapa/Placa */}
                        <td className="py-3 px-3 text-center">
                          {isChapa ? (
                            <div className="p-1.5 bg-slate-950/80 rounded-lg border border-amber-500/20 space-y-0.5">
                              <div className="text-xs font-mono font-bold text-amber-300 flex items-center justify-center gap-1">
                                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-extrabold border border-amber-500/30">
                                  Chapa / Placa
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-emerald-400 font-bold">
                                Saldo em KG: {formatWeightKg(Number(item.pesoKg) || 0)}
                              </div>
                              <div className="text-[9px] font-mono text-slate-500">
                                Barras 6m N/A
                              </div>
                            </div>
                          ) : (
                            <div className="p-1.5 bg-slate-950/80 rounded-lg border border-slate-800 space-y-0.5">
                              <div className="text-xs font-mono font-extrabold text-blue-300">
                                {formatNumberBR(qtdBarras6m, 2)} <span className="text-[10px] font-normal text-slate-400">barras (6m)</span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                {formatNumberBR(metroLinear, 1)} m lineares
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 7. Custo Real por Kg (incorporando IPI 3,25% + Rateio Proporcional do Frete) */}
                        <td className="py-3 px-3 text-right">
                          <div className="p-1.5 bg-emerald-950/30 border border-emerald-500/30 rounded-lg space-y-0.5">
                            <div className="text-xs font-mono font-extrabold text-emerald-300">
                              {formatCurrency(custoRealKg)}/Kg
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              Total: {formatCurrency(l.custoTotalItem)}
                            </div>
                            <div className="text-[9px] text-slate-500">
                              IPI: {formatCurrency(ipiValor)} | Frete: {formatCurrency(freteProporcional)}
                            </div>
                          </div>
                        </td>

                        {/* 8. CAMPO EDITÁVEL: Preço de Venda Pretendido (R$/Kg) */}
                        <td className="py-3 px-3 text-right bg-amber-950/15 border-x border-amber-500/20">
                          <div className="space-y-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.precoVendaKg}
                              onChange={(e) => handleUpdateItem(item.id, 'precoVendaKg', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                              placeholder="0.00"
                              className="w-full px-2.5 py-1.5 bg-slate-950 border-2 border-amber-500/50 rounded-lg text-xs text-amber-300 font-mono font-extrabold text-right focus:border-amber-400 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
                              required
                            />
                            <div className="text-[10px] font-mono text-amber-400/90 text-right">
                              Venda Total: {formatCurrency((Number(item.pesoKg) || 0) * (Number(item.precoVendaKg) || 0))}
                            </div>
                          </div>
                        </td>

                        {/* 9. Lucro (R$/Kg) e Margem (%) atualizados em tempo real */}
                        <td className="py-3 px-3 text-right">
                          {Number(item.precoVendaKg) <= 0 ? (
                            <div className="p-1.5 rounded-lg border border-slate-800 bg-slate-950/60 text-right space-y-0.5 text-slate-500">
                              <div className="text-xs font-mono font-medium text-slate-400">R$ 0,00/Kg</div>
                              <div className="text-[10px] font-mono text-slate-500">Defina a Venda</div>
                            </div>
                          ) : (
                            <div className={`p-1.5 rounded-lg border text-right space-y-0.5 ${
                              lucroKg >= 0 
                                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                            }`}>
                              <div className="text-xs font-mono font-bold flex items-center justify-end gap-1">
                                {lucroKg >= 0 ? '+' : ''}{formatCurrency(lucroKg)}/Kg
                              </div>
                              <div className="text-[10px] font-mono font-bold">
                                {lucroKg >= 0 ? '+' : ''}{formatNumberBR(margemPercent, 1)}% margem
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 10. Ações da Linha */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicarLinha(item)}
                              title="Duplicar este item"
                              className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoverLinha(item.id)}
                              title="Remover item da nota"
                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>

            {/* Linha de Totais da Nota Fiscal */}
            <div className="p-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-xl border border-blue-500/30 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Peso Total NF</span>
                <div className="text-sm font-mono font-extrabold text-emerald-400">
                  {formatWeightKg(totaisNF.pesoTotalKg)}
                </div>
                <span className="text-[10px] text-slate-500">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Subtotal NF</span>
                <div className="text-sm font-mono font-bold text-white">
                  {formatCurrency(totaisNF.subtotalTotal)}
                </div>
                <span className="text-[10px] text-slate-500">Produtos</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-amber-400">IPI Total (3,25%)</span>
                <div className="text-sm font-mono font-bold text-amber-300">
                  {formatCurrency(totaisNF.ipiTotal)}
                </div>
                <span className="text-[10px] text-slate-500">Imposto</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-blue-400">Frete Total</span>
                <div className="text-sm font-mono font-bold text-blue-300">
                  {formatCurrency(totaisNF.freteTotal)}
                </div>
                <span className="text-[10px] text-slate-500">Rateado por peso</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-indigo-300">Custo Total NF</span>
                <div className="text-sm font-mono font-extrabold text-indigo-400">
                  {formatCurrency(totaisNF.custoTotalGeral)}
                </div>
                <span className="text-[10px] text-slate-500">Sub + IPI + Frete</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-blue-300">Barras 6m (Total)</span>
                <div className="text-sm font-mono font-bold text-blue-400">
                  {totaisNF.totalBarras6m > 0 ? (
                    <>
                      {formatNumberBR(totaisNF.totalBarras6m, 1)} <span className="text-[10px]">barras</span>
                    </>
                  ) : (
                    <span className="text-amber-300 text-xs font-semibold">N/A (Chapas/Placas)</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">
                  {totaisNF.totalMetrosLineares > 0
                    ? `${formatNumberBR(totaisNF.totalMetrosLineares, 1)} m lineares`
                    : (totaisNF.qtdChapas > 0 ? `${totaisNF.qtdChapas} chapa(s) em KG` : '0 m lineares')}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-emerald-400">Margem Ponderada</span>
                <div className={`text-sm font-mono font-extrabold ${totaisNF.margemMediaPercent >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                  {totaisNF.margemMediaPercent >= 0 ? '+' : ''}{formatNumberBR(totaisNF.margemMediaPercent, 1)}%
                </div>
                <span className="text-[10px] text-slate-500">Lucro: {formatCurrency(totaisNF.lucroTotal)}</span>
              </div>
            </div>
          </div>

          {/* =====================================================================
              3. ARMAZENAMENTO E REGRAS DO ESTOQUE (USICORTE)
              ===================================================================== */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 leading-relaxed">
                <strong className="text-amber-300">Regra UsiCorte - Abatimento Estrito em KG: </strong>
                Todos os <strong className="text-white">{itens.length} itens</strong> desta nota fiscal serão inseridos simultaneamente na tabela <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">estoque</code> do Supabase com a quantidade principal gravada estritamente em <strong className="text-white">KG ({formatWeightKg(totaisNF.pesoTotalKg)})</strong>. 
                Isso assegura que cortes fracionados de orçamentos e vendas abatam o peso real consumido. A quantidade equivalente em <strong className="text-white">{formatNumberBR(totaisNF.totalBarras6m, 1)} barras de 6 metros</strong> ({formatNumberBR(totaisNF.totalMetrosLineares, 1)} metros) é mantida no cadastro para conferência física no pátio.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gerarContasPagar}
                  onChange={(e) => setGerarContasPagar(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span>
                  Lançar despesa consolidada da Nota Fiscal em <strong>Contas a Pagar</strong> ({formatCurrency(totaisNF.custoTotalGeral)})
                </span>
              </label>

              <div className="text-xs text-slate-400 font-mono">
                Fornecedor: <span className="text-white font-semibold">{fornecedor}</span> | NF: <span className="text-white font-semibold">{numeroNF}</span>
              </div>
            </div>
          </div>

          {/* =====================================================================
              RODAPÉ / AÇÃO FINAL DE INSERÇÃO
              ===================================================================== */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              <span>
                Total a estocar: <strong className="text-white">{itens.length} itens</strong> | <strong className="text-emerald-400">{formatWeightKg(totaisNF.pesoTotalKg)}</strong> ({formatNumberBR(totaisNF.totalBarras6m, 1)} barras de 6m)
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                id="btn-confirmar-todos-itens-estoque"
                disabled={isSubmitting || itens.length === 0}
                className="flex-1 sm:flex-initial px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar e Cadastrar Todos os Itens no Estoque</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
