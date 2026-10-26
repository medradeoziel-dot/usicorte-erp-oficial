import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Client, Quote, QuoteItem, FormaPagamentoFinanceiro, LancamentoFinanceiro } from '../types';
import { 
  fetchCotacoesDb, 
  SupabaseCotacao, 
  atualizarSituacaoCotacaoDb,
  atualizarStatusPagamentoCotacaoDb,
  updateCotacaoNfeStatusDb,
  sincronizarPagamentoContaReceberDb,
  fetchItensByCotacaoId,
  isUuid,
  supabase
} from '../lib/db';
import { formatCurrency, formatSafeDate, formatarMedidasLimpa } from '../utils/calculator';
import { 
  getPagamentosCotacoesMap, 
  darBaixaMultiplasCotacoesDb,
  salvarPagamentosCotacoesMap,
  RegistroPagamentoCotacao,
  carregarExtratoCotacoes
} from '../services/inventoryFinanceService';
import ExtratoCobrancaPrint, { ExtratoCotacaoItem, ExtratoCotacaoItemDetalhado } from './ExtratoCobrancaPrint';
import EmissaoNfeModal from './EmissaoNfeModal';
import DanfeEspelhoA4Modal from './DanfeEspelhoA4Modal';
import { isNfeAutorizada, isNfeCancelada } from '../services/nfeService';
import {
  FileText,
  FileCheck,
  Search,
  Calendar,
  CheckSquare,
  Square,
  MinusSquare,
  DollarSign,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Filter,
  RotateCcw,
  Building,
  User,
  AlertCircle,
  Eye,
  X,
  ArrowRight,
  TrendingUp,
  Download,
  Receipt,
  Layers,
  Sparkles,
  ChevronDown,
  CreditCard,
  Wallet,
  Trash2
} from 'lucide-react';

interface FechamentoCotacoesModuleProps {
  clients?: Client[];
  onNavigateToFinanceiro?: () => void;
  onNavigateToQuote?: () => void;
  onOpenHistoricoFechamento?: () => void;
}

export default function FechamentoCotacoesModule({
  clients = [],
  onNavigateToFinanceiro,
  onNavigateToQuote,
  onOpenHistoricoFechamento
}: FechamentoCotacoesModuleProps) {
  // Lista unificada de cotações carregadas
  const [allQuotes, setAllQuotes] = useState<ExtratoCotacaoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filtros de Pesquisa
  const [filtroCliente, setFiltroCliente] = useState<string>('');
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');
  const [filtroStatusPagamento, setFiltroStatusPagamento] = useState<'todas' | 'pendentes' | 'pagas'>('todas');
  const [buscaNumero, setBuscaNumero] = useState<string>('');

  // Seleção múltipla (Chave: número ou id da cotação)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Modais
  const [isExtratoModalOpen, setIsExtratoModalOpen] = useState<boolean>(false);
  const [isBaixaModalOpen, setIsBaixaModalOpen] = useState<boolean>(false);
  const [selectedQuoteDetail, setSelectedQuoteDetail] = useState<ExtratoCotacaoItem | null>(null);
  const [quoteForNfeModal, setQuoteForNfeModal] = useState<Quote | null>(null);
  const [clientForNfeModal, setClientForNfeModal] = useState<Client | null>(null);
  const [quoteForDanfeModal, setQuoteForDanfeModal] = useState<Quote | null>(null);
  const [autoPrintDanfeModal, setAutoPrintDanfeModal] = useState<boolean>(false);
  const quotesEmissaoNfeRef = useRef<ExtratoCotacaoItem[]>([]);

  // Formulário de Baixa de Pagamento
  const [dataPagamentoBaixa, setDataPagamentoBaixa] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formaPagamentoBaixa, setFormaPagamentoBaixa] = useState<FormaPagamentoFinanceiro>('PIX');
  const [contaDestinoBaixa, setContaDestinoBaixa] = useState<string>('Conta Banco do Brasil - Principal');
  const [observacoesBaixa, setObservacoesBaixa] = useState<string>('');
  const [isSubmittingBaixa, setIsSubmittingBaixa] = useState<boolean>(false);
  const [feedbackMensagem, setFeedbackMensagem] = useState<{ tipo: 'success' | 'error'; texto: string; lancamento?: LancamentoFinanceiro } | null>(null);

  // Lista de clientes únicos para o dropdown
  const clientOptions = useMemo(() => {
    const map = new Map<string, { nome: string; documento?: string; fone?: string }>();
    
    // 1. Clientes cadastrados
    clients.forEach(c => {
      const nome = c.fantasyName || c.name || c.nome_fantasia || c.nome || '';
      if (nome.trim()) {
        map.set(nome.trim().toUpperCase(), {
          nome: nome.trim(),
          documento: c.document || c.documento,
          fone: c.phone || c.telefone
        });
      }
    });

    // 2. Clientes encontrados nas cotações
    allQuotes.forEach(q => {
      const nome = q.cliente || '';
      if (nome.trim() && !map.has(nome.trim().toUpperCase())) {
        map.set(nome.trim().toUpperCase(), {
          nome: nome.trim(),
          documento: q.clienteDoc,
          fone: q.clienteTelefone
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [clients, allQuotes]);

  // Carrega todas as cotações e status de pagamento para o Extrato e Fechamento (sem restrição fixa de status e sem limite rígido)
  const loadQuotesData = async (filtroClienteId?: string, termoBuscaNumero?: string) => {
    setIsLoading(true);
    const resultList: ExtratoCotacaoItem[] = [];
    const seenKeys = new Set<string>();
    const pagamentosMap = getPagamentosCotacoesMap();

    // Cache prévio de orçamentos do LocalStorage para cruzamento rápido de itens
    let localQuotesList: Quote[] = [];
    try {
      const saved = localStorage.getItem('s_orcamentos');
      if (saved) {
        localQuotesList = JSON.parse(saved) || [];
      }
    } catch {}
    const localQuotesMap = new Map<string, Quote>();
    localQuotesList.forEach(lq => {
      if (lq.quoteNumber) localQuotesMap.set(lq.quoteNumber.trim().toLowerCase(), lq);
      if (lq.id) localQuotesMap.set(lq.id.trim().toLowerCase(), lq);
    });

    // 1. Carrega do Supabase usando query de extrato sem travar status_pagamento = 'pendente' e sem limite rígido
    try {
      const dbQuotes = await carregarExtratoCotacoes(filtroClienteId, termoBuscaNumero);
      if (dbQuotes && dbQuotes.length > 0) {
        dbQuotes.forEach(q => {
          const statusLower = String(q.status || '').trim().toLowerCase();
          if (statusLower === 'rejeitado') return;

          const numKey = (q.numero || q.id || '').trim().toLowerCase();
          if (!numKey || seenKeys.has(numKey)) return;
          seenKeys.add(numKey);
          if (q.id) seenKeys.add(q.id.trim().toLowerCase());

          // Itens detalhados e resumo
          const matchingLocal = localQuotesMap.get(numKey) || (q.id ? localQuotesMap.get(q.id.trim().toLowerCase()) : undefined);
          let mappedItens: ExtratoCotacaoItemDetalhado[] = [];

          if (q.cotacao_itens && q.cotacao_itens.length > 0) {
            mappedItens = q.cotacao_itens.map((it: any, idx: number) => {
              const unit = Number(it.valor_unitario) || 0;
              const qte = Number(it.quantidade) || 1;
              const sub = Number(it.valor_total) || (unit * qte);
              return {
                id: it.id || idx + 1,
                produto: (it.produto || it.material || 'MATERIAL').toUpperCase(),
                medida: it.medida || '—',
                descricao: it.descricao || 'Item industrial',
                info: it.observacao || it.info || '',
                unitario: unit,
                qtd: qte,
                subtotal: sub,
                ncm: it.ncm || '72085200',
                cfop: it.cfop || it.cfop_interno || '5102',
                cfop_interno: it.cfop_interno || '5102',
                cfop_externo: it.cfop_externo || '6102',
                unidade_medida: it.unidade_medida || 'PC',
                csosn: '101 - Com permissão de crédito',
                totalWeightKg: Number((it as any).peso_total || (it as any).totalWeightKg || 0)
              };
            });
          } else if (matchingLocal?.items && matchingLocal.items.length > 0) {
            mappedItens = matchingLocal.items.map((it: any, idx: number) => {
              const unit = Number(it.unitPrice || it.valorUnitario || 0);
              const qte = Number(it.quantity || it.qtd || 1);
              const sub = Number(it.subtotal || (unit * qte));
              const med = formatarMedidasLimpa(it);
              return {
                id: it.id || idx + 1,
                produto: (it.constantName || it.constanteNome || it.material || it.produto || 'MATERIAL').toUpperCase(),
                medida: it.measure || it.medida || (med !== '-' ? med : '—'),
                descricao: it.description || it.descricao || 'Item de corte',
                info: it.notes || it.observacao || it.info || '',
                unitario: unit,
                qtd: qte,
                subtotal: sub,
                ncm: it.ncm || '72085200',
                cfop: it.cfop || it.cfop_interno || '5102',
                cfop_interno: it.cfop_interno || '5102',
                cfop_externo: it.cfop_externo || '6102',
                unidade_medida: it.unidade_medida || it.unidadeMedida || 'PC',
                csosn: '101 - Com permissão de crédito',
                totalWeightKg: Number(it.totalWeightKg || it.pesoTotal || 0)
              };
            });
          } else {
            mappedItens = [{
              id: 1,
              produto: 'SERVIÇOS DE CORTE DIVERSOS',
              medida: '—',
              descricao: q.observacoes || 'Serviços industriais de corte e conformação',
              info: '',
              unitario: Number(q.valor_total) || 0,
              qtd: 1,
              subtotal: Number(q.valor_total) || 0,
              ncm: '72085200',
              cfop: '5102',
              unidade_medida: 'PC',
              csosn: '101 - Com permissão de crédito'
            }];
          }

          let itensResumo = '';
          let pesoTotal = mappedItens.reduce((sum, it) => sum + (Number((it as any).totalWeightKg) || 0), 0);
          let qtdItens = mappedItens.length;
          itensResumo = mappedItens.map(i => `${i.produto} (${i.qtd}x ${i.medida})`).join(' | ');

          // 1. Leitura direta das colunas da tabela 'cotacoes' do Supabase
          const statusPagamentoUpper = String((q as any).status_pagamento || '').trim().toUpperCase();
          const isPagoNaTabela = statusPagamentoUpper === 'PAGO' ||
                                 String(q.situacao || '').trim().toUpperCase() === 'FATURADO' ||
                                 String(q.status || '').trim().toLowerCase() === 'faturado';

          const dataPagamentoFromTable = (q as any).data_pagamento 
            ? String((q as any).data_pagamento).split('T')[0] 
            : undefined;

          let pag: RegistroPagamentoCotacao;
          if (isPagoNaTabela) {
            pag = {
              status: 'Pago',
              dataPagamento: dataPagamentoFromTable || pagamentosMap[numKey]?.dataPagamento || (q.data ? String(q.data).split('T')[0] : new Date().toISOString().split('T')[0]),
              formaPagamento: (q as any).forma_pagamento || pagamentosMap[numKey]?.formaPagamento || 'PIX',
              observacoes: (q as any).observacoes_baixa || pagamentosMap[numKey]?.observacoes,
              valorPago: Number((q as any).valor_pago) || Number(q.valor_total) || 0
            };
          } else if (statusPagamentoUpper === 'PENDENTE') {
            pag = {
              status: 'Pendente',
              formaPagamento: (q as any).forma_pagamento || 'PIX'
            };
          } else {
            pag = pagamentosMap[numKey] || (q.id ? pagamentosMap[q.id.trim().toLowerCase()] : undefined) || {
              status: 'Pendente'
            };
          }

          // Localiza cliente no cadastro para obter CNPJ/CPF completo e endereço
          const foundClient = clients.find(c => 
            (c.id && q.cliente_id && String(c.id) === String(q.cliente_id)) ||
            (c.name && q.cliente_nome && c.name.trim().toLowerCase() === q.cliente_nome.trim().toLowerCase()) ||
            (c.fantasyName && q.cliente_nome && c.fantasyName.trim().toLowerCase() === q.cliente_nome.trim().toLowerCase())
          );

          const clientDocVal = (q as any).documento || (q as any).cliente_documento || matchingLocal?.clientDocument || foundClient?.document || '';
          const clientTelVal = q.telefone || matchingLocal?.clientPhone || foundClient?.phone || '';
          const clientContatoVal = q.contato || matchingLocal?.contactPerson || foundClient?.contactPerson || '';
          const clientEndVal = matchingLocal?.clientStreet ? `${matchingLocal.clientStreet}, ${matchingLocal.clientCity || ''}` : foundClient?.street ? `${foundClient.street}, ${foundClient.city || ''}` : '';
          const clientCidVal = matchingLocal?.clientCity || foundClient?.city || '';

          resultList.push({
            id: q.id,
            numero: q.numero || q.id || 'COT-TEMP',
            data: q.data || (q.created_at ? q.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
            cliente: q.cliente_nome || 'Cliente Balcão',
            clienteDoc: clientDocVal,
            clienteTelefone: clientTelVal,
            clienteContato: clientContatoVal,
            clienteEndereco: clientEndVal,
            clienteCidade: clientCidVal,
            valor: Number(q.valor_total) || 0,
            pesoKg: pesoTotal,
            qtdItens: qtdItens || 1,
            itensResumo: itensResumo.slice(0, 180),
            statusCotacao: isPagoNaTabela ? 'faturado' : (q.status || 'aprovado'),
            status_nfe: (q as any).status_nfe || (matchingLocal as any)?.status_nfe || 'Pendente',
            nfe_numero: (q as any).nfe_numero || (matchingLocal as any)?.nfe_numero,
            nfe_chave: (q as any).nfe_chave || (q as any).chave_acesso || (matchingLocal as any)?.nfe_chave,
            chave_acesso: (q as any).chave_acesso || (q as any).nfe_chave || (matchingLocal as any)?.chave_acesso,
            danfe_url: (q as any).danfe_url || (matchingLocal as any)?.danfe_url,
            xml_url: (q as any).xml_url || (matchingLocal as any)?.xml_url,
            pagamento: pag,
            itens: mappedItens,
            rawQuote: q
          });
        });
      }
    } catch (e) {
      console.warn('Aviso ao carregar do Supabase:', e);
    }

    // 2. Carrega do LocalStorage (s_orcamentos)
    try {
      const saved = localStorage.getItem('s_orcamentos');
      if (saved) {
        const localQuotes: Quote[] = JSON.parse(saved);
        if (Array.isArray(localQuotes)) {
          localQuotes.forEach(lq => {
            const localStatusLower = String(lq.status || '').trim().toLowerCase();
            if (localStatusLower === 'rejeitado') return;

            const numKey = (lq.quoteNumber || lq.id || '').trim().toLowerCase();
            if (!numKey || seenKeys.has(numKey)) return;
            seenKeys.add(numKey);

            let localMappedItens: ExtratoCotacaoItemDetalhado[] = [];
            if (lq.items && lq.items.length > 0) {
              localMappedItens = lq.items.map((it: any, idx: number) => {
                const unit = Number(it.unitPrice || it.valorUnitario || 0);
                const qte = Number(it.quantity || it.qtd || 1);
                const sub = Number(it.subtotal || (unit * qte));
                const med = formatarMedidasLimpa(it);
                return {
                  id: it.id || idx + 1,
                  produto: (it.constantName || it.constanteNome || it.material || it.produto || 'MATERIAL').toUpperCase(),
                  medida: it.measure || it.medida || (med !== '-' ? med : '—'),
                  descricao: it.description || it.descricao || 'Item de corte e dobra',
                  info: it.notes || it.observacao || it.info || '',
                  unitario: unit,
                  qtd: qte,
                  subtotal: sub,
                  ncm: it.ncm || '72085200',
                  cfop: it.cfop || it.cfop_interno || '5102',
                  cfop_interno: it.cfop_interno || '5102',
                  cfop_externo: it.cfop_externo || '6102',
                  unidade_medida: it.unidade_medida || it.unidadeMedida || 'PC',
                  csosn: '101 - Com permissão de crédito',
                  totalWeightKg: Number(it.totalWeightKg || it.pesoTotal || 0)
                };
              });
            } else {
              localMappedItens = [{
                id: 1,
                produto: 'SERVIÇOS DE CORTE DIVERSOS',
                medida: '—',
                descricao: lq.observations || 'Serviços industriais de corte e conformação',
                info: '',
                unitario: Number(lq.grandTotal || lq.subtotalTotal || 0),
                qtd: 1,
                subtotal: Number(lq.grandTotal || lq.subtotalTotal || 0),
                ncm: '72085200',
                cfop: '5102',
                unidade_medida: 'PC',
                csosn: '101 - Com permissão de crédito'
              }];
            }

            let itensResumo = localMappedItens.map(i => `${i.produto} (${i.qtd}x ${i.medida})`).join(' | ');

            const pag = pagamentosMap[numKey] || {
              status: lq.paymentStatus || 'Pendente',
              dataPagamento: lq.paymentDate,
              formaPagamento: lq.paymentMethod as any,
              observacoes: lq.paymentNotes
            };

            const foundClientLocal = clients.find(c => 
              (c.id && lq.clientId && String(c.id) === String(lq.clientId)) ||
              (c.document && lq.clientDocument && c.document.replace(/\D/g, '') === lq.clientDocument.replace(/\D/g, '')) ||
              (c.name && lq.clientName && c.name.trim().toLowerCase() === lq.clientName.trim().toLowerCase())
            );

            resultList.push({
              id: lq.id,
              numero: lq.quoteNumber || lq.id || 'COT-LOCAL',
              data: lq.date || lq.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
              cliente: lq.clientName || 'Cliente Balcão',
              clienteDoc: lq.clientDocument || foundClientLocal?.document || '',
              clienteTelefone: lq.clientPhone || foundClientLocal?.phone || '',
              clienteEndereco: lq.clientCity ? `${lq.clientCity}/${lq.clientState || 'SP'}` : foundClientLocal?.street ? `${foundClientLocal.street}, ${foundClientLocal.city || ''}` : '',
              clienteCidade: lq.clientCity || foundClientLocal?.city || '',
              clienteContato: lq.contactPerson || foundClientLocal?.contactPerson || '',
              valor: Number(lq.grandTotal || lq.subtotalTotal || 0),
              pesoKg: Number(lq.totalWeightKg || 0),
              qtdItens: localMappedItens.length || 1,
              itensResumo: itensResumo.slice(0, 180),
              statusCotacao: lq.status || 'Rascunho',
              status_nfe: (lq as any).status_nfe || 'Pendente',
              nfe_numero: (lq as any).nfe_numero,
              nfe_chave: (lq as any).nfe_chave || (lq as any).chave_acesso,
              chave_acesso: (lq as any).chave_acesso || (lq as any).nfe_chave,
              danfe_url: (lq as any).danfe_url,
              xml_url: (lq as any).xml_url,
              pagamento: pag,
              itens: localMappedItens,
              rawQuote: lq
            });
          });
        }
      }
    } catch (e) {
      console.warn('Aviso ao carregar do LocalStorage:', e);
    }

    // Ordena por data mais recente
    resultList.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    setAllQuotes(resultList);
    setIsLoading(false);
  };

  // Dispara busca com debounce no Supabase e banco local sempre que buscaNumero ou filtroCliente mudar
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      loadQuotesData(filtroCliente, buscaNumero);
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaNumero, filtroCliente]);

  useEffect(() => {
    loadQuotesData();

    const handleAtualizacao = () => {
      loadQuotesData(filtroCliente, buscaNumero);
    };

    window.addEventListener('cotacoes_migradas_emergencia', handleAtualizacao);
    window.addEventListener('cotacao_status_alterado', handleAtualizacao);
    window.addEventListener('cotacoes_atualizadas', handleAtualizacao);

    return () => {
      window.removeEventListener('cotacoes_migradas_emergencia', handleAtualizacao);
      window.removeEventListener('cotacao_status_alterado', handleAtualizacao);
      window.removeEventListener('cotacoes_atualizadas', handleAtualizacao);
    };
  }, []);

  // Limpeza de classes de impressão ao desmontar
  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('print-extrato');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      handleAfterPrint();
    };
  }, []);

  // Atalhos de período
  const aplicarPeriodo = (tipo: 'hoje' | 'mes' | '30dias' | 'limpar') => {
    const hoje = new Date();
    if (tipo === 'limpar') {
      setFiltroDataInicio('');
      setFiltroDataFim('');
      return;
    }

    if (tipo === 'hoje') {
      const hojeStr = hoje.toISOString().split('T')[0];
      setFiltroDataInicio(hojeStr);
      setFiltroDataFim(hojeStr);
    } else if (tipo === 'mes') {
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
      const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
      setFiltroDataInicio(primeiroDia);
      setFiltroDataFim(ultimoDia);
    } else if (tipo === '30dias') {
      const trintaDiasAtras = new Date(hoje.getTime() - 30 * 86400000).toISOString().split('T')[0];
      const hojeStr = hoje.toISOString().split('T')[0];
      setFiltroDataInicio(trintaDiasAtras);
      setFiltroDataFim(hojeStr);
    }
  };

  /**
   * Helper robusto para correspondência de número com zeros à esquerda
   * Garante suporte tanto para termos simples ('28', '028', '00028') quanto formatados ('COT-2026-00028', 'COT-28')
   */
  const matchNumeroCotacaoComZeros = (
    numeroQuote: string | undefined | null,
    idQuote: string | undefined | null,
    termoBusca: string
  ): boolean => {
    if (!termoBusca || !termoBusca.trim()) return true;
    const termo = termoBusca.trim().toLowerCase();
    const numStr = String(numeroQuote || '').trim().toLowerCase();
    const idStr = String(idQuote || '').trim().toLowerCase();

    // 1. Verificação direta por substring
    if (numStr.includes(termo) || idStr.includes(termo)) return true;

    // 2. Extração numérica inteligente para zeros à esquerda (ex: 28, 028, 00028, COT-2026-00028)
    const extrairSequencial = (str: string): { intVal: number; lastSeq: string } | null => {
      if (!str) return null;
      const matchSuffix = str.match(/(?:COT[-_\s]*)?(?:(?:19|20)\d{2}[-_\s]*)?(\d+)/i);
      const digitsOnly = str.replace(/\D/g, '');
      const seq = matchSuffix ? matchSuffix[1] : digitsOnly;
      if (!seq) return null;
      const intVal = parseInt(seq, 10);
      return {
        intVal: isNaN(intVal) ? -1 : intVal,
        lastSeq: seq
      };
    };

    const infoTermo = extrairSequencial(termo);
    const infoNum = extrairSequencial(numStr);

    if (infoTermo && infoNum) {
      if (infoTermo.intVal > 0 && infoTermo.intVal === infoNum.intVal) {
        return true;
      }

      const termoCleanNum = infoTermo.intVal > 0 ? String(infoTermo.intVal) : infoTermo.lastSeq.replace(/^0+/, '');
      const numCleanNum = infoNum.intVal > 0 ? String(infoNum.intVal) : infoNum.lastSeq.replace(/^0+/, '');
      if (termoCleanNum && numCleanNum && termoCleanNum === numCleanNum) {
        return true;
      }

      if (infoTermo.intVal > 0) {
        const padZeros = (n: number, size: number) => String(n).padStart(size, '0');
        const p3 = padZeros(infoTermo.intVal, 3);
        const p4 = padZeros(infoTermo.intVal, 4);
        const p5 = padZeros(infoTermo.intVal, 5);
        const p6 = padZeros(infoTermo.intVal, 6);
        if (
          numStr.includes(p3) ||
          numStr.includes(p4) ||
          numStr.includes(p5) ||
          numStr.includes(p6)
        ) {
          return true;
        }
      }
    }

    return false;
  };

  // Filtragem das cotações
  const filteredQuotes = useMemo(() => {
    const termoBusca = buscaNumero.trim();
    const temBuscaNumero = Boolean(termoBusca);

    return allQuotes.filter(q => {
      // 1. Filtro por Cliente
      if (filtroCliente.trim()) {
        const clienteTerm = filtroCliente.trim().toLowerCase();
        const clienteNome = (q.cliente || '').toLowerCase();
        const clienteDoc = (q.clienteDoc || '').toLowerCase();
        if (!clienteNome.includes(clienteTerm) && !clienteDoc.includes(clienteTerm)) {
          return false;
        }
      }

      // 2. e 3. Filtros por Intervalo de Datas
      // REQUISITO 2: Se houver busca por 'Nº Cotação / Item' preenchida, o filtro de data DEVE SER IGNORADO
      // para permitir encontrar cotações antigas (ex: cotação 00028) na tabela inteira
      if (!temBuscaNumero) {
        if (filtroDataInicio && q.data < filtroDataInicio) return false;
        if (filtroDataFim && q.data > filtroDataFim) return false;
      }

      // 4. Filtro por Status de Pagamento
      if (filtroStatusPagamento === 'pendentes') {
        if (q.pagamento?.status === 'Pago') return false;
      } else if (filtroStatusPagamento === 'pagas') {
        if (q.pagamento?.status !== 'Pago') return false;
      }

      // 5. Busca Direta por Número ou Item com suporte total a zeros à esquerda
      if (temBuscaNumero) {
        const matchNum = matchNumeroCotacaoComZeros(q.numero, q.id, termoBusca);
        if (matchNum) return true;

        const termoLower = termoBusca.toLowerCase();
        if ((q.itensResumo || '').toLowerCase().includes(termoLower)) return true;

        if (q.itens && q.itens.some(it =>
          (it.produto || '').toLowerCase().includes(termoLower) ||
          (it.descricao || '').toLowerCase().includes(termoLower) ||
          (it.medida || '').toLowerCase().includes(termoLower) ||
          (it.info || '').toLowerCase().includes(termoLower) ||
          (it.ncm || '').toLowerCase().includes(termoLower)
        )) {
          return true;
        }

        const rawObs = ((q.rawQuote as any)?.observacoes || '').toLowerCase();
        if (rawObs.includes(termoLower)) return true;

        return false;
      }

      return true;
    });
  }, [allQuotes, filtroCliente, filtroDataInicio, filtroDataFim, filtroStatusPagamento, buscaNumero]);

  // Totais das cotações filtradas e selecionadas
  const selectedQuotes = useMemo(() => {
    return filteredQuotes.filter(q => selectedKeys.has(q.numero) || (q.id && selectedKeys.has(q.id)));
  }, [filteredQuotes, selectedKeys]);

  const totalValorFiltrado = useMemo(() => {
    return filteredQuotes.reduce((acc, q) => acc + q.valor, 0);
  }, [filteredQuotes]);

  const totalValorSelecionado = useMemo(() => {
    return selectedQuotes.reduce((acc, q) => acc + q.valor, 0);
  }, [selectedQuotes]);

  const totalPesoSelecionado = useMemo(() => {
    return selectedQuotes.reduce((acc, q) => acc + (q.pesoKg || 0), 0);
  }, [selectedQuotes]);

  const totalPendentesValor = useMemo(() => {
    return filteredQuotes.filter(q => q.pagamento?.status !== 'Pago').reduce((acc, q) => acc + q.valor, 0);
  }, [filteredQuotes]);

  const totalPagasValor = useMemo(() => {
    return filteredQuotes.filter(q => q.pagamento?.status === 'Pago').reduce((acc, q) => acc + q.valor, 0);
  }, [filteredQuotes]);

  // Gestão da Seleção de Checkboxes
  const isAllSelected = filteredQuotes.length > 0 && selectedQuotes.length === filteredQuotes.length;
  const isIndeterminate = selectedQuotes.length > 0 && selectedQuotes.length < filteredQuotes.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Desseleciona todas as visíveis
      const next = new Set(selectedKeys);
      filteredQuotes.forEach(q => {
        next.delete(q.numero);
        if (q.id) next.delete(q.id);
      });
      setSelectedKeys(next);
    } else {
      // Seleciona todas as visíveis
      const next = new Set(selectedKeys);
      filteredQuotes.forEach(q => {
        next.add(q.numero);
        if (q.id) next.add(q.id);
      });
      setSelectedKeys(next);
    }
  };

  const toggleSelectRow = (q: ExtratoCotacaoItem) => {
    const next = new Set(selectedKeys);
    const key = q.numero || q.id || '';
    if (next.has(key) || (q.id && next.has(q.id))) {
      next.delete(key);
      if (q.id) next.delete(q.id);
    } else {
      next.add(key);
      if (q.id) next.add(q.id);
    }
    setSelectedKeys(next);
  };

  // Informações completas do cliente para o Extrato
  const selectedClientInfo = useMemo(() => {
    if (!filtroCliente.trim() && selectedQuotes.length === 0) return undefined;
    const nomeBusca = (filtroCliente.trim() || selectedQuotes[0]?.cliente || '').toLowerCase();
    const found = clients.find(c => {
      const n = (c.fantasyName || c.name || c.nome_fantasia || c.nome || '').toLowerCase();
      return n.includes(nomeBusca) || nomeBusca.includes(n);
    });
    if (found) return found;

    if (selectedQuotes.length > 0) {
      const first = selectedQuotes[0];
      return {
        name: first.cliente,
        fantasyName: first.cliente,
        document: first.clienteDoc,
        phone: first.clienteTelefone,
        street: first.clienteEndereco,
        city: first.clienteCidade,
        contactPerson: first.clienteContato
      };
    }
    return undefined;
  }, [filtroCliente, selectedQuotes, clients]);

  // Cotações consolidadas para o Extrato (selecionadas ou filtradas)
  const quotesParaExtrato = useMemo(() => {
    return selectedQuotes.length > 0 ? selectedQuotes : filteredQuotes;
  }, [selectedQuotes, filteredQuotes]);

  // Informações completas do cliente para o Extrato
  const clientInfoParaExtrato = useMemo(() => {
    if (selectedClientInfo) return selectedClientInfo;
    if (quotesParaExtrato.length > 0) {
      const first = quotesParaExtrato[0];
      const found = clients.find(c => {
        const n = (c.fantasyName || c.name || c.nome_fantasia || c.nome || '').toLowerCase();
        return n.includes((first.cliente || '').toLowerCase()) || (first.cliente || '').toLowerCase().includes(n);
      });
      if (found) return found;
      return {
        name: first.cliente,
        fantasyName: first.cliente,
        document: first.clienteDoc,
        phone: first.clienteTelefone,
        street: first.clienteEndereco,
        city: first.clienteCidade,
        contactPerson: first.clienteContato
      };
    }
    return undefined;
  }, [selectedClientInfo, quotesParaExtrato, clients]);

  // Intercepta eventos de impressão na tela de Fechamento & Extrato para isolamento total
  useEffect(() => {
    const handleBeforePrint = () => {
      document.body.classList.add('print-fechamento', 'print-extrato');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('print-fechamento', 'print-extrato');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('print-fechamento', 'print-extrato');
    };
  }, []);

  // Ação: Abrir Extrato de Cobrança
  const handleAbrirExtrato = () => {
    if (selectedQuotes.length === 0) {
      alert('Selecione pelo menos uma cotação na tabela para gerar o extrato.');
      return;
    }
    setIsExtratoModalOpen(true);
  };

  // Sincroniza classes no body durante a impressão com a modal aberta (incluindo atalho Ctrl+P)
  useEffect(() => {
    if (!isExtratoModalOpen) return;
    const handleBeforePrint = () => {
      document.body.classList.add('print-fechamento', 'print-extrato');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('print-fechamento', 'print-extrato');
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('print-fechamento', 'print-extrato');
    };
  }, [isExtratoModalOpen]);

  // Ação: Imprimir Extrato A4 Formatado em CSS @media print
  const handleImprimirExtrato = () => {
    document.body.classList.remove(
      'print-pedido',
      'print-etiqueta',
      'print-proposta',
      'print-corte',
      'print-geral',
      'print-empresa'
    );
    document.body.classList.add('print-fechamento', 'print-extrato');

    const originalTitle = document.title;
    const nomeCli = selectedClientInfo?.fantasyName || selectedClientInfo?.name || selectedQuotes[0]?.cliente || 'Cliente';
    document.title = `Extrato_Cobranca_${String(nomeCli).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    const onAfterPrint = () => {
      document.body.classList.remove('print-fechamento', 'print-extrato');
      document.title = originalTitle;
      window.removeEventListener('afterprint', onAfterPrint);
    };
    window.addEventListener('afterprint', onAfterPrint);

    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Ação: Abrir Modal de Baixa de Pagamento
  const handleAbrirBaixa = () => {
    if (selectedQuotes.length === 0) {
      alert('Selecione pelo menos uma cotação para dar baixa de pagamento.');
      return;
    }
    setDataPagamentoBaixa(new Date().toISOString().split('T')[0]);
    setObservacoesBaixa(`Baixa consolidada de ${selectedQuotes.length} cotação(ões) do cliente ${selectedQuotes[0]?.cliente || ''}`);
    setIsBaixaModalOpen(true);
  };

  // Ação: Confirmar Baixa em Lote e Integração Financeira
  const handleConfirmarBaixa = async () => {
    if (selectedQuotes.length === 0) return;
    setIsSubmittingBaixa(true);

    try {
      const cotacoesParaBaixar = selectedQuotes.map(q => ({
        id: q.id,
        numero: q.numero,
        cliente: q.cliente,
        valor: q.valor
      }));

      const res = await darBaixaMultiplasCotacoesDb(cotacoesParaBaixar, {
        dataPagamento: dataPagamentoBaixa,
        formaPagamento: formaPagamentoBaixa,
        contaDestino: contaDestinoBaixa,
        observacoes: observacoesBaixa
      });

      if (res.sucesso) {
        // 3. Sincronização em Tempo Real:
        // Atualiza imediatamente o estado de allQuotes para refletir status 'PAGO' sem necessidade de F5
        setAllQuotes(prev => prev.map(item => {
          const match = cotacoesParaBaixar.some(cb => 
            (cb.id && item.id && cb.id === item.id) || 
            (cb.numero && item.numero && cb.numero.trim().toLowerCase() === item.numero.trim().toLowerCase())
          );
          if (match) {
            return {
              ...item,
              statusCotacao: 'faturado',
              pagamento: {
                status: 'Pago',
                dataPagamento: dataPagamentoBaixa,
                formaPagamento: formaPagamentoBaixa,
                observacoes: observacoesBaixa,
                valorPago: item.valor
              }
            };
          }
          return item;
        }));

        setSelectedKeys(new Set());

        setFeedbackMensagem({
          tipo: 'success',
          texto: res.mensagem,
          lancamento: res.lancamento || undefined
        });

        setIsBaixaModalOpen(false);

        // Recarrega os dados diretamente do Supabase
        await loadQuotesData();
      } else {
        alert(res.mensagem || 'Não foi possível concluir a baixa.');
      }
    } catch (err: any) {
      alert(`Erro ao registrar baixa: ${err?.message || err}`);
    } finally {
      setIsSubmittingBaixa(false);
    }
  };

  // Ação: Reverter Baixa para 'Pendente' se necessário
  const handleReverterParaPendente = async (q: ExtratoCotacaoItem) => {
    if (!confirm(`Deseja reverter a cotação ${q.numero} para o status PENDENTE DE PAGAMENTO?`)) return;

    const map = getPagamentosCotacoesMap();
    const key = (q.numero || q.id || '').trim().toLowerCase();
    delete map[key];
    if (q.id) delete map[q.id.trim().toLowerCase()];
    salvarPagamentosCotacoesMap(map);

    try {
      await atualizarStatusPagamentoCotacaoDb(
        { id: q.id, numero: q.numero },
        {
          status_pagamento: 'Pendente',
          situacao: 'APROVADO',
          data_pagamento: null,
          valor_pago: 0
        }
      );
      await sincronizarPagamentoContaReceberDb({
        cotacaoId: q.id,
        cotacaoNumero: q.numero,
        clienteNome: q.cliente,
        valor: q.valor,
        dataPagamento: null,
        status: 'Pendente'
      });
    } catch (e) {
      console.warn('Aviso ao reverter situação no Supabase:', e);
    }

    // Atualiza imediatamente o estado de allQuotes
    setAllQuotes(prev => prev.map(item => {
      const match = (q.id && item.id === q.id) || 
                    (q.numero && item.numero && q.numero.trim().toLowerCase() === item.numero.trim().toLowerCase());
      if (match) {
        return {
          ...item,
          statusCotacao: 'aprovado',
          pagamento: {
            status: 'Pendente'
          }
        };
      }
      return item;
    }));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cotacoes_migradas_emergencia'));
      window.dispatchEvent(new CustomEvent('cotacao_status_alterado'));
      window.dispatchEvent(new CustomEvent('cotacoes_atualizadas'));
    }

    await loadQuotesData();
  };

  const fetchCotacoes = () => {
    loadQuotesData(filtroCliente, buscaNumero);
  };

  const handleExcluirCotacao = async (id: string) => {
    if (!confirm('Deseja realmente remover esta cotação da listagem?')) return;

    let query = supabase
      .from('cotacoes')
      .update({ status: 'REJEITADO' });

    if (isUuid(id)) {
      query = query.eq('id', id);
    } else {
      query = query.eq('numero', id);
    }

    const { error } = await query;

    if (error) {
      alert('Erro ao ocultar cotação: ' + error.message);
    } else {
      // Atualiza também no localStorage caso exista cópia local
      try {
        const saved = localStorage.getItem('s_orcamentos');
        if (saved) {
          const localList: Quote[] = JSON.parse(saved);
          const updated = localList.map(item => {
            if (item.id === id || item.quoteNumber === id) {
              return { ...item, status: 'REJEITADO' };
            }
            return item;
          });
          localStorage.setItem('s_orcamentos', JSON.stringify(updated));
        }
      } catch {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cotacao_status_alterado'));
        window.dispatchEvent(new CustomEvent('cotacoes_atualizadas'));
      }
      fetchCotacoes(); // Recarrega a listagem
    }
  };

  // Ação: Abrir Fluxo / Modal de Emissão de NF-e para Cotações Selecionadas ou Individual
  const handleEmitirNfe = async (cotacoesParaEmitir: ExtratoCotacaoItem[]) => {
    // 1. Verificação: ao menos 1 cotação selecionada
    if (!cotacoesParaEmitir || cotacoesParaEmitir.length === 0) {
      alert('Selecione ao menos 1 cotação nos checkboxes da tabela para emitir a NF-e.');
      return;
    }

    // Registra a lista de cotações alvo para a baixa automática pós-autorização SEFAZ
    quotesEmissaoNfeRef.current = cotacoesParaEmitir;

    // 2. Validação contra cotações com NF-e cancelada na SEFAZ
    const cotacaoCancelada = cotacoesParaEmitir.find(q => isNfeCancelada(q.status_nfe));
    if (cotacaoCancelada) {
      alert(`A cotação Nº ${cotacaoCancelada.numero} possui NF-e CANCELADA na SEFAZ (Status 101) e não pode ser faturada novamente.`);
      return;
    }

    // Alerta caso cotações de clientes distintos sejam marcadas simultaneamente
    const clientesDistintos = new Set(
      cotacoesParaEmitir.map(q => (q.clienteDoc || q.cliente || '').trim().toLowerCase())
    );
    if (clientesDistintos.size > 1) {
      const confirmDiff = confirm(
        'Atenção: As cotações selecionadas possuem identificações de clientes diferentes. A NF-e consolidada será gerada com o cliente principal da primeira cotação selecionada. Deseja prosseguir?'
      );
      if (!confirmDiff) return;
    }

    // 2. a) O Cliente selecionado (Razão Social / CNPJ)
    const primaryQuote = cotacoesParaEmitir[0];
    const targetDocClean = (primaryQuote.clienteDoc || '').replace(/\D/g, '');
    const targetNameClean = (primaryQuote.cliente || '').trim().toLowerCase();

    let clientObj = clients.find(c => {
      if (targetDocClean && c.document && c.document.replace(/\D/g, '') === targetDocClean) return true;
      const cName = (c.fantasyName || c.name || c.nome_fantasia || c.nome || '').trim().toLowerCase();
      return cName && (cName === targetNameClean || cName.includes(targetNameClean) || targetNameClean.includes(cName));
    });

    if (!clientObj) {
      clientObj = {
        id: primaryQuote.id || `cli-${Date.now()}`,
        type: ((primaryQuote.clienteDoc || '').replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF') as 'CNPJ' | 'CPF',
        document: primaryQuote.clienteDoc || '',
        name: primaryQuote.cliente || 'Cliente Selecionado',
        fantasyName: primaryQuote.cliente || 'Cliente Selecionado',
        situation: 'ATIVA',
        cep: '13000-000',
        street: primaryQuote.clienteEndereco || 'Rua Principal',
        neighborhood: 'Centro',
        city: primaryQuote.clienteCidade || 'Campinas',
        state: 'SP',
        phone: primaryQuote.clienteTelefone || '',
        email: '',
        enabled: true,
        registrationDate: new Date().toISOString().split('T')[0],
        contactPerson: primaryQuote.clienteContato || ''
      };
    }

    // 2. b) A lista unificada de todos os itens das cotações marcadas
    // 2. d) Aplicação do CSOSN 101 nos itens
    let seqItem = 1;
    const itensUnificados: QuoteItem[] = [];

    for (const q of cotacoesParaEmitir) {
      const refCot = q.numero || q.id || 'COT';
      let itensDestaCotacao: ExtratoCotacaoItemDetalhado[] = q.itens || [];

      // Se a cotação tiver apenas item genérico ou itens vazios, busca os itens integrais no Supabase
      if (q.id && (!itensDestaCotacao.length || (itensDestaCotacao.length === 1 && itensDestaCotacao[0].produto === 'SERVIÇOS DE CORTE DIVERSOS'))) {
        try {
          const dbItems = await fetchItensByCotacaoId(q.id);
          if (dbItems && dbItems.length > 0) {
            itensDestaCotacao = dbItems.map((it: any, idx: number) => ({
              id: it.id || idx + 1,
              produto: (it.produto || it.material || 'MATERIAL').toUpperCase(),
              medida: it.medida || '—',
              descricao: it.descricao || 'Item industrial',
              info: it.observacao || it.info || '',
              unitario: Number(it.valor_unitario) || 0,
              qtd: Number(it.quantidade) || 1,
              subtotal: Number(it.valor_total) || ((Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 1)),
              ncm: it.ncm || '72085200',
              cfop: it.cfop || it.cfop_interno || '5102',
              cfop_interno: it.cfop_interno || '5102',
              cfop_externo: it.cfop_externo || '6102',
              unidade_medida: it.unidade_medida || 'PC',
              csosn: '101 - Com permissão de crédito',
              totalWeightKg: Number((it as any).peso_total || (it as any).totalWeightKg || 0)
            }));
          }
        } catch (e) {
          console.warn('Aviso ao carregar itens detalhados do Supabase:', e);
        }
      }

      if (itensDestaCotacao && itensDestaCotacao.length > 0) {
        itensDestaCotacao.forEach(it => {
          const unit = Number(it.unitario) || 0;
          const qte = Number(it.qtd) || 1;
          const sub = Number(it.subtotal) || (unit * qte);
          const peso = Number(it.totalWeightKg) || 0;

          itensUnificados.push({
            id: `NFE-${seqItem++}-${it.id || ''}`,
            date: q.data || new Date().toISOString().slice(0, 10),
            companyName: clientObj?.name || clientObj?.fantasyName || q.cliente,
            constant: '1.0',
            diameter: it.medida || '',
            description: it.descricao || it.produto || `Item #${seqItem}`,
            descricao: it.descricao || it.produto || `Item #${seqItem}`,
            material: it.produto || 'Aço Carbono',
            constanteNome: it.produto || 'Material',
            measure: it.medida || 'Conforme desenho',
            widthLength: it.medida || '',
            quantity: qte,
            qtd: qte,
            unitPrice: unit,
            valorUnitario: unit,
            subtotal: sub,
            notes: it.info ? `${it.info} (Ref. ${refCot})` : `Ref. ${refCot}`,
            observacao: it.info ? `${it.info} (Ref. ${refCot})` : `Ref. ${refCot}`,
            ncm: it.ncm || '72085200',
            cfop: it.cfop || it.cfop_interno || '5102',
            cfop_interno: it.cfop_interno || '5102',
            cfop_externo: it.cfop_externo || '6102',
            // d) Aplicação do CSOSN 101 nos itens
            csosn: '101 - Com permissão de crédito',
            unidade_medida: it.unidade_medida || 'PC',
            totalWeightKg: peso,
            pesoTotal: peso,
            unitWeightKg: qte > 0 ? peso / qte : 0,
            cotacaoOrigem: refCot
          });
        });
      } else {
        // Fallback: item consolidado com o valor da cotação
        itensUnificados.push({
          id: `NFE-${seqItem++}`,
          date: q.data || new Date().toISOString().slice(0, 10),
          companyName: clientObj?.name || clientObj?.fantasyName || q.cliente,
          constant: '1.0',
          diameter: '—',
          description: q.itensResumo || `Serviços industriais de corte e conformação (Ref. ${refCot})`,
          descricao: q.itensResumo || `Serviços industriais de corte e conformação (Ref. ${refCot})`,
          material: 'Aço Carbono',
          constanteNome: 'Aço',
          measure: 'Conforme desenho',
          widthLength: '',
          quantity: 1,
          qtd: 1,
          unitPrice: q.valor,
          valorUnitario: q.valor,
          subtotal: q.valor,
          notes: `Ref. ${refCot}`,
          observacao: `Ref. ${refCot}`,
          ncm: '72085200',
          cfop: '5102',
          cfop_interno: '5102',
          cfop_externo: '6102',
          // d) Aplicação do CSOSN 101 nos itens
          csosn: '101 - Com permissão de crédito',
          unidade_medida: 'PC',
          totalWeightKg: q.pesoKg || 0,
          pesoTotal: q.pesoKg || 0,
          unitWeightKg: q.pesoKg || 0,
          cotacaoOrigem: refCot
        });
      }
    }

    // 2. c) O valor total consolidado das cotações
    const valorTotalConsolidado = itensUnificados.reduce((sum, it) => sum + (it.subtotal || 0), 0);
    const pesoTotalConsolidado = itensUnificados.reduce((sum, it) => sum + (it.totalWeightKg || 0), 0);

    const listaNumeros = cotacoesParaEmitir.map(q => q.numero).filter(Boolean);
    const listaIds = cotacoesParaEmitir.map(q => q.id || q.numero).filter(Boolean);
    const textoRef = `Ref. Cotações: ${listaNumeros.join(', ')}`;

    const unifiedQuote: Quote = {
      id: cotacoesParaEmitir.length === 1 && cotacoesParaEmitir[0].id ? cotacoesParaEmitir[0].id : `MULTI-FECHAMENTO-${Date.now()}`,
      quoteNumber: cotacoesParaEmitir.length === 1 ? cotacoesParaEmitir[0].numero : listaNumeros.join(', '),
      date: cotacoesParaEmitir[0].data || new Date().toISOString().split('T')[0],
      createdAt: cotacoesParaEmitir[0].data || new Date().toISOString(),
      clientId: clientObj.id,
      clientName: clientObj.name || clientObj.fantasyName || primaryQuote.cliente,
      clientDocument: clientObj.document || primaryQuote.clienteDoc || '',
      clientPhone: clientObj.phone || primaryQuote.clienteTelefone || '',
      clientStreet: clientObj.street || primaryQuote.clienteEndereco || '',
      clientCity: clientObj.city || primaryQuote.clienteCidade || '',
      contactPerson: clientObj.contactPerson || primaryQuote.clienteContato || '',
      items: itensUnificados,
      subtotalTotal: valorTotalConsolidado,
      grandTotal: valorTotalConsolidado,
      totalWeightKg: pesoTotalConsolidado,
      discount: 0,
      shipping: 0,
      observations: cotacoesParaEmitir.length > 1 
        ? `${textoRef}. Fechamento e faturamento de cotações.` 
        : (primaryQuote.rawQuote?.observations || `Ref. Cotação ${primaryQuote.numero}`),
      validityDays: 10,
      paymentTerms: 'À Vista',
      updatedAt: new Date().toISOString(),
      status: 'Aprovado',
      status_nfe: cotacoesParaEmitir.length === 1 ? (cotacoesParaEmitir[0].status_nfe || 'Pendente') : 'Pendente',
      nfe_numero: cotacoesParaEmitir.length === 1 ? cotacoesParaEmitir[0].nfe_numero : undefined,
      nfe_chave: cotacoesParaEmitir.length === 1 ? (cotacoesParaEmitir[0].nfe_chave || cotacoesParaEmitir[0].chave_acesso) : undefined,
      danfe_url: cotacoesParaEmitir.length === 1 ? cotacoesParaEmitir[0].danfe_url : undefined,
      xml_url: cotacoesParaEmitir.length === 1 ? cotacoesParaEmitir[0].xml_url : undefined,
      origemCotacoes: listaNumeros,
      origemCotacaoIds: listaIds
    };

    setClientForNfeModal(clientObj);
    setQuoteForNfeModal(unifiedQuote);
  };

  return (
    <div className="fechamento-root-container fechamento-cotacoes-module print-fechamento flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* REGRAS ISOLADAS DE IMPRESSÃO EXCLUSIVAS DO COMPONENTE DE FECHAMENTO */}
      <style>{`
        @media print {
          /* 1. Oculta navegação e barras do sistema quando na tela de Fechamento */
          body.print-fechamento nav,
          body.print-fechamento aside,
          body.print-fechamento sidebar,
          body.print-fechamento .sidebar,
          body.print-fechamento header.topbar,
          body.print-fechamento .topbar,
          body.print-fechamento .footerbar,
          body.print-fechamento footer,
          body.print-fechamento #sidebarOverlay,
          body.print-fechamento .offline-indicator,
          body.print-fechamento #migration-alert-banner {
            display: none !important;
          }

          /* 2. Oculta todos os elementos de tela do Fechamento (filtros, cabeçalhos, cards, botões de ação e tabela interativa) */
          .print-fechamento .fechamento-interface-screen,
          .print-fechamento .fechamento-header,
          .print-fechamento .fechamento-cards,
          .print-fechamento .fechamento-filtros,
          .print-fechamento .fechamento-acoes,
          .print-fechamento .fechamento-feedback,
          .print-fechamento .fechamento-tabela-tela,
          .print-fechamento .extrato-modal-header,
          .print-fechamento .extrato-modal-footer,
          .print-fechamento .no-print,
          .print-fechamento .btn-no-print,
          .print-fechamento button,
          body.print-fechamento .fechamento-interface-screen,
          body.print-fechamento .fechamento-header,
          body.print-fechamento .fechamento-cards,
          body.print-fechamento .fechamento-filtros,
          body.print-fechamento .fechamento-acoes,
          body.print-fechamento .fechamento-feedback,
          body.print-fechamento .fechamento-tabela-tela,
          body.print-fechamento .extrato-modal-header,
          body.print-fechamento .extrato-modal-footer,
          body.print-fechamento .no-print,
          body.print-fechamento .btn-no-print,
          body.print-fechamento button {
            display: none !important;
          }

          /* 3. Limpeza de fundos escuros, margens e overflow para folha A4 limpa */
          body.print-fechamento,
          body.print-fechamento #root,
          body.print-fechamento main,
          body.print-fechamento .fechamento-root-container,
          body.print-fechamento .fechamento-cotacoes-module,
          body.print-fechamento .print-fechamento {
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 100% !important;
            max-height: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* 4. Exibe exclusivamente o Extrato limpo e organizado */
          .print-fechamento .secao-extrato,
          .print-fechamento .secao-fechamento-print-documento,
          body.print-fechamento .secao-extrato,
          body.print-fechamento .secao-fechamento-print-documento {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: none !important;
            box-shadow: none !important;
          }

          /* Se o modal estiver aberto, remove overlay escuro e exibe o extrato limpo */
          .print-fechamento .extrato-modal-overlay,
          .print-fechamento .extrato-modal-content,
          .print-fechamento .extrato-modal-scroll,
          .print-fechamento .extrato-modal-card-wrapper,
          body.print-fechamento .extrato-modal-overlay,
          body.print-fechamento .extrato-modal-content,
          body.print-fechamento .extrato-modal-scroll,
          body.print-fechamento .extrato-modal-card-wrapper {
            position: static !important;
            background: #ffffff !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-height: none !important;
            width: 100% !important;
            overflow: visible !important;
          }

          /* Permite fluxo contínuo na listagem de cotações, evitando quebras forçadas e folhas em branco intermediárias */
          .extrato-blocos-cotacoes {
            page-break-inside: auto !important;
            break-inside: auto !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* Evita que blocos individuais de cotação, total e pagamento sejam cortados entre páginas ao imprimir */
          .bloco-cotacao-extrato,
          .extrato-total-geral-box,
          .extrato-pagamento-box,
          .extrato-assinaturas {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            height: auto !important;
            overflow: visible !important;
          }
        }
      `}</style>
      {/* INTERFACE EM TELA (OCULTADA TOTALMENTE EM @MEDIA PRINT) */}
      <div className="fechamento-interface-screen flex-1 flex flex-col h-full overflow-hidden no-print">
        {/* 1. TOPO DO MÓDULO: TÍTULO & CARDS DE RESUMO */}
        <div className="fechamento-header border-b border-slate-800 bg-slate-900/90 px-4 py-3 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                    Fechamento & Extrato de Cotações
                    <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-semibold">
                      Cobrança & Financeiro
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400">
                    Controle de faturamento consolidado por cliente, geração de extratos em PDF e baixa com integração no Caixa.
                  </p>
                </div>
              </div>
            </div>

            {/* Cards Rápidos de Indicadores */}
            <div className="fechamento-cards flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 min-w-[130px]">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Filtrado</span>
                <span className="text-sm font-black font-mono text-white">
                  {formatCurrency(totalValorFiltrado)}
                </span>
                <span className="text-[10px] text-slate-400 block">{filteredQuotes.length} cotações</span>
              </div>

              <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-3 py-1.5 min-w-[130px]">
                <span className="text-[10px] text-amber-400 uppercase font-semibold block flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Pendente de Baixa
                </span>
                <span className="text-sm font-black font-mono text-amber-300">
                  {formatCurrency(totalPendentesValor)}
                </span>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl px-3 py-1.5 min-w-[130px]">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold block flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Já Pago / Baixado
                </span>
                <span className="text-sm font-black font-mono text-emerald-300">
                  {formatCurrency(totalPagasValor)}
                </span>
              </div>

              {onOpenHistoricoFechamento && (
                <button
                  onClick={onOpenHistoricoFechamento}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all cursor-pointer border border-purple-400/30 shrink-0"
                  title="Histórico de Fechamentos Mensais Salvos no Supabase"
                >
                  <Calendar className="w-4 h-4 text-purple-200" />
                  <span>📊 Histórico no Supabase</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. BARRA DE FILTROS AVANÇADOS */}
        <div className="fechamento-filtros bg-slate-900/60 border-b border-slate-800 p-3 sm:p-4 space-y-3 shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Filtro por Cliente / Empresa */}
          <div className="lg:col-span-4">
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-blue-400" />
              <span>Cliente / Empresa (Razão ou Fantasia)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={filtroCliente}
                onChange={e => setFiltroCliente(e.target.value)}
                placeholder="Digite o nome do cliente para filtrar..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                list="lista-clientes-fechamento"
              />
              <datalist id="lista-clientes-fechamento">
                {clientOptions.map((c, idx) => (
                  <option key={idx} value={c.nome}>
                    {c.documento ? `CNPJ: ${c.documento}` : ''}
                  </option>
                ))}
              </datalist>
              {filtroCliente && (
                <button
                  onClick={() => setFiltroCliente('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filtro por Período de Data */}
          <div className="lg:col-span-4 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>Data Inicial</span>
              </label>
              <input
                type="date"
                value={filtroDataInicio}
                onChange={e => setFiltroDataInicio(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                <span>Data Final</span>
              </label>
              <input
                type="date"
                value={filtroDataFim}
                onChange={e => setFiltroDataFim(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filtro por Status de Pagamento */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Status Pagamento</span>
            </label>
            <select
              value={filtroStatusPagamento}
              onChange={e => setFiltroStatusPagamento(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="todas">Todas as Cotações</option>
              <option value="pendentes">⏳ Pendentes de Baixa</option>
              <option value="pagas">✅ Pagas / Baixadas</option>
            </select>
          </div>

          {/* Busca Direta por Número */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-amber-400" />
              <span>Nº Cotação / Item</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={buscaNumero}
                onChange={e => setBuscaNumero(e.target.value)}
                placeholder="Ex: 28, 00028, item..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 pr-7 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {buscaNumero && (
                <button
                  type="button"
                  onClick={() => setBuscaNumero('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-0.5"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Atalhos Rápidos de Filtro */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-semibold mr-1">Atalhos de Período:</span>
            <button
              onClick={() => aplicarPeriodo('hoje')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-[11px] transition-colors"
            >
              Hoje
            </button>
            <button
              onClick={() => aplicarPeriodo('mes')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-[11px] transition-colors"
            >
              Mês Atual
            </button>
            <button
              onClick={() => aplicarPeriodo('30dias')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-[11px] transition-colors"
            >
              Últimos 30 dias
            </button>
            {(filtroDataInicio || filtroDataFim || filtroCliente || buscaNumero || filtroStatusPagamento !== 'todas') && (
              <button
                onClick={() => {
                  setFiltroCliente('');
                  setFiltroDataInicio('');
                  setFiltroDataFim('');
                  setFiltroStatusPagamento('todas');
                  setBuscaNumero('');
                }}
                className="px-2.5 py-1 bg-red-950/40 text-red-400 hover:bg-red-900/60 border border-red-800/40 rounded-lg text-[11px] transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Limpar Todos Filtros
              </button>
            )}
          </div>

          <button
            onClick={() => loadQuotesData()}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {/* 3. PAINEL FIXO DE TOTAIS EM TEMPO REAL E AÇÕES DE FECHAMENTO */}
      <div className="fechamento-acoes bg-slate-900 border-b border-slate-800 px-4 py-2.5 shrink-0 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-400" />
              ) : isIndeterminate ? (
                <MinusSquare className="w-4 h-4 text-blue-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>{isAllSelected ? 'Desmarcar Todas' : 'Selecionar Todas'}</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1">
              <span className="text-slate-400 mr-1.5">Selecionadas:</span>
              <strong className="text-white font-mono">{selectedQuotes.length}</strong>
              <span className="text-slate-500 text-[11px] ml-1">de {filteredQuotes.length}</span>
            </div>

            <div className="bg-slate-950 border border-blue-500/40 rounded-lg px-3 py-1">
              <span className="text-slate-400 mr-1.5">Total a Cobrar:</span>
              <strong className="text-blue-400 font-mono text-sm">{formatCurrency(totalValorSelecionado)}</strong>
              {totalPesoSelecionado > 0 && (
                <span className="text-slate-500 text-[11px] ml-1.5">({totalPesoSelecionado.toFixed(2)} kg)</span>
              )}
            </div>
          </div>
        </div>

        {/* Botões de Ação Principais */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão destacado quando 1 ou mais cotações são selecionadas na tabela */}
          {selectedQuotes.length > 0 && (
            <button
              onClick={handleAbrirExtrato}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer ring-2 ring-blue-400/50 animate-in fade-in zoom-in-95"
              title="Visualizar e Imprimir o Extrato de Cobrança das cotações selecionadas"
            >
              <Eye className="w-4 h-4" />
              <span>Visualizar e Imprimir Selecionadas ({selectedQuotes.length})</span>
            </button>
          )}

          {/* Botão Emitir NF-e das Selecionadas */}
          <button
            onClick={() => handleEmitirNfe(selectedQuotes)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              selectedQuotes.length > 0
                ? 'bg-blue-700 hover:bg-blue-600 text-white shadow-lg shadow-blue-700/40 ring-2 ring-blue-400/60 animate-in fade-in zoom-in-95'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white'
            }`}
            title="Emitir Nota Fiscal Eletrônica (NF-e) unificada das cotações selecionadas"
          >
            <FileText className="w-4 h-4 text-blue-200" />
            <span>📄 Emitir NF-e das Selecionadas {selectedQuotes.length > 0 ? `(${selectedQuotes.length})` : ''}</span>
          </button>

          {selectedQuotes.length > 0 && (
            <button
              onClick={handleAbrirBaixa}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-emerald-600/30 transition-all cursor-pointer animate-pulse"
              title="Dar baixa de pagamento nas cotações selecionadas"
            >
              <DollarSign className="w-4 h-4" />
              <span>💰 Dar Baixa nas Selecionadas</span>
            </button>
          )}
        </div>
      </div>

      {/* FEEDBACK DE SUCESSO OU ALERTA */}
      {feedbackMensagem && (
        <div className="fechamento-feedback bg-emerald-950/90 border-b border-emerald-500/50 px-4 py-2.5 text-xs text-emerald-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMensagem.texto}</span>
          </div>
          <div className="flex items-center gap-3">
            {onNavigateToFinanceiro && (
              <button
                onClick={onNavigateToFinanceiro}
                className="text-xs font-bold text-white underline hover:text-emerald-300 flex items-center gap-1"
              >
                <span>Ver no Financeiro</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setFeedbackMensagem(null)}
              className="text-emerald-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. TABELA DE RESULTADOS COM SELEÇÃO INDIVIDUAL */}
      <div className="fechamento-tabela-tela flex-1 overflow-auto p-3 sm:p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs font-semibold">Carregando cotações e faturamento...</p>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <Filter className="w-10 h-10 text-slate-600 mb-3" />
            <h3 className="text-sm font-bold text-slate-300">Nenhuma cotação encontrada</h3>
            <p className="text-xs text-slate-500 max-w-md mt-1">
              Não encontramos pedidos que correspondam aos filtros informados. Tente ajustar o cliente, período de datas ou status de pagamento.
            </p>
            <button
              onClick={() => {
                setFiltroCliente('');
                setFiltroDataInicio('');
                setFiltroDataFim('');
                setFiltroStatusPagamento('todas');
                setBuscaNumero('');
              }}
              className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Limpar Todos os Filtros
            </button>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px] font-bold">
                  <th className="p-3 text-center w-12">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-white"
                      title="Selecionar / Desmarcar Todas"
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : isIndeterminate ? (
                        <MinusSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                  </th>
                  <th className="p-3 text-center w-28">Nº Cotação</th>
                  <th className="p-3 text-center w-24">Data</th>
                  <th className="p-3">Cliente / Empresa</th>
                  <th className="p-3 hidden md:table-cell">Resumo dos Itens</th>
                  <th className="p-3 text-right w-28">Valor (R$)</th>
                  <th className="p-3 text-center w-24">Status Cotação</th>
                  <th className="p-3 text-center w-32">Status Pagamento</th>
                  <th className="p-3 text-center w-36">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredQuotes.map(q => {
                  const key = q.numero || q.id || '';
                  const isSelected = selectedKeys.has(key) || (q.id && selectedKeys.has(q.id));
                  const isPago = q.pagamento?.status === 'Pago';

                  return (
                    <tr
                      key={q.id || q.numero}
                      onClick={() => toggleSelectRow(q)}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-blue-950/30 hover:bg-blue-950/40' 
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => toggleSelectRow(q)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      </td>

                      {/* Nº Cotação */}
                      <td className="p-3 text-center">
                        <span className="font-mono font-bold text-white bg-slate-800 px-2 py-1 rounded text-[11px] border border-slate-700">
                          {q.numero}
                        </span>
                      </td>

                      {/* Data */}
                      <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                        {formatSafeDate(q.data)}
                      </td>

                      {/* Cliente */}
                      <td className="p-3">
                        <div className="font-bold text-slate-100 text-xs">{q.cliente}</div>
                        {q.clienteTelefone && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{q.clienteTelefone}</div>
                        )}
                      </td>

                      {/* Resumo Itens */}
                      <td className="p-3 hidden md:table-cell text-slate-300 text-[11px] max-w-xs truncate" title={q.itensResumo}>
                        {q.itensResumo || '-'}
                      </td>

                      {/* Valor (R$) */}
                      <td className="p-3 text-right">
                        <span className="font-mono font-bold text-sm text-emerald-400">
                          {formatCurrency(q.valor)}
                        </span>
                      </td>

                      {/* Status da Cotação */}
                      <td className="p-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {q.statusCotacao || 'Aprovado'}
                        </span>
                      </td>

                      {/* Status de Pagamento */}
                      <td className="p-3 text-center">
                        {isPago ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> PAGO
                            </span>
                            {q.pagamento?.dataPagamento && (
                              <span className="block text-[9.5px] text-slate-400 mt-0.5 font-mono">
                                {formatSafeDate(q.pagamento.dataPagamento)} ({q.pagamento.formaPagamento || 'PIX'})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Clock className="w-3 h-3" /> PENDENTE
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedQuoteDetail(q);
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                            title="Ver Detalhes"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Botão Rápido Emitir NF-e Individual */}
                          <button
                            onClick={() => handleEmitirNfe([q])}
                            className={`p-1.5 rounded-lg transition-colors text-[10px] ${
                              isNfeAutorizada(q.status_nfe)
                                ? 'bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/30'
                                : 'bg-blue-950/50 hover:bg-blue-900/70 text-blue-300 border border-blue-500/30'
                            }`}
                            title={
                              isNfeAutorizada(q.status_nfe)
                                ? `NF-e Nº ${q.nfe_numero || ''} Autorizada - Ver / Reemitir DANFE`
                                : `Emitir NF-e da cotação ${q.numero}`
                            }
                          >
                            {isNfeAutorizada(q.status_nfe) ? (
                              <FileCheck className="w-3.5 h-3.5 text-indigo-400" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-blue-400" />
                            )}
                          </button>

                          {isPago ? (
                            <button
                              onClick={() => handleReverterParaPendente(q)}
                              className="p-1.5 bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 rounded-lg transition-colors text-[10px]"
                              title="Reverter para Pendente"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedKeys(new Set([q.numero || q.id || '']));
                                handleAbrirBaixa();
                              }}
                              className="p-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 rounded-lg transition-colors text-[10px]"
                              title="Dar Baixa Individual"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Botão de Exclusão (Soft Delete) */}
                          <button
                            onClick={() => handleExcluirCotacao(q.id || q.numero)}
                            className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 rounded-lg transition-colors text-[10px] border border-rose-500/20"
                            title="Remover cotação da listagem"
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
        )}
      </div>
      {/* FIM DA INTERFACE EM TELA (fechamento-interface-screen) */}
      </div>

      {/* 5. MODAL DE PRÉ-VISUALIZAÇÃO DINÂMICA DO EXTRATO DE COBRANÇA (A4 / PDF) */}
      {isExtratoModalOpen && (
        <div className="extrato-modal-overlay fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:static print:p-0 print:m-0 print:bg-transparent print:overflow-visible print:h-auto print:max-h-none print:transform-none">
          <div className="extrato-modal-content bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl print:bg-transparent print:border-none print:border-t-0 print:shadow-none print:max-h-none print:w-full print:rounded-none print:overflow-visible print:h-auto print:transform-none">
            {/* Topo Modal */}
            <div className="extrato-modal-header p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0 no-print btn-no-print">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Pré-visualização do Relatório / Extrato de Cobrança</h2>
                  <p className="text-[11px] text-slate-400">
                    {selectedQuotes.length} cotação(ões) selecionada(s) | Total: {formatCurrency(totalValorSelecionado)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsExtratoModalOpen(false);
                    handleEmitirNfe(selectedQuotes);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer ring-2 ring-indigo-400/50"
                  title="Emitir NF-e consolidada em lote das cotações deste extrato"
                >
                  <FileText className="w-4 h-4 text-indigo-100" />
                  <span>📄 Emitir NF-e ({selectedQuotes.length})</span>
                </button>

                <button
                  onClick={handleImprimirExtrato}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                  title="Imprimir ou Salvar em PDF"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / Salvar PDF</span>
                </button>

                <button
                  onClick={() => setIsExtratoModalOpen(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Fechar Pré-visualização
                </button>

                <button
                  onClick={() => setIsExtratoModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conteúdo do Extrato Formatado para A4 */}
            <div className="extrato-modal-scroll flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-800/40 print:p-0 print:m-0 print:bg-transparent print:overflow-visible print:h-auto print:max-h-none">
              <div className="extrato-modal-card-wrapper bg-white rounded-xl shadow-2xl border border-slate-300 overflow-hidden print:border-none print:border-t-0 print:shadow-none print:rounded-none print:p-0 print:m-0 print:overflow-visible print:h-auto print:max-h-none">
                <ExtratoCobrancaPrint 
                  cotacoes={selectedQuotes}
                  clienteInfo={selectedClientInfo}
                  periodoInicio={filtroDataInicio}
                  periodoFim={filtroDataFim}
                />
              </div>
            </div>

            {/* Rodapé Modal */}
            <div className="extrato-modal-footer p-3 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 shrink-0 no-print btn-no-print">
              <span>Layout certificado para impressão em folha A4 e exportação em PDF.</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsExtratoModalOpen(false);
                    handleEmitirNfe(selectedQuotes);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer ring-2 ring-indigo-400/50"
                  title="Emitir NF-e das cotações deste extrato"
                >
                  <FileText className="w-4 h-4 text-indigo-100" />
                  <span>📄 Emitir NF-e ({selectedQuotes.length})</span>
                </button>
                <button
                  onClick={() => setIsExtratoModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors cursor-pointer text-xs"
                >
                  Fechar Pré-visualização
                </button>
                <button
                  onClick={handleImprimirExtrato}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / Salvar PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. ÁREA DE IMPRESSÃO EXCLUSIVA DO EXTRATO DIRETO DA TELA (QUANDO O MODAL NÃO ESTÁ ABERTO) */}
      {!isExtratoModalOpen && (
        <div className="secao-fechamento-print-documento print:block hidden print-fechamento-only">
          <ExtratoCobrancaPrint 
            cotacoes={quotesParaExtrato}
            clienteInfo={clientInfoParaExtrato}
            periodoInicio={filtroDataInicio}
            periodoFim={filtroDataFim}
          />
        </div>
      )}

      {/* 7. MODAL DE BAIXA DE PAGAMENTO & INTEGRAÇÃO FINANCEIRA */}
      {isBaixaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Baixa de Pagamento & Integração Financeira</h2>
                  <p className="text-[11px] text-slate-400">
                    Confirmação de recebimento e lançamento no Caixa
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBaixaModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Card Resumo do Faturamento */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Cotações Selecionadas:</span>
                  <strong className="text-white font-mono">{selectedQuotes.length}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Cliente Principal:</span>
                  <strong className="text-white truncate max-w-[200px]">{selectedQuotes[0]?.cliente || 'Cliente'}</strong>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <span className="font-bold text-emerald-400 uppercase">Valor Total a Baixar:</span>
                  <span className="font-black font-mono text-base text-emerald-300">
                    {formatCurrency(totalValorSelecionado)}
                  </span>
                </div>
              </div>

              {/* Formulário de Baixa */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>Data do Recebimento / Pagamento</span>
                  </label>
                  <input
                    type="date"
                    value={dataPagamentoBaixa}
                    onChange={e => setDataPagamentoBaixa(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                      <span>Forma de Pagamento</span>
                    </label>
                    <select
                      value={formaPagamentoBaixa}
                      onChange={e => setFormaPagamentoBaixa(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="PIX">⚡ PIX (Instantâneo)</option>
                      <option value="Boleto">📄 Boleto Bancário</option>
                      <option value="Transferência">🏦 Transferência / TED</option>
                      <option value="Dinheiro">💵 Dinheiro / Espécie</option>
                      <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
                      <option value="Cartão de Débito">💳 Cartão de Débito</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-amber-400" />
                      <span>Conta de Destino / Caixa</span>
                    </label>
                    <select
                      value={contaDestinoBaixa}
                      onChange={e => setContaDestinoBaixa(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Conta Banco do Brasil - Principal">Conta BB Principal</option>
                      <option value="Conta Itaú PJ">Conta Itaú PJ</option>
                      <option value="Caixa Físico Central">Caixa Central da Loja</option>
                      <option value="Carteira Digital PIX">Chave PIX UsiCorte</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    <span>Observações / Detalhes do Pagamento</span>
                  </label>
                  <textarea
                    rows={2}
                    value={observacoesBaixa}
                    onChange={e => setObservacoesBaixa(e.target.value)}
                    placeholder="Ex: Comprovante de PIX recebido via WhatsApp pelo operador..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>
              </div>

              {/* Aviso da Integração */}
              <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-3 text-[11px] text-blue-300 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Integração Automática:</strong> Esta ação marcará todas as cotações como <strong>PAGO</strong> e criará automaticamente o lançamento de <strong>Receita</strong> no Módulo Financeiro vinculado ao cliente.
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBaixaModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmarBaixa}
                disabled={isSubmittingBaixa}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                {isSubmittingBaixa ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processando Baixa...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Baixa & Lançar no Caixa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DETALHES DE UMA COTAÇÃO */}
      {selectedQuoteDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Detalhes da Cotação {selectedQuoteDetail.numero}</span>
              </h3>
              <button
                onClick={() => setSelectedQuoteDetail(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px]">Data:</span>
                  <strong className="text-white">{formatSafeDate(selectedQuoteDetail.data)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Valor:</span>
                  <strong className="text-emerald-400 font-mono">{formatCurrency(selectedQuoteDetail.valor)}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px]">Cliente:</span>
                  <strong className="text-white">{selectedQuoteDetail.cliente}</strong>
                </div>
                {selectedQuoteDetail.clienteTelefone && (
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">Telefone:</span>
                    <span className="text-slate-300">{selectedQuoteDetail.clienteTelefone}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Itens / Serviços:</span>
                <p className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-300 leading-relaxed">
                  {selectedQuoteDetail.itensResumo || 'Sem itens detalhados'}
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Status de Pagamento:</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedQuoteDetail.pagamento?.status === 'Pago' 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {selectedQuoteDetail.pagamento?.status === 'Pago' ? 'PAGO' : 'PENDENTE DE BAIXA'}
                  </span>
                  {selectedQuoteDetail.pagamento?.formaPagamento && (
                    <span className="text-slate-400 text-[11px]">
                      via {selectedQuoteDetail.pagamento.formaPagamento}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  const q = selectedQuoteDetail;
                  setSelectedQuoteDetail(null);
                  handleEmitirNfe([q]);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                title="Emitir NF-e para esta cotação"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📄 Emitir NF-e</span>
              </button>
              <button
                onClick={() => setSelectedQuoteDetail(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL DE EMISSÃO / TRANSMISSÃO FISCAL DA NF-E (SEFAZ) */}
      {quoteForNfeModal && (
        <EmissaoNfeModal
          quote={quoteForNfeModal}
          client={clientForNfeModal}
          onSuccess={async (updated) => {
            setQuoteForNfeModal(null);
            setQuoteForDanfeModal(updated);
            setAutoPrintDanfeModal(true);

            // 1. Identifica todas as cotações que foram incluídas nesta NF-e
            let cotacoesAlvo: ExtratoCotacaoItem[] = quotesEmissaoNfeRef.current;
            if (!cotacoesAlvo || cotacoesAlvo.length === 0) {
              const numeros = updated.origemCotacoes || [updated.quoteNumber];
              const ids = updated.origemCotacaoIds || [updated.id];
              cotacoesAlvo = allQuotes.filter(q => 
                (q.numero && numeros.includes(q.numero)) || (q.id && ids.includes(q.id))
              );
            }

            const numNfe = updated.nfe_numero || '';
            const chaveNfe = updated.nfe_chave || updated.chave_acesso || '';
            const dataHoje = updated.nfe_emitida_em ? updated.nfe_emitida_em.split('T')[0] : new Date().toISOString().split('T')[0];

            if (cotacoesAlvo.length > 0) {
              const cotacoesParaBaixar = cotacoesAlvo.map(q => ({
                id: q.id,
                numero: q.numero,
                cliente: q.cliente,
                valor: q.valor
              }));

              try {
                // 1. BAIXA FINANCEIRA AUTOMÁTICA:
                // Aciona automaticamente a mesma lógica do botão "Dar Baixa nas Selecionadas",
                // atualiza o Status de Pagamento para "PAGO", registra a data e sincroniza a entrada de caixa no Financeiro
                const resBaixa = await darBaixaMultiplasCotacoesDb(cotacoesParaBaixar, {
                  dataPagamento: dataHoje,
                  formaPagamento: 'PIX',
                  contaDestino: 'Conta Banco do Brasil - Principal',
                  observacoes: `Baixa automática via Emissão da NF-e Nº ${numNfe}${chaveNfe ? ` (Chave: ${chaveNfe})` : ''}`,
                  nfeNumero: numNfe,
                  nfeChave: chaveNfe,
                  documentoRef: numNfe ? `NF-e ${numNfe}` : undefined
                });

                // 2. ATUALIZAÇÃO DO STATUS DA COTAÇÃO & VINCULAÇÃO FISCAL NO SUPABASE:
                // Altera a Situação das cotações selecionadas para "FATURADO"
                // e vincula a chave de acesso / número da NF-e gerada ao histórico dessas cotações
                for (const c of cotacoesAlvo) {
                  try {
                    await updateCotacaoNfeStatusDb(c.id || c.numero, {
                      status_nfe: 'Emitida',
                      nfe_numero: numNfe,
                      nfe_chave: chaveNfe,
                      chave_acesso: chaveNfe,
                      danfe_url: updated.danfe_url,
                      xml_url: updated.xml_url,
                      situacao: 'FATURADO'
                    });
                  } catch (eDb) {
                    console.warn(`Aviso ao vincular NF-e na cotação ${c.numero}:`, eDb);
                  }
                }

                // 3. ATUALIZAÇÃO EM TEMPO REAL NO ESTADO LOCAL (sem necessidade de F5):
                setAllQuotes(prev => prev.map(item => {
                  const match = cotacoesAlvo.some(ca => 
                    (ca.id && item.id && ca.id === item.id) || 
                    (ca.numero && item.numero && ca.numero.trim().toLowerCase() === item.numero.trim().toLowerCase())
                  );
                  if (match) {
                    return {
                      ...item,
                      statusCotacao: 'faturado',
                      status_nfe: 'Emitida',
                      nfe_numero: numNfe,
                      nfe_chave: chaveNfe,
                      chave_acesso: chaveNfe,
                      danfe_url: updated.danfe_url,
                      xml_url: updated.xml_url,
                      pagamento: {
                        status: 'Pago',
                        dataPagamento: dataHoje,
                        formaPagamento: 'PIX',
                        observacoes: `Baixa automática via Emissão da NF-e Nº ${numNfe}`,
                        valorPago: item.valor
                      }
                    };
                  }
                  return item;
                }));

                // Desmarca da seleção as cotações baixadas
                setSelectedKeys(prev => {
                  const next = new Set(prev);
                  cotacoesAlvo.forEach(ca => {
                    next.delete(ca.numero);
                    if (ca.id) next.delete(ca.id);
                  });
                  return next;
                });

                setFeedbackMensagem({
                  tipo: 'success',
                  texto: `⚡ NF-e Nº ${numNfe} autorizada com sucesso pela SEFAZ! Baixa automática realizada no Financeiro e ${cotacoesAlvo.length} cotação(ões) alterada(s) para FATURADO.`,
                  lancamento: resBaixa?.lancamento || undefined
                });
              } catch (baixaErr: any) {
                console.error('Erro na baixa automática pós-NF-e:', baixaErr);
                setFeedbackMensagem({
                  tipo: 'success',
                  texto: `NF-e emitida e autorizada com sucesso! (Nº ${numNfe})`
                });
              }
            } else {
              setFeedbackMensagem({
                tipo: 'success',
                texto: `NF-e emitida e autorizada com sucesso! (Nº ${numNfe})`
              });
            }

            quotesEmissaoNfeRef.current = [];
            await loadQuotesData();
          }}
          onClose={() => {
            quotesEmissaoNfeRef.current = [];
            setQuoteForNfeModal(null);
          }}
        />
      )}

      {/* 9. MODAL DE VISUALIZAÇÃO E IMPRESSÃO DA DANFE A4 OFICIAL */}
      {quoteForDanfeModal && (
        <DanfeEspelhoA4Modal
          isOpen={Boolean(quoteForDanfeModal)}
          onClose={() => {
            setQuoteForDanfeModal(null);
            setAutoPrintDanfeModal(false);
          }}
          quote={quoteForDanfeModal}
          client={clientForNfeModal}
          isPrevia={!isNfeAutorizada(quoteForDanfeModal.status_nfe)}
          autoPrint={autoPrintDanfeModal}
          onTransmit={() => {
            const q = quoteForDanfeModal;
            setQuoteForDanfeModal(null);
            setAutoPrintDanfeModal(false);
            if (q) setQuoteForNfeModal(q);
          }}
        />
      )}
    </div>
  );
}
