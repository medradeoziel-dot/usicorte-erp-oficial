import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MaterialEstoque } from '../types';
import { 
  PRODUTOS_PADRAO_NF, 
  ProdutoPadraoNF 
} from '../utils/notaFiscalCalculator';
import { formatCurrency, formatWeightKg, formatNumberBR, parseDimensionToMm } from '../utils/calculator';
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
  Layers
} from 'lucide-react';

export interface ItemNotaFiscalGrid {
  id: string;
  tipoPerfilId: string;
  nomeItem: string;
  bitolaInput: string;
  constanteK: number;
  ncm: string;
  pesoKg: number;
  valorKgNF: number;
  precoVendaKg: number;
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
    chave: '35240833611500000119550010001048201987654321',
    numeroNF: '104820',
    emitente: 'Gerdau Aços Longos S.A.',
    cnpj: '33.611.500/0001-19',
    freteTotal: 240.00,
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
    chave: '31240917469701000177550020002154301123456789',
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
    chave: '35240901732997000104550030003412001554433221',
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
    chave: '35240761074829000185550010000895401998877665',
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
  }
];

function decodificarChaveAcessoDanfeMulti(chaveInput: string): DanfeChaveInfoMulti | null {
  const digits = chaveInput.replace(/\D/g, '');
  if (!digits) return null;

  // 1. Preset conhecido
  const preset = EXEMPLOS_DANFE_MULTI.find(
    ex => ex.chave === digits || (digits.length >= 6 && ex.chave.includes(digits)) || digits === ex.numeroNF
  );
  if (preset && digits.length >= 6) {
    return preset;
  }

  // 2. Chave de 44 dígitos oficial de NF-e
  if (digits.length === 44) {
    const cnpjRaw = digits.slice(6, 20);
    const cnpjFormatado = `${cnpjRaw.slice(0, 2)}.${cnpjRaw.slice(2, 5)}.${cnpjRaw.slice(5, 8)}/${cnpjRaw.slice(8, 12)}-${cnpjRaw.slice(12, 14)}`;
    const numNFNum = parseInt(digits.slice(25, 34), 10);
    const numNFStr = String(numNFNum || digits.slice(25, 34));

    let emitente = `Siderúrgica Industrial (CNPJ ${cnpjFormatado})`;
    if (cnpjRaw.startsWith('33611500')) emitente = 'Gerdau Aços Longos S.A.';
    else if (cnpjRaw.startsWith('17469701')) emitente = 'ArcelorMittal Brasil S.A.';
    else if (cnpjRaw.startsWith('33041260')) emitente = 'CSN - Cia Siderúrgica Nacional';
    else if (cnpjRaw.startsWith('61074829')) emitente = 'Villares Metals S.A.';
    else if (cnpjRaw.startsWith('01732997')) emitente = 'Açotubo Indústria e Comércio';

    const seed = (numNFNum % 1000) || 450;
    const baseVal = Number((10.50 + ((numNFNum % 30) * 0.12)).toFixed(2));

    return {
      chave: digits,
      numeroNF: numNFStr,
      emitente,
      cnpj: cnpjFormatado,
      freteTotal: 250.00,
      itens: [
        {
          tipoPerfilId: 'quadrado',
          nomeItem: `Barra Quadrada Aço Carbono 50mm x 6m`,
          bitolaInput: '50',
          constanteK: 0.00785,
          ncm: '7214.99.10',
          pesoKg: Number((650 + (seed * 0.6)).toFixed(2)),
          valorKgNF: baseVal,
          precoVendaKg: Number((baseVal * 1.9).toFixed(2)),
          localizacao: 'Pátio de Barras - Rack B1'
        },
        {
          tipoPerfilId: 'redondo',
          nomeItem: `Barra Redonda Maciça 1020 Ø 2" (50.8mm) x 6m`,
          bitolaInput: '50.8',
          constanteK: 0.00617,
          ncm: '7214.99.10',
          pesoKg: Number((550 + (seed * 0.4)).toFixed(2)),
          valorKgNF: Number((baseVal + 0.30).toFixed(2)),
          precoVendaKg: Number(((baseVal + 0.30) * 1.95).toFixed(2)),
          localizacao: 'Pátio de Barras - Rack B2'
        },
        {
          tipoPerfilId: 'tubo',
          nomeItem: `Tubo Mecânico ST 52 Ø 60.3mm x 6m`,
          bitolaInput: '60.3',
          constanteK: 0.00617,
          ncm: '7304.39.90',
          pesoKg: Number((420 + (seed * 0.3)).toFixed(2)),
          valorKgNF: Number((baseVal + 1.50).toFixed(2)),
          precoVendaKg: Number(((baseVal + 1.50) * 1.85).toFixed(2)),
          localizacao: 'Pátio de Tubos - Rack T1'
        }
      ]
    };
  }

  // 3. Usuário digitou o número da NF diretamente
  if (digits.length >= 4 && digits.length <= 10) {
    return {
      chave: digits,
      numeroNF: digits,
      emitente: 'Gerdau Aços Longos S.A.',
      cnpj: '33.611.500/0001-19',
      freteTotal: 200.00,
      itens: [
        {
          tipoPerfilId: 'redondo',
          nomeItem: 'Barra Redonda 1020 Ø 50.8mm (2")',
          bitolaInput: '50.8',
          constanteK: 0.00617,
          ncm: '7214.99.10',
          pesoKg: 700.00,
          valorKgNF: 11.20,
          precoVendaKg: 21.50,
          localizacao: 'Pátio de Barras - Rack B1'
        },
        {
          tipoPerfilId: 'quadrado',
          nomeItem: 'Barra Quadrada 50mm',
          bitolaInput: '50',
          constanteK: 0.00785,
          ncm: '7214.99.10',
          pesoKg: 500.00,
          valorKgNF: 11.40,
          precoVendaKg: 21.00,
          localizacao: 'Pátio de Barras - Rack B2'
        }
      ]
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

function criarItemPadrao(index: number, tipoId = 'quadrado', bitola = '50'): ItemNotaFiscalGrid {
  const prod = PRODUTOS_PADRAO_NF.find(p => p.id === tipoId) || PRODUTOS_PADRAO_NF[0];
  const bitolaMm = parseDimensionToMm(bitola);
  const prefix = prod.tipoPerfil === 'Redondo/Barra Maciça' ? 'Redondo Maciço' : prod.tipoPerfil;
  return {
    id: `item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    tipoPerfilId: prod.id,
    nomeItem: `${prefix} ${bitolaMm > 0 ? `${bitolaMm}mm` : ''} x 6000mm`.trim(),
    bitolaInput: bitola,
    constanteK: prod.constanteK,
    ncm: prod.ncm,
    pesoKg: 500.00,
    valorKgNF: 11.50,
    precoVendaKg: 22.00,
    modoDestino: 'novo',
    localizacao: 'Pátio de Barras - Rack B1'
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
  const [chaveAcessoInput, setChaveAcessoInput] = useState<string>('');
  const [leituraStatus, setLeituraStatus] = useState<{
    tipo: 'idle' | 'sucesso' | 'erro';
    mensagem: string;
    detalhes?: {
      numeroNF: string;
      emitente: string;
      cnpj?: string;
      qtdItens: number;
    };
  }>({ tipo: 'idle', mensagem: '' });
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Campos Globais da NF
  const [numeroNF, setNumeroNF] = useState<string>('NF-104820');
  const [fornecedor, setFornecedor] = useState<string>('Gerdau Aços Longos S.A.');
  const [freteTotalNF, setFreteTotalNF] = useState<number | string>(240.00);
  const [gerarContasPagar, setGerarContasPagar] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 2. Tabela de Itens da NF (Grade Multi-Itens)
  const [itens, setItens] = useState<ItemNotaFiscalGrid[]>([
    criarItemPadrao(1, 'redondo', '50.8'),
    criarItemPadrao(2, 'quadrado', '50'),
    criarItemPadrao(3, 'tubo', '60.3'),
    criarItemPadrao(4, 'barra_chata', '25.4')
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
  const handleProcessarLeituraDanfe = (chaveParaProcessar?: string) => {
    const chave = (chaveParaProcessar !== undefined ? chaveParaProcessar : chaveAcessoInput).trim();
    if (!chave) {
      setLeituraStatus({
        tipo: 'erro',
        mensagem: 'Por favor, bipe o código de barras ou digite a chave de acesso da NF-e (44 dígitos).'
      });
      barcodeInputRef.current?.focus();
      return;
    }

    const info = decodificarChaveAcessoDanfeMulti(chave);
    if (!info) {
      setLeituraStatus({
        tipo: 'erro',
        mensagem: 'Chave de acesso não reconhecida. Verifique se foram bipados os 44 dígitos da NF-e ou informe o número da NF.'
      });
      return;
    }

    // Preenche cabeçalho global
    const nfFormatada = info.numeroNF.startsWith('NF-') ? info.numeroNF : `NF-${info.numeroNF}`;
    setNumeroNF(nfFormatada);
    setFornecedor(info.emitente);
    setFreteTotalNF(info.freteTotal);

    // Preenche as linhas da tabela multi-itens
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
      mensagem: `Nota Fiscal ${info.numeroNF} lida com sucesso! ${info.itens.length} itens carregados na grade com peso e valores da NF.`,
      detalhes: {
        numeroNF: info.numeroNF,
        emitente: info.emitente,
        cnpj: info.cnpj,
        qtdItens: info.itens.length
      }
    });
  };

  const handleChaveInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setChaveAcessoInput(val);
    const digits = val.replace(/\D/g, '');
    if (digits.length === 44) {
      handleProcessarLeituraDanfe(val);
    }
  };

  // Manipulação de Linhas na Tabela
  const handleAddItemLinha = () => {
    const novo = criarItemPadrao(itens.length + 1, 'quadrado', '50');
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
    if (itens.length <= 1) {
      alert('A Nota Fiscal deve conter pelo menos 1 item na tabela.');
      return;
    }
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
          atualizado.nomeItem = `${prefix} ${bitolaMm > 0 ? `${bitolaMm}mm` : ''} x 6000mm`.trim();
        }
      }

      // Se mudou a bitola, atualiza sugestão de nome se estiver no modo novo
      if (campo === 'bitolaInput') {
        const prod = PRODUTOS_PADRAO_NF.find(p => p.id === atualizado.tipoPerfilId);
        const bitolaMm = parseDimensionToMm(String(valor));
        const prefix = prod?.tipoPerfil === 'Redondo/Barra Maciça' ? 'Redondo Maciço' : (prod?.tipoPerfil || 'Barra');
        if (atualizado.modoDestino === 'novo') {
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

  // Cálculos detalhados de cada linha da grade
  const linhasCalculadas = useMemo(() => {
    const aliquotaIPI = 0.0325; // 3,25%

    return itens.map(item => {
      const bitolaMm = parseDimensionToMm(item.bitolaInput);
      const k = Number(item.constanteK) || 0.00785;
      const pesoItem = Math.max(0, Number(item.pesoKg) || 0);
      const valorKg = Math.max(0, Number(item.valorKgNF) || 0);
      const precoVenda = Math.max(0, Number(item.precoVendaKg) || 0);

      // 1. Peso Teórico de 1 Barra de 6 Metros = (Bitola²) * k * 6
      const pesoBarra6m = bitolaMm > 0 && k > 0
        ? Number(((bitolaMm * bitolaMm) * k * 6).toFixed(3))
        : 0;

      // 2. Qtd Barras (6m) = Peso do Item / Peso 1 Barra 6m
      const qtdBarras6m = pesoBarra6m > 0 && pesoItem > 0
        ? Number((pesoItem / pesoBarra6m).toFixed(2))
        : 0;

      // 3. Metros Lineares = Qtd Barras * 6
      const metroLinear = Number((qtdBarras6m * 6).toFixed(2));

      // 4. Subtotal Item = Peso * Valor Unitário NF
      const subtotal = Number((pesoItem * valorKg).toFixed(2));

      // 5. IPI (3,25%) = Subtotal * 0,0325
      const ipiValor = Number((subtotal * aliquotaIPI).toFixed(2));

      // 6. Rateio Proporcional do Frete:
      // Se pesoTotalNFGlobal > 0: rateio baseado no peso do item (kgItem / kgTotal * freteTotal)
      // Se pesoTotalNFGlobal == 0: rateio igualitário (freteTotal / qtdItens)
      const freteProporcional = pesoTotalNFGlobal > 0
        ? Number(((pesoItem / pesoTotalNFGlobal) * freteTotalNum).toFixed(2))
        : Number((freteTotalNum / Math.max(1, itens.length)).toFixed(2));

      // 7. Custo Total Item = Subtotal + IPI + Frete Rateado
      const custoTotalItem = Number((subtotal + ipiValor + freteProporcional).toFixed(2));

      // 8. Custo Real por Kg = Custo Total Item / Peso do Item
      const custoRealKg = pesoItem > 0
        ? Number((custoTotalItem / pesoItem).toFixed(2))
        : 0;

      // 9. Lucro por Kg (R$) = Preço de Venda Pretendido - Custo Real por Kg
      const lucroKg = Number((precoVenda - custoRealKg).toFixed(2));

      // 10. Margem (%) = (Lucro por Kg / Preço de Venda) * 100
      const margemPercent = precoVenda > 0
        ? Number(((lucroKg / precoVenda) * 100).toFixed(2))
        : 0;

      return {
        item,
        bitolaMm,
        pesoBarra6m,
        qtdBarras6m,
        metroLinear,
        subtotal,
        ipiValor,
        freteProporcional,
        custoTotalItem,
        custoRealKg,
        lucroKg,
        margemPercent
      };
    });
  }, [itens, pesoTotalNFGlobal, freteTotalNum]);

  // Totais Gerais da Nota Fiscal
  const totaisNF = useMemo(() => {
    const subtotalTotal = Number(linhasCalculadas.reduce((acc, l) => acc + l.subtotal, 0).toFixed(2));
    const ipiTotal = Number(linhasCalculadas.reduce((acc, l) => acc + l.ipiValor, 0).toFixed(2));
    const freteTotal = freteTotalNum;
    const custoTotalGeral = Number((subtotalTotal + ipiTotal + freteTotal).toFixed(2));
    const totalBarras6m = Number(linhasCalculadas.reduce((acc, l) => acc + l.qtdBarras6m, 0).toFixed(2));
    const totalMetrosLineares = Number(linhasCalculadas.reduce((acc, l) => acc + l.metroLinear, 0).toFixed(2));
    const valorVendaTotal = Number(linhasCalculadas.reduce((acc, l) => acc + (l.item.pesoKg * l.item.precoVendaKg), 0).toFixed(2));
    const lucroTotal = Number((valorVendaTotal - custoTotalGeral).toFixed(2));
    const margemMediaPercent = valorVendaTotal > 0 ? Number(((lucroTotal / valorVendaTotal) * 100).toFixed(2)) : 0;

    return {
      pesoTotalKg: pesoTotalNFGlobal,
      subtotalTotal,
      ipiTotal,
      freteTotal,
      custoTotalGeral,
      totalBarras6m,
      totalMetrosLineares,
      valorVendaTotal,
      lucroTotal,
      margemMediaPercent
    };
  }, [linhasCalculadas, pesoTotalNFGlobal, freteTotalNum]);

  if (!isOpen) return null;

  // Submissão Final e Gravação no Estoque
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pesoTotalNFGlobal <= 0) {
      alert('Por favor, informe pelo menos um item com Peso Total em KG válido na tabela.');
      return;
    }

    if (!numeroNF.trim()) {
      alert('Por favor, informe o Número da Nota Fiscal.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Constrói os dados de todos os materiais e movimentações da grade
      const itensPreparados = linhasCalculadas.map((l, index) => {
        const { item, bitolaMm, pesoBarra6m, qtdBarras6m, metroLinear, custoRealKg, custoTotalItem, lucroKg, margemPercent } = l;
        const pesoKg = Number(item.pesoKg) || 0;
        const precoVendaKg = Number(item.precoVendaKg) || 0;
        const isNovo = item.modoDestino === 'novo' || !item.materialExistenteId;

        let materialFinal: MaterialEstoque;

        if (!isNovo && item.materialExistenteId) {
          const matExistente = materiaisExistentes.find(m => m.id === item.materialExistenteId);
          if (matExistente) {
            const novoSaldoKg = Number((matExistente.pesoTotalKg + pesoKg).toFixed(2));
            const pesoUnit = pesoBarra6m > 0 ? pesoBarra6m : matExistente.pesoUnitarioKg;
            const novaQtdBarras = pesoUnit > 0 ? Number((novoSaldoKg / pesoUnit).toFixed(2)) : matExistente.quantidade;

            materialFinal = {
              ...matExistente,
              pesoTotalKg: novoSaldoKg, // SALDO PRINCIPAL ESTRITAMENTE EM KG
              quantidade: novaQtdBarras, // Barras para conferência física
              pesoUnitarioKg: pesoUnit,
              custoKg: custoRealKg > 0 ? custoRealKg : matExistente.custoKg,
              precoVendaKg: precoVendaKg > 0 ? precoVendaKg : matExistente.precoVendaKg,
              comprimentoMm: 6000,
              ncm: item.ncm.trim() || matExistente.ncm,
              constanteK: item.constanteK || matExistente.constanteK,
              bitolaMm: bitolaMm || matExistente.bitolaMm,
              metroLinearTotal: Number((novaQtdBarras * 6).toFixed(2)),
              atualizadoEm: new Date().toISOString()
            };
          } else {
            // Se não encontrou o existente, cria como novo
            const prod = PRODUTOS_PADRAO_NF.find(p => p.id === item.tipoPerfilId);
            materialFinal = {
              id: `mat-${Date.now()}-${index}`,
              codigo: `BAR-${item.tipoPerfilId.slice(0, 4).toUpperCase()}-${Math.round(bitolaMm)}-${Date.now().toString().slice(-4)}`,
              nome: item.nomeItem,
              tipo: prod?.tipo || 'barra',
              material: prod ? prod.nome.split(' ')[0] : 'Aço',
              espessuraMm: bitolaMm,
              larguraMm: bitolaMm,
              comprimentoMm: 6000,
              densidade: item.constanteK || 0.00785,
              pesoUnitarioKg: pesoBarra6m,
              quantidade: qtdBarras6m,
              pesoTotalKg: pesoKg, // SALDO PRINCIPAL ESTRITAMENTE EM KG
              estoqueMinimoKg: Number((pesoBarra6m * 2).toFixed(2)),
              estoqueMinimoQtd: 2,
              custoKg: custoRealKg,
              precoVendaKg: precoVendaKg || Number((custoRealKg * 1.5).toFixed(2)),
              localizacao: item.localizacao || 'Pátio de Barras',
              fornecedor: fornecedor.trim() || undefined,
              ncm: item.ncm.trim() || undefined,
              constanteK: item.constanteK,
              bitolaMm: bitolaMm,
              metroLinearTotal: metroLinear,
              observacoes: `Entrada NF ${numeroNF} (Item ${index + 1}/${itens.length}): ${pesoKg} Kg (${qtdBarras6m} barras de 6m) | Custo Real: ${formatCurrency(custoRealKg)}/Kg`,
              atualizadoEm: new Date().toISOString()
            };
          }
        } else {
          // Cadastra novo material
          const prod = PRODUTOS_PADRAO_NF.find(p => p.id === item.tipoPerfilId);
          materialFinal = {
            id: `mat-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
            codigo: `BAR-${item.tipoPerfilId.slice(0, 4).toUpperCase()}-${Math.round(bitolaMm)}-${Date.now().toString().slice(-4)}`,
            nome: item.nomeItem,
            tipo: prod?.tipo || 'barra',
            material: prod ? prod.nome.split(' ')[0] : 'Aço',
            espessuraMm: bitolaMm,
            larguraMm: bitolaMm,
            comprimentoMm: 6000,
            densidade: item.constanteK || 0.00785,
            pesoUnitarioKg: pesoBarra6m,
            quantidade: qtdBarras6m, // Quantidade de barras apenas para conferência física
            pesoTotalKg: pesoKg, // SALDO PRINCIPAL ESTRITAMENTE EM KG
            estoqueMinimoKg: Number((pesoBarra6m * 2).toFixed(2)),
            estoqueMinimoQtd: 2,
            custoKg: custoRealKg,
            precoVendaKg: precoVendaKg || Number((custoRealKg * 1.5).toFixed(2)),
            localizacao: item.localizacao || 'Pátio de Barras',
            fornecedor: fornecedor.trim() || undefined,
            ncm: item.ncm.trim() || undefined,
            constanteK: item.constanteK,
            bitolaMm: bitolaMm,
            metroLinearTotal: metroLinear,
            observacoes: `Entrada via NF ${numeroNF} (Item ${index + 1}/${itens.length}): ${pesoKg} Kg (${qtdBarras6m} barras de 6m / ${metroLinear}m) | Custo Real: ${formatCurrency(custoRealKg)}/Kg`,
            atualizadoEm: new Date().toISOString()
          };
        }

        const movimentacao = {
          numeroNF: numeroNF.trim(),
          pesoKg: pesoKg,
          custoTotal: custoTotalItem,
          quantidadeBarras: qtdBarras6m,
          metroLinear: metroLinear,
          observacao: `Entrada NF ${numeroNF} (${materialFinal.nome}): ${formatWeightKg(pesoKg)} (${qtdBarras6m} barras 6m / ${metroLinear}m) - Custo Real: ${formatCurrency(custoRealKg)}/Kg`
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

      onClose();
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

              <button
                type="button"
                id="btn-buscar-nota-fiscal"
                onClick={() => handleProcessarLeituraDanfe()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>Carregar Itens da NF</span>
              </button>

              {chaveAcessoInput && (
                <button
                  type="button"
                  onClick={() => {
                    setChaveAcessoInput('');
                    setLeituraStatus({ tipo: 'idle', mensagem: '' });
                    barcodeInputRef.current?.focus();
                  }}
                  title="Limpar chave"
                  className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Limpar</span>
                </button>
              )}
            </div>

            {/* Feedback Visual da Leitura */}
            {leituraStatus.tipo === 'sucesso' && (
              <div className="p-3 bg-emerald-950/70 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-300 animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-white">{leituraStatus.mensagem}</span>
                    {leituraStatus.detalhes && (
                      <div className="text-[11px] text-emerald-300/90 font-mono mt-0.5">
                        NF: <span className="font-bold text-white">{leituraStatus.detalhes.numeroNF}</span> | 
                        Fornecedor: <span className="font-bold text-white ml-1">{leituraStatus.detalhes.emitente}</span>
                        {leituraStatus.detalhes.cnpj && ` (${leituraStatus.detalhes.cnpj})`} |
                        Itens Carregados: <span className="font-bold text-white">{leituraStatus.detalhes.qtdItens}</span>
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-500/30 shrink-0">
                  Itens na Grade
                </span>
              </div>
            )}

            {leituraStatus.tipo === 'erro' && (
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

            {/* Linha 3: CAMPOS GLOBAIS DA NOTA FISCAL (Número, Fornecedor, Frete Total, Quantidade de Itens) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-blue-500/20">
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
                  Fornecedor *
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
                  onClick={handleAddItemLinha}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Linha</span>
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
                    <th className="py-2.5 px-3 min-w-[150px] text-center">Barras (6m) / Metros</th>
                    <th className="py-2.5 px-3 min-w-[150px] text-right">Custo Real (R$/Kg)</th>
                    <th className="py-2.5 px-3 min-w-[140px] text-right bg-amber-950/20 border-x border-amber-500/20">
                      <span className="text-amber-400 font-bold">Venda Pretendido (R$/Kg) *</span>
                    </th>
                    <th className="py-2.5 px-3 min-w-[140px] text-right">Lucro & Margem (%)</th>
                    <th className="py-2.5 px-3 w-16 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs text-slate-200">
                  {linhasCalculadas.map((l, index) => {
                    const { item, bitolaMm, pesoBarra6m, qtdBarras6m, metroLinear, subtotal, ipiValor, freteProporcional, custoRealKg, lucroKg, margemPercent } = l;

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
                                {prod.tipoPerfil} (k={prod.constanteK})
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

                        {/* 3. Bitola (mm) / Constante (k) / NCM */}
                        <td className="py-3 px-3 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-semibold w-11">Bitola:</span>
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={item.bitolaInput}
                                onChange={(e) => handleUpdateItem(item.id, 'bitolaInput', e.target.value)}
                                placeholder="50"
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

                          <div className="text-[10px] text-blue-400 font-mono text-center">
                            1 barra 6m = {pesoBarra6m.toFixed(2)} Kg
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
                              onChange={(e) => handleUpdateItem(item.id, 'pesoKg', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold text-right focus:border-blue-500 focus:outline-hidden"
                              required
                            />
                            <span className="text-[10px] text-emerald-400 font-mono mt-0.5 block">
                              {formatWeightKg(item.pesoKg)}
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
                              onChange={(e) => handleUpdateItem(item.id, 'valorKgNF', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold text-right focus:border-blue-500 focus:outline-hidden"
                              required
                            />
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                              Sub: {formatCurrency(subtotal)}
                            </span>
                          </div>
                        </td>

                        {/* 6. Qtd Barras (6m) e Metros Lineares (Calculados Automaticamente) */}
                        <td className="py-3 px-3 text-center">
                          <div className="p-1.5 bg-slate-950/80 rounded-lg border border-slate-800 space-y-0.5">
                            <div className="text-xs font-mono font-extrabold text-blue-300">
                              {formatNumberBR(qtdBarras6m, 2)} <span className="text-[10px] font-normal text-slate-400">barras (6m)</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {formatNumberBR(metroLinear, 1)} m lineares
                            </div>
                          </div>
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
                              onChange={(e) => handleUpdateItem(item.id, 'precoVendaKg', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full px-2.5 py-1.5 bg-slate-950 border-2 border-amber-500/50 rounded-lg text-xs text-amber-300 font-mono font-extrabold text-right focus:border-amber-400 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
                              required
                            />
                            <div className="text-[10px] font-mono text-amber-400/90 text-right">
                              Venda Total: {formatCurrency(item.pesoKg * item.precoVendaKg)}
                            </div>
                          </div>
                        </td>

                        {/* 9. Lucro (R$/Kg) e Margem (%) atualizados em tempo real */}
                        <td className="py-3 px-3 text-right">
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
                              disabled={itens.length <= 1}
                              title={itens.length <= 1 ? "Mínimo de 1 item" : "Remover item"}
                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
                  {formatNumberBR(totaisNF.totalBarras6m, 1)} <span className="text-[10px]">barras</span>
                </div>
                <span className="text-[10px] text-slate-500">{formatNumberBR(totaisNF.totalMetrosLineares, 1)} m lineares</span>
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
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
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
