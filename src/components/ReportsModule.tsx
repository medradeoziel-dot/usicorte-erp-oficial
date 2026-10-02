import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Quote, QuoteItem, Client } from '../types';
import Logo from './Logo';
import CompanyHeader from './CompanyHeader';
import { QuotePrintView } from './QuotePrintView';
import EtiquetaDesenho from './EtiquetaDesenho';
import { fileToDxfImage, isDxfFile, renderDxfToDataUrl } from '../utils/dxfRenderer';
import { 
  formatCurrency, 
  formatWeightKg, 
  formatarMedidasLimpa,
  formatSafeDate,
  getObservacaoEspecificaItem
} from '../utils/calculator';
import { 
  fetchCotacoesDb, 
  fetchCotacaoById,
  uploadDesenhoStorage, 
  updateItemCortadoDb,
  updateCotacaoStatusDb,
  deleteCotacaoDb,
  deleteCotacaoItemDb,
  deleteMultipleCotacoesDb,
  db 
} from '../lib/db';
import { executarMigracaoEmergenciaOrcamentos } from '../services/emergencyMigrationService';
import { 
  FileText, 
  Printer, 
  Download, 
  Calendar, 
  Building, 
  User, 
  Scale, 
  DollarSign, 
  Layers, 
  FileSpreadsheet,
  Scissors,
  Tag,
  Image as ImageIcon,
  Camera,
  Upload,
  Trash2,
  Copy,
  Eye,
  Pencil,
  CheckCircle2,
  Search,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Check,
  X,
  Barcode,
  CreditCard,
  TrendingUp,
  Bell,
  Clock,
  RotateCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import BoletosGestaoModal from './BoletosGestaoModal';
import { 
  ContaReceberParcela,
  fetchBoletosDb,
  darBaixaBoletoDb,
  registrarFaturamentoCotacaoDb,
  obterBoletosVencimentoHoje,
  formatCurrencyPtBr,
  formatDataPtBr,
  getDataHojeIso
} from '../services/boletosService';

interface ReportsModuleProps {
  currentQuote: Quote;
  clients?: Client[];
  onNavigateToQuote?: () => void;
  onEditQuote?: (quote: Quote) => void;
  onDuplicateQuote?: (quote: Quote, originalNumber: string) => void;
  initialTab?: 'propostas' | 'consulta';
  onTabChange?: (tab: 'propostas' | 'consulta') => void;
  onNavigateToMovimentacoes?: () => void;
  onOpenHistoricoFechamento?: () => void;
}

export type StatusProposta = 'rascunho' | 'pendente' | 'aprovado' | 'faturado' | 'rejeitado' | 'cancelado' | string;

export interface StatusOptionConfig {
  value: string;
  label: string;
  dotClass: string;
}

export const STATUS_OPTIONS: StatusOptionConfig[] = [
  { value: 'pendente', label: 'Pendente', dotClass: 'bg-blue-500' },
  { value: 'aprovado', label: 'Aprovado', dotClass: 'bg-green-500' },
  { value: 'rascunho', label: 'Rascunho', dotClass: 'bg-yellow-400' },
  { value: 'faturado', label: 'Faturado', dotClass: 'bg-purple-500' },
  { value: 'rejeitado', label: 'Rejeitado', dotClass: 'bg-red-500' },
  { value: 'cancelado', label: 'Cancelado', dotClass: 'bg-slate-100 border border-slate-600' },
];

export function normalizeStatus(rawStatus?: string): string {
  if (!rawStatus) return 'pendente';
  const s = rawStatus.trim().toLowerCase();
  if (s === 'aprovado') return 'aprovado';
  if (s === 'faturado') return 'faturado';
  if (s === 'rascunho') return 'rascunho';
  if (s === 'rejeitado' || s === 'reprovado') return 'rejeitado';
  if (s === 'cancelado') return 'cancelado';
  if (s === 'pendente' || s === 'enviado' || s.includes('analise') || s.includes('análise')) return 'pendente';
  return s;
}

export function getStatusOption(rawStatus?: string): StatusOptionConfig {
  if (rawStatus === 'ativas') {
    return { value: 'ativas', label: 'Em Aberto / Ativas', dotClass: 'bg-sky-500' };
  }
  if (rawStatus === 'todos') {
    return { value: 'todos', label: 'Todas as Situações', dotClass: 'bg-slate-400' };
  }
  if (rawStatus === 'faturado') {
    return { value: 'faturado', label: 'Faturado', dotClass: 'bg-purple-500' };
  }
  const norm = normalizeStatus(rawStatus);
  const found = STATUS_OPTIONS.find(o => o.value === norm);
  if (found) return found;
  return { value: norm, label: (rawStatus || 'Pendente'), dotClass: 'bg-blue-500' };
}

export function getStatusLabel(rawStatus?: string): string {
  return getStatusOption(rawStatus).label;
}

type PrintModelType = 'A4-inteiro' | 'A4-2vias' | 'etiqueta-80' | 'proposta-resumida' | 'corte';

export interface ConsultaItem {
  idVer: number;
  data: string;
  empresa: string;
  contato: string;
  produto: string;
  medida: string;
  descricao: string;
  valor: string;
  qtd: number;
  unitario: number;
  valorGeral: number;
  cotacao: string;
  cotacaoId?: string;
  itemId?: string | number;
  observacao?: string;
  obs?: string;
  status: StatusProposta;
  desenhoUrl?: string;
}

// Dados de consulta (inicia vazio para produção)
const DADOS_CONSULTA_EXEMPLO: ConsultaItem[] = [];

const STATUS_STYLES: Record<string, string> = {
  rascunho: 'bg-slate-700/50 text-slate-300 border-slate-600',
  pendente: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  aprovado: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  rejeitado: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  reprovado: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  cancelado: 'bg-red-950/60 text-red-300 border-red-700/50',
  em_analise: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  'em analise': 'bg-sky-500/20 text-sky-300 border-sky-500/40'
};


// Sample technical blueprint drawing in base64 SVG
const SAMPLE_DRAWING_BASE64 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><circle cx="100" cy="100" r="60" fill="none" stroke="%232563eb" stroke-width="2" stroke-dasharray="4,2"/><circle cx="100" cy="100" r="35" fill="%23dbeafe" stroke="%231e40af" stroke-width="2.5"/><line x1="20" y1="100" x2="180" y2="100" stroke="%23ef4444" stroke-width="1" stroke-dasharray="3,3"/><line x1="100" y1="20" x2="100" y2="180" stroke="%23ef4444" stroke-width="1" stroke-dasharray="3,3"/><circle cx="100" cy="100" r="3" fill="%23ef4444"/><text x="100" y="32" font-family="monospace" font-size="10" text-anchor="middle" font-weight="bold" fill="%231e293b">Ø 120 ±0.05</text><text x="100" y="104" font-family="monospace" font-size="9" text-anchor="middle" font-weight="bold" fill="%231e40af">Ø 70 mm</text><text x="100" y="188" font-family="sans-serif" font-size="8" text-anchor="middle" fill="%2364748b">CORTE / USINAGEM CNC</text></svg>`;

export default function ReportsModule({ 
  currentQuote, 
  clients = [], 
  onNavigateToQuote, 
  onEditQuote,
  onDuplicateQuote,
  initialTab = 'propostas',
  onTabChange,
  onNavigateToMovimentacoes,
  onOpenHistoricoFechamento
}: ReportsModuleProps) {
  // Navigation tab: 'propostas' | 'consulta'
  const [activeTab, setActiveTab] = useState<'propostas' | 'consulta'>(initialTab);

  const switchTab = (tab: 'propostas' | 'consulta') => {
    setActiveTab(tab);
    if (tab === 'consulta') {
      // Reset de seleções e estados pendentes ao entrar na Consulta & Relatório Geral
      setSelectedIds([]);
      setItemToDelete(null);
      setActiveImagePreviewItem(null);
      setIsBulkDeleteOpen(false);
      loadAllConsultaData();
    }
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      if (initialTab === 'consulta') {
        setSelectedIds([]);
        setItemToDelete(null);
        setActiveImagePreviewItem(null);
        setIsBulkDeleteOpen(false);
        loadAllConsultaData();
      }
    }
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === 'consulta') {
      loadAllConsultaData();
    }
  }, [activeTab]);

  // Cotação ativa específica (carregada do banco por ID/URL ou cotação atual)
  const [activeQuote, setActiveQuote] = useState<Quote>(currentQuote);
  const [savedDbQuotes, setSavedDbQuotes] = useState<{ id: string; numero: string; cliente: string; data: string; total: number; createdAt?: string }[]>([]);

  // Estados de Paginação e Carregamento Otimizado da Consulta
  const [isLoadingConsulta, setIsLoadingConsulta] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const isLoadingConsultaRef = useRef<boolean>(false);

  // Active document preview / print mode
  const [activeModel, setActiveModel] = useState<PrintModelType>('A4-inteiro');
  const [printMode, setPrintMode] = useState<'pedido' | 'etiqueta' | 'proposta' | 'corte'>('pedido');

  // Helper para carregar e editar uma cotação completa no formulário de vendas/orçamento
  const handleEditCotacaoFromConsulta = async (item: ConsultaItem) => {
    const targetId = item.cotacaoId || item.cotacao;
    let quoteObj: Quote | null = null;

    if (targetId) {
      quoteObj = await carregarCotacaoPorId(targetId);
    }

    if (!quoteObj) {
      // Tenta buscar no localStorage
      try {
        const saved = localStorage.getItem('s_orcamentos');
        if (saved) {
          const parsed: Quote[] = JSON.parse(saved);
          const found = parsed.find(
            q => (q.quoteNumber && q.quoteNumber.trim().toLowerCase() === String(item.cotacao).trim().toLowerCase()) ||
                 (q.id && q.id === item.cotacaoId) ||
                 (q.id && q.id === item.cotacao)
          );
          if (found) {
            quoteObj = found;
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar do localStorage:', e);
      }
    }

    // Se ainda não encontrou no Supabase/localStorage, reconstrói a partir dos itens da consulta
    if (!quoteObj) {
      const sameQuoteItems = dbQuotesItems.filter(
        i => (i.cotacao && i.cotacao === item.cotacao) || (i.cotacaoId && i.cotacaoId === item.cotacaoId)
      );

      const itemsToUse = sameQuoteItems.length > 0 ? sameQuoteItems : [item];
      const sumTotal = itemsToUse.reduce((acc, curr) => acc + (curr.valorGeral || (curr.unitario * curr.qtd)), 0);

      quoteObj = {
        id: item.cotacaoId || item.cotacao || 'COT-TEMP',
        quoteNumber: item.cotacao || 'COT-TEMP',
        date: item.data || new Date().toISOString().slice(0, 10),
        clientName: item.empresa || 'Cliente Balcão',
        contactPerson: item.contato !== '-' ? item.contato : '',
        status: (item.status === 'aprovado' ? 'Aprovado' : item.status === 'pendente' ? 'Enviado' : item.status === 'rejeitado' ? 'Cancelado' : 'Rascunho'),
        validityDays: 10,
        paymentTerms: 'À Vista / Pix (3% Desc.)',
        observations: item.observacao || '',
        items: itemsToUse.map((it, idx) => ({
          id: String(it.itemId || it.idVer || idx + 1),
          date: it.data || new Date().toISOString().slice(0, 10),
          companyName: it.empresa,
          description: it.descricao,
          descricao: it.descricao,
          constantName: it.produto,
          constant: '0.00785',
          measure: it.medida,
          quantity: it.qtd,
          qtd: it.qtd,
          unitPrice: it.unitario,
          valorUnitario: it.unitario,
          subtotal: it.valorGeral,
          notes: it.observacao || ''
        })),
        subtotalTotal: sumTotal,
        grandTotal: sumTotal,
        discount: 0,
        shipping: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    if (onEditQuote) {
      onEditQuote(quoteObj);
    } else if (onNavigateToQuote) {
      onNavigateToQuote();
    }
  };

  // Helper para duplicar uma cotação completa e redirecionar para a tela Vendas & PDV com novo número
  const handleDuplicateCotacaoFromConsulta = async (item: ConsultaItem) => {
    const targetId = item.cotacaoId || item.cotacao;
    const originalNumber = item.cotacao || (item.cotacaoId ? String(item.cotacaoId) : 'Cotação');
    setDuplicatingQuoteKey(originalNumber);
    setIsDuplicating(true);

    try {
      let quoteObj: Quote | null = null;

      if (targetId) {
        quoteObj = await carregarCotacaoPorId(targetId);
      }

      if (!quoteObj) {
        // Tenta buscar no localStorage
        try {
          const saved = localStorage.getItem('s_orcamentos');
          if (saved) {
            const parsed: Quote[] = JSON.parse(saved);
            const found = parsed.find(
              q => (q.quoteNumber && q.quoteNumber.trim().toLowerCase() === String(item.cotacao).trim().toLowerCase()) ||
                   (q.id && q.id === item.cotacaoId) ||
                   (q.id && q.id === item.cotacao)
            );
            if (found) {
              quoteObj = found;
            }
          }
        } catch (e) {
          console.warn('Erro ao carregar do localStorage:', e);
        }
      }

      // Se ainda não encontrou, reconstrói a partir dos itens da consulta
      if (!quoteObj) {
        const sameQuoteItems = dbQuotesItems.filter(
          i => (i.cotacao && i.cotacao === item.cotacao) || (i.cotacaoId && i.cotacaoId === item.cotacaoId)
        );

        const itemsToUse = sameQuoteItems.length > 0 ? sameQuoteItems : [item];
        const sumTotal = itemsToUse.reduce((acc, curr) => acc + (curr.valorGeral || (curr.unitario * curr.qtd)), 0);

        quoteObj = {
          id: item.cotacaoId || item.cotacao || 'COT-TEMP',
          quoteNumber: item.cotacao || 'COT-TEMP',
          date: item.data || new Date().toISOString().slice(0, 10),
          clientName: item.empresa || 'Cliente Balcão',
          contactPerson: item.contato !== '-' ? item.contato : '',
          status: 'Pendente',
          validityDays: 10,
          paymentTerms: 'À Vista / Pix (3% Desc.)',
          observations: item.observacao || '',
          items: itemsToUse.map((it, idx) => ({
            id: String(it.itemId || it.idVer || idx + 1),
            date: it.data || new Date().toISOString().slice(0, 10),
            companyName: it.empresa,
            description: it.descricao,
            descricao: it.descricao,
            constantName: it.produto,
            constant: '0.00785',
            measure: it.medida,
            quantity: it.qtd,
            qtd: it.qtd,
            unitPrice: it.unitario,
            valorUnitario: it.unitario,
            subtotal: it.valorGeral,
            notes: it.observacao || '',
            drawingImage: it.desenhoUrl
          })),
          subtotalTotal: sumTotal,
          grandTotal: sumTotal,
          discount: 0,
          shipping: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      if (quoteObj) {
        if (onDuplicateQuote) {
          onDuplicateQuote(quoteObj, originalNumber);
        } else if (onEditQuote) {
          onEditQuote(quoteObj);
        } else if (onNavigateToQuote) {
          onNavigateToQuote();
        }
      } else {
        setDeleteFeedback({
          message: `Não foi possível carregar os dados da cotação "${originalNumber}" para duplicação.`,
          type: 'error'
        });
        setTimeout(() => setDeleteFeedback(null), 5000);
      }
    } catch (err: any) {
      console.error('Erro ao duplicar cotação:', err);
      setDeleteFeedback({
        message: `Erro ao duplicar cotação: ${err?.message || 'Falha de comunicação'}`,
        type: 'error'
      });
      setTimeout(() => setDeleteFeedback(null), 5000);
    } finally {
      setIsDuplicating(false);
      setDuplicatingQuoteKey(null);
    }
  };

  // Helper para buscar e duplicar por número digitado (cotações antigas ou paradas)
  const handleDuplicateByNumero = async () => {
    const cleanInput = duplicarNumeroInput.trim();
    if (!cleanInput) return;

    setIsDuplicating(true);
    setDuplicatingQuoteKey(cleanInput);

    try {
      // 1. Tenta buscar direto no Supabase por ID ou Número exato
      let cot = await fetchCotacaoById(cleanInput);

      // 2. Se não encontrou, busca por correspondência em savedDbQuotes
      if (!cot) {
        const lower = cleanInput.toLowerCase();
        const foundSaved = savedDbQuotes.find(
          q => (q.numero && q.numero.toLowerCase() === lower) ||
               (q.id && q.id.toLowerCase() === lower) ||
               (q.numero && q.numero.toLowerCase().endsWith(lower)) ||
               (q.numero && q.numero.toLowerCase().includes(lower))
        );
        if (foundSaved) {
          cot = await fetchCotacaoById(foundSaved.id || foundSaved.numero);
        }
      }

      // 3. Se ainda não encontrou, busca em dbQuotesItems
      if (!cot) {
        const lower = cleanInput.toLowerCase();
        const foundItem = dbQuotesItems.find(
          i => (i.cotacao && i.cotacao.toLowerCase() === lower) ||
               (i.cotacaoId && i.cotacaoId.toLowerCase() === lower) ||
               (i.cotacao && i.cotacao.toLowerCase().includes(lower))
        );
        if (foundItem) {
          await handleDuplicateCotacaoFromConsulta(foundItem);
          setDuplicarNumeroInput('');
          return;
        }
      }

      if (cot) {
        const quoteObj = await carregarCotacaoPorId(cot.id || cot.numero);
        if (quoteObj) {
          const originalNum = cot.numero || cleanInput;
          if (onDuplicateQuote) {
            onDuplicateQuote(quoteObj, originalNum);
          } else if (onEditQuote) {
            onEditQuote(quoteObj);
          } else if (onNavigateToQuote) {
            onNavigateToQuote();
          }
          setDuplicarNumeroInput('');
        }
      } else {
        setDeleteFeedback({
          message: `Cotação com número "${cleanInput}" não foi encontrada no Supabase ou histórico. Verifique o número digitado.`,
          type: 'error'
        });
        setTimeout(() => setDeleteFeedback(null), 5000);
      }
    } catch (err: any) {
      console.error('Erro na duplicação por número:', err);
      setDeleteFeedback({
        message: `Erro ao buscar cotação "${cleanInput}": ${err?.message || 'Falha de conexão'}`,
        type: 'error'
      });
      setTimeout(() => setDeleteFeedback(null), 5000);
    } finally {
      setIsDuplicating(false);
      setDuplicatingQuoteKey(null);
    }
  };

  // Helper para duplicar a partir do botão no topo (Ações em Massa) "DUPLICAR PEDIDO"
  const handleDuplicateSelectedQuote = async () => {
    if (selectedIds.length === 0) return;

    // Encontra o item selecionado entre os itens da consulta
    const firstSelectedId = selectedIds[0];
    const selectedItem = filteredConsultaItems.find(it => it.idVer === firstSelectedId) || 
                         dbQuotesItems.find(it => it.idVer === firstSelectedId);

    if (selectedItem) {
      await handleDuplicateCotacaoFromConsulta(selectedItem);
    } else {
      setDeleteFeedback({
        message: 'Selecione um item na tabela para duplicar o pedido.',
        type: 'error'
      });
      setTimeout(() => setDeleteFeedback(null), 4000);
    }
  };
  
  // Limpeza de classes de impressão ao desmontar ou após fechar caixa de impressão
  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('print-pedido', 'print-etiqueta', 'print-proposta', 'print-corte');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      handleAfterPrint();
    };
  }, []);
  
  // Selected client for report (prioritizing Nome Fantasia)
  const [selectedClientName, setSelectedClientName] = useState<string>(() => currentQuote.clientName || 'CLIENTE BALCÃO');
  
  // Selected saved order/file
  const [selectedOrderKey, setSelectedOrderKey] = useState<string>('CURRENT');

  // Lista de pedidos salvos filtrada pelo cliente selecionado
  const filteredSavedQuotes = useMemo(() => {
    if (!selectedClientName || selectedClientName.trim() === '' || selectedClientName === '-- SELECIONE O CLIENTE --' || selectedClientName === 'TODOS') {
      return savedDbQuotes;
    }
    const normSelected = selectedClientName.trim().toLowerCase();
    const isBalcao = normSelected.includes('balcao') || normSelected.includes('balcão');

    return savedDbQuotes.filter(sq => {
      const clientStr = String(sq.cliente || '').trim().toLowerCase();
      if (isBalcao) {
        return clientStr.includes('balcao') || clientStr.includes('balcão') || !clientStr || clientStr === 'cliente';
      }
      return clientStr.includes(normSelected) || normSelected.includes(clientStr);
    });
  }, [savedDbQuotes, selectedClientName]);
  
  // Drawing photo for item/label
  // ✅ UMA imagem POR ITEM (chave = índice do item), em vez de uma única imagem global
  const [drawingPhotos, setDrawingPhotos] = useState<Record<number, string>>({});
  
  // Selected item index for individual label printing
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);

  // Status message for Ctrl+V paste area
  const [pasteSuccess, setPasteSuccess] = useState<boolean>(false);

  // States for Consulta Module
  const [tipoFiltro, setTipoFiltro] = useState<'cliente' | 'cotacao' | 'contato' | 'produto' | 'data'>('cliente');
  const [inputBusca, setInputBusca] = useState<string>('');
  // Campo dedicado: NOME DO CLIENTE (filtra sempre, combinado com a busca acima)
  const [clienteBusca, setClienteBusca] = useState<string>('');
  // Filtro padrão por situação da proposta: inicia selecionado em "Em Aberto / Ativas" (exibindo apenas Pendente, Aprovado, Rascunho)
  const [statusFiltro, setStatusFiltro] = useState<string>('ativas');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dbQuotesItems, setDbQuotesItems] = useState<ConsultaItem[]>([]);

  // Estados para Exclusão (Individual e em Massa)
  const [itemToDelete, setItemToDelete] = useState<ConsultaItem | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteFeedback, setDeleteFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Estados para Duplicação de Cotação / Pedido para a tela Vendas & PDV
  const [isDuplicating, setIsDuplicating] = useState<boolean>(false);
  const [duplicatingQuoteKey, setDuplicatingQuoteKey] = useState<string | null>(null);
  const [duplicarNumeroInput, setDuplicarNumeroInput] = useState<string>('');

  // Estados para anexo direto de Imagem/DXF na tabela de consulta
  const [targetImageItem, setTargetImageItem] = useState<ConsultaItem | null>(null);
  const [activeImagePreviewItem, setActiveImagePreviewItem] = useState<ConsultaItem | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<number | null>(null);
  const itemFileInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  // Estados para alteração rápida da Situação na tabela de Consulta
  const [updatingQuoteKey, setUpdatingQuoteKey] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [openStatusDropdownId, setOpenStatusDropdownId] = useState<number | 'filtro' | null>(null);

  // Estados para Gestão de Boletos e Alertas de Vencimento
  const [boletos, setBoletos] = useState<ContaReceberParcela[]>([]);
  const [isBoletosModalOpen, setIsBoletosModalOpen] = useState<boolean>(false);
  const [selectedBoletoCotacao, setSelectedBoletoCotacao] = useState<{
    cotacaoNumero: string;
    clienteNome: string;
    valorTotal: number;
    cotacaoId?: string;
    clienteId?: string;
  } | null>(null);
  const [isQuickPayingBoletoId, setIsQuickPayingBoletoId] = useState<string | null>(null);
  const [vencimentosDismissed, setVencimentosDismissed] = useState<boolean>(false);

  // Carregamento inicial de boletos cadastrados
  useEffect(() => {
    fetchBoletosDb()
      .then(b => setBoletos(b))
      .catch(err => console.warn('Aviso ao carregar boletos:', err));
  }, []);

  // Abre modal de gestão de boletos a partir de um item de consulta
  const abrirModalBoletosItem = (item: ConsultaItem) => {
    const targetNumero = (item.cotacao || '').trim();
    const targetId = item.cotacaoId ? String(item.cotacaoId).trim() : '';
    const itensDestaCotacao = dbQuotesItems.filter(it => 
      (targetId && it.cotacaoId && String(it.cotacaoId).trim() === targetId) ||
      (targetNumero && it.cotacao && String(it.cotacao).trim().toLowerCase() === targetNumero.toLowerCase()) ||
      it.idVer === item.idVer
    );
    const valorTotalCotacao = itensDestaCotacao.reduce((acc, it) => acc + (Number(it.valorGeral) || 0), 0) || Number(item.valorGeral) || 0;

    setSelectedBoletoCotacao({
      cotacaoNumero: targetNumero || `COT-${item.idVer}`,
      clienteNome: item.empresa || 'Cliente',
      valorTotal: valorTotalCotacao,
      cotacaoId: targetId || undefined
    });
    setIsBoletosModalOpen(true);
  };

  // Abre modal de boletos para a cotação selecionada
  const handleAbrirBoletosSelecionado = () => {
    if (selectedIds.length > 0) {
      const itemSel = filteredConsultaItems.find(i => selectedIds.includes(i.idVer)) || filteredConsultaItems[0];
      if (itemSel) {
        abrirModalBoletosItem(itemSel);
        return;
      }
    }
    if (filteredConsultaItems.length > 0) {
      abrirModalBoletosItem(filteredConsultaItems[0]);
    } else {
      setDeleteFeedback({ message: 'Nenhuma cotação disponível na tabela para gerenciar boletos.', type: 'error' });
    }
  };

  // Baixa rápida de boleto pelo painel de alerta diário
  const handleBaixaRapidaBoleto = async (boletoId: string) => {
    setIsQuickPayingBoletoId(boletoId);
    try {
      const res = await darBaixaBoletoDb(boletoId, getDataHojeIso());
      if (res.sucesso && res.boleto) {
        setBoletos(prev => prev.map(b => b.id === boletoId ? res.boleto! : b));
        setDeleteFeedback({
          message: res.mensagem,
          type: 'success'
        });
      } else {
        setDeleteFeedback({
          message: res.mensagem || 'Erro ao dar baixa no boleto.',
          type: 'error'
        });
      }
    } catch (e: any) {
      setDeleteFeedback({
        message: `Erro ao baixar boleto: ${e?.message || 'Falha de comunicação'}`,
        type: 'error'
      });
    } finally {
      setIsQuickPayingBoletoId(null);
    }
  };

  // Fecha dropdowns de situação ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.status-dropdown-wrapper')) {
        setOpenStatusDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Manipulador para alteração rápida do status da "Situação" diretamente na tabela
  const handleStatusChange = async (item: ConsultaItem, newStatusValue: string) => {
    const targetNumero = (item.cotacao || '').trim();
    const targetId = item.cotacaoId ? String(item.cotacaoId).trim() : '';
    const newStatus = normalizeStatus(newStatusValue);
    const keyForSpinner = targetNumero || targetId || String(item.idVer);

    // 1. Atualização OTIMISTA Instantânea na UI (Zero Latência)
    // Se a cotação possuir múltiplos itens agrupados sob o mesmo número, atualiza a situação de todos os itens daquela cotação.
    setDbQuotesItems(prevItems =>
      prevItems.map(it => {
        const isSameQuote =
          (targetId && it.cotacaoId && String(it.cotacaoId).trim() === targetId) ||
          (targetNumero && it.cotacao && String(it.cotacao).trim().toLowerCase() === targetNumero.toLowerCase()) ||
          it.idVer === item.idVer;

        if (isSameQuote) {
          return { ...it, status: newStatus as StatusProposta };
        }
        return it;
      })
    );

    // Atualiza também na lista agrupada de cotações distintas
    setSavedDbQuotes(prev =>
      prev.map(q => {
        const isSameQuote =
          (targetId && q.id && String(q.id).trim() === targetId) ||
          (targetNumero && q.numero && String(q.numero).trim().toLowerCase() === targetNumero.toLowerCase());
        return isSameQuote ? { ...q, status: newStatus } : q;
      })
    );

    setUpdatingQuoteKey(keyForSpinner);

    try {
      // 2. Atualização Persistente no Supabase
      const { error: dbErr } = await updateCotacaoStatusDb(
        { id: targetId || undefined, numero: targetNumero || undefined },
        newStatus
      );

      if (dbErr) {
        console.warn('Aviso no Supabase ao atualizar status:', dbErr);
      }

      // 3. Desvinculado do LocalStorage para prevenir QuotaExceededError
      try {
        localStorage.removeItem('s_orcamentos');
      } catch (localErr) {}

      // 4. Se a cotação ativa atual for a mesma, atualiza seu status
      setActiveQuote(prev => {
        const isSame =
          (targetId && prev.id && String(prev.id).trim() === targetId) ||
          (targetNumero && prev.quoteNumber && String(prev.quoteNumber).trim().toLowerCase() === targetNumero.toLowerCase());

        if (isSame) {
          const mappedLabel =
            newStatus === 'aprovado' ? 'Aprovado' :
            newStatus === 'faturado' ? 'Faturado' :
            newStatus === 'rejeitado' ? 'Rejeitado' :
            newStatus === 'cancelado' ? 'Cancelado' :
            newStatus === 'em_analise' ? 'Pendente' :
            newStatus === 'pendente' ? 'Enviado' : 'Rascunho';
          return { ...prev, status: mappedLabel as any };
        }
        return prev;
      });

      // 5. Integração com o Módulo Financeiro: Quando uma cotação for alterada para "FATURADO"
      if (newStatus === 'faturado') {
        const itensDestaCotacao = dbQuotesItems.filter(it => 
          (targetId && it.cotacaoId && String(it.cotacaoId).trim() === targetId) ||
          (targetNumero && it.cotacao && String(it.cotacao).trim().toLowerCase() === targetNumero.toLowerCase()) ||
          it.idVer === item.idVer
        );
        const valorTotalCotacao = itensDestaCotacao.reduce((acc, it) => acc + (Number(it.valorGeral) || 0), 0) || Number(item.valorGeral) || 0;

        registrarFaturamentoCotacaoDb(
          targetNumero || String(item.cotacao) || 'COT',
          item.empresa || 'Cliente',
          valorTotalCotacao,
          targetId || item.cotacaoId
        ).then(() => {
          fetchBoletosDb().then(b => setBoletos(b));
          setStatusToast({
            message: `Cotação #${targetNumero || ''} faturada! Lançamento de ${formatCurrencyPtBr(valorTotalCotacao)} registrado automaticamente no Módulo Financeiro e indicador do Dia atualizado!`,
            type: 'success'
          });
        }).catch(err => {
          console.warn('Aviso ao registrar faturamento automático:', err);
        });
      }

      setStatusToast({
        message: `Situação da cotação ${targetNumero || 'selecionada'} alterada para ${getStatusLabel(newStatus)}.`,
        type: 'success'
      });
      setTimeout(() => setStatusToast(null), 3000);
    } catch (err) {
      console.error('Erro ao atualizar situação no Supabase:', err);
      setStatusToast({
        message: 'Erro ao registrar alteração no banco de dados.',
        type: 'info'
      });
      setTimeout(() => setStatusToast(null), 3000);
    } finally {
      setUpdatingQuoteKey(null);
    }
  };

  // Busca e carrega uma cotação estritamente por ID no banco de dados com fallback para LocalStorage
  const carregarCotacaoPorId = async (idOuNumero: string) => {
    if (!idOuNumero) return null;
    try {
      const cot = await fetchCotacaoById(idOuNumero);
      if (cot) {
        const mappedItems: QuoteItem[] = (cot.cotacao_itens && cot.cotacao_itens.length > 0)
          ? cot.cotacao_itens.map((it, idx) => ({
              id: String(it.id || (idx + 1)),
              date: cot.data || new Date().toISOString().slice(0, 10),
              companyName: cot.cliente_nome || 'Cliente Selecionado',
              constant: '1.0',
              diameter: it.medida || '',
              description: it.descricao || it.produto || `Item #${idx + 1}`,
              descricao: it.descricao || it.produto || `Item #${idx + 1}`,
              material: it.material || it.produto || 'Aço Carbono',
              constanteNome: it.material || it.produto || 'Material',
              measure: it.medida || 'Conforme desenho',
              widthLength: it.medida || '',
              quantity: Number(it.quantidade) || 1,
              qtd: Number(it.quantidade) || 1,
              unitPrice: Number(it.valor_unitario) || 0,
              valorUnitario: Number(it.valor_unitario) || 0,
              subtotal: Number(it.valor_total) || (Number(it.valor_unitario) * Number(it.quantidade)),
              notes: it.observacao || '',
              observacao: it.observacao || '',
              drawingImage: it.desenho_url || undefined,
              fotoDesenho: it.desenho_url || undefined,
              totalWeightKg: 0,
              pesoTotal: 0
            }))
          : [{
              id: '1',
              date: cot.data || new Date().toISOString().slice(0, 10),
              companyName: cot.cliente_nome || 'Cliente Selecionado',
              constant: '1.0',
              diameter: '',
              description: cot.observacoes || 'Item da cotação',
              descricao: cot.observacoes || 'Item da cotação',
              material: 'Aço Carbono',
              constanteNome: 'Aço Carbono',
              measure: 'Conforme desenho',
              widthLength: '',
              quantity: 1,
              qtd: 1,
              unitPrice: Number(cot.valor_total) || 0,
              valorUnitario: Number(cot.valor_total) || 0,
              subtotal: Number(cot.valor_total) || 0,
              notes: '',
              observacao: '',
              totalWeightKg: 0,
              pesoTotal: 0
            }];

        const mapStatus = (st?: string): Quote['status'] => {
          if (!st) return 'Rascunho';
          const lower = st.toLowerCase();
          if (lower === 'aprovado') return 'Aprovado';
          if (lower === 'pendente') return 'Enviado';
          if (lower === 'rejeitado') return 'Cancelado';
          return 'Rascunho';
        };

        const newQ: Quote = {
          id: cot.id || idOuNumero,
          quoteNumber: cot.numero || idOuNumero,
          date: cot.data || new Date().toISOString().slice(0, 10),
          clientName: cot.cliente_nome || 'Cliente Selecionado',
          contactPerson: cot.contato || '',
          status: mapStatus(cot.status),
          validityDays: 10,
          paymentTerms: 'À Vista / Pix',
          observations: cot.observacoes || '',
          items: mappedItems,
          subtotalTotal: Number(cot.valor_total) || 0,
          grandTotal: Number(cot.valor_total) || 0,
          discount: 0,
          shipping: 0,
          totalWeightKg: 0,
          createdAt: cot.created_at || new Date().toISOString(),
          updatedAt: cot.created_at || new Date().toISOString()
        };

        setActiveQuote(newQ);
        setSelectedClientName(newQ.clientName);
        setSelectedOrderKey(newQ.id || newQ.quoteNumber);

        const fotosMap: Record<number, string> = {};
        mappedItems.forEach((it, idx) => {
          if (it.drawingImage) {
            fotosMap[idx] = it.drawingImage;
          }
        });
        setDrawingPhotos(fotosMap);
        setSelectedItemIndex(0);

        // Atualiza a URL sem recarregar a página
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('id', cot.id || cot.numero);
          window.history.pushState({}, '', url.toString());
        }

        return newQ;
      }
    } catch (err) {
      console.warn("Supabase sem resposta para ID:", err);
    }

    // Fallback: busca em localStorage se não encontrar no Supabase
    try {
      const saved = localStorage.getItem('s_orcamentos');
      if (saved) {
        const quotes: Quote[] = JSON.parse(saved);
        const found = quotes.find(
          q => q.id === idOuNumero || q.quoteNumber === idOuNumero || (q.quoteNumber && q.quoteNumber.trim().toLowerCase() === idOuNumero.trim().toLowerCase())
        );
        if (found) {
          setActiveQuote(found);
          setSelectedClientName(found.clientName || 'Cliente Balcão');
          setSelectedOrderKey(found.id || found.quoteNumber);

          const fotosMap: Record<number, string> = {};
          (found.items || []).forEach((it, idx) => {
            if (it.drawingImage || (it as any).fotoDesenho) {
              fotosMap[idx] = it.drawingImage || (it as any).fotoDesenho;
            }
          });
          setDrawingPhotos(fotosMap);
          setSelectedItemIndex(0);
          return found;
        }
      }
    } catch (e) {
      console.warn("Erro ao buscar quote local:", e);
    }

    return null;
  };

  // Carrega cotações e itens do Supabase e LocalStorage com deduplicação rigorosa e exibindo apenas a versão mais recente
  const loadAllConsultaData = async (forceRefresh = false) => {
    if (isLoadingConsultaRef.current) return;
    isLoadingConsultaRef.current = true;
    setIsLoadingConsulta(true);

    const itemsList: ConsultaItem[] = [];
    const seenQuoteNumbers = new Set<string>();
    const distinctQuotesList: { id: string; numero: string; cliente: string; data: string; total: number; createdAt?: string }[] = [];

    try {
      // 1. Do Supabase (Prioridade Máxima com limite e caching em memória)
      try {
        const dbData = await fetchCotacoesDb(undefined, undefined, { forceRefresh, limit: 300 });
        if (dbData && dbData.length > 0) {
          // Ordena por data e criação decrescente (mais recentes primeiro)
          const sortedDbData = [...dbData].sort((a, b) => {
            const dateA = new Date(a.created_at || a.data || 0).getTime();
            const dateB = new Date(b.created_at || b.data || 0).getTime();
            return dateB - dateA;
          });

          sortedDbData.forEach((q, qIdx) => {
            const rawNum = q.numero || q.id || '';
            const key = String(rawNum).trim().toLowerCase();

            // Se já processamos o registro mais recente deste orçamento, IGNORA versões antigas duplicadas
            if (!key || seenQuoteNumbers.has(key)) {
              return;
            }
            seenQuoteNumbers.add(key);
            if (q.id) seenQuoteNumbers.add(String(q.id).trim().toLowerCase());

            distinctQuotesList.push({
              id: q.id || '',
              numero: q.numero || 'COT-SEM-NUMERO',
              cliente: q.cliente_nome || 'Cliente Balcão',
              data: q.data || q.created_at || '',
              total: Number(q.valor_total) || 0,
              createdAt: q.created_at || q.data || ''
            });

            // Adiciona SOMENTE os itens da versão mais recente desta cotação
            (q.cotacao_itens || []).forEach((it, itIdx) => {
                const isFaturadoQuote = String(q.situacao || '').toUpperCase() === 'FATURADO' || String(q.status || '').toLowerCase() === 'faturado';
                const computedQuoteStatus = isFaturadoQuote ? 'faturado' : (q.status as StatusProposta);

                itemsList.push({
                  idVer: 30000 + qIdx * 100 + itIdx,
                  data: formatSafeDate(q.data || q.created_at),
                  empresa: q.cliente_nome || 'Cliente Balcão',
                  contato: q.contato || '-',
                  produto: it.produto || 'Peça',
                  medida: it.medida || '',
                  descricao: it.descricao || 'Item UsiCorte',
                  valor: formatCurrency(it.valor_unitario || 0),
                  qtd: it.quantidade || 1,
                  unitario: it.valor_unitario || 0,
                  valorGeral: it.valor_total || ((it.valor_unitario || 0) * (it.quantidade || 1)),
                  cotacao: q.numero,
                  cotacaoId: q.id,
                  itemId: it.id,
                  observacao: it.observacao || (it as any).notes || (it as any).obs || '',
                  obs: it.observacao || (it as any).notes || (it as any).obs || '',
                  status: computedQuoteStatus,
                  desenhoUrl: it.desenho_url || undefined
                });
            });
          });
        }
      } catch (err) {
        console.warn('Supabase offline ou sem cotações:', err);
      }

      // 2. Do LocalStorage (apenas as cotações que NÃO existem no Supabase)
      const saved = localStorage.getItem('s_orcamentos');
      if (saved) {
        try {
          const quotes: Quote[] = JSON.parse(saved);
          if (Array.isArray(quotes)) {
            // Ordena por data de atualização mais recente
            const sortedLocal = [...quotes].sort((a, b) => {
              const dateA = new Date(a.updatedAt || a.createdAt || a.date || 0).getTime();
              const dateB = new Date(b.updatedAt || b.createdAt || b.date || 0).getTime();
              return dateB - dateA;
            });

            sortedLocal.forEach((q, qIdx) => {
              const key = String(q.quoteNumber || q.id || '').trim().toLowerCase();
              if (key && !seenQuoteNumbers.has(key)) {
                seenQuoteNumbers.add(key);

                distinctQuotesList.push({
                  id: q.id || '',
                  numero: q.quoteNumber || `COT-LOCAL-${qIdx + 1}`,
                  cliente: q.clientName || 'Cliente Balcão',
                  data: q.date || q.createdAt || '',
                  total: q.grandTotal || q.subtotalTotal || (q.items || []).reduce((acc, i) => acc + ((i.unitPrice || 0) * (i.quantity || 1)), 0),
                  createdAt: q.createdAt || q.updatedAt || q.date || ''
                });

                (q.items || []).forEach((it, itIdx) => {
                  const obsText = it.notes || it.observacao || (it as any).obs || '';
                    const isFaturadoLocal = (q.status || '').toLowerCase().includes('faturad') || ((q as any).situacao || '').toUpperCase() === 'FATURADO' || q.paymentStatus === 'Pago';
                    const computedLocalStatus = isFaturadoLocal ? 'faturado' :
                      (q.status?.toLowerCase().includes('aprov') ? 'aprovado' :
                       q.status?.toLowerCase().includes('canc') ? 'cancelado' :
                       q.status?.toLowerCase().includes('rej') ? 'rejeitado' :
                       q.status?.toLowerCase().includes('env') ? 'pendente' : 'rascunho');

                    itemsList.push({
                      idVer: 20000 + qIdx * 100 + itIdx,
                      data: formatSafeDate(q.date || q.createdAt),
                      empresa: q.clientName || 'Cliente Balcão',
                      contato: q.contactPerson || '-',
                      produto: it.constantName || it.description || 'Material',
                      medida: formatarMedidasLimpa(it),
                      descricao: it.description || 'Peça UsiCorte',
                      valor: formatCurrency(it.unitPrice || 0),
                      qtd: it.quantity || 1,
                      unitario: it.unitPrice || 0,
                      valorGeral: (it.unitPrice || 0) * (it.quantity || 1),
                      cotacao: q.quoteNumber || `COT-${qIdx + 1}`,
                      cotacaoId: q.id,
                      itemId: it.id,
                      observacao: obsText,
                      obs: obsText,
                      status: computedLocalStatus as StatusProposta,
                      desenhoUrl: it.drawingImage || (it as any).fotoDesenho || (it as any).desenho_url || undefined
                    });
                });
              }
            });
          }
        } catch (e) {
          console.warn('Erro ao ler s_orcamentos:', e);
        }

        // Rotina segura de sincronização: envia orçamentos locais pendentes ao Supabase
        // e só limpa a chave 's_orcamentos' após confirmação de gravação no banco
        executarMigracaoEmergenciaOrcamentos().then(res => {
          if (res.migratedCount > 0) {
            // Se novos orçamentos foram salvos no Supabase, atualiza os dados da consulta
            loadAllConsultaData();
          }
        }).catch(err => {
          console.warn('Aviso ao sincronizar emergência em ReportsModule:', err);
        });
      }

      setSavedDbQuotes(distinctQuotesList);
      setDbQuotesItems(itemsList);
    } finally {
      isLoadingConsultaRef.current = false;
      setIsLoadingConsulta(false);
    }
  };

  useEffect(() => {
    loadAllConsultaData();

    const handleMigrated = () => {
      loadAllConsultaData();
    };
    window.addEventListener('cotacoes_migradas_emergencia', handleMigrated);
    return () => {
      window.removeEventListener('cotacoes_migradas_emergencia', handleMigrated);
    };
  }, []);

  // Mantém a cotação ativa sincronizada com currentQuote se o usuário estiver na visualização da cotação atual
  useEffect(() => {
    if (selectedOrderKey === 'CURRENT') {
      setActiveQuote(currentQuote);
    }
  }, [currentQuote, selectedOrderKey]);

  // Handler para clicar no botão de imagem na tabela de consulta
  const handleItemImageButtonClick = (item: ConsultaItem) => {
    setTargetImageItem(item);
    if (item.desenhoUrl) {
      setActiveImagePreviewItem(item);
    } else {
      if (itemFileInputRef.current) {
        itemFileInputRef.current.value = '';
        itemFileInputRef.current.click();
      }
    }
  };

  // Handler para processar o arquivo selecionado (Imagem ou DXF) para um item específico
  const handleItemFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetImageItem) return;

    const currentTarget = targetImageItem;
    setUploadingItemId(currentTarget.idVer);

    try {
      // 1. Converte imagem ou arquivo DXF em base64 com alto contraste e geometria enquadrada
      const base64 = await fileToDxfImage(file, {
        medida: currentTarget.medida,
        material: currentTarget.produto,
        observacao: currentTarget.observacao,
        descricao: currentTarget.descricao
      });

      // 2. Upload para o bucket 'desenhos' do Supabase Storage
      const cotacaoKey = currentTarget.cotacao || String(currentTarget.cotacaoId || 'geral');
      try {
        await uploadDesenhoStorage(cotacaoKey, file, currentTarget.itemId);
      } catch (storageErr) {
        console.warn('Aviso upload storage:', storageErr);
      }

      // 3. Atualiza na tabela cotacao_itens no Supabase se houver itemId
      if (currentTarget.itemId) {
        try {
          await db
            .from('cotacao_itens')
            .update({ desenho_url: base64 })
            .eq('id', currentTarget.itemId);
        } catch (dbErr) {
          console.warn('Aviso update cotacao_itens:', dbErr);
        }
      }

      // 4. Desvinculado do LocalStorage para evitar QuotaExceededError
      try {
        localStorage.removeItem('s_orcamentos');
      } catch (lsErr) {}

      // 5. Atualiza estado da tabela de consulta
      setDbQuotesItems(prev => prev.map(it => {
        if (it.idVer === currentTarget.idVer) {
          return { ...it, desenhoUrl: base64 };
        }
        return it;
      }));

      // 6. Atualiza activeImagePreviewItem se o modal estiver aberto
      if (activeImagePreviewItem && activeImagePreviewItem.idVer === currentTarget.idVer) {
        setActiveImagePreviewItem({ ...currentTarget, desenhoUrl: base64 });
      }

      // 7. Sincroniza com activeQuote / drawingPhotos se cotação estiver aberta
      if (activeQuote.quoteNumber === currentTarget.cotacao || activeQuote.id === currentTarget.cotacaoId) {
        const itemIndex = activeQuote.items?.findIndex(
          (it, idx) => (currentTarget.itemId && String(it.id) === String(currentTarget.itemId)) ||
                       idx === (currentTarget.idVer % 100)
        );
        if (itemIndex !== undefined && itemIndex >= 0) {
          setDrawingPhotos(prev => ({ ...prev, [itemIndex]: base64 }));
        }
      }

      setDeleteFeedback({
        message: `Imagem/desenho salvo com sucesso no item "${currentTarget.descricao}".`,
        type: 'success'
      });
      setTimeout(() => setDeleteFeedback(null), 4000);
    } catch (err: any) {
      console.error('Erro ao salvar imagem do item:', err);
      setDeleteFeedback({
        message: `Erro ao processar imagem: ${err?.message || 'Falha na conversão'}`,
        type: 'error'
      });
      setTimeout(() => setDeleteFeedback(null), 4500);
    } finally {
      setUploadingItemId(null);
      e.target.value = '';
    }
  };

  // Remove a imagem do item no Supabase, LocalStorage e Estado Local
  const handleRemoveItemImage = async (item: ConsultaItem) => {
    try {
      // 1. Supabase
      if (item.itemId) {
        await db
          .from('cotacao_itens')
          .update({ desenho_url: null })
          .eq('id', item.itemId);
      }

      // 2. Desvinculado do LocalStorage para evitar QuotaExceededError
      try {
        localStorage.removeItem('s_orcamentos');
      } catch (e) {}

      // 3. Estado local
      setDbQuotesItems(prev => prev.map(it => {
        if (it.idVer === item.idVer) {
          return { ...it, desenhoUrl: undefined };
        }
        return it;
      }));

      if (activeQuote.quoteNumber === item.cotacao || activeQuote.id === item.cotacaoId) {
        const itemIndex = activeQuote.items?.findIndex(
          (it, idx) => (item.itemId && String(it.id) === String(item.itemId)) ||
                       idx === (item.idVer % 100)
        );
        if (itemIndex !== undefined && itemIndex >= 0) {
          setDrawingPhotos(prev => {
            const next = { ...prev };
            delete next[itemIndex];
            return next;
          });
        }
      }

      setActiveImagePreviewItem(null);
      setDeleteFeedback({
        message: `Imagem/desenho removido do item "${item.descricao}".`,
        type: 'success'
      });
      setTimeout(() => setDeleteFeedback(null), 4000);
    } catch (err: any) {
      console.error('Erro ao remover imagem do item:', err);
      setDeleteFeedback({
        message: `Erro ao remover imagem: ${err?.message || 'Falha na operação'}`,
        type: 'error'
      });
      setTimeout(() => setDeleteFeedback(null), 4000);
    }
  };

  // Exclusão Individual (Item / Orçamento)
  const executeDeleteItem = async (item: ConsultaItem) => {
    setIsDeleting(true);
    try {
      // 1. Apaga do Supabase
      if (item.itemId) {
        await deleteCotacaoItemDb(item.itemId);
      }
      if (item.cotacaoId || item.cotacao) {
        if (item.cotacaoId) {
          await deleteCotacaoDb(item.cotacaoId);
        } else if (item.cotacao) {
          await deleteCotacaoDb(item.cotacao);
        }
      }

      // 2. Desvinculado do LocalStorage para evitar QuotaExceededError
      try {
        localStorage.removeItem('s_orcamentos');
      } catch (e) {}

      // 3. Atualiza estado local da tabela
      setDbQuotesItems(prev => prev.filter(it => it.idVer !== item.idVer));
      setSelectedIds(prev => prev.filter(id => id !== item.idVer));
      if (item.cotacaoId || item.cotacao) {
        setSavedDbQuotes(prev => prev.filter(q => q.id !== item.cotacaoId && q.numero !== item.cotacao));
      }

      setDeleteFeedback({
        message: `Registro da cotação "${item.cotacao}" excluído com sucesso do banco de dados.`,
        type: 'success'
      });
      setTimeout(() => setDeleteFeedback(null), 4500);
      setItemToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir item:', err);
      setDeleteFeedback({
        message: `Erro ao excluir: ${err?.message || 'Falha na operação'}`,
        type: 'error'
      });
      setTimeout(() => setDeleteFeedback(null), 5000);
    } finally {
      setIsDeleting(false);
    }
  };

  // Exclusão em Massa (Itens Selecionados)
  const executeBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);
    try {
      const itemsToRemove = allConsultaItems.filter(i => selectedIds.includes(i.idVer));
      
      const cotacoesParaExcluir = new Set<string>();
      const itensParaExcluir = new Set<string | number>();

      itemsToRemove.forEach(it => {
        if (it.cotacaoId) cotacoesParaExcluir.add(it.cotacaoId);
        if (it.cotacao) cotacoesParaExcluir.add(it.cotacao);
        if (it.itemId) itensParaExcluir.add(it.itemId);
      });

      // 1. Exclui do Supabase
      for (const itId of Array.from(itensParaExcluir)) {
        await deleteCotacaoItemDb(itId);
      }
      for (const cotId of Array.from(cotacoesParaExcluir)) {
        await deleteCotacaoDb(cotId);
      }

      // 2. Desvinculado do LocalStorage para evitar QuotaExceededError
      try {
        localStorage.removeItem('s_orcamentos');
      } catch (e) {}

      // 3. Atualiza estado local
      const removedIdVers = new Set(selectedIds);
      setDbQuotesItems(prev => prev.filter(it => !removedIdVers.has(it.idVer)));
      setSavedDbQuotes(prev => prev.filter(q => !cotacoesParaExcluir.has(q.id) && !cotacoesParaExcluir.has(q.numero)));
      setSelectedIds([]);

      setDeleteFeedback({
        message: `${itemsToRemove.length} item(ns) selecionado(s) excluído(s) com sucesso do banco de dados.`,
        type: 'success'
      });
      setTimeout(() => setDeleteFeedback(null), 4500);
      setIsBulkDeleteOpen(false);
    } catch (err: any) {
      console.error('Erro ao excluir itens em massa:', err);
      setDeleteFeedback({
        message: `Erro ao excluir em lote: ${err?.message || 'Falha na operação'}`,
        type: 'error'
      });
      setTimeout(() => setDeleteFeedback(null), 5000);
    } finally {
      setIsDeleting(false);
    }
  };

  // Ao montar, verifica se há um ID de cotação na URL para filtrar a cotação correta
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('id') || params.get('cotacaoId') || params.get('pedidoId') || params.get('numero');
      if (urlId) {
        carregarCotacaoPorId(urlId);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ Itens da consulta carregados EXCLUSIVAMENTE do banco de dados (Supabase) e registros locais (localStorage).
  // Totalmente isolado da "Cotação Atual (Em Edição)" da primeira aba/orçamento para evitar contaminação cruzada.
  const allConsultaItems: ConsultaItem[] = useMemo(() => {
    return dbQuotesItems;
  }, [dbQuotesItems]);

  // Totais calculados por Situação (KPIs no topo)
  const totaisPorSituacao = useMemo(() => {
    const mapa: Record<string, { totalValor: number; qtdItens: number; cotacoesSet: Set<string> }> = {
      pendente: { totalValor: 0, qtdItens: 0, cotacoesSet: new Set() },
      aprovado: { totalValor: 0, qtdItens: 0, cotacoesSet: new Set() },
      rascunho: { totalValor: 0, qtdItens: 0, cotacoesSet: new Set() },
      faturado: { totalValor: 0, qtdItens: 0, cotacoesSet: new Set() },
      rejeitado: { totalValor: 0, qtdItens: 0, cotacoesSet: new Set() },
      cancelado: { totalValor: 0, qtdItens: 0, cotacoesSet: new Set() },
    };

    allConsultaItems.forEach(item => {
      const st = normalizeStatus(item.status);
      if (!mapa[st]) {
        mapa[st] = { totalValor: 0, qtdItens: 0, cotacoesSet: new Set() };
      }
      const val = Number(item.valorGeral) || (Number(item.unitario) || 0) * (Number(item.qtd) || 1) || 0;
      mapa[st].totalValor += val;
      mapa[st].qtdItens += 1;
      const refCot = (item.cotacao || item.cotacaoId || String(item.idVer)).trim();
      if (refCot) mapa[st].cotacoesSet.add(refCot);
    });

    return mapa;
  }, [allConsultaItems]);

  // Indicador consolidado de Faturado / Recebido Hoje
  const faturadoHojeInfo = useMemo(() => {
    const hojeIso = getDataHojeIso();
    let totalHoje = 0;
    let countHoje = 0;
    const quotesContadas = new Set<string>();

    // 1. Cotações marcadas como FATURADO com data de hoje
    allConsultaItems.forEach(item => {
      const st = normalizeStatus(item.status);
      if (st === 'faturado') {
        const itemData = (item.data || '').split('T')[0];
        if (itemData === hojeIso) {
          totalHoje += Number(item.valorGeral) || 0;
          const ref = (item.cotacao || String(item.idVer)).trim();
          if (ref && !quotesContadas.has(ref)) {
            quotesContadas.add(ref);
            countHoje += 1;
          }
        }
      }
    });

    // 2. Boletos baixados/recebidos na data de hoje
    boletos.forEach(b => {
      if (b.status === 'Baixado' && b.dataPagamento === hojeIso) {
        totalHoje += Number(b.valorParcela) || 0;
        countHoje += 1;
      }
    });

    return { total: totalHoje, count: countHoje };
  }, [allConsultaItems, boletos]);

  // Alertas de Boletos com Vencimento Hoje e Atrasados
  const alertasBoletos = useMemo(() => {
    return obterBoletosVencimentoHoje(boletos);
  }, [boletos]);


  // Normaliza texto (minúsculo, sem acentos) para comparações
  const normalizar = (v: unknown) =>
    String(v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // Filtra a tabela: NOME DO CLIENTE (sempre) + categoria selecionada
  const filteredConsultaItems = useMemo(() => {
    const term = normalizar(inputBusca);
    const cliente = normalizar(clienteBusca);

    return allConsultaItems.filter(item => {
      // 1) Filtro fixo por nome do cliente
      if (cliente && !normalizar(item.empresa).includes(cliente)) return false;

      // 1.b) Filtro por situação da proposta
      const normStatus = normalizeStatus(item.status);
      if (statusFiltro === 'ativas') {
        // "Em Aberto / Ativas" (Padrão ao abrir a tela: exibe apenas Pendente, Aprovado, Rascunho)
        // Cotações marcadas como FATURADO saem automaticamente da listagem principal
        if (normStatus !== 'pendente' && normStatus !== 'aprovado' && normStatus !== 'rascunho') {
          return false;
        }
      } else if (statusFiltro === 'faturado') {
        // "Faturado" (Para consultar apenas orçamentos baixados/faturados)
        if (normStatus !== 'faturado') {
          return false;
        }
      } else if (statusFiltro === 'todos') {
        // "Todas as Situações" (Para ver todo o histórico consolidado)
      } else {
        if (normStatus !== normalizeStatus(statusFiltro)) return false;
      }

      // 2) Filtro por categoria selecionada
      if (!term) return true;

      switch (tipoFiltro) {
        case 'cliente':
          return normalizar(item.empresa).includes(term);
        case 'cotacao':
          return normalizar(item.cotacao).includes(term);
        case 'contato':
          return normalizar(item.contato).includes(term);
        case 'produto':
          return normalizar(item.produto).includes(term) || normalizar(item.descricao).includes(term);
        case 'data':
          return normalizar(item.data).includes(term);
        default:
          return true;
      }
    });
  }, [allConsultaItems, inputBusca, clienteBusca, tipoFiltro, statusFiltro]);

  // Mantém selecionados apenas os itens que continuam visíveis após o filtro
  useEffect(() => {
    setSelectedIds(prev => {
      const visiveis = new Set(filteredConsultaItems.map(i => i.idVer));
      const next = prev.filter(id => visiveis.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [filteredConsultaItems]);

  // Linhas selecionadas usadas no modelo de CORTE
  const itensCorte = useMemo(
    () => filteredConsultaItems.filter(i => selectedIds.includes(i.idVer)),
    [filteredConsultaItems, selectedIds]
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredConsultaItems.map(item => item.idVer));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (idVer: number) => {
    setSelectedIds(prev => 
      prev.includes(idVer) ? prev.filter(id => id !== idVer) : [...prev, idVer]
    );
  };

  // Reseta para a primeira página sempre que o usuário alterar os filtros de busca
  useEffect(() => {
    setCurrentPage(1);
  }, [inputBusca, clienteBusca, tipoFiltro, statusFiltro, pageSize]);

  // Itens paginados para renderização leve e de alta performance
  const paginatedConsultaItems = useMemo(() => {
    if (pageSize <= 0) return filteredConsultaItems;
    const start = (currentPage - 1) * pageSize;
    return filteredConsultaItems.slice(start, start + pageSize);
  }, [filteredConsultaItems, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize <= 0 || filteredConsultaItems.length === 0) return 1;
    return Math.ceil(filteredConsultaItems.length / pageSize);
  }, [filteredConsultaItems.length, pageSize]);

  const handleSelectCurrentPage = (checked: boolean) => {
    const pageIds = paginatedConsultaItems.map(item => item.idVer);
    if (checked) {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    } else {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    }
  };

  // ✅ Padronização de todos os botões de impressão da CONSULTA (GERAL, EMPRESA, PEDIDO, ETIQUETAS, CORTE)
  // Utiliza EXCLUSIVAMENTE a cotação/itens selecionados na tabela da Consulta,
  // 100% isolado do estado ou cache da primeira aba.
  const imprimirRelatorioGeral = async (tipoRelatorio: 'GERAL' | 'EMPRESA' | 'PEDIDO' | 'ETIQUETAS' | 'CORTE') => {
    if (selectedIds.length === 0) {
      alert(`Por favor, selecione ao menos um item da tabela para gerar o relatório de ${tipoRelatorio}.`);
      return;
    }

    document.body.classList.remove('print-pedido', 'print-etiqueta', 'print-proposta', 'print-corte', 'print-geral', 'print-empresa');

    // Configura o modelo ativo e classe de impressão conforme o botão acionado (renderizado na tela de Consulta)
    if (tipoRelatorio === 'CORTE') {
      setActiveModel('corte');
      setPrintMode('corte');
      document.body.classList.add('print-corte');
    } else if (tipoRelatorio === 'GERAL') {
      setActiveModel('A4-inteiro');
      setPrintMode('proposta');
      document.body.classList.add('print-geral');
    } else if (tipoRelatorio === 'EMPRESA') {
      setActiveModel('proposta-resumida');
      setPrintMode('proposta');
      document.body.classList.add('print-empresa');
    } else if (tipoRelatorio === 'PEDIDO') {
      setActiveModel('A4-2vias');
      setPrintMode('pedido');
      document.body.classList.add('print-pedido');
    } else if (tipoRelatorio === 'ETIQUETAS') {
      setActiveModel('etiqueta-80');
      setPrintMode('etiqueta');
      document.body.classList.add('print-etiqueta');
    }

    // Aciona a caixa de impressão após breve delay para atualização da renderização
    const onAfterPrint = () => {
      document.body.classList.remove('print-pedido', 'print-etiqueta', 'print-proposta', 'print-corte', 'print-geral', 'print-empresa');
      window.removeEventListener('afterprint', onAfterPrint);
    };
    window.addEventListener('afterprint', onAfterPrint);

    setTimeout(() => {
      window.print();
    }, 250);
  };

  // Sync client name if quote updates
  useEffect(() => {
    if (currentQuote.clientName && selectedOrderKey === 'CURRENT') {
      setSelectedClientName(currentQuote.clientName);
    }
  }, [currentQuote.clientName, selectedOrderKey]);

  // ✅ Normaliza texto para comparação (sem acento, sem símbolos, maiúsculo)
  const normalizeKey = (txt: string) =>
    (txt || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\.[^.]+$/, '')            // remove extensão do arquivo
      .replace(/[^a-zA-Z0-9]/g, '')       // remove espaços, traços, underline...
      .toUpperCase();

  // Texto de "observação" usado como etiqueta de cada item
  const getItemLabel = (it: Partial<QuoteItem>) =>
    (it?.observacao || it?.notes || it?.info || it?.descricao || '') as string;

  // Mensagem de resultado do casamento nome-do-arquivo x observação
  const [matchInfo, setMatchInfo] = useState<string>('');

  // Handle clipboard paste (Ctrl + V / PrintScreen / Win+Shift+S ou arquivo DXF)
  const processClipboardItems = async (clipboardData: DataTransfer | null) => {
    if (!clipboardData) return;
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1 || item.kind === 'file') {
        const blob = item.getAsFile();
        if (blob) {
          try {
            const targetItem = displayQuote.items[selectedItemIndex];
            const base64 = await fileToDxfImage(blob, {
              medida: targetItem ? formatarMedidasLimpa(targetItem) : undefined,
              material: targetItem?.material || targetItem?.constanteNome,
              observacao: targetItem?.observacao || targetItem?.notes,
              descricao: targetItem?.descricao || targetItem?.description
            });
            setDrawingPhotos(prev => ({ ...prev, [selectedItemIndex]: base64 }));
            setPasteSuccess(true);
            setTimeout(() => setPasteSuccess(false), 4000);

            // Persistência local e DB
            if (displayQuote?.items?.[selectedItemIndex]) {
              displayQuote.items[selectedItemIndex].drawingImage = base64;
              (displayQuote.items[selectedItemIndex] as any).fotoDesenho = base64;
              (displayQuote.items[selectedItemIndex] as any).desenho_url = base64;
            }

            try {
              localStorage.removeItem('s_orcamentos');
            } catch (e) {}

            const targetDbItem = targetItem as any;
            if (targetDbItem?.id && !isNaN(Number(targetDbItem.id))) {
              db.from('cotacao_itens')
                .update({ desenho_url: base64 })
                .eq('id', Number(targetDbItem.id))
                .then(() => {}, (dbErr: any) => console.warn('Aviso update cotacao_itens:', dbErr));
            }
          } catch (err) {
            console.warn('Erro ao processar imagem ou DXF colado:', err);
          }
        }
        break;
      }
    }

    // Se o clipboard contém texto com dados de arquivo DXF
    const text = clipboardData.getData('text');
    if (text && (text.includes('ENTITIES') || text.includes('SECTION'))) {
      try {
        const targetItem = displayQuote.items[selectedItemIndex];
        const dataUrl = renderDxfToDataUrl(text, {
          medida: targetItem ? formatarMedidasLimpa(targetItem) : undefined,
          material: targetItem?.material || targetItem?.constanteNome,
          observacao: targetItem?.observacao || targetItem?.notes,
          descricao: targetItem?.descricao || targetItem?.description
        });
        if (dataUrl) {
          setDrawingPhotos(prev => ({ ...prev, [selectedItemIndex]: dataUrl }));
          setPasteSuccess(true);
          setTimeout(() => setPasteSuccess(false), 4000);

          if (displayQuote?.items?.[selectedItemIndex]) {
            displayQuote.items[selectedItemIndex].drawingImage = dataUrl;
            (displayQuote.items[selectedItemIndex] as any).fotoDesenho = dataUrl;
            (displayQuote.items[selectedItemIndex] as any).desenho_url = dataUrl;
          }

          try {
            localStorage.removeItem('s_orcamentos');
          } catch (e) {}

          const targetDbItem = targetItem as any;
          if (targetDbItem?.id && !isNaN(Number(targetDbItem.id))) {
            db.from('cotacao_itens')
              .update({ desenho_url: dataUrl })
              .eq('id', Number(targetDbItem.id))
              .then(() => {}, (dbErr: any) => console.warn('Aviso update cotacao_itens:', dbErr));
          }
        }
      } catch (err) {
        console.warn('Erro ao interpretar texto DXF colado:', err);
      }
    }
  };

  const handlePasteEvent = (e: React.ClipboardEvent) => {
    processClipboardItems(e.clipboardData);
  };

  // Handle saved file / order switcher
  const handleOrderChange = async (key: string) => {
    setSelectedOrderKey(key);

    if (key === 'CURRENT') {
      setActiveQuote(currentQuote);
      setSelectedClientName(currentQuote.clientName || 'Cliente Balcão');
      setDrawingPhotos({});
      setSelectedItemIndex(0);
      return;
    }

    const loaded = await carregarCotacaoPorId(key);
    if (!loaded) {
      // Fallback para itens da lista em memória
      const matchedItems = dbQuotesItems.filter(
        i => i.cotacao === key || i.cotacaoId === key
      );
      if (matchedItems.length > 0) {
        const first = matchedItems[0];
        const sumTotal = matchedItems.reduce((acc, curr) => acc + (curr.valorGeral || (curr.unitario * curr.qtd)), 0);
        const reconstructed: Quote = {
          id: first.cotacaoId || first.cotacao || key,
          quoteNumber: first.cotacao || key,
          date: first.data || new Date().toISOString().slice(0, 10),
          clientName: first.empresa || 'Cliente Balcão',
          contactPerson: first.contato !== '-' ? first.contato : '',
          status: (first.status === 'aprovado' ? 'Aprovado' : first.status === 'pendente' ? 'Enviado' : first.status === 'rejeitado' ? 'Cancelado' : 'Rascunho'),
          validityDays: 10,
          paymentTerms: 'À Vista / Pix',
          observations: first.observacao || '',
          items: matchedItems.map((it, idx) => ({
            id: String(it.itemId || it.idVer || idx + 1),
            date: it.data || new Date().toISOString().slice(0, 10),
            companyName: it.empresa,
            description: it.descricao,
            descricao: it.descricao,
            constantName: it.produto,
            material: it.produto,
            constant: '1.0',
            measure: it.medida,
            widthLength: it.medida,
            quantity: it.qtd,
            qtd: it.qtd,
            unitPrice: it.unitario,
            valorUnitario: it.unitario,
            subtotal: it.valorGeral,
            notes: it.observacao || '',
            observacao: it.observacao || '',
            drawingImage: it.desenhoUrl || undefined,
            fotoDesenho: it.desenhoUrl || undefined
          })),
          subtotalTotal: sumTotal,
          grandTotal: sumTotal,
          discount: 0,
          shipping: 0,
          totalWeightKg: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const fotosMap: Record<number, string> = {};
        reconstructed.items.forEach((it, idx) => {
          if (it.drawingImage) {
            fotosMap[idx] = it.drawingImage;
          }
        });
        setDrawingPhotos(fotosMap);

        setActiveQuote(reconstructed);
        setSelectedClientName(reconstructed.clientName);
        setSelectedItemIndex(0);
      }
    }
  };


  // Handle drawing photo upload (SELEÇÃO MÚLTIPLA + casamento pelo nome do arquivo, aceita PNG/JPG e .DXF)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;

    // Mapa: observação normalizada -> índice do item
    const labelMap = new Map<string, number>();
    (displayQuote.items || []).forEach((it, idx) => {
      const key = normalizeKey(getItemLabel(it));
      if (key && !labelMap.has(key)) labelMap.set(key, idx);
    });

    const matched: string[] = [];
    const unmatched: string[] = [];

    for (const file of files) {
      const fileKey = normalizeKey(file.name.replace(/\.dxf$/i, ''));

      // 1) match exato  2) match parcial (arquivo contém a observação ou vice-versa)
      let targetIdx = labelMap.get(fileKey);
      if (targetIdx === undefined) {
        for (const [key, idx] of labelMap.entries()) {
          if (fileKey.includes(key) || key.includes(fileKey)) {
            targetIdx = idx;
            break;
          }
        }
      }
      // 3) se veio um único arquivo e nada casou, aplica no item selecionado
      if (targetIdx === undefined && files.length === 1) targetIdx = selectedItemIndex;

      if (targetIdx === undefined) {
        unmatched.push(file.name);
        continue;
      }

      const idx = targetIdx;
      try {
        const targetItem = displayQuote.items[idx];
        const base64 = await fileToDxfImage(file, {
          medida: targetItem ? formatarMedidasLimpa(targetItem) : undefined,
          material: targetItem?.material || targetItem?.constanteNome,
          observacao: targetItem?.observacao || targetItem?.notes,
          descricao: targetItem?.descricao || targetItem?.description
        });
        setDrawingPhotos(prev => ({ ...prev, [idx]: base64 }));
        matched.push(`${file.name} → item ${idx + 1}`);

        // Persistência no item do activeQuote
        if (displayQuote?.items?.[idx]) {
          displayQuote.items[idx].drawingImage = base64;
          (displayQuote.items[idx] as any).fotoDesenho = base64;
          (displayQuote.items[idx] as any).desenho_url = base64;
        }

        // Desvinculado do LocalStorage para evitar QuotaExceededError
        try {
          localStorage.removeItem('s_orcamentos');
        } catch (lsErr) {}

        // Persistência no Supabase cotacao_itens
        const targetDbItem = targetItem as any;
        if (targetDbItem?.id && !isNaN(Number(targetDbItem.id))) {
          db.from('cotacao_itens')
            .update({ desenho_url: base64 })
            .eq('id', Number(targetDbItem.id))
            .then(() => {}, (dbErr: any) => console.warn('Aviso update cotacao_itens:', dbErr));
        }

        // Sincroniza com Supabase Storage bucket 'desenhos'
        if (displayQuote?.quoteNumber) {
          uploadDesenhoStorage(displayQuote.quoteNumber, file, targetDbItem?.id).catch(e => {
            console.warn('Upload bucket desenhos aviso:', e);
          });
        }
      } catch (err) {
        console.error('Erro ao converter arquivo para imagem:', err);
        unmatched.push(file.name);
      }
    }

    setPasteSuccess(matched.length > 0);
    setMatchInfo(
      `${matched.length} desenho(s)/imagem(ns) vinculado(s)` +
      (unmatched.length ? ` • sem correspondência: ${unmatched.join(', ')}` : '')
    );
    setTimeout(() => { setPasteSuccess(false); setMatchInfo(''); }, 6000);

    // permite reenviar os mesmos arquivos
    e.target.value = '';
  };

  // Alterna entre os modelos e ativa a caixa de impressão do navegador com setTimeout
  const gerarEImprimir = (tipoProposta: PrintModelType | 'pedido' | 'etiqueta' | 'proposta') => {
    // Remove classes anteriores
    document.body.classList.remove('print-pedido', 'print-etiqueta', 'print-proposta', 'print-corte');

    if (tipoProposta === 'corte') {
      setPrintMode('corte');
      setActiveModel('corte');
      document.body.classList.add('print-corte');
    } else if (tipoProposta === 'pedido' || tipoProposta === 'A4-2vias') {
      setPrintMode('pedido');
      setActiveModel('A4-2vias');
      document.body.classList.add('print-pedido');
    } else if (tipoProposta === 'etiqueta' || tipoProposta === 'etiqueta-80') {
      setPrintMode('etiqueta');
      setActiveModel('etiqueta-80');
      document.body.classList.add('print-etiqueta');
    } else {
      setPrintMode('proposta');
      setActiveModel('A4-inteiro');
      document.body.classList.add('print-proposta');
    }

    // Pequeno setTimeout antes do window.print() para dar tempo do React atualizar a tela antes de abrir a janela da impressora
    const onAfterPrint = () => {
      document.body.classList.remove('print-pedido', 'print-etiqueta', 'print-proposta', 'print-corte', 'print-geral', 'print-empresa');
      window.removeEventListener('afterprint', onAfterPrint);
    };
    window.addEventListener('afterprint', onAfterPrint);

    setTimeout(() => {
      window.print();
    }, 150);
  };

  const EMPTY_QUOTE: Quote = {
    id: '',
    quoteNumber: '',
    date: '',
    clientName: '',
    contactPerson: '',
    status: 'Rascunho',
    validityDays: 10,
    paymentTerms: 'À Vista / Pix',
    observations: '',
    items: [],
    subtotalTotal: 0,
    grandTotal: 0,
    discount: 0,
    shipping: 0,
    totalWeightKg: 0,
    createdAt: '',
    updatedAt: ''
  };

  // ✅ Cotação gerada EXCLUSIVAMENTE a partir das linhas selecionadas na tabela da Consulta
  // 100% independente da "Cotação Atual (Em Edição)" e de qualquer cache da primeira aba.
  const consultaSelectedQuote = useMemo<Quote>(() => {
    const selRows = filteredConsultaItems.filter(i => selectedIds.includes(i.idVer));
    if (selRows.length === 0) return EMPTY_QUOTE;

    const firstItem = selRows[0];
    const clientName = firstItem.empresa || 'CLIENTE BALCÃO';
    const quoteNum = firstItem.cotacao || 'COT-SELECIONADA';
    const dateVal = firstItem.data || new Date().toISOString().slice(0, 10);

    const mapStatus = (st?: string): Quote['status'] => {
      if (!st) return 'Rascunho';
      const lower = st.toLowerCase();
      if (lower.includes('aprov')) return 'Aprovado';
      if (lower.includes('pend') || lower.includes('env')) return 'Enviado';
      if (lower.includes('rej') || lower.includes('canc')) return 'Cancelado';
      return 'Rascunho';
    };

    const mappedItems: QuoteItem[] = selRows.map((it, idx) => {
      const persistentDrawing = it.desenhoUrl || undefined;
      const unitVal = Number(it.unitario) || 0;
      const qty = Number(it.qtd) || 1;
      const subVal = Number(it.valorGeral) || (unitVal * qty);

      return {
        id: String(it.itemId || it.idVer || idx + 1),
        date: it.data || dateVal,
        companyName: it.empresa || clientName,
        constant: '1.0',
        diameter: it.medida || '',
        description: it.descricao || it.produto || `Item #${idx + 1}`,
        descricao: it.descricao || it.produto || `Item #${idx + 1}`,
        material: it.produto || 'MATERIAL',
        constanteNome: it.produto || 'MATERIAL',
        measure: it.medida || '',
        widthLength: it.medida || '',
        quantity: qty,
        qtd: qty,
        unitPrice: unitVal,
        valorUnitario: unitVal,
        subtotal: subVal,
        notes: it.observacao || '',
        observacao: it.observacao || '',
        drawingImage: persistentDrawing,
        fotoDesenho: persistentDrawing,
        totalWeightKg: 0,
        pesoTotal: 0
      };
    });

    const subtotal = mappedItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
    const totalWeight = mappedItems.reduce((acc, it) => acc + (it.totalWeightKg || it.pesoTotal || 0), 0);

    return {
      id: firstItem.cotacaoId || quoteNum,
      quoteNumber: quoteNum,
      date: dateVal,
      clientName: clientName,
      contactPerson: (firstItem.contato && firstItem.contato !== '-') ? firstItem.contato : '',
      status: mapStatus(firstItem.status),
      validityDays: 10,
      paymentTerms: 'À Vista / Pix',
      observations: '',
      items: mappedItems,
      subtotalTotal: subtotal,
      grandTotal: subtotal,
      discount: 0,
      shipping: 0,
      totalWeightKg: totalWeight,
      createdAt: firstItem.data || new Date().toISOString(),
      updatedAt: firstItem.data || new Date().toISOString()
    };
  }, [filteredConsultaItems, selectedIds]);

  const propostasQuote = (selectedOrderKey === 'CURRENT' ? (currentQuote || activeQuote) : (activeQuote || currentQuote)) || currentQuote;

  // ✅ displayQuote isolado por aba:
  // - Na aba 'consulta', utiliza estritamente o consultaSelectedQuote
  // - Na aba 'propostas', utiliza a cotação ativa / selecionada da primeira aba
  const displayQuote = activeTab === 'consulta'
    ? consultaSelectedQuote
    : propostasQuote;

  const totalItems = displayQuote.items.length;
  const totalWeight = displayQuote.totalWeightKg || displayQuote.items.reduce((acc, item) => acc + (item.totalWeightKg || item.pesoTotal || 0), 0);
  const subtotalValue = displayQuote.subtotalTotal || displayQuote.items.reduce((acc, item) => acc + (item.subtotal || (item.unitPrice * item.quantity)), 0);
  const discountVal = displayQuote.discount || 0;
  const shippingVal = displayQuote.shipping || 0;
  const grandTotal = displayQuote.grandTotal || (subtotalValue - discountVal + shippingVal);

  const getItemDateReports = (item: any) => {
    const rawDate =
      item?.created_at ||
      item?.data ||
      item?.date ||
      item?.createdAt ||
      item?.data_item ||
      (displayQuote as any)?.data_orcamento ||
      (displayQuote as any)?.data ||
      displayQuote?.date ||
      (displayQuote as any)?.created_at;
    return formatSafeDate(rawDate);
  };

  const activeItem: Partial<QuoteItem> = displayQuote.items[selectedItemIndex] || displayQuote.items[0] || {
    material: 'BRONZE TM-23 REDONDO',
    constanteNome: 'BRONZE TM-23 REDONDO',
    measure: 'Ø 50 × 200 mm',
    widthLength: '200 mm',
    quantity: 1,
    qtd: 1,
    unitPrice: 185.00,
    totalWeightKg: 3.450,
    observacao: '',
    description: 'BUCHA USINADA'
  };

  // ✅ imagem de UM item específico:
  // Na aba consulta, busca diretamente a imagem do item selecionado sem contaminação pelo clipboard da aba 1
  const getDrawing = (idx: number): string => {
    if (activeTab === 'consulta') {
      const it = displayQuote.items[idx] as (QuoteItem & { drawingImage?: string; fotoDesenho?: string }) | undefined;
      return it?.drawingImage || it?.fotoDesenho || SAMPLE_DRAWING_BASE64;
    }
    const override = drawingPhotos[idx];
    if (override !== undefined && override !== '') return override;
    const it = displayQuote.items[idx] as (QuoteItem & { drawingImage?: string; fotoDesenho?: string }) | undefined;
    return it?.drawingImage || it?.fotoDesenho || SAMPLE_DRAWING_BASE64;
  };

  const currentDrawing = getDrawing(selectedItemIndex);

  const handleExportJSON = () => {
    const dataToExport = {
      ...displayQuote,
      clientName: selectedClientName,
      drawingPhoto: currentDrawing || null,
      exportedAt: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `proposta_${displayQuote.quoteNumber || 'cotacao'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    const headers = ["Material", "Medidas", "Descricao", "Informacoes", "Valor_Unitario", "Qtd", "Peso_Total_Kg", "Subtotal"];
    const rows = displayQuote.items.map(item => [
      `"${(item.constanteNome || item.constantName || item.material || 'MATERIAL').replace(/"/g, '""')}"`,
      `"${formatarMedidasLimpa(item).replace(/"/g, '""')}"`,
      `"${(item.descricao || item.description || '-').replace(/"/g, '""')}"`,
      `"${(item.observacao || item.notes || item.info || '-').replace(/"/g, '""')}"`,
      (item.valorUnitario !== undefined ? item.valorUnitario : item.unitPrice).toFixed(2),
      item.qtd || item.quantity || 1,
      (item.pesoTotal !== undefined ? item.pesoTotal : (item.totalWeightKg || 0)).toFixed(3),
      (item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1))).toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_itens_${displayQuote.quoteNumber || 'cotacao'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // ✅ Componente Reutilizável de Renderização dos 5 Modelos de Documento
  const renderDocumentosImpressao = () => {
    const totalTiposItens = displayQuote.items.length;
    const totalPecas = displayQuote.items.reduce((acc, item) => acc + Number(item.qtd !== undefined ? item.qtd : (item.quantity || 1)), 0);
    // Na Consulta, utiliza 100% o cliente da linha selecionada sem vazamento do filtro da aba de Propostas
    const effectiveClientName = activeTab === 'consulta'
      ? (displayQuote.clientName || 'CLIENTE BALCÃO')
      : (selectedClientName || displayQuote.clientName || 'CLIENTE BALCÃO');

    return (
    <div className="bg-slate-900/60 p-2 sm:p-6 rounded-2xl border border-slate-800 w-full overflow-x-hidden print:bg-transparent print:p-0 print:m-0 print:border-none print:border-t-0 print:shadow-none">
      
      {/* ===================================================
           PROPOSTA 1: RELATÓRIO A4 INTEIRO (GERAL)
           =================================================== */}
      <div 
        id="doc-A4-inteiro" 
        className={`documento-modelo secao-proposta bg-white text-slate-900 p-4 sm:p-8 rounded-xl shadow-2xl font-sans w-full max-w-4xl mx-auto overflow-x-hidden ${
          activeModel === 'A4-inteiro' ? 'block' : 'hidden'
        }`}
        style={{ minHeight: '800px' }}
      >
        {/* Header Centralizado da Empresa */}
        <CompanyHeader 
          documentType="Relatório / Proposta Comercial"
          documentNumber={displayQuote.quoteNumber || '00124'}
          documentDate={displayQuote.date || new Date().toLocaleDateString('pt-BR')}
        />

        {/* Client box */}
        <div className="bg-slate-100 border border-slate-300 p-3 rounded-md mb-4 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <span className="font-bold text-slate-700">EMPRESA / CLIENTE:</span>{' '}
            <strong className="lbl-cliente-nome text-slate-900 text-sm font-black uppercase break-words">{effectiveClientName}</strong>
          </div>
          <div className="text-slate-600 font-mono">
            Condições: <strong>{displayQuote.paymentTerms || 'À Vista / Pix'}</strong>
          </div>
        </div>

        {/* 📱 MOBILE: Cards de Produtos (< 640px) */}
        <div className="block sm:hidden space-y-3 mb-6 flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Itens da Proposta ({displayQuote.items.length})
          </span>
          {displayQuote.items.length === 0 ? (
            <div className="py-6 text-center text-slate-500 italic text-xs bg-slate-50 rounded-lg border border-slate-200">
              Nenhum item na cotação para exibição.
            </div>
          ) : (
            displayQuote.items.map((item, idx) => {
              const produtoMaterial = item.constanteNome || item.constantName || item.material || 'MATERIAL';
              const medidasFormatadas = formatarMedidasLimpa(item);
              const descricaoItem = item.descricao || item.description || '-';
              const obsEspecifica = getObservacaoEspecificaItem(item);
              const valorUnitario = Number(item.valorUnitario !== undefined ? item.valorUnitario : (item.unitPrice || 0));
              const qtd = Number(item.qtd !== undefined ? item.qtd : (item.quantity || 1));
              const pesoTotal = Number(item.pesoTotal !== undefined ? item.pesoTotal : (item.totalWeightKg || 0));
              const subtotal = Number(item.subtotal !== undefined ? item.subtotal : (valorUnitario * qtd));

              return (
                <div key={item.id || idx} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2 text-xs shadow-xs">
                  <div className="flex justify-between items-start border-b border-slate-200 pb-1.5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Produto / Material</span>
                    <div className="text-right">
                      <div style={{ fontWeight: 'bold' }} className="font-bold text-slate-900 text-sm leading-tight">
                        {produtoMaterial}
                      </div>
                      <div
                        className="medida-obs"
                        style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '2px', lineHeight: '1.2' }}
                      >
                        {getItemDateReports(item)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Medidas</span>
                    <div className="medida-bloco flex flex-col">
                      <span className="medida-dimensao font-mono text-slate-900 font-bold">{medidasFormatadas}</span>
                      {obsEspecifica && (
                        <span className="medida-obs text-[10px] text-slate-500 italic mt-0.5">{obsEspecifica}</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Descrição</span>
                    <span className="text-slate-700">{descricaoItem}</span>
                  </div>

                  {obsEspecifica && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Informações</span>
                      <span className="italic text-slate-600">{obsEspecifica}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate-500">Qtd: <strong>{qtd}</strong></span>
                      <span className="mx-1.5 text-slate-300">|</span>
                      <span className="text-slate-500">Peso: <strong>{formatWeightKg(pesoTotal, 3)}</strong></span>
                    </div>
                    <div className="font-bold text-slate-950 font-mono text-sm">
                      {formatCurrency(subtotal)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 🖥️ DESKTOP: 7-Column Table (>= 640px) */}
        <table className="hidden sm:table w-full border-collapse text-xs mb-6" border={1} cellPadding={6}>
          <thead>
            <tr className="bg-slate-200 text-slate-900 font-bold uppercase text-[11px] border-b border-black">
              <th className="text-left p-2">PRODUTO / MATERIAL</th>
              <th className="text-center p-2">MEDIDAS</th>
              <th className="text-left p-2">DESCRIÇÃO</th>
              <th className="text-left p-2">INFORMAÇÕES</th>
              <th className="text-right p-2">UNITÁRIO</th>
              <th className="text-center p-2 w-12">QTD</th>
              <th className="text-right p-2">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody id="tbody-a4-inteiro" className="divide-y divide-slate-300">
            {displayQuote.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                  Nenhum item na cotação para exibição.
                </td>
              </tr>
            ) : (
              displayQuote.items.map((item, idx) => {
                const produtoMaterial = item.constanteNome || item.constantName || item.material || 'MATERIAL';
                const medidasFormatadas = formatarMedidasLimpa(item);
                const descricaoItem = item.descricao || item.description || '-';
                const obsEspecifica = getObservacaoEspecificaItem(item);
                const valorUnitario = Number(item.valorUnitario !== undefined ? item.valorUnitario : (item.unitPrice || 0));
                const qtd = Number(item.qtd !== undefined ? item.qtd : (item.quantity || 1));
                const subtotal = Number(item.subtotal !== undefined ? item.subtotal : (valorUnitario * qtd));

                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50">
                    <td className="text-left font-bold text-slate-900 p-2">
                      <div>
                        <div style={{ fontWeight: 'bold' }} className="leading-tight">
                          {produtoMaterial}
                        </div>
                        <div
                          className="medida-obs"
                          style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '2px', lineHeight: '1.2' }}
                        >
                          {getItemDateReports(item)}
                        </div>
                      </div>
                    </td>
                    <td className="text-center p-2">
                      <div className="medida-bloco-center flex flex-col items-center justify-center">
                        <span className="medida-dimensao font-bold font-mono text-[11px] text-slate-900 leading-tight">
                          {medidasFormatadas}
                        </span>
                        {obsEspecifica && (
                          <span className="medida-obs text-[9.5px] text-slate-500 italic font-sans leading-tight mt-0.5">
                            {obsEspecifica}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-left p-2 text-slate-800">{descricaoItem}</td>
                    <td className="text-left p-2 text-slate-600 italic text-[10px]">{obsEspecifica || '-'}</td>
                    <td className="text-right font-mono p-2">{formatCurrency(valorUnitario)}</td>
                    <td className="text-center font-bold font-mono p-2">{qtd}</td>
                    <td className="text-right font-mono font-bold p-2 text-slate-950">{formatCurrency(subtotal)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Totais de Itens / Peças */}
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-400 font-bold text-xs">
          <div className="flex gap-4 text-slate-700">
            <span>ITENS: <strong className="text-slate-900">{totalTiposItens}</strong></span>
            <span>TOTAL PEÇAS: <strong className="text-slate-900">{totalPecas} PÇ</strong></span>
          </div>
          <div className="text-sm">
            TOTAL: <strong className="text-slate-900 font-mono font-black">{formatCurrency(grandTotal)}</strong>
          </div>
        </div>

        {/* Totals & Notes footer */}
        <div className="border-t-2 border-black pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-end text-xs gap-4">
          <div className="space-y-1 text-slate-600 max-w-md w-full sm:w-auto">
            <p>• Validade da proposta: <strong>{displayQuote.validityDays || 10} dias</strong></p>
            <p>• Prazo de entrega: <strong>A combinar após aprovação</strong></p>
            {displayQuote.observations && <p>• Obs: {displayQuote.observations}</p>}
          </div>

          <div className="text-left sm:text-right space-y-1 w-full sm:w-auto min-w-[220px] bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-200">
            <div className="flex justify-between text-slate-700">
              <span>Peso Total Estimado:</span>
              <strong className="font-mono">{formatWeightKg(totalWeight, 3)}</strong>
            </div>
            {discountVal > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Desconto:</span>
                <strong className="font-mono">- {formatCurrency(discountVal)}</strong>
              </div>
            )}
            {shippingVal > 0 && (
              <div className="flex justify-between text-slate-700">
                <span>Frete:</span>
                <strong className="font-mono">+ {formatCurrency(shippingVal)}</strong>
              </div>
            )}
            <div className="flex justify-between text-base font-black border-t border-black pt-2 text-slate-950">
              <span>VALOR TOTAL:</span>
              <span className="font-mono text-blue-900">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================
           PROPOSTA 2: PEDIDO A4 DIVIDIDO AO MEIO (2 VIAS EM FOLHA ÚNICA)
           =================================================== */}
      <div 
        id="doc-A4-2vias" 
        className={`documento-modelo secao-pedido modelo-duas-vias bg-white text-slate-900 p-2 sm:p-4 rounded-xl shadow-2xl w-full max-w-4xl mx-auto font-sans overflow-hidden flex flex-col justify-between ${
          activeModel === 'A4-2vias' ? 'block' : 'hidden'
        }`}
      >
        {/* VIA 1: CLIENTE (Metade Superior) */}
        <div 
          className="via-pedido via-cliente border border-black p-2 sm:p-3 rounded bg-white flex flex-col justify-between overflow-hidden" 
          style={{ 
            minHeight: '340px',
            maxHeight: '135mm',
            pageBreakInside: 'avoid',
            breakInside: 'avoid'
          }}
        >
          <div>
            {/* Header Centralizado da Empresa (Via do Cliente) */}
            <CompanyHeader 
              tag="VIA DO CLIENTE"
              tagColor="blue"
              documentNumber={displayQuote.quoteNumber || '00124'}
              documentDate={displayQuote.date || new Date().toLocaleDateString('pt-BR')}
              compact={true}
            />

            <div className="text-[11px] mb-1.5 text-slate-700 flex flex-col sm:flex-row justify-between gap-1">
              <div><strong>Cliente:</strong> <span className="lbl-cliente-nome font-bold uppercase">{effectiveClientName}</span></div>
              <div><strong>Condições:</strong> <span className="font-semibold">{displayQuote.paymentTerms || 'À Vista / Pix'}</span></div>
            </div>

            {/* Mobile Cards Via 1 */}
            <div className="block sm:hidden space-y-1.5 mb-2">
              {displayQuote.items.map((item, idx) => {
                const medidasFormatadas = formatarMedidasLimpa(item);
                const obsEspecifica = getObservacaoEspecificaItem(item);
                return (
                  <div key={idx} className="border border-slate-200 rounded p-1.5 text-[11px] bg-slate-50 space-y-0.5">
                    <div className="flex justify-between font-bold">
                      <span>{item.constanteNome || item.material || 'MATERIAL'}</span>
                      <span className="font-mono">{formatCurrency(item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1)))}</span>
                    </div>
                    <div className="text-[10px] text-slate-600 flex justify-between">
                      <div>
                        <span>Medida: <strong className="font-mono text-slate-900">{medidasFormatadas}</strong></span>
                        {obsEspecifica && (
                          <span className="block text-[9px] text-slate-500 italic mt-0.5">{obsEspecifica}</span>
                        )}
                      </div>
                      <span>Qtd: {item.qtd || item.quantity || 1}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table Via 1 (7 Colunas Exatas - Tabela Enxuta) */}
            <table className="hidden sm:table w-full text-[11px] border-collapse mb-1.5" border={1} cellPadding={2}>
              <thead>
                <tr className="bg-slate-100 font-bold text-[9.5px] uppercase border-b border-black">
                  <th className="text-left px-1.5 py-0.5">PRODUTO / MATERIAL</th>
                  <th className="text-center px-1.5 py-0.5">MEDIDAS</th>
                  <th className="text-left px-1.5 py-0.5">DESCRIÇÃO</th>
                  <th className="text-left px-1.5 py-0.5">INFORMAÇÕES</th>
                  <th className="text-right px-1.5 py-0.5">UNITÁRIO</th>
                  <th className="text-center px-1.5 py-0.5 w-10">QTD</th>
                  <th className="text-right px-1.5 py-0.5">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody className="tbody-resumido divide-y divide-slate-200">
                {displayQuote.items.map((item, idx) => {
                  const produtoMaterial = item.constanteNome || item.constantName || item.material || 'MATERIAL';
                  const medidasFormatadas = formatarMedidasLimpa(item);
                  const descricaoItem = item.descricao || item.description || '-';
                  const obsEspecifica = getObservacaoEspecificaItem(item);
                  const valorUnitario = Number(item.valorUnitario !== undefined ? item.valorUnitario : (item.unitPrice || 0));
                  const qtd = Number(item.qtd !== undefined ? item.qtd : (item.quantity || 1));
                  const subtotal = Number(item.subtotal !== undefined ? item.subtotal : (valorUnitario * qtd));

                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-1.5 py-0.5 font-bold text-slate-900">
                        <div>
                          <div style={{ fontWeight: 'bold' }} className="leading-tight">
                            {produtoMaterial}
                          </div>
                          <div
                            className="medida-obs"
                            style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '1px', lineHeight: '1.1' }}
                          >
                            {getItemDateReports(item)}
                          </div>
                        </div>
                      </td>
                      <td className="px-1.5 py-0.5 text-center">
                        <div className="medida-bloco-center flex flex-col items-center justify-center">
                          <span className="medida-dimensao font-bold font-mono text-[9.5px] text-slate-900 leading-tight">
                            {medidasFormatadas}
                          </span>
                          {obsEspecifica && (
                            <span className="medida-obs text-[8.5px] text-slate-500 italic font-sans leading-tight mt-0.5">
                              {obsEspecifica}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-1.5 py-0.5 text-left text-slate-800 text-[10.5px]">{descricaoItem}</td>
                      <td className="px-1.5 py-0.5 text-left text-slate-600 italic text-[9.5px]">{obsEspecifica || '-'}</td>
                      <td className="px-1.5 py-0.5 text-right font-mono">{formatCurrency(valorUnitario)}</td>
                      <td className="px-1.5 py-0.5 text-center font-mono font-bold">{qtd}</td>
                      <td className="px-1.5 py-0.5 text-right font-mono font-bold">{formatCurrency(subtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Totais de Itens / Peças Via 1 */}
            <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-400 font-bold text-xs">
              <div className="flex gap-4 text-slate-700">
                <span>ITENS: <strong className="text-slate-900">{totalTiposItens}</strong></span>
                <span>TOTAL PEÇAS: <strong className="text-slate-900">{totalPecas} PÇ</strong></span>
              </div>
              <div className="text-xs sm:text-sm">
                TOTAL: <strong className="text-slate-950 font-mono font-black">{formatCurrency(grandTotal)}</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[11px] border-t border-black pt-1 mt-1 gap-1">
            <span className="text-slate-600">Assinatura Cliente: ___________________________________</span>
          </div>
        </div>

        {/* LINHA DE DESTAQUE / CORTE ENTRE AS DUAS VIAS */}
        <div className="linha-corte my-1.5 border-b border-dashed border-[#999] text-center relative w-full h-0">
          <span className="bg-white px-2.5 text-[9.5px] font-bold text-slate-500 relative -top-2">
            ✂️ CORTE AQUI
          </span>
        </div>

        {/* VIA 2: EMPRESA / PRODUÇÃO (Metade Inferior) */}
        <div 
          className="via-pedido via-empresa border border-black p-2 sm:p-3 rounded bg-white flex flex-col justify-between overflow-hidden" 
          style={{ 
            minHeight: '340px',
            maxHeight: '135mm',
            pageBreakInside: 'avoid',
            breakInside: 'avoid'
          }}
        >
          <div>
            {/* Header Centralizado da Empresa (Via da Empresa / Produção) */}
            <CompanyHeader 
              tag="VIA DA EMPRESA / PRODUÇÃO"
              tagColor="amber"
              documentNumber={displayQuote.quoteNumber || '00124'}
              documentDate={displayQuote.date || new Date().toLocaleDateString('pt-BR')}
              compact={true}
            />

            <div className="text-[11px] mb-1.5 text-slate-700 flex flex-col sm:flex-row justify-between gap-1">
              <div><strong>Cliente:</strong> <span className="lbl-cliente-nome font-bold uppercase">{effectiveClientName}</span></div>
              <div><strong>Data:</strong> <span className="rel-data font-mono">{displayQuote.date || new Date().toLocaleDateString('pt-BR')}</span></div>
            </div>

            {/* Mobile Cards Via 2 */}
            <div className="block sm:hidden space-y-1.5 mb-2">
              {displayQuote.items.map((item, idx) => {
                const medidasFormatadas = formatarMedidasLimpa(item);
                const obsEspecifica = getObservacaoEspecificaItem(item);
                return (
                  <div key={idx} className="border border-slate-200 rounded p-1.5 text-[11px] bg-slate-50 space-y-0.5">
                    <div className="flex justify-between font-bold">
                      <span>{item.constanteNome || item.material || 'MATERIAL'}</span>
                      <span className="font-mono">{formatCurrency(item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1)))}</span>
                    </div>
                    <div className="text-[10px] text-slate-600 flex justify-between">
                      <div>
                        <span>Medida: <strong className="font-mono text-slate-900">{medidasFormatadas}</strong></span>
                        {obsEspecifica && (
                          <span className="block text-[9px] text-slate-500 italic mt-0.5">{obsEspecifica}</span>
                        )}
                      </div>
                      <span>Qtd: {item.qtd || item.quantity || 1}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table Via 2 (7 Colunas Exatas - Tabela Enxuta) */}
            <table className="hidden sm:table w-full text-[11px] border-collapse mb-1.5" border={1} cellPadding={2}>
              <thead>
                <tr className="bg-slate-100 font-bold text-[9.5px] uppercase border-b border-black">
                  <th className="text-left px-1.5 py-0.5">PRODUTO / MATERIAL</th>
                  <th className="text-center px-1.5 py-0.5">MEDIDAS</th>
                  <th className="text-left px-1.5 py-0.5">DESCRIÇÃO</th>
                  <th className="text-left px-1.5 py-0.5">INFORMAÇÕES</th>
                  <th className="text-right px-1.5 py-0.5">UNITÁRIO</th>
                  <th className="text-center px-1.5 py-0.5 w-10">QTD</th>
                  <th className="text-right px-1.5 py-0.5">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody className="tbody-resumido divide-y divide-slate-200">
                {displayQuote.items.map((item, idx) => {
                  const produtoMaterial = item.constanteNome || item.constantName || item.material || 'MATERIAL';
                  const medidasFormatadas = formatarMedidasLimpa(item);
                  const descricaoItem = item.descricao || item.description || '-';
                  const obsEspecifica = getObservacaoEspecificaItem(item);
                  const valorUnitario = Number(item.valorUnitario !== undefined ? item.valorUnitario : (item.unitPrice || 0));
                  const qtd = Number(item.qtd !== undefined ? item.qtd : (item.quantity || 1));
                  const subtotal = Number(item.subtotal !== undefined ? item.subtotal : (valorUnitario * qtd));

                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-1.5 py-0.5 font-bold text-slate-900">
                        <div>
                          <div style={{ fontWeight: 'bold' }} className="leading-tight">
                            {produtoMaterial}
                          </div>
                          <div
                            className="medida-obs"
                            style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '1px', lineHeight: '1.1' }}
                          >
                            {getItemDateReports(item)}
                          </div>
                        </div>
                      </td>
                      <td className="px-1.5 py-0.5 text-center">
                        <div className="medida-bloco-center flex flex-col items-center justify-center">
                          <span className="medida-dimensao font-bold font-mono text-[9.5px] text-slate-900 leading-tight">
                            {medidasFormatadas}
                          </span>
                          {obsEspecifica && (
                            <span className="medida-obs text-[8.5px] text-slate-500 italic font-sans leading-tight mt-0.5">
                              {obsEspecifica}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-1.5 py-0.5 text-left text-slate-800 text-[10.5px]">{descricaoItem}</td>
                      <td className="px-1.5 py-0.5 text-left text-slate-600 italic text-[9.5px]">{obsEspecifica || '-'}</td>
                      <td className="px-1.5 py-0.5 text-right font-mono">{formatCurrency(valorUnitario)}</td>
                      <td className="px-1.5 py-0.5 text-center font-mono font-bold">{qtd}</td>
                      <td className="px-1.5 py-0.5 text-right font-mono font-bold">{formatCurrency(subtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totais de Itens / Peças Via 2 */}
            <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-400 font-bold text-xs">
              <div className="flex gap-4 text-slate-700">
                <span>ITENS: <strong className="text-slate-900">{totalTiposItens}</strong></span>
                <span>TOTAL PEÇAS: <strong className="text-slate-900">{totalPecas} PÇ</strong></span>
              </div>
              <div className="text-xs sm:text-sm">
                TOTAL: <strong className="text-slate-950 font-mono font-black">{formatCurrency(grandTotal)}</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[11px] border-t border-black pt-1 mt-1 gap-1">
            <span className="text-slate-600">Vendedor / Produção: ___________________________________</span>
          </div>
        </div>
      </div>

      {/* ===================================================
           PROPOSTA 3: ETIQUETA CUPOM 80x80mm (IDENTIFICAÇÃO DA PEÇA)
           =================================================== */}
      {displayQuote.items.map((rawItem, itemIdx) => {
        const item: Partial<QuoteItem> = rawItem || {};
        const img = getDrawing(itemIdx);
        const obsItem = getObservacaoEspecificaItem(item);
        return (
          <div 
            key={itemIdx}
            id={`doc-etiqueta-80-${itemIdx}`}
            className={`documento-modelo secao-etiqueta modelo-etiqueta-80 etiqueta-card w-full max-w-[380px] border-2 border-black rounded-lg bg-white text-black font-sans relative mx-auto shadow-2xl ${
              activeModel === 'etiqueta-80'
                ? (selectedItemIndex === itemIdx ? 'block' : 'hidden print:block')
                : 'hidden'
            }`}
            style={{
              padding: '8px',
              marginBottom: '12mm',
              breakInside: 'avoid',
              pageBreakInside: 'avoid',
              boxSizing: 'border-box'
            }}
          >
            {/* Cabeçalho da Empresa */}
            <div className="etiqueta-header text-center pb-1.5 mb-2 border-b border-black">
              <h2 className="font-black text-sm tracking-wide uppercase leading-tight text-slate-950 font-sans">
                USICORTE METAIS
              </h2>
              <p className="text-[7px] font-bold text-slate-900 leading-tight mt-0.5 font-sans">
                SOB CNPJ: 25.038.430/0001-23
              </p>
              <p className="text-[5px] font-semibold text-slate-800 leading-tight mt-0.5 font-sans">
                (14) 99880-9362   (14) 99819-6873
              </p>
              <div className="text-xs font-bold text-slate-900 mt-1 pt-1 border-t border-slate-200">
                PEDIDO Nº: <span className="font-mono font-black text-blue-900 rel-numero">{displayQuote.quoteNumber || displayQuote.id || 'COT-2026-9663'}</span>
              </div>
            </div>

            {/* Conteúdo: Dados + Desenho */}
            <div className="etiqueta-corpo grid grid-cols-12 gap-2 items-start mb-2">
              {/* Coluna Esquerda - Informações */}
              <div className="etiqueta-dados col-span-7 text-xs space-y-1 leading-tight">
                <div>
                  <span className="font-bold text-gray-600 block text-[11px]">EMPRESA / CLIENTE:</span>
                  <span className="lbl-cliente-nome font-extrabold uppercase">{effectiveClientName}</span>
                </div>

                <div>
                  <span className="font-bold text-gray-600 block text-[8px]">MATERIAL:</span>
                  <span id="etiq-material" className="font-extrabold uppercase text-[10px] text-blue-950 block truncate">
                    {item.constanteNome || item.material || 'BRONZE TM-23'}
                  </span>
                </div>

                <div>
                  <span className="font-bold text-gray-600 block text-[8px]">MEDIDA:</span>
                  <div className="medida-bloco flex flex-col">
                    <span id="etiq-medida" className="medida-dimensao font-extrabold uppercase text-[10.5px] font-mono leading-tight text-slate-900">
                      {formatarMedidasLimpa(item) || 'Ø 50 x 200 mm'}
                    </span>
                    {obsItem && (
                      <span id="etiq-obs" className="medida-obs text-[8.5px] text-gray-500 italic font-sans leading-tight mt-0.5">
                        {obsItem}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-gray-600 block text-[8px]">QTD:</span>
                  <span id="etiq-qtd" className="font-black text-[10px]">
                    {item.qtd || item.quantity || 1} PC
                  </span>
                </div>
              </div>

              {/* Coluna Direita - Desenho Técnico Nítido */}
              <div 
                id="box-foto-etiqueta"
                className="etiqueta-foto-box col-span-5 border-2 border-dashed border-gray-400 p-1 rounded flex items-center justify-center min-h-[105px] bg-slate-50 overflow-hidden"
              >
                <EtiquetaDesenho
                  material={item.constanteNome || item.material || (item as any).produto || item.descricao}
                  medida={formatarMedidasLimpa(item) || item.medida || (item as any).measure}
                  observacao={obsItem || ''}
                  descricao={item.descricao || (item as any).description || item.material}
                  imagem={img}
                  engrossarTracos={true}
                />
              </div>
            </div>

            {/* Item selector pills if quote has multiple items */}
            {displayQuote.items.length > 1 && (
              <div className="btn-no-print pt-1 pb-1.5 mb-1.5 flex items-center gap-1 overflow-x-auto border-t border-slate-200">
                <span className="text-[9px] text-slate-400 font-bold">Peça:</span>
                {displayQuote.items.map((it, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedItemIndex(idx)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer transition-all ${
                      selectedItemIndex === idx ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    #{idx + 1}
                  </button>
                ))}
              </div>
            )}

            {/* Rodapé Interno */}
            <div className="etiqueta-footer pt-1.5 pb-0.5 text-center mt-auto">
              <span className="site-url text-[9.5px] font-bold tracking-widest text-black uppercase block">
                www.usicortemetais.com.br
              </span>
            </div>
          </div>
        );
      })}

      {/* ===================================================
           PROPOSTA 4: RELATÓRIO / PROPOSTA COMERCIAL (EMPRESA / 4 COLUNAS)
           =================================================== */}
      <div 
        id="doc-proposta-resumida" 
        className={`documento-modelo secao-proposta-resumida mx-auto ${
          activeModel === 'proposta-resumida' ? 'block' : 'hidden'
        }`}
      >
        <QuotePrintView 
          quote={{
            id: displayQuote.quoteNumber || displayQuote.id || 'COT-2026-3169',
            quoteNumber: displayQuote.quoteNumber || displayQuote.id || 'COT-2026-3169',
            date: displayQuote.date || new Date().toLocaleDateString('pt-BR'),
            clientName: effectiveClientName,
            paymentTerms: displayQuote.paymentTerms || 'À Vista / Pix (3% Desc.)',
            validityDays: displayQuote.validityDays || 10,
            deliveryTerms: 'A combinar / Imediato',
            observations: displayQuote.observations,
            totalWeightKg: displayQuote.totalWeightKg || (displayQuote.items ? displayQuote.items.reduce((acc, it) => acc + (it.totalWeightKg || 0), 0) : undefined),
            totalDiscount: displayQuote.discount,
            shippingCost: displayQuote.shipping,
            grandTotal: displayQuote.grandTotal,
            items: displayQuote.items.map((it, idx) => ({
              material: it.constanteNome || it.constantName || it.material || 'MATERIAL',
              dimensions: formatarMedidasLimpa(it) || 'Ø 50 x 200 mm',
              description: it.descricao || it.description || 'Corte / Usinagem Industrial',
              info: it.observacao || it.notes || it.info || '-',
              drawingImage: getDrawing(idx),
              created_at: it.created_at || (it as any).createdAt,
              data: it.data || it.date || (it as any).data_item || (displayQuote as any).data || displayQuote.date,
            }))
          }}
        />
      </div>

      {/* ===================================================
           PROPOSTA 5: MODELO DE ORDEM DE CORTE
           =================================================== */}
      <div
        id="doc-corte"
        className={`documento-modelo secao-corte bg-white text-slate-900 p-6 rounded-xl shadow-2xl font-sans w-full max-w-4xl mx-auto ${
          activeModel === 'corte' ? 'block' : 'hidden'
        }`}
      >
        <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-4">
          <div>
            <h2 className="m-0 text-lg font-black uppercase tracking-wide">Ordem de Corte</h2>
            <div className="flex flex-wrap items-center gap-x-3 text-[11px] font-semibold text-slate-600 uppercase mt-0.5">
              <p className="m-0">
                Cliente: <span className="text-black font-bold">{effectiveClientName}</span>
              </p>
              <span className="text-slate-400">•</span>
              <p className="m-0">
                Cotação: <span className="text-black font-bold font-mono">{displayQuote.quoteNumber || displayQuote.id || '-'}</span>
              </p>
            </div>
          </div>
          <div className="text-right text-[11px] font-semibold text-slate-600">
            <p className="m-0">Data: {new Date().toLocaleDateString('pt-BR')}</p>
            <p className="m-0">Itens: {displayQuote.items.length}</p>
          </div>
        </div>

        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-200">
              <th className="border border-black p-1.5 text-left">Observação</th>
              <th className="border border-black p-1.5 text-left">Produto / Material</th>
              <th className="border border-black p-1.5 text-left">Medidas</th>
              <th className="border border-black p-1.5 text-left">Descrição</th>
              <th className="border border-black p-1.5 text-center w-12">Qtd</th>
              <th className="border border-black p-1.5 text-center w-16">Cortado</th>
            </tr>
          </thead>
          <tbody>
            {displayQuote.items.map((item, idx) => {
              const obsItem = getObservacaoEspecificaItem(item);
              return (
                <tr key={item.id || idx}>
                  <td className="border border-black p-1.5 font-bold uppercase">{obsItem || '-'}</td>
                  <td className="border border-black p-1.5 uppercase font-bold">
                    <div>
                      <div style={{ fontWeight: 'bold' }} className="leading-tight">
                        {item.constanteNome || item.material || 'MATERIAL'}
                      </div>
                      <div
                        className="medida-obs"
                        style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '2px', lineHeight: '1.2' }}
                      >
                        {getItemDateReports(item)}
                      </div>
                    </div>
                  </td>
                  <td className="border border-black p-1.5">
                    <div className="medida-bloco flex flex-col">
                      <span className="medida-dimensao font-bold font-mono text-slate-900">{formatarMedidasLimpa(item)}</span>
                      {obsItem && (
                        <span className="medida-obs text-[9px] text-gray-500 italic font-sans mt-0.5">
                          {obsItem}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="border border-black p-1.5 uppercase">{item.descricao || item.description || '-'}</td>
                  <td className="border border-black p-1.5 text-center font-bold">{item.qtd || item.quantity || 1}</td>
                  <td className="border border-black p-1.5 text-center">
                    <span className="inline-block w-4 h-4 border-2 border-black align-middle" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-center">
          www.usicortemetais.com.br
        </p>
      </div>

    </div>
    );
  };

  return (
    <div id="screen-relatorios" className="space-y-6">

      {/* Tamanho de página: A4 RETRATO para todos os modelos, exceto ETIQUETAS */}
      <style>{activeModel === 'etiqueta-80'
        ? `@page { size: auto; margin: 5mm; }
           @media print {
             .etiqueta-card {
               break-inside: avoid !important;
               page-break-inside: avoid !important;
               margin-bottom: 12mm !important;
               box-sizing: border-box !important;
               padding: 8px !important;
             }
           }`
        : `@page { size: A4 portrait; margin: 8mm; }
           @media print {
             html, body { width: 100%; height: 100%; margin: 0; padding: 0; }
             .documento-modelo:not(.secao-etiqueta) { width: 100% !important; max-width: 100% !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; border-top: none !important; }
           }`}</style>

      {/* Regras de impressão de todos os modelos */}
      <style>{`
        @media print {
          html, body, #root, #app-root, main, #screen-relatorios, #screen-consulta, #container-impressao {
            border-top: none !important;
            border: none !important;
            box-shadow: none !important;
          }
          header, .company-header-centralizado, .etiqueta-header {
            border-top: none !important;
          }
          hr, .linha-separadora {
            display: none !important;
            border: none !important;
          }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          table { page-break-inside: auto !important; }

          .etiqueta-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 12mm !important;
            box-sizing: border-box !important;
            padding: 8px !important;
          }

          body.print-corte .btn-no-print,
          body.print-corte .filtros-bar,
          body.print-corte .tabela-container,
          body.print-corte .screen-header,
          body.print-corte .documento-modelo:not(.secao-corte) { display: none !important; }
          body.print-corte #doc-corte { display: block !important; box-shadow: none !important; padding: 0 !important; }
          body.print-corte #doc-corte table { page-break-inside: auto; }
          body.print-corte #doc-corte tr { page-break-inside: avoid; }

          body.print-pedido .btn-no-print,
          body.print-pedido .filtros-bar,
          body.print-pedido .tabela-container,
          body.print-pedido .screen-header,
          body.print-pedido .documento-modelo:not(.secao-pedido) { display: none !important; }
          body.print-pedido #doc-A4-2vias { 
            display: flex !important; 
            flex-direction: column !important;
            justify-content: space-between !important;
            box-shadow: none !important; 
            width: 100% !important; 
            max-width: 100% !important;
            height: 100% !important;
            max-height: 275mm !important;
            padding: 0 !important;
            margin: 0 auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            overflow: hidden !important;
          }

          body.print-etiqueta .btn-no-print,
          body.print-etiqueta .filtros-bar,
          body.print-etiqueta .tabela-container,
          body.print-etiqueta .screen-header,
          body.print-etiqueta .documento-modelo:not(.secao-etiqueta) { display: none !important; }
          body.print-etiqueta .secao-etiqueta { display: flex !important; box-shadow: none !important; }

          body.print-geral .btn-no-print,
          body.print-geral .filtros-bar,
          body.print-geral .tabela-container,
          body.print-geral .screen-header,
          body.print-geral .documento-modelo:not(.secao-proposta) { display: none !important; }
          body.print-geral #doc-A4-inteiro { display: block !important; box-shadow: none !important; }

          body.print-empresa .btn-no-print,
          body.print-empresa .filtros-bar,
          body.print-empresa .tabela-container,
          body.print-empresa .screen-header,
          body.print-empresa .documento-modelo:not(.secao-proposta-resumida) { display: none !important; }
          body.print-empresa #doc-proposta-resumida { display: block !important; box-shadow: none !important; }

          body.print-proposta .btn-no-print,
          body.print-proposta .filtros-bar,
          body.print-proposta .tabela-container,
          body.print-proposta .screen-header,
          body.print-proposta .documento-modelo:not(.secao-proposta):not(.secao-proposta-resumida) { display: none !important; }

          .medida-bloco { display: flex !important; flex-direction: column !important; align-items: flex-start !important; }
          .medida-bloco-center { display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; text-align: center !important; }
          .medida-dimensao { font-weight: 800 !important; color: #000000 !important; font-family: monospace, Courier, monospace !important; display: block !important; }
          .medida-obs { font-size: 7.5pt !important; font-style: italic !important; color: #4b5563 !important; font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; display: block !important; margin-top: 1px !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .secao-etiqueta .medida-dimensao { font-size: 8.5pt !important; font-weight: 900 !important; color: #000 !important; }
          .secao-etiqueta .medida-obs { font-size: 6.8pt !important; color: #4b5563 !important; font-style: italic !important; line-height: 1.1 !important; }
        }
      `}</style>
      
      {/* TAB NAVIGATION: PROPOSTAS vs CONSULTA */}
      <div className="btn-no-print flex items-center justify-between border-b border-slate-800 pb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => switchTab('propostas')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'propostas'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-300" />
            <span>📄 Emissão de Propostas & Etiquetas</span>
          </button>

          <button
            onClick={() => switchTab('consulta')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'consulta'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Search className="w-4 h-4 text-emerald-400" />
            <span>🔍 Consulta & Relatório Geral</span>
          </button>

          {onOpenHistoricoFechamento && (
            <button
              onClick={onOpenHistoricoFechamento}
              className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/40 hover:border-purple-400 shadow-sm"
              title="Visualizar histórico de fechamentos e consolidar mês no Supabase"
            >
              <Calendar className="w-4 h-4 text-purple-400" />
              <span>📊 Histórico de Fechamentos Mensais</span>
            </button>
          )}
        </div>

        {onNavigateToQuote && (
          <button
            onClick={onNavigateToQuote}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Voltar para Calculadora de Cotações</span>
          </button>
        )}
      </div>

      {/* ===================================================
           MÓDULO DE CONSULTA E IMPRESSÃO DE RELATÓRIOS
           =================================================== */}
      {activeTab === 'consulta' && (
        <div id="screen-consulta" className="space-y-4">
          
          {/* Feedback de Exclusão / Operação */}
          {deleteFeedback && (
            <div className={`btn-no-print p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all animate-in fade-in duration-200 ${
              deleteFeedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {deleteFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{deleteFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteFeedback(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
                title="Fechar alerta"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* BARRA SUPERIOR COM BOTÕES E CAMPOS DE BUSCA */}
          <div className="filtros-bar btn-no-print">
            
            {/* Botões de Impressão e Ações */}
            <div className="botoes-impressao grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5 w-full">
              <button 
                type="button" 
                className="btn-print w-full min-w-0 cursor-pointer bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-all flex flex-col items-center justify-center disabled:opacity-60" 
                onClick={() => loadAllConsultaData(true)}
                disabled={isLoadingConsulta}
                title="Recarregar dados do Supabase"
              >
                <span className="flex items-center justify-center">
                  <RotateCw className={`w-4 h-4 mb-0.5 ${isLoadingConsulta ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
                </span>
                {isLoadingConsulta ? 'ATUALIZANDO' : 'ATUALIZAR'}
              </button>
              <button 
                type="button" 
                className="btn-print w-full min-w-0 cursor-pointer" 
                onClick={() => imprimirRelatorioGeral('GERAL')}
                title="Imprimir Relatório Geral (A4 Inteiro)"
              >
                <span>🖨️</span> GERAL
              </button>
              <button 
                type="button" 
                className="btn-print w-full min-w-0 cursor-pointer" 
                onClick={() => imprimirRelatorioGeral('EMPRESA')}
                title="Imprimir Proposta Comercial Resumida"
              >
                <span>🏢</span> EMPRESA
              </button>
              <button 
                type="button" 
                className="btn-print w-full min-w-0 cursor-pointer" 
                onClick={() => imprimirRelatorioGeral('PEDIDO')}
                title="Imprimir Pedido (2 Vias A4)"
              >
                <span>📋</span> PEDIDO
              </button>
              <button 
                type="button" 
                className="btn-print w-full min-w-0 cursor-pointer" 
                onClick={() => imprimirRelatorioGeral('ETIQUETAS')}
                title="Imprimir Etiquetas (80x80mm)"
              >
                <span>🏷️</span> ETIQUETAS
              </button>
              <button 
                type="button" 
                className="btn-print w-full min-w-0 cursor-pointer" 
                onClick={() => imprimirRelatorioGeral('CORTE')}
                title="Imprimir Ordem de Corte"
              >
                <span>✂️</span> CORTE
              </button>
              <button
                type="button"
                onClick={handleDuplicateSelectedQuote}
                disabled={selectedIds.length === 0 || isDuplicating}
                className={`btn-print w-full min-w-0 border transition-all cursor-pointer flex flex-col items-center justify-center ${
                  selectedIds.length > 0
                    ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500 shadow-md shadow-purple-600/30'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                }`}
                title={selectedIds.length > 0 ? `Duplicar pedido selecionado no PDV` : 'Selecione 1 item na tabela para duplicar o pedido'}
              >
                <span className="flex items-center justify-center">
                  {isDuplicating ? (
                    <Loader2 className="w-4 h-4 mb-0.5 animate-spin" />
                  ) : (
                    <Copy className="w-4 h-4 mb-0.5" />
                  )}
                </span>
                DUPLICAR PEDIDO
              </button>
              <button
                type="button"
                onClick={() => setIsBulkDeleteOpen(true)}
                disabled={selectedIds.length === 0}
                className={`btn-print w-full min-w-0 border transition-all cursor-pointer flex flex-col items-center justify-center ${
                  selectedIds.length > 0
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 shadow-md shadow-rose-600/30'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                }`}
                title={selectedIds.length > 0 ? `Excluir ${selectedIds.length} item(ns) selecionado(s)` : 'Selecione 1 ou mais itens para excluir'}
              >
                <span className="flex items-center justify-center">
                  <Trash2 className="w-4 h-4 mb-0.5" />
                </span>
                EXCLUIR {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </button>
            </div>

            {/* Barra de Duplicar Cotação / Pedido por Número */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-slate-900/90 border border-cyan-500/40 rounded-xl shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 shrink-0">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-100">Duplicar Cotação / Pedido por Número</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-700/50 rounded-md font-semibold tracking-wide uppercase">
                      Vendas & PDV
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Digite o número de uma cotação antiga ou parada para carregar cliente e itens no PDV com um novo número sequencial gerado
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <input 
                    type="text" 
                    placeholder="Ex: COT-2026-000140..." 
                    value={duplicarNumeroInput}
                    onChange={(e) => setDuplicarNumeroInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleDuplicateByNumero();
                      }
                    }}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 rounded-lg text-xs text-white placeholder-slate-500 outline-none font-mono"
                  />
                  {duplicarNumeroInput && (
                    <button
                      type="button"
                      onClick={() => setDuplicarNumeroInput('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleDuplicateByNumero}
                  disabled={!duplicarNumeroInput.trim() || isDuplicating}
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm shadow-cyan-950/40"
                  title="Buscar cotação no Supabase e transferir para o PDV com nova numeração"
                >
                  {isDuplicating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Duplicar no PDV</span>
                </button>
              </div>
            </div>

            {/* Filtros por Categoria e Campo de Texto */}
            <div className="opcoes-pesquisa">
              <label>
                <input 
                  type="radio" 
                  name="tipoFiltro" 
                  value="cliente" 
                  checked={tipoFiltro === 'cliente'} 
                  onChange={() => setTipoFiltro('cliente')} 
                /> CLIENTE
              </label>
              <label>
                <input 
                  type="radio" 
                  name="tipoFiltro" 
                  value="cotacao" 
                  checked={tipoFiltro === 'cotacao'} 
                  onChange={() => setTipoFiltro('cotacao')} 
                /> COTAÇÃO
              </label>
              <label>
                <input 
                  type="radio" 
                  name="tipoFiltro" 
                  value="contato" 
                  checked={tipoFiltro === 'contato'} 
                  onChange={() => setTipoFiltro('contato')} 
                /> CONTATO
              </label>
              <label>
                <input 
                  type="radio" 
                  name="tipoFiltro" 
                  value="produto" 
                  checked={tipoFiltro === 'produto'} 
                  onChange={() => setTipoFiltro('produto')} 
                /> PRODUTO / DESCRIÇÃO
              </label>
              <label>
                <input 
                  type="radio" 
                  name="tipoFiltro" 
                  value="data" 
                  checked={tipoFiltro === 'data'} 
                  onChange={() => setTipoFiltro('data')} 
                /> DATA
              </label>

              {/* Filtro por Situação com Visual Padronizado */}
              <div className="status-dropdown-wrapper relative inline-block">
                <button
                  type="button"
                  id="selectStatus"
                  onClick={() => setOpenStatusDropdownId(prev => prev === 'filtro' ? null : 'filtro')}
                  className="h-[37px] px-3 bg-white border border-slate-300 hover:border-blue-400 rounded-md shadow-xs flex items-center justify-between gap-2.5 cursor-pointer transition-all min-w-[195px]"
                  title="Filtrar por situação da proposta"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${getStatusOption(statusFiltro).dotClass}`} />
                    <span className="text-blue-600 font-semibold text-xs whitespace-nowrap">
                      {getStatusOption(statusFiltro).label}
                    </span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-blue-600 opacity-70 transition-transform ${openStatusDropdownId === 'filtro' ? 'rotate-180' : ''}`} />
                </button>

                {openStatusDropdownId === 'filtro' && (
                  <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[210px] bg-white border border-slate-200 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100">
                    {/* 1. Em Aberto / Ativas (Padrão ao abrir a tela) */}
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFiltro('ativas');
                        setOpenStatusDropdownId(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition-colors hover:bg-blue-50 cursor-pointer ${
                        statusFiltro === 'ativas' ? 'bg-blue-50/80 font-bold' : 'font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                        <span className="text-blue-600">Em Aberto / Ativas</span>
                      </div>
                      {statusFiltro === 'ativas' && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                    </button>

                    {/* 2. Faturado (Para consultar apenas orçamentos baixados/faturados) */}
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFiltro('faturado');
                        setOpenStatusDropdownId(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition-colors hover:bg-blue-50 cursor-pointer ${
                        statusFiltro === 'faturado' ? 'bg-blue-50/80 font-bold' : 'font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                        <span className="text-blue-600">Faturado</span>
                      </div>
                      {statusFiltro === 'faturado' && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                    </button>

                    {/* 3. Todas as Situações (Para ver todo o histórico consolidado) */}
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFiltro('todos');
                        setOpenStatusDropdownId(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition-colors hover:bg-blue-50 cursor-pointer ${
                        statusFiltro === 'todos' ? 'bg-blue-50/80 font-bold' : 'font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                        <span className="text-blue-600">Todas as Situações</span>
                      </div>
                      {statusFiltro === 'todos' && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                    </button>

                    <div className="h-px bg-slate-100 my-1" />

                    {/* Filtros específicos por situação individual */}
                    {STATUS_OPTIONS.filter(opt => opt.value !== 'faturado').map((opt) => {
                      const isSelected = statusFiltro === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setStatusFiltro(opt.value as StatusProposta);
                            setOpenStatusDropdownId(null);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition-colors hover:bg-blue-50 cursor-pointer ${
                            isSelected ? 'bg-blue-50/80 font-bold' : 'font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dotClass}`} />
                            <span className="text-blue-600">{opt.label}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <input 
                type="text" 
                id="inputCliente" 
                className="input-busca-avancada" 
                placeholder="Nome do Cliente..." 
                value={clienteBusca} 
                onChange={(e) => setClienteBusca(e.target.value)} 
              />

              <input 
                type="text" 
                id="inputBusca" 
                className="input-busca-avancada" 
                placeholder="Digite para pesquisar..." 
                value={inputBusca} 
                onChange={(e) => setInputBusca(e.target.value)} 
              />
            </div>

          </div>

          {/* TABELA COM DADOS TÉCNICOS */}
          <div className="tabela-container shadow-2xl">
            <table className="tabela-consulta" id="tabelaDados">
              <thead>
                <tr>
                  <th style={{ width: '30px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      id="checkTodos" 
                      checked={paginatedConsultaItems.length > 0 && paginatedConsultaItems.every(i => selectedIds.includes(i.idVer))}
                      onChange={(e) => handleSelectCurrentPage(e.target.checked)} 
                      title="Selecionar todos os itens da página atual"
                    />
                  </th>
                  <th style={{ minWidth: '190px', textAlign: 'center' }}>Ações</th>
                  <th>Cotação</th>
                  <th style={{ minWidth: '135px', textAlign: 'center' }}>Situação</th>
                  <th>Data</th>
                  <th>Cliente / Empresa</th>
                  <th>Contato</th>
                  <th>Produto</th>
                  <th>Medida</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Qtd</th>
                  <th>Unitário</th>
                  <th>Valor Geral</th>
                </tr>
              </thead>
              <tbody id="tbodyConsulta">
                {isLoadingConsulta ? (
                  <tr>
                    <td colSpan={14} className="text-center py-12 text-slate-400 font-medium bg-slate-900/40">
                      <div className="flex flex-col items-center justify-center gap-2.5">
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                        <span className="text-sm font-semibold text-slate-200">Carregando cotações e itens do Supabase...</span>
                        <span className="text-xs text-slate-400">Otimizando dados da consulta</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredConsultaItems.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center py-6 text-slate-500 font-medium">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  paginatedConsultaItems.map((item, idx) => {
                    const isSelected = selectedIds.includes(item.idVer);
                    return (
                      <tr 
                        key={item.idVer} 
                        className={isSelected ? 'linha-selecionada cursor-pointer' : 'cursor-pointer hover:bg-slate-800/40'}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (
                            target.tagName !== 'INPUT' && 
                            target.tagName !== 'BUTTON' && 
                            target.tagName !== 'SELECT' && 
                            !target.closest('button') && 
                            !target.closest('select') &&
                            !target.closest('.status-dropdown-wrapper')
                          ) {
                            handleToggleSelect(item.idVer);
                          }
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            className="chk-item" 
                            value={item.idVer} 
                            checked={isSelected}
                            onChange={() => handleToggleSelect(item.idVer)} 
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateCotacaoFromConsulta(item);
                              }}
                              disabled={isDuplicating && duplicatingQuoteKey === (item.cotacao || String(item.idVer))}
                              className="p-1.5 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-400 hover:text-white border border-cyan-500/40 rounded-md transition-all cursor-pointer flex items-center justify-center shadow-xs disabled:opacity-50"
                              title="Duplicar Cotação"
                            >
                              {isDuplicating && duplicatingQuoteKey === (item.cotacao || String(item.idVer)) ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCotacaoFromConsulta(item);
                              }}
                              className="p-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/40 rounded-md transition-all cursor-pointer flex items-center justify-center shadow-xs"
                              title="Editar Cotação"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const targetId = item.cotacaoId || item.cotacao;
                                if (targetId) {
                                  await carregarCotacaoPorId(targetId);
                                }
                                setActiveTab('propostas');
                              }}
                              className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/40 rounded-md transition-all cursor-pointer flex items-center justify-center shadow-xs"
                              title="Abrir / Visualizar"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirModalBoletosItem(item);
                              }}
                              className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/40 rounded-md transition-all cursor-pointer flex items-center justify-center shadow-xs"
                              title="Gerenciar Boletos / Condição de Pagamento desta Cotação"
                            >
                              <Barcode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemImageButtonClick(item);
                              }}
                              className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center shadow-xs ${
                                item.desenhoUrl
                                  ? 'bg-emerald-600/25 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/50 shadow-emerald-950/40'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700'
                              }`}
                              title={
                                item.desenhoUrl
                                  ? 'Imagem/Desenho já anexado. Clique para visualizar, substituir ou remover'
                                  : 'Anexar imagem (.jpg, .png) ou desenho CAD (.dxf) diretamente neste item'
                              }
                            >
                              {uploadingItemId === item.idVer ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                              ) : (
                                <Camera className={`w-3.5 h-3.5 ${item.desenhoUrl ? 'text-emerald-400 group-hover:text-white' : ''}`} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToDelete(item);
                              }}
                              className="p-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/40 rounded-md transition-all cursor-pointer flex items-center justify-center shadow-xs"
                              title="Excluir este item/orçamento do banco de dados"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td><strong>{item.cotacao || '-'}</strong></td>
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          {/* Elemento Interativo de Alteração Rápida de Situação com fundo claro, texto azul e bolinha colorida */}
                          <div className="status-dropdown-wrapper relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenStatusDropdownId(prev => prev === item.idVer ? null : item.idVer);
                              }}
                              disabled={updatingQuoteKey === (item.cotacao || item.cotacaoId || String(item.idVer))}
                              className="btn-no-print h-[28px] px-2.5 bg-white border border-slate-300 hover:border-blue-400 rounded-md shadow-xs inline-flex items-center gap-2 cursor-pointer transition-all disabled:opacity-60 disabled:cursor-wait"
                              title="Clique para alterar a situação desta cotação"
                            >
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${getStatusOption(item.status).dotClass}`} />
                              <span className="text-blue-600 font-semibold text-xs whitespace-nowrap">
                                {getStatusOption(item.status).label}
                              </span>
                              {updatingQuoteKey === (item.cotacao || item.cotacaoId || String(item.idVer)) ? (
                                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0 ml-0.5" />
                              ) : (
                                <ChevronDown className={`w-3.5 h-3.5 text-blue-600 opacity-70 shrink-0 ml-0.5 transition-transform ${openStatusDropdownId === item.idVer ? 'rotate-180' : ''}`} />
                              )}
                            </button>

                            {/* Dropdown Menu com Opções Padronizadas */}
                            {openStatusDropdownId === item.idVer && (
                              <div 
                                className={`absolute left-0 z-50 min-w-[155px] bg-white border border-slate-200 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100 ${
                                  idx >= filteredConsultaItems.length - 3 ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {STATUS_OPTIONS.map((opt) => {
                                  const isSelected = normalizeStatus(item.status) === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenStatusDropdownId(null);
                                        handleStatusChange(item, opt.value);
                                      }}
                                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition-colors hover:bg-blue-50 cursor-pointer ${
                                        isSelected ? 'bg-blue-50/80 font-bold' : 'font-medium'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dotClass}`} />
                                        <span className="text-blue-600">{opt.label}</span>
                                      </div>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Exibição para Impressão */}
                            <span className="hidden print:inline-block text-[10px] font-bold text-slate-800">
                              {getStatusOption(item.status).label}
                            </span>
                          </div>
                        </td>
                        <td>{item.data}</td>
                        <td><strong>{item.empresa}</strong></td>
                        <td>{item.contato || '-'}</td>
                        <td>{item.produto}</td>
                        <td>
                          <div>{item.medida || '-'}</div>
                          {getObservacaoEspecificaItem(item) && (
                            <div className="text-xs text-slate-400 italic mt-0.5">
                              {getObservacaoEspecificaItem(item)}
                            </div>
                          )}
                        </td>
                        <td>{item.descricao}</td>
                        <td>{item.valor}</td>
                        <td>{item.qtd}</td>
                        <td>R$ {item.unitario.toFixed(2)}</td>
                        <td><strong>R$ {item.valorGeral.toFixed(2)}</strong></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* BARRA DE PAGINAÇÃO E CONTROLE DE EXIBIÇÃO */}
          <div className="btn-no-print flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 rounded-xl p-3 shadow-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <span>
                Exibindo <strong className="text-slate-200">{filteredConsultaItems.length === 0 ? 0 : (currentPage - 1) * (pageSize || 1) + 1}</strong> a <strong className="text-slate-200">{pageSize <= 0 ? filteredConsultaItems.length : Math.min(currentPage * pageSize, filteredConsultaItems.length)}</strong> de <strong className="text-slate-200">{filteredConsultaItems.length}</strong> itens filtrados ({allConsultaItems.length} no total)
              </span>
              <span className="text-cyan-400 font-semibold">
                {selectedIds.length} item(ns) selecionado(s)
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-950 border border-slate-700 text-slate-200 rounded-md px-2 py-1 text-xs outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={0}>Todos</option>
                </select>
              </div>

              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage <= 1}
                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Página anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1 px-1.5 text-xs">
                    <span className="text-slate-200 font-bold">{currentPage}</span>
                    <span className="text-slate-500">/</span>
                    <span className="text-slate-400">{totalPages}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Próxima página"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ===================================================
               MODAL DE CONFIRMAÇÃO DE EXCLUSÃO INDIVIDUAL
               =================================================== */}
          {itemToDelete && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-100">
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                    <AlertTriangle className="w-6 h-6 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-100">Confirmar Exclusão</h3>
                    <p className="text-xs text-slate-400">Remover registro do banco de dados</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs space-y-1.5 text-slate-300">
                  <div><strong className="text-slate-400">Cotação:</strong> <span className="font-mono text-blue-400 font-bold">{itemToDelete.cotacao || '-'}</span></div>
                  <div><strong className="text-slate-400">Cliente:</strong> <span className="text-slate-200 font-semibold">{itemToDelete.empresa}</span></div>
                  <div><strong className="text-slate-400">Item:</strong> <span className="text-slate-200">{itemToDelete.descricao} ({itemToDelete.produto})</span></div>
                  <div><strong className="text-slate-400">Valor:</strong> <span className="font-mono text-emerald-400 font-bold">R$ {itemToDelete.valorGeral.toFixed(2)}</span></div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Tem certeza que deseja excluir este item/orçamento? O registro será permanentemente removido do banco de dados (Supabase) e da listagem.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setItemToDelete(null)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => executeDeleteItem(itemToDelete)}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Excluindo...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Confirmar Exclusão</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================
               MODAL DE CONFIRMAÇÃO DE EXCLUSÃO EM MASSA
               =================================================== */}
          {isBulkDeleteOpen && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-100">
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                    <Trash2 className="w-6 h-6 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-100">Exclusão em Massa</h3>
                    <p className="text-xs text-slate-400">Excluir múltiplos registros</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs space-y-1 text-slate-300">
                  <p>
                    Você selecionou <strong className="text-rose-400 font-mono text-sm">{selectedIds.length}</strong> item(ns) para exclusão.
                  </p>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Tem certeza que deseja excluir todos os <strong className="text-slate-200">{selectedIds.length} itens</strong> selecionados? Esta operação removerá os registros correspondentes do banco de dados (Supabase) e não poderá ser desfeita.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setIsBulkDeleteOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={executeBulkDelete}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Excluindo itens...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir {selectedIds.length} Selecionados</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================
               INPUT DE ARQUIVO OCULTO PARA ANEXAR IMAGEM/DXF
               =================================================== */}
          <input 
            type="file" 
            ref={itemFileInputRef} 
            onChange={handleItemFileInputChange} 
            accept="image/png, image/jpeg, image/jpg, image/webp, .dxf" 
            className="hidden" 
          />

          {/* ===================================================
               MODAL DE VISUALIZAÇÃO / GESTÃO DA IMAGEM DO ITEM
               =================================================== */}
          {activeImagePreviewItem && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-100 relative">
                <button 
                  type="button"
                  onClick={() => setActiveImagePreviewItem(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 text-emerald-400">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <Camera className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-100">Desenho Técnico / Imagem do Item</h3>
                    <p className="text-xs text-slate-400">Arquivo vinculado ao registro no banco e armazenamento</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span><strong className="text-slate-400">Cotação:</strong> <span className="font-mono text-blue-400 font-bold">{activeImagePreviewItem.cotacao || '-'}</span></span>
                    <span><strong className="text-slate-400">Cliente:</strong> <span className="text-slate-200 font-semibold">{activeImagePreviewItem.empresa}</span></span>
                  </div>
                  <div><strong className="text-slate-400">Item:</strong> <span className="text-slate-200">{activeImagePreviewItem.descricao}</span></div>
                  <div><strong className="text-slate-400">Medida / Material:</strong> <span className="text-slate-200 font-mono">{activeImagePreviewItem.medida || '-'} ({activeImagePreviewItem.produto})</span></div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-center min-h-[220px] max-h-[360px] overflow-hidden">
                  {activeImagePreviewItem.desenhoUrl ? (
                    <img 
                      src={activeImagePreviewItem.desenhoUrl} 
                      alt={`Desenho de ${activeImagePreviewItem.descricao}`}
                      className="max-h-72 w-auto object-contain rounded bg-white p-2 border border-slate-700 shadow-md"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      Nenhuma imagem anexada.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleRemoveItemImage(activeImagePreviewItem)}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/40 transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Remover permanentemente a imagem deste item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover Imagem</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetImageItem(activeImagePreviewItem);
                        if (itemFileInputRef.current) {
                          itemFileInputRef.current.value = '';
                          itemFileInputRef.current.click();
                        }
                      }}
                      disabled={uploadingItemId === activeImagePreviewItem.idVer}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {uploadingItemId === activeImagePreviewItem.idVer ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Atualizando...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Substituir Arquivo (.jpg, .png, .dxf)</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImagePreviewItem(null)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================
               PRÉ-VISUALIZAÇÃO / RELATÓRIO DIRETO NA ABA CONSULTA
               (Renderiza diretamente abaixo da tabela mantendo estado)
               =================================================== */}
          {selectedIds.length > 0 && (
            <div className="pt-4 border-t border-slate-800 print:pt-0 print:border-none print:border-t-0 space-y-4 animate-in fade-in duration-200">
              {/* Barra de controle da visualização direta */}
              <div className="btn-no-print bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-blue-400" />
                    Visualização do Modelo:
                  </span>
                  <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModel('A4-inteiro');
                        setPrintMode('proposta');
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        activeModel === 'A4-inteiro' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🖨️ Geral (A4)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModel('proposta-resumida');
                        setPrintMode('proposta');
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        activeModel === 'proposta-resumida' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🏢 Empresa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModel('A4-2vias');
                        setPrintMode('pedido');
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        activeModel === 'A4-2vias' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      📋 Pedido (2 Vias)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModel('etiqueta-80');
                        setPrintMode('etiqueta');
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        activeModel === 'etiqueta-80' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🏷️ Etiquetas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModel('corte');
                        setPrintMode('corte');
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        activeModel === 'corte' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ✂️ Corte
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const mapPrint: Record<PrintModelType, 'GERAL' | 'EMPRESA' | 'PEDIDO' | 'ETIQUETAS' | 'CORTE'> = {
                        'A4-inteiro': 'GERAL',
                        'proposta-resumida': 'EMPRESA',
                        'A4-2vias': 'PEDIDO',
                        'etiqueta-80': 'ETIQUETAS',
                        'corte': 'CORTE'
                      };
                      imprimirRelatorioGeral(mapPrint[activeModel] || 'GERAL');
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir ({activeModel === 'A4-inteiro' ? 'Geral' : activeModel === 'proposta-resumida' ? 'Empresa' : activeModel === 'A4-2vias' ? 'Pedido' : activeModel === 'etiqueta-80' ? 'Etiquetas' : 'Corte'})</span>
                  </button>
                </div>
              </div>

              {/* Renderização do Documento Selecionado */}
              <div id="container-impressao" className="w-full overflow-x-hidden print:border-none print:border-t-0 print:p-0 print:m-0 print:shadow-none">
                {renderDocumentosImpressao()}
              </div>
            </div>
          )}

          {/* ===================================================
               MODAL DE GESTÃO DE BOLETOS & CONDIÇÃO DE PAGAMENTO
               =================================================== */}
          {isBoletosModalOpen && selectedBoletoCotacao && (
            <BoletosGestaoModal
              isOpen={isBoletosModalOpen}
              onClose={() => setIsBoletosModalOpen(false)}
              cotacaoNumero={selectedBoletoCotacao.cotacaoNumero}
              clienteNome={selectedBoletoCotacao.clienteNome}
              valorTotal={selectedBoletoCotacao.valorTotal}
              cotacaoId={selectedBoletoCotacao.cotacaoId}
              clienteId={selectedBoletoCotacao.clienteId}
              boletosExistentes={boletos}
              onBoletosAtualizados={(atualizados) => setBoletos(atualizados)}
              onFeedback={(tipo, mensagem) => setDeleteFeedback({ message: mensagem, type: tipo })}
            />
          )}

        </div>
      )}

      {/* ===================================================
           ABA 1: EMISSÃO DE PROPOSTAS & ETIQUETAS (PADRÃO)
           =================================================== */}
      {activeTab === 'propostas' && (
        <>
          {/* PAINEL DE CONTROLE E FILTROS (NÃO SAI NA IMPRESSÃO) */}
          <div className="screen-header btn-no-print flex flex-col gap-5 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl">
        
        {/* Top Header with title and 3 direct Print Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Relatório e Emissão de Propostas
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Gere propostas oficiais completas em A4, pedidos de produção em 2 vias com linha de corte, ou etiquetas técnicas 80x80mm.
            </p>
          </div>

          {/* BOTÕES DAS PROPOSTAS DE IMPRESSÃO (AÇÕES INDEPENDENTES) */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => gerarEImprimir('pedido')}
              title="Imprime apenas a Via do Cliente e Via da Empresa/Produção em A4 (oculta a etiqueta da peça)"
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 ${
                activeModel === 'A4-2vias'
                  ? 'bg-amber-600 text-white shadow-amber-600/30 ring-2 ring-amber-300'
                  : 'bg-slate-800 hover:bg-amber-900/40 text-amber-200 border border-amber-500/40'
              }`}
            >
              <Scissors className="w-4 h-4 text-amber-300" />
              <span>📋 Imprimir Pedido (A4)</span>
            </button>

            <button
              onClick={() => gerarEImprimir('etiqueta')}
              title="Imprime apenas a Etiqueta de Identificação da Peça (oculta as vias do pedido em A4)"
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 ${
                activeModel === 'etiqueta-80'
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-300'
                  : 'bg-slate-800 hover:bg-emerald-900/40 text-emerald-200 border border-emerald-500/40'
              }`}
            >
              <Tag className="w-4 h-4 text-emerald-300" />
              <span>🏷️ Imprimir Etiqueta da Peça</span>
            </button>

            <button
              onClick={() => gerarEImprimir('proposta')}
              title="Imprime a Proposta Comercial completa em A4"
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95 ${
                activeModel === 'A4-inteiro'
                  ? 'bg-blue-600 text-white shadow-blue-600/30 ring-2 ring-blue-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <FileText className="w-4 h-4 text-blue-300" />
              <span>📄 Imprimir Proposta (A4 Inteiro)</span>
            </button>
          </div>
        </div>

        {/* SELEÇÃO DE EMPRESA E ARQUIVO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800 items-end">
          
          {/* SELEÇÃO DE CLIENTE COM NOME FANTASIA (Ponto 3) */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-blue-400" />
              Selecione o Cliente (Nome Fantasia):
            </label>
            <select 
              id="select-relatorio-cliente"
              value={selectedClientName}
              onChange={(e) => setSelectedClientName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 text-slate-100 border border-slate-700 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 font-medium"
            >
              <option value="">-- SELECIONE O CLIENTE --</option>
              <option value="CLIENTE BALCÃO">CLIENTE BALCÃO</option>
              <option value="IGREJA PRIMOGÊNITOS" data-razao="IGREJA EVANGELICA IRMAOS PRIMOGENITOS">IGREJA PRIMOGÊNITOS (Fantasia)</option>
              <option value="USICORTE METAIS" data-razao="USICORTE USINAGEM E MANUTENCAO EIRELI">USICORTE METAIS (Fantasia)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.fantasyName || c.name} data-razao={c.name}>
                  {c.fantasyName ? `${c.fantasyName} (Fantasia)` : `${c.name} (${c.type})`}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Puxar Arquivo / Pedido Salvo */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              Selecione o Pedido Salvo:
            </label>
            <select 
              id="select-relatorio-arquivo"
              value={selectedOrderKey}
              onChange={(e) => handleOrderChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 text-slate-100 border border-slate-700 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 font-mono"
            >
              <option value="CURRENT">
                {propostasQuote.quoteNumber ? `[${propostasQuote.quoteNumber}] ${propostasQuote.clientName || 'Cotação Atual'} (Cotação Selecionada)` : 'Cotação Atual (Em Edição)'}
              </option>
              {filteredSavedQuotes.map(sq => (
                <option key={sq.id || sq.numero} value={sq.id || sq.numero}>
                  [{sq.numero || 'COT'}] {sq.cliente || 'CLIENTE BALCÃO'} - {formatSafeDate(sq.data || sq.createdAt)}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* ÁREA PARA COLAR O PRINT SCREEN COM CTRL + V (Ponto 1) */}
        <div className="pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
              📸 Desenho Técnico (Copie o print com Win+Shift+S ou PrintScreen e cole abaixo):
            </label>
            {currentDrawing && (
              <button
                type="button"
                onClick={() => {
                  setDrawingPhotos(prev => ({ ...prev, [selectedItemIndex]: '' }));
                  setPasteSuccess(false);
                }}
                className="text-[11px] text-red-400 hover:text-red-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                title="Remover Desenho"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remover Foto (Exibir SEM DESENHO)</span>
              </button>
            )}
          </div>

          <div
            id="paste-area"
            ref={pasteAreaRef}
            tabIndex={0}
            onPaste={handlePasteEvent}
            onClick={() => pasteAreaRef.current?.focus()}
            className={`p-3.5 border-2 border-dashed rounded-xl text-center cursor-pointer outline-hidden transition-all flex flex-col sm:flex-row items-center justify-between gap-3 ${
              pasteSuccess
                ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300'
                : 'border-blue-500/70 hover:border-blue-400 bg-blue-950/10 focus:bg-blue-950/20 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs text-left">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <span id="paste-msg" className="block font-medium">
                  {pasteSuccess ? (
                    <strong className="text-emerald-400 font-bold">✅ Foto do print colada com sucesso!</strong>
                  ) : (
                    <>Clique aqui e pressione <strong className="text-blue-400 font-bold bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800/60">Ctrl + V</strong> para colar a foto do print</>
                  )}
                </span>
                <span className="text-[11px] text-slate-400">
                  Ou clique em "Carregar Arquivos" e selecione fotos ou <strong>arquivos CAD (.dxf)</strong> — conversão vetorial automática para a etiqueta por observação ou item ativo.
                </span>
                {matchInfo && (
                  <span className="block text-[11px] text-amber-300 mt-1">{matchInfo}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {currentDrawing && (
                <div className="w-10 h-10 rounded border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center shrink-0">
                  <img 
                    src={currentDrawing} 
                    alt="Miniatura" 
                    className="desenho-tecnico-img w-full h-full object-contain"
                  />
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*,.dxf" 
                multiple 
                className="hidden" 
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>{currentDrawing ? 'Alterar / Adicionar Arquivos (.dxf/fotos)' : 'Carregar Imagens / .DXF'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action toolbar with visual model switchers and export buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">Visualizar na tela:</span>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 flex-wrap gap-1">
              <button
                onClick={() => setActiveModel('A4-inteiro')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeModel === 'A4-inteiro' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Geral (A4 Inteiro)
              </button>
              <button
                onClick={() => setActiveModel('proposta-resumida')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  activeModel === 'proposta-resumida' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Empresa</span>
              </button>
              <button
                onClick={() => setActiveModel('A4-2vias')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeModel === 'A4-2vias' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                A4 2 Vias
              </button>
              <button
                onClick={() => setActiveModel('etiqueta-80')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeModel === 'etiqueta-80' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Etiqueta 80x80
              </button>
              <button
                onClick={() => setActiveModel('corte')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeModel === 'corte' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Corte
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>JSON</span>
            </button>
          </div>
        </div>

      </div>

      {/* ===================================================
           CONTAINER DE IMPRESSÃO (O QUE SAI NA IMPRESSORA E NA PRÉVIA)
           =================================================== */}
      <div id="container-impressao" className="w-full overflow-x-hidden print:border-none print:border-t-0 print:p-0 print:m-0 print:shadow-none">
        {renderDocumentosImpressao()}
      </div>
        </>
      )}

      {/* Toast flutuante de confirmação de alteração rápida de Situação */}
      {statusToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-slate-100 border border-emerald-500/50 shadow-2xl rounded-xl px-4 py-2.5 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{statusToast.message}</span>
        </div>
      )}

    </div>
  );
}
