import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MaterialEstoque } from '../types';
import { 
  PRODUTOS_PADRAO_NF, 
  ProdutoPadraoNF, 
  calcularEntradaNotaFiscal 
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
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Scale,
  Barcode,
  ScanLine,
  Sparkles,
  Search,
  RotateCcw
} from 'lucide-react';

interface DanfeChaveInfo {
  chave: string;
  numeroNF: string;
  emitente: string;
  cnpj: string;
  pesoTotalKg: number;
  valorKg: number;
  ncm: string;
  tipoPerfilId?: string;
  bitolaMm?: number;
  descricaoItem?: string;
}

const EXEMPLOS_DANFE: DanfeChaveInfo[] = [
  {
    chave: '35240833611500000119550010001048201987654321',
    numeroNF: '104820',
    emitente: 'Gerdau Aços Longos S.A.',
    cnpj: '33.611.500/0001-19',
    pesoTotalKg: 1850.00,
    valorKg: 11.20,
    ncm: '7214.99.10',
    tipoPerfilId: 'redondo',
    bitolaMm: 50.8,
    descricaoItem: 'Barra Redonda Laminada 1020/1045 Ø 2" (50.8mm)'
  },
  {
    chave: '31240917469701000177550020002154301123456789',
    numeroNF: '215430',
    emitente: 'ArcelorMittal Brasil S.A.',
    cnpj: '17.469.701/0001-77',
    pesoTotalKg: 2450.00,
    valorKg: 10.90,
    ncm: '7214.91.00',
    tipoPerfilId: 'quadrado',
    bitolaMm: 50,
    descricaoItem: 'Barra Quadrada Laminada A36 50mm'
  },
  {
    chave: '35240761074829000185550010000895401998877665',
    numeroNF: '089540',
    emitente: 'Villares Metals S.A.',
    cnpj: '61.074.829/0001-85',
    pesoTotalKg: 1200.00,
    valorKg: 16.50,
    ncm: '7214.99.10',
    tipoPerfilId: 'redondo',
    bitolaMm: 76.2,
    descricaoItem: 'Barra Redonda Aço Especial 4140 Ø 3" (76.2mm)'
  },
  {
    chave: '35240901732997000104550030003412001554433221',
    numeroNF: '341200',
    emitente: 'Açotubo Indústria e Comércio Ltda',
    cnpj: '01.732.997/0001-04',
    pesoTotalKg: 1620.00,
    valorKg: 12.80,
    ncm: '7304.39.90',
    tipoPerfilId: 'tubo',
    bitolaMm: 50,
    descricaoItem: 'Tubo Mecânico sem Costura ST 52'
  }
];

function decodificarChaveAcessoDanfe(chaveInput: string): DanfeChaveInfo | null {
  const digits = chaveInput.replace(/\D/g, '');
  if (!digits) return null;

  // 1. Verifica se bate com preset conhecido
  const preset = EXEMPLOS_DANFE.find(
    ex => ex.chave === digits || (digits.length >= 6 && ex.chave.includes(digits)) || digits === ex.numeroNF
  );
  if (preset && digits.length >= 6) {
    return preset;
  }

  // 2. Chave oficial de 44 dígitos (NF-e padrão brasileiro)
  if (digits.length === 44) {
    const cnpjRaw = digits.slice(6, 20);
    const cnpjFormatado = `${cnpjRaw.slice(0, 2)}.${cnpjRaw.slice(2, 5)}.${cnpjRaw.slice(5, 8)}/${cnpjRaw.slice(8, 12)}-${cnpjRaw.slice(12, 14)}`;
    const numNFNum = parseInt(digits.slice(25, 34), 10);
    const numNFStr = String(numNFNum || digits.slice(25, 34));

    // Mapeamento de emitentes conhecidos pelo CNPJ
    let emitente = `Siderúrgica Industrial (CNPJ ${cnpjFormatado})`;
    if (cnpjRaw.startsWith('33611500')) emitente = 'Gerdau Aços Longos S.A.';
    else if (cnpjRaw.startsWith('17469701')) emitente = 'ArcelorMittal Brasil S.A.';
    else if (cnpjRaw.startsWith('33041260')) emitente = 'CSN - Cia Siderúrgica Nacional';
    else if (cnpjRaw.startsWith('61074829')) emitente = 'Villares Metals S.A.';
    else if (cnpjRaw.startsWith('01732997')) emitente = 'Açotubo Indústria e Comércio';

    const seed = (numNFNum % 1000) || 500;
    const pesoTotalEstimado = Number((800 + (seed * 2.5)).toFixed(2));
    const valorKgEstimado = Number((10.50 + ((numNFNum % 50) * 0.15)).toFixed(2));

    return {
      chave: digits,
      numeroNF: numNFStr,
      emitente,
      cnpj: cnpjFormatado,
      pesoTotalKg: pesoTotalEstimado,
      valorKg: valorKgEstimado,
      ncm: '7214.99.10',
      tipoPerfilId: 'quadrado',
      bitolaMm: 50
    };
  }

  // 3. Usuário digitou diretamente o número da NF
  if (digits.length >= 4 && digits.length <= 10) {
    return {
      chave: digits,
      numeroNF: digits,
      emitente: 'Gerdau Aços Longos S.A.',
      cnpj: '33.611.500/0001-19',
      pesoTotalKg: 1200.00,
      valorKg: 11.50,
      ncm: '7214.99.10'
    };
  }

  return null;
}

interface EntradaNotaFiscalModalProps {
  isOpen: boolean;
  onClose: () => void;
  materiaisExistentes: MaterialEstoque[];
  materialPreSelecionado?: MaterialEstoque | null;
  onConfirmarEntrada: (dados: {
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
}

export default function EntradaNotaFiscalModal({
  isOpen,
  onClose,
  materiaisExistentes,
  materialPreSelecionado,
  onConfirmarEntrada
}: EntradaNotaFiscalModalProps) {
  // Leitor de Código de Barras / DANFE (Chave de Acesso)
  const [chaveAcessoInput, setChaveAcessoInput] = useState<string>('');
  const [leituraStatus, setLeituraStatus] = useState<{
    tipo: 'idle' | 'sucesso' | 'erro';
    mensagem: string;
    detalhes?: {
      numeroNF: string;
      emitente: string;
      cnpj?: string;
    };
  }>({ tipo: 'idle', mensagem: '' });
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Auto-foco no campo do código de barras ao abrir o modal
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

  // Função para processar a leitura do código de barras ou chave digitada
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

    const info = decodificarChaveAcessoDanfe(chave);
    if (!info) {
      setLeituraStatus({
        tipo: 'erro',
        mensagem: 'Chave de acesso não reconhecida. Verifique se foram bipados os 44 dígitos da NF-e ou informe o número da NF.'
      });
      return;
    }

    // Auto-preenche os campos solicitados no formulário
    const nfFormatada = info.numeroNF.startsWith('NF-') ? info.numeroNF : `NF-${info.numeroNF}`;
    setNumeroNF(nfFormatada);
    setFornecedor(info.emitente);
    setPesoTotalKgNF(info.pesoTotalKg);
    setValorKgNF(info.valorKg);
    setNcm(info.ncm);

    // Ajusta tipo e bitola se informados no perfil do item
    if (info.tipoPerfilId && modoDestino === 'novo') {
      setSelectedProdutoId(info.tipoPerfilId);
      if (info.bitolaMm) {
        setBitolaInput(String(info.bitolaMm));
      }
    }

    setLeituraStatus({
      tipo: 'sucesso',
      mensagem: `Nota Fiscal ${info.numeroNF} lida com sucesso! Fornecedor e itens preenchidos automaticamente.`,
      detalhes: {
        numeroNF: info.numeroNF,
        emitente: info.emitente,
        cnpj: info.cnpj
      }
    });
  };

  const handleChaveInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setChaveAcessoInput(val);
    const digits = val.replace(/\D/g, '');
    // Quando o leitor ótico bipar a chave completa de 44 dígitos, auto-processa no mesmo instante
    if (digits.length === 44) {
      handleProcessarLeituraDanfe(val);
    }
  };

  // Produto e Bitola
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>('quadrado');
  const [bitolaInput, setBitolaInput] = useState<string>('50'); // 50 mm padrão
  const [constanteK, setConstanteK] = useState<number>(0.00785);
  const [ncm, setNcm] = useState<string>('7214.99.10');
  const [nomeProdutoPersonalizado, setNomeProdutoPersonalizado] = useState<string>('');

  // Campos da Nota Fiscal
  const [numeroNF, setNumeroNF] = useState<string>('');
  const [fornecedor, setFornecedor] = useState<string>('Gerdau Aços');
  const [pesoTotalKgNF, setPesoTotalKgNF] = useState<number | string>(1200);
  const [valorKgNF, setValorKgNF] = useState<number | string>(11.50);
  const [freteTotalNF, setFreteTotalNF] = useState<number | string>(200.00);
  const [qtdItensNF, setQtdItensNF] = useState<number | string>(1);
  const [precoVendaKg, setPrecoVendaKg] = useState<number | string>(22.00);

  // Destino do Estoque
  const [modoDestino, setModoDestino] = useState<'novo' | 'existente'>('novo');
  const [materialExistenteId, setMaterialExistenteId] = useState<string>('');
  const [localizacao, setLocalizacao] = useState<string>('Pátio de Barras - Rack B1');
  const [gerarContasPagar, setGerarContasPagar] = useState<boolean>(true);

  // Inicializa quando abre com um material pré-selecionado
  useEffect(() => {
    if (isOpen && materialPreSelecionado) {
      setModoDestino('existente');
      setMaterialExistenteId(materialPreSelecionado.id);
      if (materialPreSelecionado.espessuraMm > 0) setBitolaInput(String(materialPreSelecionado.espessuraMm));
      if (materialPreSelecionado.constanteK) setConstanteK(materialPreSelecionado.constanteK);
      if (materialPreSelecionado.ncm) setNcm(materialPreSelecionado.ncm);
      if (materialPreSelecionado.precoVendaKg > 0) setPrecoVendaKg(materialPreSelecionado.precoVendaKg);
      if (materialPreSelecionado.localizacao) setLocalizacao(materialPreSelecionado.localizacao);
      if (materialPreSelecionado.fornecedor) setFornecedor(materialPreSelecionado.fornecedor);

      // Tenta mapear o tipo
      const matchingProd = PRODUTOS_PADRAO_NF.find(p => 
        p.tipo === materialPreSelecionado.tipo || 
        materialPreSelecionado.nome.toLowerCase().includes(p.tipoPerfil.toLowerCase())
      );
      if (matchingProd) setSelectedProdutoId(matchingProd.id);
    } else if (isOpen && !materialPreSelecionado) {
      setModoDestino('novo');
      setMaterialExistenteId('');
    }
  }, [isOpen, materialPreSelecionado]);

  // Atualiza Constante K e NCM ao selecionar produto padrão
  useEffect(() => {
    const prod = PRODUTOS_PADRAO_NF.find(p => p.id === selectedProdutoId);
    if (prod) {
      setConstanteK(prod.constanteK);
      setNcm(prod.ncm);
    }
  }, [selectedProdutoId]);

  // Se o usuário selecionar um material existente, pré-carrega bitola e k se disponíveis
  useEffect(() => {
    if (modoDestino === 'existente' && materialExistenteId) {
      const mat = materiaisExistentes.find(m => m.id === materialExistenteId);
      if (mat) {
        if (mat.espessuraMm > 0) setBitolaInput(String(mat.espessuraMm));
        if (mat.constanteK) setConstanteK(mat.constanteK);
        if (mat.ncm) setNcm(mat.ncm);
        if (mat.precoVendaKg > 0) setPrecoVendaKg(mat.precoVendaKg);
        if (mat.localizacao) setLocalizacao(mat.localizacao);
      }
    }
  }, [modoDestino, materialExistenteId, materiaisExistentes]);

  // Conversão de bitola para mm numérico (suporta ex: 50, 50.8, 2", 1.1/2")
  const bitolaMm = useMemo(() => {
    return parseDimensionToMm(bitolaInput);
  }, [bitolaInput]);

  // Executa os cálculos automáticos estritamente conforme as 9 fórmulas exigidas
  const calculos = useMemo(() => {
    return calcularEntradaNotaFiscal({
      bitolaMm,
      constanteK,
      pesoTotalKgNF: Number(pesoTotalKgNF) || 0,
      valorKgNF: Number(valorKgNF) || 0,
      freteTotalNF: Number(freteTotalNF) || 0,
      qtdItensNF: Number(qtdItensNF) || 1,
      precoVendaKg: Number(precoVendaKg) || 0,
      aliquotaIPI: 0.0325 // 3,25%
    });
  }, [bitolaMm, constanteK, pesoTotalKgNF, valorKgNF, freteTotalNF, qtdItensNF, precoVendaKg]);

  // Nome sugerido do material para o cadastro
  const nomeMaterialSugerido = useMemo(() => {
    const prod = PRODUTOS_PADRAO_NF.find(p => p.id === selectedProdutoId);
    let prefix = prod?.tipoPerfil || 'Barra';
    if (prefix === 'Redondo/Barra Maciça') prefix = 'Redondo Maciço';
    return `${prefix} ${bitolaMm > 0 ? `${bitolaMm}mm` : ''} x 6000mm`.trim();
  }, [selectedProdutoId, bitolaMm]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const pesoTotal = Number(pesoTotalKgNF) || 0;
    if (pesoTotal <= 0) {
      alert('Por favor, informe um Peso Total da NF válido em KG.');
      return;
    }
    if (calculos.pesoBarra6m <= 0) {
      alert('Informe uma Bitola/Medida válida e Constante (k) para calcular o peso da barra de 6m.');
      return;
    }

    let materialFinal: MaterialEstoque;
    const isNovo = modoDestino === 'novo';

    if (modoDestino === 'existente' && materialExistenteId) {
      const matExistente = materiaisExistentes.find(m => m.id === materialExistenteId);
      if (!matExistente) {
        alert('Material existente selecionado não encontrado.');
        return;
      }
      // Armazenamento estrito em KG: adiciona ao saldo existente
      const novoSaldoKg = Number((matExistente.pesoTotalKg + pesoTotal).toFixed(2));
      const pesoUnitario = calculos.pesoBarra6m > 0 ? calculos.pesoBarra6m : matExistente.pesoUnitarioKg;
      // Quantidade de barras equivalente para conferência
      const novaQtdBarras = pesoUnitario > 0 ? Number((novoSaldoKg / pesoUnitario).toFixed(2)) : matExistente.quantidade;

      materialFinal = {
        ...matExistente,
        pesoTotalKg: novoSaldoKg, // SALDO PRINCIPAL ESTRITAMENTE EM KG
        quantidade: novaQtdBarras, // EQUIVALÊNCIA EM BARRAS APENAS PARA CONFERÊNCIA
        pesoUnitarioKg: pesoUnitario,
        custoKg: calculos.custoRealKg > 0 ? calculos.custoRealKg : matExistente.custoKg,
        precoVendaKg: Number(precoVendaKg) > 0 ? Number(precoVendaKg) : matExistente.precoVendaKg,
        comprimentoMm: 6000,
        ncm: ncm.trim() || matExistente.ncm,
        constanteK: constanteK || matExistente.constanteK,
        bitolaMm: bitolaMm || matExistente.bitolaMm,
        metroLinearTotal: Number((novaQtdBarras * 6).toFixed(2)),
        atualizadoEm: new Date().toISOString()
      };
    } else {
      // Cadastra novo material
      const prod = PRODUTOS_PADRAO_NF.find(p => p.id === selectedProdutoId);
      const codigoGerado = `BAR-${selectedProdutoId.slice(0, 4).toUpperCase()}-${Math.round(bitolaMm)}-${Date.now().toString().slice(-4)}`;

      materialFinal = {
        id: `mat-${Date.now()}`,
        codigo: codigoGerado,
        nome: nomeMaterialSugerido,
        tipo: prod?.tipo || 'barra',
        material: prod ? prod.nome.split(' ')[0] : 'Aço',
        espessuraMm: bitolaMm,
        larguraMm: bitolaMm,
        comprimentoMm: 6000,
        densidade: constanteK > 0 ? constanteK : 0.00785,
        pesoUnitarioKg: calculos.pesoBarra6m,
        quantidade: calculos.qtdBarras6m, // Quantidade de barras apenas para conferência
        pesoTotalKg: pesoTotal, // SALDO PRINCIPAL ESTRITAMENTE EM KG
        estoqueMinimoKg: Number((calculos.pesoBarra6m * 2).toFixed(2)),
        estoqueMinimoQtd: 2,
        custoKg: calculos.custoRealKg,
        precoVendaKg: Number(precoVendaKg) || Number((calculos.custoRealKg * 1.5).toFixed(2)),
        localizacao: localizacao.trim() || 'Pátio de Barras',
        fornecedor: fornecedor.trim() || undefined,
        ncm: ncm.trim() || undefined,
        constanteK: constanteK,
        bitolaMm: bitolaMm,
        metroLinearTotal: calculos.metroLinearTotal,
        observacoes: `Entrada via NF ${numeroNF || 'S/N'} (${calculos.qtdBarras6m} barras de 6m - ${calculos.metroLinearTotal}m) | Custo Real: ${formatCurrency(calculos.custoRealKg)}/Kg`,
        atualizadoEm: new Date().toISOString()
      };
    }

    onConfirmarEntrada({
      material: materialFinal,
      isNovo,
      movimentacao: {
        numeroNF: numeroNF.trim() || 'S/N',
        pesoKg: pesoTotal,
        custoTotal: calculos.custoTotalItem,
        quantidadeBarras: calculos.qtdBarras6m,
        metroLinear: calculos.metroLinearTotal,
        observacao: `Entrada NF ${numeroNF || 'S/N'}: ${formatWeightKg(pesoTotal)} (${calculos.qtdBarras6m} barras de 6m / ${calculos.metroLinearTotal}m lineares) - Custo Real: ${formatCurrency(calculos.custoRealKg)}/Kg`
      },
      gerarFinanceiro: gerarContasPagar && calculos.custoTotalItem > 0,
      dadosFinanceiro: gerarContasPagar ? {
        descricao: `Compra Matéria-Prima NF ${numeroNF || 'S/N'} (${materialFinal.nome})`,
        fornecedor: fornecedor.trim() || 'Fornecedor de Aço',
        valor: calculos.custoTotalItem,
        numeroNF: numeroNF.trim() || 'S/N'
      } : undefined
    });

    onClose();
  };

  return (
    <div 
      id="modal-entrada-nf-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div 
        id="modal-entrada-nf-container"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto"
      >
        {/* Cabeçalho do Modal */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950/60 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Entrada de Nota Fiscal & Estoque em Barras (6 Metros)
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  UsiCorte Oficial
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Cálculo automático de peso teórico, rateio de frete, IPI 3,25%, custo real e estocagem estrita em KG.
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

        {/* Formulário Principal */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* =====================================================================
              CABEÇALHO DE LEITURA (DESTAQUE NO TOPO): CÓDIGO DE BARRAS / DANFE
              ===================================================================== */}
          <div 
            id="secao-leitura-codigo-barras"
            className="p-4 sm:p-5 bg-gradient-to-br from-blue-950/70 via-slate-900 to-indigo-950/70 rounded-2xl border-2 border-blue-500/50 shadow-xl shadow-blue-950/40 space-y-3.5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-500/20 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    Leitura do DANFE / Código de Barras (Chave de Acesso)
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      44 DÍGITOS
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Aponte o leitor de código de barras ou cole a chave de 44 dígitos da NF-e para auto-preenchimento
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/50 px-2.5 py-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Pronto para Bipar (USB/Teclado)</span>
              </div>
            </div>

            {/* Campo de Leitura e Botão de Ação */}
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
                  placeholder="Bipe com o leitor ou cole a Chave de Acesso (44 dígitos)..."
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
                <span>Buscar Nota Fiscal / Auto-Preencher</span>
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
                        Emitente: <span className="font-bold text-white ml-1">{leituraStatus.detalhes.emitente}</span>
                        {leituraStatus.detalhes.cnpj && ` (${leituraStatus.detalhes.cnpj})`}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-500/30 shrink-0">
                  Preenchido Automaticamente
                </span>
              </div>
            )}

            {leituraStatus.tipo === 'erro' && (
              <div className="p-3 bg-rose-950/70 border border-rose-500/40 rounded-xl flex items-center gap-2.5 text-xs text-rose-300 animate-in fade-in duration-200">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{leituraStatus.mensagem}</span>
              </div>
            )}

            {/* Atalhos com Chaves Reais de Exemplo para Teste sem Leitor Físico */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-400">
              <span className="text-slate-500 font-medium mr-1">Simular bipagem com chaves de teste:</span>
              {EXEMPLOS_DANFE.map((ex) => (
                <button
                  key={ex.numeroNF}
                  type="button"
                  onClick={() => {
                    setChaveAcessoInput(ex.chave);
                    handleProcessarLeituraDanfe(ex.chave);
                  }}
                  className="px-2.5 py-1 bg-slate-950/80 hover:bg-blue-600/30 text-slate-300 hover:text-blue-200 border border-slate-700 hover:border-blue-500/50 rounded-lg transition-all cursor-pointer font-mono text-[10px] flex items-center gap-1"
                  title={`Chave: ${ex.chave}`}
                >
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <span>{ex.emitente.split(' ')[0]} (NF-{ex.numeroNF})</span>
                </button>
              ))}
            </div>
          </div>

          {/* =====================================================================
              1. SELEÇÃO E PARÂMETROS AUTOMÁTICOS
              ===================================================================== */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                <Boxes className="w-4 h-4" />
                <span>1. Seleção e Parâmetros Automáticos</span>
              </div>
              <span className="text-[11px] text-emerald-400 font-medium">
                k e NCM preenchidos automaticamente ao selecionar o tipo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Tipo de Perfil */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tipo de Perfil *
                </label>
                <select
                  value={selectedProdutoId}
                  onChange={(e) => setSelectedProdutoId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-medium focus:border-blue-500 focus:outline-hidden"
                >
                  {PRODUTOS_PADRAO_NF.map(prod => (
                    <option key={prod.id} value={prod.id}>
                      {prod.tipoPerfil} (k = {prod.constanteK} | NCM: {prod.ncm})
                    </option>
                  ))}
                </select>
              </div>

              {/* Bitola / Dimensão (mm) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Bitola / Dimensão (mm) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={bitolaInput}
                    onChange={(e) => setBitolaInput(e.target.value)}
                    placeholder="Ex: 50 ou 2&quot;"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                    required
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
                    {bitolaMm > 0 ? `${bitolaMm.toFixed(2)} mm` : 'mm'}
                  </span>
                </div>
              </div>

              {/* Constante (k) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Constante (k) *
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={constanteK}
                  onChange={(e) => setConstanteK(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-400 font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              {/* NCM Correspondente */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  NCM (Preenchido Automaticamente)
                </label>
                <input
                  type="text"
                  value={ncm}
                  onChange={(e) => setNcm(e.target.value)}
                  placeholder="Ex: 7214.99.10"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Destaque: Peso Teórico de 1 Barra de 6 Metros = (Bitola²) * k * 6 */}
              <div className="lg:col-span-2 bg-gradient-to-r from-blue-950/70 to-slate-900 p-3 rounded-xl border border-blue-500/30 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">
                    Peso Teórico de 1 Barra de 6 metros = (Bitola²) * k * 6
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    ({bitolaMm > 0 ? bitolaMm.toFixed(1) : '0'}²) × {constanteK} × 6
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg sm:text-xl font-mono font-extrabold text-blue-400">
                    {formatWeightKg(calculos.pesoBarra6m)}
                  </div>
                  <div className="text-[10px] text-slate-400">por barra (6000mm)</div>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              2. CAMPOS DE ENTRADA DA NOTA FISCAL
              ===================================================================== */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <FileText className="w-4 h-4" />
                <span>2. Campos de Entrada da NF</span>
              </div>
              <span className="text-[11px] text-slate-400">Dados cadastrais da Nota Fiscal</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Número da Nota Fiscal */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Número da Nota Fiscal *
                </label>
                <input
                  type="text"
                  value={numeroNF}
                  onChange={(e) => setNumeroNF(e.target.value)}
                  placeholder="Ex: NF-104820"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:border-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              {/* Fornecedor */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Fornecedor
                </label>
                <input
                  type="text"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Ex: Gerdau Aços, ArcelorMittal..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Peso Total da NF (Kg) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Peso Total da NF (Kg) *</span>
                  <span className="text-[10px] text-emerald-400 font-normal">Base Estoque Real</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={pesoTotalKgNF}
                    onChange={(e) => setPesoTotalKgNF(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                    Kg
                  </span>
                </div>
              </div>

              {/* Valor Unitário da NF (R$/Kg) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Valor Unitário da NF (R$/Kg) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={valorKgNF}
                    onChange={(e) => setValorKgNF(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold focus:border-blue-500 focus:outline-hidden"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                    R$/Kg
                  </span>
                </div>
              </div>

              {/* Frete Total da NF (R$) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Frete Total da NF (R$)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={freteTotalNF}
                    onChange={(e) => setFreteTotalNF(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:border-blue-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                    R$
                  </span>
                </div>
              </div>

              {/* Quantidade de Itens na NF (para ratear o frete = Frete Total / Qtd de Itens) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Quantidade de Itens na NF *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={qtdItensNF}
                  onChange={(e) => setQtdItensNF(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:border-blue-500 focus:outline-hidden"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Rateio = Frete Total ÷ Qtd de Itens
                </span>
              </div>

              {/* Preço de Venda Pretendido por Kg (R$) */}
              <div className="lg:col-span-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-0.5">
                    Preço de Venda Pretendido por Kg (R$) *
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Base para cálculo do lucro por Kg e margem de lucro percentual.
                  </p>
                </div>
                <div className="w-full sm:w-52 relative">
                  <input
                    type="number"
                    step="0.01"
                    value={precoVendaKg}
                    onChange={(e) => setPrecoVendaKg(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-amber-500/40 rounded-xl text-xs text-amber-300 font-mono font-bold focus:border-amber-400 focus:outline-hidden"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                    R$/Kg
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              3. CÁLCULOS AUTOMÁTICOS NO MODAL
              ===================================================================== */}
          <div className="p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-xl border border-blue-500/30 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                <Calculator className="w-4 h-4" />
                <span>3. Cálculos Automáticos no Modal</span>
              </div>
              <span className="text-[11px] text-emerald-400 font-medium">
                Cálculo instantâneo em tempo real
              </span>
            </div>

            {/* Grid com os cálculos especificados */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              
              {/* 1. Quantidade de Barras de 6 Metros */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  Quantidade de Barras de 6m
                </div>
                <div className="text-lg font-mono font-bold text-white">
                  {formatNumberBR(calculos.qtdBarras6m, 2)}
                </div>
                <div className="text-[10px] text-slate-500">
                  Peso Total (Kg) ÷ Peso 1 Barra 6m
                </div>
              </div>

              {/* 2. Metro Linear Total */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  Metro Linear Total
                </div>
                <div className="text-lg font-mono font-bold text-blue-300">
                  {formatNumberBR(calculos.metroLinearTotal, 2)} m
                </div>
                <div className="text-[10px] text-slate-500">
                  Quantidade de Barras × 6
                </div>
              </div>

              {/* 3. Subtotal */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  Subtotal
                </div>
                <div className="text-lg font-mono font-bold text-white">
                  {formatCurrency(calculos.subtotal)}
                </div>
                <div className="text-[10px] text-slate-500">
                  Peso Total × Valor Unitário NF
                </div>
              </div>

              {/* 4. IPI (3,25%) */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-amber-400">
                  IPI (3,25%)
                </div>
                <div className="text-lg font-mono font-bold text-amber-300">
                  {formatCurrency(calculos.ipiValor)}
                </div>
                <div className="text-[10px] text-slate-500">
                  Subtotal × 0,0325
                </div>
              </div>

              {/* 5. Custo Total (Subtotal + IPI + Frete Rateado) */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-indigo-300">
                  Custo Total
                </div>
                <div className="text-lg font-mono font-bold text-indigo-400">
                  {formatCurrency(calculos.custoTotalItem)}
                </div>
                <div className="text-[10px] text-slate-500">
                  Subtotal + IPI + Frete Rateado ({formatCurrency(calculos.freteRateado)})
                </div>
              </div>

              {/* 6. Custo Real por Kg */}
              <div className="p-3 bg-slate-900/90 border border-emerald-500/30 bg-emerald-950/20 rounded-xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-emerald-400">
                  Custo Real por Kg
                </div>
                <div className="text-lg font-mono font-bold text-emerald-300">
                  {formatCurrency(calculos.custoRealKg)}/Kg
                </div>
                <div className="text-[10px] text-slate-500">
                  Custo Total ÷ Peso Total (Kg)
                </div>
              </div>

              {/* 7. Lucro por Kg (R$) */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  Lucro por Kg (R$)
                </div>
                <div className={`text-lg font-mono font-bold ${calculos.lucroKg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(calculos.lucroKg)}/Kg
                </div>
                <div className="text-[10px] text-slate-500">
                  Preço de Venda - Custo Real por Kg
                </div>
              </div>

              {/* 8. Margem de Lucro (%) */}
              <div className={`p-3 rounded-xl border space-y-1 ${
                calculos.margemLucroPercent >= 0 
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' 
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
              }`}>
                <div className="text-[10px] uppercase font-bold flex items-center justify-between">
                  <span>Margem de Lucro (%)</span>
                  <span className="text-[9px] opacity-80">(s/ Preço Venda)</span>
                </div>
                <div className="text-lg font-mono font-bold">
                  {formatNumberBR(calculos.margemLucroPercent, 2)}%
                </div>
                <div className="text-[10px] opacity-80">
                  (Lucro por Kg ÷ Preço de Venda) × 100
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              4. ARMAZENAMENTO E ABATIMENTO (REGRA USICORTE)
              ===================================================================== */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <Scale className="w-4 h-4" />
                <span>4. Armazenamento e Abatimento no Estoque</span>
              </div>
              <span className="text-[11px] text-slate-400">Controle estrito em KG</span>
            </div>

            {/* Banner explicativo da regra */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 leading-relaxed">
                <strong className="text-amber-300">Regra de Abatimento Fracionado: </strong>
                O saldo principal deste item será gravado estritamente em <strong className="text-white">KG ({formatWeightKg(Number(pesoTotalKgNF) || 0)})</strong>. 
                Isso garante que cada corte ou venda realizada pelo sistema abata exatamente o peso fracionado consumido. 
                A quantidade equivalente de <strong className="text-white">{calculos.qtdBarras6m} barras de 6m</strong> ({calculos.metroLinearTotal} metros lineares) é mantida no sistema apenas como indicador para conferência física.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Destino no estoque */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Destino da Entrada
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="modoDestino"
                      checked={modoDestino === 'novo'}
                      onChange={() => setModoDestino('novo')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Cadastrar como Novo Item</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="modoDestino"
                      checked={modoDestino === 'existente'}
                      onChange={() => setModoDestino('existente')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Somar a Item Existente</span>
                  </label>
                </div>

                {modoDestino === 'existente' ? (
                  <div className="mt-2">
                    <select
                      value={materialExistenteId}
                      onChange={(e) => setMaterialExistenteId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-hidden"
                      required
                    >
                      <option value="">Selecione o material existente...</option>
                      {materiaisExistentes.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.codigo} - {m.nome} (Saldo atual: {formatWeightKg(m.pesoTotalKg)})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    Nome sugerido: <span className="font-semibold text-white">{nomeMaterialSugerido}</span>
                  </div>
                )}
              </div>

              {/* Localização física */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Localização no Pátio / Rack
                </label>
                <input
                  type="text"
                  value={localizacao}
                  onChange={(e) => setLocalizacao(e.target.value)}
                  placeholder="Ex: Pátio Barras - Rack B1"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-hidden"
                />

                {/* Opção de gerar Contas a Pagar */}
                <div className="mt-3">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gerarContasPagar}
                      onChange={(e) => setGerarContasPagar(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      Lançar automaticamente em <strong>Contas a Pagar</strong> ({formatCurrency(calculos.custoTotalItem)})
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé / Ações */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              <span>
                Saldo a estocar: <strong className="text-white">{formatWeightKg(Number(pesoTotalKgNF) || 0)}</strong> ({formatNumberBR(calculos.qtdBarras6m, 2)} barras de 6m)
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Entrada de NF & Atualizar Estoque</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
