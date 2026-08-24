import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Quote, QuoteItem, Client } from '../types';
import Logo from './Logo';
import { QuotePrintView } from './QuotePrintView';
import { 
  formatCurrency, 
  formatWeightKg, 
  formatarMedidasLimpa,
  formatSafeDate 
} from '../utils/calculator';
import { 
  fetchCotacoesDb, 
  fetchCotacaoById,
  uploadDesenhoStorage, 
  updateItemCortadoDb,
  deleteCotacaoDb,
  deleteCotacaoItemDb,
  deleteMultipleCotacoesDb,
  db 
} from '../lib/db';
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
  Upload,
  Trash2,
  Eye,
  CheckCircle2,
  Search,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  AlertTriangle,
  Loader2,
  X
} from 'lucide-react';

interface ReportsModuleProps {
  currentQuote: Quote;
  clients?: Client[];
  onNavigateToQuote?: () => void;
}

export type StatusProposta = 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado';

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
  status: StatusProposta;
}

// Dados de consulta (inicia vazio para produção)
const DADOS_CONSULTA_EXEMPLO: ConsultaItem[] = [];

const STATUS_STYLES: Record<StatusProposta, string> = {
  rascunho: 'bg-slate-200 text-slate-700',
  pendente: 'bg-amber-200 text-amber-900',
  aprovado: 'bg-emerald-200 text-emerald-900',
  rejeitado: 'bg-rose-200 text-rose-900'
};


// Sample technical blueprint drawing in base64 SVG
const SAMPLE_DRAWING_BASE64 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><circle cx="100" cy="100" r="60" fill="none" stroke="%232563eb" stroke-width="2" stroke-dasharray="4,2"/><circle cx="100" cy="100" r="35" fill="%23dbeafe" stroke="%231e40af" stroke-width="2.5"/><line x1="20" y1="100" x2="180" y2="100" stroke="%23ef4444" stroke-width="1" stroke-dasharray="3,3"/><line x1="100" y1="20" x2="100" y2="180" stroke="%23ef4444" stroke-width="1" stroke-dasharray="3,3"/><circle cx="100" cy="100" r="3" fill="%23ef4444"/><text x="100" y="32" font-family="monospace" font-size="10" text-anchor="middle" font-weight="bold" fill="%231e293b">Ø 120 ±0.05</text><text x="100" y="104" font-family="monospace" font-size="9" text-anchor="middle" font-weight="bold" fill="%231e40af">Ø 70 mm</text><text x="100" y="188" font-family="sans-serif" font-size="8" text-anchor="middle" fill="%2364748b">CORTE / USINAGEM CNC</text></svg>`;

export default function ReportsModule({ currentQuote, clients = [], onNavigateToQuote }: ReportsModuleProps) {
  // Navigation tab: 'propostas' | 'consulta'
  const [activeTab, setActiveTab] = useState<'propostas' | 'consulta'>('propostas');

  // Cotação ativa específica (carregada do banco por ID/URL ou cotação atual)
  const [activeQuote, setActiveQuote] = useState<Quote>(currentQuote);
  const [savedDbQuotes, setSavedDbQuotes] = useState<{ id: string; numero: string; cliente: string; data: string; total: number; createdAt?: string }[]>([]);

  // Active document preview / print mode
  const [activeModel, setActiveModel] = useState<PrintModelType>('A4-inteiro');
  const [printMode, setPrintMode] = useState<'pedido' | 'etiqueta' | 'proposta' | 'corte'>('pedido');
  
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
  // Filtro por situação da proposta (para não misturar no fechamento)
  const [statusFiltro, setStatusFiltro] = useState<'todos' | StatusProposta>('todos');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dbQuotesItems, setDbQuotesItems] = useState<ConsultaItem[]>([]);

  // Estados para Exclusão (Individual e em Massa)
  const [itemToDelete, setItemToDelete] = useState<ConsultaItem | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteFeedback, setDeleteFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  // Busca e carrega uma cotação estritamente por ID no banco de dados
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
              notes: cot.observacoes || '',
              observacao: cot.observacoes || '',
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
        setSelectedOrderKey(newQ.quoteNumber);

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
      console.error("Erro ao carregar cotação filtrada por ID:", err);
    }
    return null;
  };

  // Carrega cotações e itens do Supabase e LocalStorage com deduplicação rigorosa e exibindo apenas a versão mais recente
  const loadAllConsultaData = async () => {
    const itemsList: ConsultaItem[] = [];
    const seenQuoteNumbers = new Set<string>();
    const distinctQuotesList: { id: string; numero: string; cliente: string; data: string; total: number; createdAt?: string }[] = [];

    // 1. Do Supabase (Prioridade Máxima)
    try {
      const dbData = await fetchCotacoesDb();
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
              observacao: it.observacao || '',
              status: q.status as StatusProposta
            });
          });
        });

        setSavedDbQuotes(distinctQuotesList);
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
              (q.items || []).forEach((it, itIdx) => {
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
                  observacao: it.notes || '',
                  status: (q.status?.toLowerCase().includes('aprov') ? 'aprovado' :
                           q.status?.toLowerCase().includes('canc') ? 'rejeitado' :
                           q.status?.toLowerCase().includes('env') ? 'pendente' : 'rascunho') as StatusProposta
                });
              });
            }
          });
        }
      } catch (e) {
        console.warn('Erro ao ler s_orcamentos:', e);
      }
    }

    setDbQuotesItems(itemsList);
  };

  useEffect(() => {
    loadAllConsultaData();
  }, []);

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

      // 2. Apaga do LocalStorage se existente
      const saved = localStorage.getItem('s_orcamentos');
      if (saved) {
        try {
          const quotes: Quote[] = JSON.parse(saved);
          if (Array.isArray(quotes)) {
            const cotKey = String(item.cotacao || item.cotacaoId || '').trim().toLowerCase();
            const updated = quotes.filter(q => {
              const qKey = String(q.quoteNumber || q.id || '').trim().toLowerCase();
              return qKey !== cotKey;
            });
            localStorage.setItem('s_orcamentos', JSON.stringify(updated));
          }
        } catch (e) {
          console.warn('Erro ao atualizar s_orcamentos:', e);
        }
      }

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

      // 2. Exclui do LocalStorage
      const saved = localStorage.getItem('s_orcamentos');
      if (saved) {
        try {
          const quotes: Quote[] = JSON.parse(saved);
          if (Array.isArray(quotes)) {
            const cotKeysSet = new Set(
              Array.from(cotacoesParaExcluir).map(k => String(k).trim().toLowerCase())
            );
            const updated = quotes.filter(q => {
              const qKey = String(q.quoteNumber || q.id || '').trim().toLowerCase();
              return !cotKeysSet.has(qKey);
            });
            localStorage.setItem('s_orcamentos', JSON.stringify(updated));
          }
        } catch (e) {
          console.warn('Erro ao atualizar s_orcamentos:', e);
        }
      }

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

  // Consolida itens da consulta garantindo exibição de cotação única sem duplicar com a cotação ativa
  const allConsultaItems: ConsultaItem[] = useMemo(() => {
    // Se temos itens persistidos no banco/local
    if (dbQuotesItems.length > 0) {
      const currQuoteNum = String(currentQuote?.quoteNumber || '').trim().toLowerCase();
      const currItems = currentQuote?.items || [];

      // Se a cotação atual em memória possui itens e ainda NÃO está salva no banco/local
      if (currQuoteNum && currItems.length > 0) {
        const existsInDb = dbQuotesItems.some(
          it => String(it.cotacao || '').trim().toLowerCase() === currQuoteNum
        );
        if (!existsInDb) {
          const currentItemsMapped: ConsultaItem[] = currItems.map((it, idx) => ({
            idVer: 14000 + idx,
            data: formatSafeDate(currentQuote.date || currentQuote.createdAt),
            empresa: selectedClientName || currentQuote.clientName || 'Cliente Balcão',
            contato: currentQuote.contactPerson || '-',
            produto: it.constanteNome || it.material || 'Material',
            medida: formatarMedidasLimpa(it),
            descricao: it.descricao || it.description || 'Item UsiCorte',
            valor: formatCurrency(it.unitPrice || 0),
            qtd: it.qtd || it.quantity || 1,
            unitario: it.unitPrice || 0,
            valorGeral: (it.unitPrice || 0) * (it.qtd || it.quantity || 1),
            cotacao: currentQuote.quoteNumber || 'COT-NOVA',
            cotacaoId: currentQuote.id,
            itemId: it.id,
            observacao: (it.observacao || it.notes || it.info || '') as string,
            status: (((it as unknown as { status?: StatusProposta }).status) || (currentQuote as unknown as { status?: StatusProposta }).status || 'rascunho') as StatusProposta
          }));
          return [...currentItemsMapped, ...dbQuotesItems];
        }
      }
      return dbQuotesItems;
    }

    // Fallback: se não há nada no banco ainda, exibe a cotação atual em memória
    const currentItemsMapped: ConsultaItem[] = (currentQuote?.items || []).map((it, idx) => ({
      idVer: 14000 + idx,
      data: formatSafeDate(currentQuote.date || currentQuote.createdAt),
      empresa: selectedClientName || currentQuote.clientName || 'Cliente Balcão',
      contato: currentQuote.contactPerson || '-',
      produto: it.constanteNome || it.material || 'Material',
      medida: formatarMedidasLimpa(it),
      descricao: it.descricao || it.description || 'Item UsiCorte',
      valor: formatCurrency(it.unitPrice || 0),
      qtd: it.qtd || it.quantity || 1,
      unitario: it.unitPrice || 0,
      valorGeral: (it.unitPrice || 0) * (it.qtd || it.quantity || 1),
      cotacao: currentQuote.quoteNumber || 'COT-NOVA',
      cotacaoId: currentQuote.id,
      itemId: it.id,
      observacao: (it.observacao || it.notes || it.info || '') as string,
      status: (((it as unknown as { status?: StatusProposta }).status) || (currentQuote as unknown as { status?: StatusProposta }).status || 'rascunho') as StatusProposta
    }));

    return currentItemsMapped;
  }, [currentQuote, selectedClientName, dbQuotesItems]);


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

      // 1.b) Filtro por situação (rascunho / pendente / aprovado / rejeitado)
      if (statusFiltro !== 'todos' && item.status !== statusFiltro) return false;

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

  // ✅ Padronização de todos os botões de impressão da CONSULTA (GERAL, EMPRESA, PEDIDO, ETIQUETAS, CORTE)
  // Renderizam diretamente na tela atual sem redirecionar de aba
  const imprimirRelatorioGeral = async (tipoRelatorio: 'GERAL' | 'EMPRESA' | 'PEDIDO' | 'ETIQUETAS' | 'CORTE') => {
    if (selectedIds.length === 0) {
      alert(`Por favor, selecione ao menos um item da tabela para gerar o relatório de ${tipoRelatorio}.`);
      return;
    }

    document.body.classList.remove('print-pedido', 'print-etiqueta', 'print-proposta', 'print-corte', 'print-geral', 'print-empresa');

    // Se houver item selecionado, carrega os dados completos da cotação caso exista no banco
    const selectedItem = filteredConsultaItems.find(i => selectedIds.includes(i.idVer));
    if (selectedItem) {
      const targetId = selectedItem.cotacaoId || selectedItem.cotacao;
      if (targetId) {
        await carregarCotacaoPorId(targetId);
      }
      if (selectedItem.empresa) {
        setSelectedClientName(selectedItem.empresa);
      }
    }

    // Configura o modelo ativo e classe de impressão conforme o botão acionado (sem sair da tela de Consulta)
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

  // Handle clipboard paste (Ctrl + V / PrintScreen / Win+Shift+S)
  const processClipboardItems = (clipboardData: DataTransfer | null) => {
    if (!clipboardData) return;
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            // aplica a imagem colada APENAS ao item selecionado
            setDrawingPhotos(prev => ({ ...prev, [selectedItemIndex]: base64 }));
            setPasteSuccess(true);
            setTimeout(() => setPasteSuccess(false), 4000);
          };
          reader.readAsDataURL(blob);
        }
        break;
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
    } else {
      await carregarCotacaoPorId(key);
    }
  };


  // Handle drawing photo upload (SELEÇÃO MÚLTIPLA + casamento pelo nome do arquivo)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    let pending = files.length;

    files.forEach((file) => {
      const fileKey = normalizeKey(file.name);

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
        if (--pending === 0) finish();
        return;
      }

      const idx = targetIdx;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setDrawingPhotos(prev => ({ ...prev, [idx]: base64 }));
        matched.push(`${file.name} → item ${idx + 1}`);
        if (--pending === 0) finish();
      };
      reader.onerror = () => {
        unmatched.push(file.name);
        if (--pending === 0) finish();
      };
      reader.readAsDataURL(file);

      // Sincroniza com Supabase Storage bucket 'desenhos'
      if (displayQuote?.quoteNumber) {
        uploadDesenhoStorage(displayQuote.quoteNumber, file).catch(e => {
          console.warn('Upload bucket desenhos aviso:', e);
        });
      }
    });

    function finish() {
      setPasteSuccess(matched.length > 0);
      setMatchInfo(
        `${matched.length} imagem(ns) vinculada(s)` +
        (unmatched.length ? ` • sem correspondência: ${unmatched.join(', ')}` : '')
      );
      setTimeout(() => { setPasteSuccess(false); setMatchInfo(''); }, 6000);
    }

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
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const consultaSelectedQuote = useMemo<Quote>(() => {
    const selRows = filteredConsultaItems.filter(i => selectedIds.includes(i.idVer));
    if (selRows.length === 0) return activeQuote || currentQuote;

    const firstItem = selRows[0];
    const clientName = firstItem.empresa || selectedClientName || activeQuote?.clientName || 'CLIENTE BALCÃO';
    const quoteNum = firstItem.cotacao || activeQuote?.quoteNumber || 'COT-SELECIONADA';
    const dateVal = firstItem.data || activeQuote?.date || new Date().toISOString().slice(0, 10);

    const mappedItems: QuoteItem[] = selRows.map((it, idx) => {
      const matchInActive = (activeQuote?.items || []).find(
        aqIt => String(aqIt.id) === String(it.itemId) || aqIt.descricao === it.descricao
      );

      return {
        id: String(it.itemId || it.idVer || idx + 1),
        date: dateVal,
        companyName: clientName,
        constant: matchInActive?.constant || '1.0',
        diameter: it.medida || matchInActive?.diameter || '',
        description: it.descricao || it.produto || `Item #${idx + 1}`,
        descricao: it.descricao || it.produto || `Item #${idx + 1}`,
        material: it.produto || matchInActive?.material || 'MATERIAL',
        constanteNome: it.produto || matchInActive?.constanteNome || 'MATERIAL',
        measure: it.medida || matchInActive?.measure || '',
        widthLength: it.medida || matchInActive?.widthLength || '',
        quantity: Number(it.qtd) || 1,
        qtd: Number(it.qtd) || 1,
        unitPrice: Number(it.unitario) || 0,
        valorUnitario: Number(it.unitario) || 0,
        subtotal: Number(it.valorGeral) || ((Number(it.unitario) || 0) * (Number(it.qtd) || 1)),
        notes: it.observacao || matchInActive?.notes || '',
        observacao: it.observacao || matchInActive?.observacao || '',
        drawingImage: matchInActive?.drawingImage || drawingPhotos[idx] || undefined,
        fotoDesenho: matchInActive?.fotoDesenho || drawingPhotos[idx] || undefined,
        totalWeightKg: matchInActive?.totalWeightKg || matchInActive?.pesoTotal || 0,
        pesoTotal: matchInActive?.pesoTotal || matchInActive?.totalWeightKg || 0
      };
    });

    const subtotal = mappedItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
    const totalWeight = mappedItems.reduce((acc, it) => acc + (it.totalWeightKg || it.pesoTotal || 0), 0);

    return {
      id: activeQuote?.id || firstItem.cotacaoId || quoteNum,
      quoteNumber: quoteNum,
      date: dateVal,
      clientName: clientName,
      contactPerson: firstItem.contato || activeQuote?.contactPerson || '',
      status: activeQuote?.status || 'Rascunho',
      validityDays: activeQuote?.validityDays || 10,
      paymentTerms: activeQuote?.paymentTerms || 'À Vista / Pix',
      observations: activeQuote?.observations || '',
      items: mappedItems,
      subtotalTotal: subtotal,
      grandTotal: subtotal,
      discount: activeQuote?.discount || 0,
      shipping: activeQuote?.shipping || 0,
      totalWeightKg: totalWeight,
      createdAt: activeQuote?.createdAt || new Date().toISOString(),
      updatedAt: activeQuote?.updatedAt || new Date().toISOString()
    };
  }, [filteredConsultaItems, selectedIds, activeQuote, currentQuote, selectedClientName, drawingPhotos]);

  const displayQuote = (activeTab === 'consulta' && selectedIds.length > 0)
    ? consultaSelectedQuote
    : (activeQuote || currentQuote);

  const totalItems = displayQuote.items.length;
  const totalWeight = displayQuote.totalWeightKg || displayQuote.items.reduce((acc, item) => acc + (item.totalWeightKg || item.pesoTotal || 0), 0);
  const subtotalValue = displayQuote.subtotalTotal || displayQuote.items.reduce((acc, item) => acc + (item.subtotal || (item.unitPrice * item.quantity)), 0);
  const discountVal = displayQuote.discount || 0;
  const shippingVal = displayQuote.shipping || 0;
  const grandTotal = displayQuote.grandTotal || (subtotalValue - discountVal + shippingVal);

  const activeItem: Partial<QuoteItem> = displayQuote.items[selectedItemIndex] || displayQuote.items[0] || {
    material: 'BRONZE TM-23 REDONDO',
    constanteNome: 'BRONZE TM-23 REDONDO',
    measure: 'Ø 50 × 200 mm',
    widthLength: '200 mm',
    quantity: 1,
    qtd: 1,
    unitPrice: 185.00,
    totalWeightKg: 3.450,
    observacao: 'CONFORME DESENHO TÉCNICO',
    description: 'BUCHA USINADA'
  };

  // ✅ imagem de UM item específico: override manual -> imagem do próprio item -> exemplo
  const getDrawing = (idx: number): string => {
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
  const renderDocumentosImpressao = () => (
    <div id="container-impressao" className="bg-slate-900/60 p-2 sm:p-6 rounded-2xl border border-slate-800 w-full overflow-x-hidden">
      
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
        {/* Header */}
        <div className="border-b-2 border-black pb-3 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="logo-impressao mb-2" style={{ width: '180px' }}>
              <Logo variant="light" className="w-[180px] h-auto" />
            </div>
            <p className="m-0 text-xs font-semibold text-slate-600 tracking-wide uppercase">Relatório / Proposta Comercial</p>
          </div>
          <div className="text-left sm:text-right text-xs space-y-0.5 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
            <div><strong>PROPOSTA Nº:</strong> <span className="rel-numero font-mono font-bold text-blue-800">{displayQuote.quoteNumber || '00124'}</span></div>
            <div><strong>DATA:</strong> <span className="rel-data font-mono">{displayQuote.date || new Date().toLocaleDateString('pt-BR')}</span></div>
          </div>
        </div>

        {/* Client box */}
        <div className="bg-slate-100 border border-slate-300 p-3 rounded-md mb-4 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <span className="font-bold text-slate-700">EMPRESA / CLIENTE:</span>{' '}
            <strong className="lbl-cliente-nome text-slate-900 text-sm font-black uppercase break-words">{selectedClientName || displayQuote.clientName}</strong>
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
              const informacoesObs = item.observacao || item.notes || item.info || '-';
              const valorUnitario = Number(item.valorUnitario !== undefined ? item.valorUnitario : (item.unitPrice || 0));
              const qtd = Number(item.qtd !== undefined ? item.qtd : (item.quantity || 1));
              const pesoTotal = Number(item.pesoTotal !== undefined ? item.pesoTotal : (item.totalWeightKg || 0));
              const subtotal = Number(item.subtotal !== undefined ? item.subtotal : (valorUnitario * qtd));

              return (
                <div key={item.id || idx} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2 text-xs shadow-xs">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Produto / Material</span>
                    <strong className="font-bold text-slate-900 text-sm">{produtoMaterial}</strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Medidas</span>
                    <span className="font-mono text-slate-800 font-semibold">{medidasFormatadas}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Descrição</span>
                    <span className="text-slate-700">{descricaoItem}</span>
                  </div>

                  {informacoesObs !== '-' && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Informações</span>
                      <span className="italic text-slate-600">{informacoesObs}</span>
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

        {/* 🖥️ DESKTOP: 8-Column Table (>= 640px) */}
        <table className="hidden sm:table w-full border-collapse text-xs mb-6" border={1} cellPadding={6}>
          <thead>
            <tr className="bg-slate-200 text-slate-900 font-bold uppercase text-[11px] border-b border-black">
              <th className="text-left p-2">PRODUTO / MATERIAL</th>
              <th className="text-center p-2">MEDIDAS</th>
              <th className="text-left p-2">DESCRIÇÃO</th>
              <th className="text-left p-2">INFORMAÇÕES</th>
              <th className="text-right p-2">UNITÁRIO</th>
              <th className="text-center p-2 w-12">QTD</th>
              <th className="text-right p-2">PESO TOTAL</th>
              <th className="text-right p-2">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody id="tbody-a4-inteiro" className="divide-y divide-slate-300">
            {displayQuote.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                  Nenhum item na cotação para exibição.
                </td>
              </tr>
            ) : (
              displayQuote.items.map((item, idx) => {
                const produtoMaterial = item.constanteNome || item.constantName || item.material || 'MATERIAL';
                const medidasFormatadas = formatarMedidasLimpa(item);
                const descricaoItem = item.descricao || item.description || '-';
                const informacoesObs = item.observacao || item.notes || item.info || '-';
                const valorUnitario = Number(item.valorUnitario !== undefined ? item.valorUnitario : (item.unitPrice || 0));
                const qtd = Number(item.qtd !== undefined ? item.qtd : (item.quantity || 1));
                const pesoTotal = Number(item.pesoTotal !== undefined ? item.pesoTotal : (item.totalWeightKg || 0));
                const subtotal = Number(item.subtotal !== undefined ? item.subtotal : (valorUnitario * qtd));

                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50">
                    <td className="text-left font-bold text-slate-900 p-2">{produtoMaterial}</td>
                    <td className="text-center font-mono text-[11px] p-2">{medidasFormatadas}</td>
                    <td className="text-left p-2 text-slate-800">{descricaoItem}</td>
                    <td className="text-left p-2 text-slate-600 italic text-[10px]">{informacoesObs}</td>
                    <td className="text-right font-mono p-2">{formatCurrency(valorUnitario)}</td>
                    <td className="text-center font-bold font-mono p-2">{qtd}</td>
                    <td className="text-right font-mono font-bold p-2 text-slate-900">{formatWeightKg(pesoTotal, 3)}</td>
                    <td className="text-right font-mono font-bold p-2 text-slate-950">{formatCurrency(subtotal)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

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
           PROPOSTA 2: PEDIDO A4 DIVIDIDO AO MEIO (2 VIAS)
           =================================================== */}
      <div 
        id="doc-A4-2vias" 
        className={`documento-modelo secao-pedido modelo-duas-vias bg-white text-slate-900 p-4 sm:p-6 rounded-xl shadow-2xl w-full max-w-4xl mx-auto font-sans overflow-x-hidden ${
          activeModel === 'A4-2vias' ? 'block' : 'hidden'
        }`}
        style={{ minHeight: '850px' }}
      >
        {/* VIA 1: CLIENTE */}
        <div className="via-pedido border border-black p-3 sm:p-4 rounded bg-white flex flex-col justify-between" style={{ minHeight: '380px' }}>
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-black pb-2 mb-3 gap-2">
              <div className="flex items-center gap-3">
                <div className="logo-impressao" style={{ width: '130px' }}>
                  <Logo variant="light" className="w-[130px] h-auto" />
                </div>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">VIA DO CLIENTE</span>
              </div>
              <span className="text-xs">
                <strong>PEDIDO Nº:</strong> <span className="rel-numero font-mono font-bold">{displayQuote.quoteNumber || '00124'}</span>
              </span>
            </div>

            <div className="text-xs mb-3 text-slate-700 flex flex-col sm:flex-row justify-between gap-1">
              <div><strong>Cliente:</strong> <span className="lbl-cliente-nome font-bold uppercase">{selectedClientName || displayQuote.clientName}</span></div>
              <div><strong>Data:</strong> <span className="rel-data font-mono">{displayQuote.date || new Date().toLocaleDateString('pt-BR')}</span></div>
            </div>

            {/* Mobile Cards Via 1 */}
            <div className="block sm:hidden space-y-2 mb-3">
              {displayQuote.items.map((item, idx) => (
                <div key={idx} className="border border-slate-200 rounded p-2 text-xs bg-slate-50 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>{item.constanteNome || item.material || 'MATERIAL'}</span>
                    <span className="font-mono">{formatCurrency(item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1)))}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span>Medida: {formatarMedidasLimpa(item)}</span>
                    <span>Qtd: {item.qtd || item.quantity || 1}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Via 1 */}
            <table className="hidden sm:table w-full text-xs border-collapse mb-3" border={1} cellPadding={4}>
              <thead>
                <tr className="bg-slate-100 font-bold text-[10px] uppercase">
                  <th className="text-left p-1.5">MATERIAL</th>
                  <th className="text-center p-1.5">MEDIDAS</th>
                  <th className="text-center p-1.5 w-12">QTD</th>
                  <th className="text-right p-1.5">PESO TOTAL</th>
                  <th className="text-right p-1.5">TOTAL</th>
                </tr>
              </thead>
              <tbody className="tbody-resumido divide-y divide-slate-200">
                {displayQuote.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-1.5 font-bold text-slate-900">{item.constanteNome || item.material || 'MATERIAL'}</td>
                    <td className="p-1.5 text-center font-mono text-[10px]">{formatarMedidasLimpa(item)}</td>
                    <td className="p-1.5 text-center font-mono font-bold">{item.qtd || item.quantity || 1}</td>
                    <td className="p-1.5 text-right font-mono">{formatWeightKg(item.pesoTotal || item.totalWeightKg || 0, 3)}</td>
                    <td className="p-1.5 text-right font-mono font-bold">{formatCurrency(item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs border-t border-black pt-2 mt-2 gap-2">
            <span className="text-slate-600">Assinatura Cliente: ___________________________________</span>
            <strong className="text-sm font-mono text-slate-950">TOTAL: <span className="lbl-valor-total">{formatCurrency(grandTotal)}</span></strong>
          </div>
        </div>

        {/* LINHA DE CORTE */}
        <div className="linha-corte my-6 border-t-2 border-dashed border-black text-center relative">
          <span className="bg-white px-3 text-[11px] font-bold text-slate-900 relative -top-3">
            ✂️ CORTE AQUI
          </span>
        </div>

        {/* VIA 2: EMPRESA / PRODUÇÃO */}
        <div className="via-pedido border border-black p-3 sm:p-4 rounded bg-white flex flex-col justify-between" style={{ minHeight: '380px' }}>
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-black pb-2 mb-3 gap-2">
              <div>
                <strong className="text-sm tracking-tight text-slate-900 font-black">USICORTE METAIS</strong>
                <span className="text-xs ml-2 px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold">VIA DA EMPRESA / PRODUÇÃO</span>
              </div>
              <span className="text-xs">
                <strong>PEDIDO Nº:</strong> <span className="rel-numero font-mono font-bold">{displayQuote.quoteNumber || '00124'}</span>
              </span>
            </div>

            <div className="text-xs mb-3 text-slate-700 flex flex-col sm:flex-row justify-between gap-1">
              <div><strong>Cliente:</strong> <span className="lbl-cliente-nome font-bold uppercase">{selectedClientName || displayQuote.clientName}</span></div>
              <div><strong>Data:</strong> <span className="rel-data font-mono">{displayQuote.date || new Date().toLocaleDateString('pt-BR')}</span></div>
            </div>

            {/* Mobile Cards Via 2 */}
            <div className="block sm:hidden space-y-2 mb-3">
              {displayQuote.items.map((item, idx) => (
                <div key={idx} className="border border-slate-200 rounded p-2 text-xs bg-slate-50 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>{item.constanteNome || item.material || 'MATERIAL'}</span>
                    <span className="font-mono">{formatCurrency(item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1)))}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span>Medida: {formatarMedidasLimpa(item)}</span>
                    <span>Qtd: {item.qtd || item.quantity || 1}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Via 2 */}
            <table className="hidden sm:table w-full text-xs border-collapse mb-3" border={1} cellPadding={4}>
              <thead>
                <tr className="bg-slate-100 font-bold text-[10px] uppercase">
                  <th className="text-left p-1.5">MATERIAL</th>
                  <th className="text-center p-1.5">MEDIDAS</th>
                  <th className="text-center p-1.5 w-12">QTD</th>
                  <th className="text-right p-1.5">PESO TOTAL</th>
                  <th className="text-right p-1.5">TOTAL</th>
                </tr>
              </thead>
              <tbody className="tbody-resumido divide-y divide-slate-200">
                {displayQuote.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-1.5 font-bold text-slate-900">{item.constanteNome || item.material || 'MATERIAL'}</td>
                    <td className="p-1.5 text-center font-mono text-[10px]">{formatarMedidasLimpa(item)}</td>
                    <td className="p-1.5 text-center font-mono font-bold">{item.qtd || item.quantity || 1}</td>
                    <td className="p-1.5 text-right font-mono">{formatWeightKg(item.pesoTotal || item.totalWeightKg || 0, 3)}</td>
                    <td className="p-1.5 text-right font-mono font-bold">{formatCurrency(item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs border-t border-black pt-2 mt-2 gap-2">
            <span className="text-slate-600">Vendedor / Produção: ___________________________________</span>
            <strong className="text-sm font-mono text-slate-950">TOTAL: <span className="lbl-valor-total">{formatCurrency(grandTotal)}</span></strong>
          </div>
        </div>
      </div>

      {/* ===================================================
           PROPOSTA 3: ETIQUETA CUPOM 80x80mm (IDENTIFICAÇÃO DA PEÇA)
           =================================================== */}
      {displayQuote.items.map((rawItem, itemIdx) => {
        const item: Partial<QuoteItem> = rawItem || {};
        const img = getDrawing(itemIdx);
        return (
          <div 
            key={itemIdx}
            id={`doc-etiqueta-80-${itemIdx}`}
            className={`documento-modelo secao-etiqueta modelo-etiqueta-80 w-full max-w-[380px] border-2 border-black rounded-lg p-4 bg-white text-black font-sans relative mx-auto shadow-2xl print:m-0 print:break-after-page ${
              activeModel === 'etiqueta-80'
                ? (selectedItemIndex === itemIdx ? 'block' : 'hidden print:block')
                : 'hidden'
            }`}
          >
            {/* Cabeçalho Original */}
            <div className="etiqueta-header text-center pb-2 border-b-2 border-black mb-3">
              <h2 className="font-extrabold text-xl tracking-wider uppercase leading-tight">USICORTE METAIS</h2>
              <p className="text-xs font-bold text-gray-800 mt-0.5">
                PEDIDO Nº: <span className="font-mono font-black text-blue-900 rel-numero">{displayQuote.quoteNumber || displayQuote.id || 'COT-2026-9663'}</span>
              </p>
            </div>

            {/* Conteúdo: Dados + Desenho */}
            <div className="etiqueta-corpo grid grid-cols-12 gap-2 items-start mb-3">
              {/* Coluna Esquerda - Informações */}
              <div className="etiqueta-dados col-span-7 text-xs space-y-1.5 leading-tight">
                <div>
                  <span className="font-bold text-gray-600 block text-[10px]">EMPRESA / CLIENTE:</span>
                  <span className="lbl-cliente-nome font-extrabold uppercase block">{selectedClientName || displayQuote.clientName || 'CLIENTE BALCÃO'}</span>
                </div>

                <div>
                  <span className="font-bold text-gray-600 block text-[10px]">MATERIAL:</span>
                  <span id="etiq-material" className="font-extrabold uppercase text-sm text-blue-950 block truncate">
                    {item.constanteNome || item.material || 'BRONZE TM-23'}
                  </span>
                </div>

                <div>
                  <span className="font-bold text-gray-600 block text-[10px]">MEDIDA:</span>
                  <span id="etiq-medida" className="font-bold block text-[11.5px] font-mono">
                    {formatarMedidasLimpa(item) || 'Ø 50 x 200 mm'}
                  </span>
                </div>

                <div>
                  <span className="font-bold text-gray-600 block text-[10px]">QTD:</span>
                  <span id="etiq-qtd" className="font-black text-sm">
                    {item.qtd || item.quantity || 1} PC
                  </span>
                </div>

                {/* Campo de Observação */}
                {(item.observacao || item.notes || item.info || item.descricao || displayQuote.observations) && (
                  <div className="pt-1">
                    <span className="font-bold text-gray-600 block text-[10px]">OBSERVAÇÃO:</span>
                    <span id="etiq-obs" className="font-semibold text-[11px] block text-gray-800 italic leading-snug">
                      {item.observacao || item.notes || item.info || item.descricao || displayQuote.observations}
                    </span>
                  </div>
                )}
              </div>

              {/* Coluna Direita - Desenho Técnico Nítido */}
              <div 
                id="box-foto-etiqueta"
                className="etiqueta-foto-box col-span-5 border-2 border-dashed border-gray-400 p-1 rounded flex items-center justify-center min-h-[110px] bg-slate-50 overflow-hidden"
              >
                {img ? (
                  <img 
                    id="img-desenho-etiqueta"
                    src={img} 
                    alt="Desenho Peça" 
                    className="desenho-tecnico-img max-h-[100px] w-auto object-contain print:contrast-[250%] print:brightness-90"
                    style={{ filter: 'contrast(200%) brightness(85%)' }}
                  />
                ) : (
                  <span id="sem-foto-msg" className="text-[9px] font-bold text-gray-400 text-center uppercase tracking-wide">
                    CORTE / USINAGEM CNC
                  </span>
                )}
              </div>
            </div>

            {/* Item selector pills if quote has multiple items */}
            {displayQuote.items.length > 1 && (
              <div className="btn-no-print pt-1 pb-2 mb-2 flex items-center gap-1 overflow-x-auto border-t border-slate-200">
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
            <div className="etiqueta-footer pt-2 border-t border-black text-center mt-auto">
              <span className="site-url text-[10px] font-bold tracking-widest text-black uppercase block">
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
            clientName: selectedClientName || displayQuote.clientName || 'BRASIL TECNOLOGIAS LTDA',
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
              drawingImage: getDrawing(idx)
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
            <p className="m-0 text-[11px] font-semibold text-slate-600 uppercase">
              Cliente: {selectedClientName || displayQuote.clientName || 'TODOS'}
            </p>
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
            {displayQuote.items.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className="border border-black p-1.5 font-bold uppercase">{item.observacao || item.notes || item.info || displayQuote.quoteNumber || '-'}</td>
                <td className="border border-black p-1.5 uppercase">{item.constanteNome || item.material || 'MATERIAL'}</td>
                <td className="border border-black p-1.5">{formatarMedidasLimpa(item)}</td>
                <td className="border border-black p-1.5 uppercase">{item.descricao || item.description || '-'}</td>
                <td className="border border-black p-1.5 text-center font-bold">{item.qtd || item.quantity || 1}</td>
                <td className="border border-black p-1.5 text-center">
                  <span className="inline-block w-4 h-4 border-2 border-black align-middle" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-center">
          www.usicortemetais.com.br
        </p>
      </div>

    </div>
  );

  return (
    <div id="screen-relatorios" className="space-y-6">

      {/* Tamanho de página: A4 RETRATO para todos os modelos, exceto ETIQUETAS */}
      <style>{activeModel === 'etiqueta-80'
        ? `@page { size: 80mm auto; margin: 3mm; }`
        : `@page { size: A4 portrait; margin: 10mm; }
           @media print {
             html, body { width: 210mm; }
             .documento-modelo { width: 100% !important; max-width: 190mm !important; margin: 0 auto !important; box-shadow: none !important; }
           }`}</style>

      {/* Regras de impressão de todos os modelos */}
      <style>{`
        @media print {
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
          body.print-pedido #doc-A4-2vias { display: flex !important; box-shadow: none !important; }

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
        }
      `}</style>
      
      {/* TAB NAVIGATION: PROPOSTAS vs CONSULTA */}
      <div className="btn-no-print flex items-center justify-between border-b border-slate-800 pb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('propostas')}
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
            onClick={() => setActiveTab('consulta')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'consulta'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Search className="w-4 h-4 text-emerald-400" />
            <span>🔍 Consulta & Relatório Geral</span>
          </button>
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
            <div className="botoes-impressao flex items-center justify-between gap-2.5 flex-wrap">
              {/* Grupo de Botões de Relatório / Impressão (Alinhados à Esquerda) */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button className="btn-print" onClick={() => imprimirRelatorioGeral('GERAL')}>
                  <span>🖨️</span> GERAL
                </button>
                <button className="btn-print" onClick={() => imprimirRelatorioGeral('EMPRESA')}>
                  <span>🏢</span> EMPRESA
                </button>
                <button className="btn-print" onClick={() => imprimirRelatorioGeral('PEDIDO')}>
                  <span>📋</span> PEDIDO
                </button>
                <button className="btn-print" onClick={() => imprimirRelatorioGeral('ETIQUETAS')}>
                  <span>🏷️</span> ETIQUETAS
                </button>
                <button className="btn-print" onClick={() => imprimirRelatorioGeral('CORTE')}>
                  <span>✂️</span> CORTE
                </button>
              </div>

              {/* Botão de Exclusão em Massa (Posicionado no Extremo Direito) */}
              <button
                type="button"
                onClick={() => setIsBulkDeleteOpen(true)}
                disabled={selectedIds.length === 0}
                className={`btn-print border transition-all cursor-pointer flex items-center justify-center gap-1.5 ml-auto ${
                  selectedIds.length > 0
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 shadow-md shadow-rose-600/30'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                }`}
                title={selectedIds.length > 0 ? `Excluir ${selectedIds.length} item(ns) selecionado(s)` : 'Selecione 1 ou mais itens para excluir'}
              >
                <Trash2 className="w-4 h-4 mb-0.5" />
                <span>EXCLUIR {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</span>
              </button>
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

              <select
                id="selectStatus"
                className="input-busca-avancada"
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value as 'todos' | StatusProposta)}
                title="Filtrar por situação da proposta"
              >
                <option value="todos">SITUAÇÃO: TODAS</option>
                <option value="rascunho">RASCUNHO</option>
                <option value="pendente">PENDENTE</option>
                <option value="aprovado">APROVADO</option>
                <option value="rejeitado">REJEITADO</option>
              </select>

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
                      checked={filteredConsultaItems.length > 0 && selectedIds.length === filteredConsultaItems.length}
                      onChange={(e) => handleSelectAll(e.target.checked)} 
                    />
                  </th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Ações</th>
                  <th>Cotação</th>
                  <th>Situação</th>
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
                {filteredConsultaItems.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center py-6 text-slate-500 font-medium">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredConsultaItems.map((item) => {
                    const isSelected = selectedIds.includes(item.idVer);
                    return (
                      <tr 
                        key={item.idVer} 
                        className={isSelected ? 'linha-selecionada cursor-pointer' : 'cursor-pointer hover:bg-slate-800/40'}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.tagName !== 'INPUT' && target.tagName !== 'BUTTON' && !target.closest('button')) {
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
                          <div className="flex items-center justify-center gap-1">
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
                              className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/40 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              title="Abrir esta cotação para visualização e impressão"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Abrir</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToDelete(item);
                              }}
                              className="p-1 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/40 rounded text-[11px] transition-all cursor-pointer"
                              title="Excluir este item/orçamento do banco de dados"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td><strong>{item.cotacao || '-'}</strong></td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLES[item.status]}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>{item.data}</td>
                        <td><strong>{item.empresa}</strong></td>
                        <td>{item.contato || '-'}</td>
                        <td>{item.produto}</td>
                        <td>{item.medida}</td>
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

          <div className="btn-no-print text-xs text-slate-400 flex items-center justify-between pt-2">
            <span>Mostrando {filteredConsultaItems.length} de {allConsultaItems.length} itens</span>
            <span>{selectedIds.length} item(ns) selecionado(s)</span>
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
               PRÉ-VISUALIZAÇÃO / RELATÓRIO DIRETO NA ABA CONSULTA
               (Renderiza diretamente abaixo da tabela mantendo estado)
               =================================================== */}
          {selectedIds.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-4 animate-in fade-in duration-200">
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
              {renderDocumentosImpressao()}
            </div>
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
              <option value="CURRENT">{displayQuote.quoteNumber || 'Cotação Atual'} (Cotação Selecionada)</option>
              {savedDbQuotes.map(sq => (
                <option key={sq.id || sq.numero} value={sq.id || sq.numero}>
                  {sq.numero || sq.id.slice(0, 8)} - {typeof sq.cliente === 'string' ? sq.cliente : 'Cliente'} ({formatSafeDate(sq.data || sq.createdAt)})
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
                  Ou clique em "Carregar Arquivos" e selecione VÁRIAS imagens de uma vez — cada arquivo vai
                  para a etiqueta cujo campo <strong>Observação</strong> tenha o mesmo nome do arquivo.
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
                accept="image/*" 
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
                <span>{currentDrawing ? 'Alterar / Adicionar Arquivos' : 'Carregar Arquivos'}</span>
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
      <div id="container-impressao" className="w-full overflow-x-hidden">
        {renderDocumentosImpressao()}
      </div>
        </>
      )}

    </div>
  );
}
