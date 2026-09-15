import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Client, Quote, FormaPagamentoFinanceiro, LancamentoFinanceiro } from '../types';
import { 
  fetchCotacoesDb, 
  SupabaseCotacao, 
  atualizarSituacaoCotacaoDb,
  atualizarStatusPagamentoCotacaoDb,
  sincronizarPagamentoContaReceberDb
} from '../lib/db';
import { formatCurrency, formatSafeDate } from '../utils/calculator';
import { 
  getPagamentosCotacoesMap, 
  darBaixaMultiplasCotacoesDb,
  salvarPagamentosCotacoesMap,
  RegistroPagamentoCotacao
} from '../services/inventoryFinanceService';
import ExtratoCobrancaPrint, { ExtratoCotacaoItem } from './ExtratoCobrancaPrint';
import {
  FileText,
  Search,
  Calendar,
  CheckSquare,
  Square,
  MinusSquare,
  DollarSign,
  Printer,
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
  Wallet
} from 'lucide-react';

interface FechamentoCotacoesModuleProps {
  clients?: Client[];
  onNavigateToFinanceiro?: () => void;
  onNavigateToQuote?: () => void;
}

export default function FechamentoCotacoesModule({
  clients = [],
  onNavigateToFinanceiro,
  onNavigateToQuote
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

  // Carrega todas as cotações e status de pagamento
  const loadQuotesData = async () => {
    setIsLoading(true);
    const resultList: ExtratoCotacaoItem[] = [];
    const seenKeys = new Set<string>();
    const pagamentosMap = getPagamentosCotacoesMap();

    // 1. Carrega do Supabase
    try {
      const dbQuotes = await fetchCotacoesDb();
      if (dbQuotes && dbQuotes.length > 0) {
        dbQuotes.forEach(q => {
          const numKey = (q.numero || q.id || '').trim().toLowerCase();
          if (!numKey || seenKeys.has(numKey)) return;
          seenKeys.add(numKey);
          if (q.id) seenKeys.add(q.id.trim().toLowerCase());

          // Resumo dos itens
          let itensResumo = '';
          let pesoTotal = 0;
          let qtdItens = 0;
          if (q.cotacao_itens && q.cotacao_itens.length > 0) {
            qtdItens = q.cotacao_itens.length;
            itensResumo = q.cotacao_itens.map(i => `${i.produto || i.descricao || 'Item'} (${i.quantidade}x ${i.medida || ''})`).join(' | ');
          } else {
            itensResumo = q.observacoes || 'Itens industriais de corte';
          }

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

          resultList.push({
            id: q.id,
            numero: q.numero || q.id || 'COT-TEMP',
            data: q.data || (q.created_at ? q.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
            cliente: q.cliente_nome || 'Cliente Balcão',
            clienteDoc: '',
            clienteTelefone: q.telefone || '',
            clienteContato: q.contato || '',
            valor: Number(q.valor_total) || 0,
            pesoKg: pesoTotal,
            qtdItens: qtdItens || 1,
            itensResumo: itensResumo.slice(0, 180),
            statusCotacao: isPagoNaTabela ? 'faturado' : (q.status || 'aprovado'),
            pagamento: pag
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
            const numKey = (lq.quoteNumber || lq.id || '').trim().toLowerCase();
            if (!numKey || seenKeys.has(numKey)) return;
            seenKeys.add(numKey);

            let itensResumo = '';
            if (lq.items && lq.items.length > 0) {
              itensResumo = lq.items.map(i => `${i.constantName || i.description || 'Material'} (${i.quantity}x ${i.measure || ''})`).join(' | ');
            } else {
              itensResumo = lq.observations || 'Itens de corte e dobra';
            }

            const pag = pagamentosMap[numKey] || {
              status: lq.paymentStatus || 'Pendente',
              dataPagamento: lq.paymentDate,
              formaPagamento: lq.paymentMethod as any,
              observacoes: lq.paymentNotes
            };

            resultList.push({
              id: lq.id,
              numero: lq.quoteNumber || lq.id || 'COT-LOCAL',
              data: lq.date || lq.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
              cliente: lq.clientName || 'Cliente Balcão',
              clienteDoc: lq.clientDocument || '',
              clienteTelefone: lq.clientPhone || '',
              clienteEndereco: lq.clientCity ? `${lq.clientCity}/${lq.clientState || 'SP'}` : '',
              clienteCidade: lq.clientCity || '',
              clienteContato: lq.contactPerson || '',
              valor: Number(lq.grandTotal || lq.subtotalTotal || 0),
              pesoKg: Number(lq.totalWeightKg || 0),
              qtdItens: lq.items?.length || 1,
              itensResumo: itensResumo.slice(0, 180),
              statusCotacao: lq.status || 'Rascunho',
              pagamento: pag
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

  useEffect(() => {
    loadQuotesData();

    const handleAtualizacao = () => {
      loadQuotesData();
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

  // Filtragem das cotações
  const filteredQuotes = useMemo(() => {
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

      // 2. Filtro por Data Inicial
      if (filtroDataInicio) {
        if (q.data < filtroDataInicio) return false;
      }

      // 3. Filtro por Data Final
      if (filtroDataFim) {
        if (q.data > filtroDataFim) return false;
      }

      // 4. Filtro por Status de Pagamento
      if (filtroStatusPagamento === 'pendentes') {
        if (q.pagamento?.status === 'Pago') return false;
      } else if (filtroStatusPagamento === 'pagas') {
        if (q.pagamento?.status !== 'Pago') return false;
      }

      // 5. Busca Direta por Número ou Termo
      if (buscaNumero.trim()) {
        const numTerm = buscaNumero.trim().toLowerCase();
        const numMatch = (q.numero || '').toLowerCase().includes(numTerm);
        const idMatch = (q.id || '').toLowerCase().includes(numTerm);
        const itemMatch = (q.itensResumo || '').toLowerCase().includes(numTerm);
        if (!numMatch && !idMatch && !itemMatch) return false;
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

  // Ação: Abrir Extrato de Cobrança
  const handleAbrirExtrato = () => {
    if (selectedQuotes.length === 0) {
      alert('Selecione pelo menos uma cotação na tabela para gerar o extrato.');
      return;
    }
    setIsExtratoModalOpen(true);
  };

  // Ação: Imprimir Extrato A4
  const handleImprimirExtrato = () => {
    document.body.classList.add('print-extrato');
    window.print();
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

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* 1. TOPO DO MÓDULO: TÍTULO & CARDS DE RESUMO */}
      <div className="border-b border-slate-800 bg-slate-900/90 px-4 py-3 shrink-0">
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
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
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
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS AVANÇADOS */}
      <div className="bg-slate-900/60 border-b border-slate-800 p-3 sm:p-4 space-y-3 shrink-0">
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
            <input
              type="text"
              value={buscaNumero}
              onChange={e => setBuscaNumero(e.target.value)}
              placeholder="Ex: COT-001..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
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
            onClick={loadQuotesData}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {/* 3. PAINEL FIXO DE TOTAIS EM TEMPO REAL E AÇÕES DE FECHAMENTO */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 shrink-0 flex items-center justify-between gap-3 flex-wrap">
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleAbrirExtrato}
            disabled={selectedQuotes.length === 0}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all ${
              selectedQuotes.length > 0
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>🖨️ Gerar Extrato para Cliente</span>
          </button>

          <button
            onClick={handleAbrirBaixa}
            disabled={selectedQuotes.length === 0}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all ${
              selectedQuotes.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer animate-pulse'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>💰 Dar Baixa nas Selecionadas</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK DE SUCESSO OU ALERTA */}
      {feedbackMensagem && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/50 px-4 py-2.5 text-xs text-emerald-200 flex items-center justify-between shrink-0">
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
      <div className="flex-1 overflow-auto p-3 sm:p-4">
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
                  <th className="p-3 text-center w-24">Ações</th>
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

      {/* 5. MODAL DE PRÉVIA E IMPRESSÃO DO EXTRATO DE COBRANÇA (A4) */}
      {isExtratoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:static print:p-0 print:m-0 print:bg-transparent">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl print:bg-transparent print:border-none print:border-t-0 print:shadow-none print:max-h-none print:w-full print:rounded-none">
            {/* Topo Modal */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0 no-print btn-no-print">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Extrato de Cobrança / Faturamento para o Cliente</h2>
                  <p className="text-[11px] text-slate-400">
                    {selectedQuotes.length} cotações selecionadas | Total: {formatCurrency(totalValorSelecionado)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleImprimirExtrato}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Extrato A4 / PDF</span>
                </button>

                <button
                  onClick={() => setIsExtratoModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conteúdo do Extrato Formatado para A4 */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-800/40 print:p-0 print:m-0 print:bg-transparent">
              <div className="bg-white rounded-xl shadow-2xl border border-slate-300 overflow-hidden print:border-none print:border-t-0 print:shadow-none print:rounded-none print:p-0 print:m-0">
                <ExtratoCobrancaPrint 
                  cotacoes={selectedQuotes}
                  clienteInfo={selectedClientInfo}
                  periodoInicio={filtroDataInicio}
                  periodoFim={filtroDataFim}
                />
              </div>
            </div>

            {/* Rodapé Modal */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0 no-print btn-no-print">
              <span>Layout certificado para impressão em folha A4 e envio de cobrança via WhatsApp / PDF.</span>
              <button
                onClick={() => setIsExtratoModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors"
              >
                Fechar Prévia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL DE BAIXA DE PAGAMENTO & INTEGRAÇÃO FINANCEIRA */}
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

            <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setSelectedQuoteDetail(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
