import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FechamentoMensal, 
  FechamentoMensalResumoJson, 
  FechamentoEmpresaResumo, 
  FechamentoCotacaoDetalhe 
} from '../types';
import { 
  buscarCotacoesParaFechamento, 
  salvarFechamentoMensalDb, 
  fetchFechamentosMensaisDb, 
  fetchFechamentoPorMesDb,
  getMesAnterior, 
  formatarMesAnoLabel,
  brl 
} from '../lib/db';
import CompanyHeader from './CompanyHeader';
import { 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Download, 
  RefreshCw, 
  Save, 
  Building, 
  FileText, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Database, 
  History, 
  X, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Sparkles,
  Layers,
  Copy,
  Check
} from 'lucide-react';

interface FechamentoMensalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: string | null;
  isAutoOpenDia1?: boolean;
}

export default function FechamentoMensalModal({
  isOpen,
  onClose,
  currentUser,
  isAutoOpenDia1 = false
}: FechamentoMensalModalProps) {
  // Mês selecionado (padrão: mês anterior ao atual)
  const [mesAnoSelecionado, setMesAnoSelecionado] = useState<string>(() => getMesAnterior());
  const [activeTab, setActiveTab] = useState<'fechamento' | 'historico' | 'sql'>('fechamento');

  // Estados de dados
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dados consolidados do mês atual em exibição
  const [dadosConsolidados, setDadosConsolidados] = useState<{
    mesAno: string;
    mesAnoFormatado: string;
    totalGeral: number;
    totalEmpresas: number;
    totalCotacoes: number;
    ticketMedio: number;
    empresas: FechamentoEmpresaResumo[];
    todasCotacoes: FechamentoCotacaoDetalhe[];
  } | null>(null);

  // Registro já salvo na tabela fechamentos_mensais (se houver)
  const [fechamentoSalvo, setFechamentoSalvo] = useState<FechamentoMensal | null>(null);

  // Histórico de todos os fechamentos da tabela fechamentos_mensais
  const [historicoFechamentos, setHistoricoFechamentos] = useState<FechamentoMensal[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState<boolean>(false);

  // Filtro de pesquisa de empresas/cotações na tela
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [empresasExpandidas, setEmpresasExpandidas] = useState<Record<string, boolean>>({});
  const [copiadoSql, setCopiadoSql] = useState<boolean>(false);

  // Gera lista dos últimos 12 meses para o seletor rápido
  const opcoesMeses = useMemo(() => {
    const lista: { valor: string; label: string }[] = [];
    const hoje = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const val = `${y}-${m}`;
      lista.push({
        valor: val,
        label: `${formatarMesAnoLabel(val)} (${val})`
      });
    }
    return lista;
  }, []);

  // Carrega os dados quando o modal abre ou o mês muda
  useEffect(() => {
    if (isOpen) {
      carregarDadosDoMes(mesAnoSelecionado);
      carregarHistorico();
    }
  }, [isOpen, mesAnoSelecionado]);

  // Função principal para carregar os dados do mês
  const carregarDadosDoMes = async (mesAno: string) => {
    setLoading(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      // 1. Verifica se já existe um fechamento salvo no banco para este mês
      const salvo = await fetchFechamentoPorMesDb(mesAno);
      setFechamentoSalvo(salvo);

      // 2. Busca e consolida as cotações com situacao = 'APROVADO' do mês
      const resultado = await buscarCotacoesParaFechamento(mesAno);
      setDadosConsolidados(resultado);

      // Inicializa a expansão das top 3 empresas por padrão
      const expand: Record<string, boolean> = {};
      resultado.empresas.slice(0, 3).forEach(emp => {
        expand[emp.empresa] = true;
      });
      setEmpresasExpandidas(expand);
    } catch (err: any) {
      console.error("Erro ao carregar dados para fechamento:", err);
      setErrorMsg("Erro ao processar as cotações do mês: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Carrega a lista completa de fechamentos passados
  const carregarHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const list = await fetchFechamentosMensaisDb();
      setHistoricoFechamentos(list);
    } catch (e) {
      console.warn("Erro ao buscar histórico:", e);
    } finally {
      setLoadingHistorico(false);
    }
  };

  // 2. Gravação no Supabase via UPSERT
  const handleSalvarNoBanco = async () => {
    if (!dadosConsolidados) return;

    setSaving(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);

    const usuarioResponsavel = currentUser || sessionStorage.getItem('usuario_logado') || 'ADMINISTRADOR';

    const resumoJson: FechamentoMensalResumoJson = {
      empresas: dadosConsolidados.empresas,
      geral: {
        mes_ano: dadosConsolidados.mesAno,
        mes_ano_formatado: dadosConsolidados.mesAnoFormatado,
        total_geral: dadosConsolidados.totalGeral,
        total_empresas: dadosConsolidados.totalEmpresas,
        total_cotacoes: dadosConsolidados.totalCotacoes,
        ticket_medio: dadosConsolidados.ticketMedio,
        fechado_em: new Date().toISOString(),
        fechado_por: usuarioResponsavel
      }
    };

    try {
      const resp = await salvarFechamentoMensalDb({
        mes_ano: dadosConsolidados.mesAno,
        total_geral: dadosConsolidados.totalGeral,
        total_empresas: dadosConsolidados.totalEmpresas,
        resumo_json: resumoJson,
        fechado_por: usuarioResponsavel
      });

      if (resp.success) {
        setSaveSuccessMsg(`Fechamento de ${dadosConsolidados.mesAnoFormatado} salvo com sucesso no banco de dados Supabase!`);
        // Atualiza o estado de fechamento salvo
        setFechamentoSalvo({
          mes_ano: dadosConsolidados.mesAno,
          total_geral: dadosConsolidados.totalGeral,
          total_empresas: dadosConsolidados.totalEmpresas,
          total_cotacoes: dadosConsolidados.totalCotacoes,
          fechado_por: usuarioResponsavel,
          fechado_em: new Date().toISOString(),
          resumo_json: resumoJson
        });
        carregarHistorico();
      } else {
        setErrorMsg("Não foi possível salvar no banco: " + (resp.error || "Erro desconhecido"));
      }
    } catch (err: any) {
      setErrorMsg("Erro ao salvar fechamento: " + (err?.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Alternar expansão de empresa individual
  const toggleExpansaoEmpresa = (nomeEmpresa: string) => {
    setEmpresasExpandidas(prev => ({
      ...prev,
      [nomeEmpresa]: !prev[nomeEmpresa]
    }));
  };

  const expandirTodas = (expand: boolean) => {
    if (!dadosConsolidados) return;
    const mapa: Record<string, boolean> = {};
    dadosConsolidados.empresas.forEach(emp => {
      mapa[emp.empresa] = expand;
    });
    setEmpresasExpandidas(mapa);
  };

  // Filtragem de empresas por texto de busca
  const empresasFiltradas = useMemo(() => {
    if (!dadosConsolidados) return [];
    if (!searchQuery.trim()) return dadosConsolidados.empresas;

    const q = searchQuery.toLowerCase().trim();
    return dadosConsolidados.empresas.filter(emp => {
      if (emp.empresa.toLowerCase().includes(q)) return true;
      return emp.cotacoes.some(cot => 
        cot.numero.toLowerCase().includes(q) ||
        (cot.contato && cot.contato.toLowerCase().includes(q)) ||
        (cot.observacoes && cot.observacoes.toLowerCase().includes(q))
      );
    });
  }, [dadosConsolidados, searchQuery]);

  // Função para acionar impressão A4 / PDF
  const handleImprimir = () => {
    document.body.classList.add('print-fechamento');
    const onAfterPrint = () => {
      document.body.classList.remove('print-fechamento');
      window.removeEventListener('afterprint', onAfterPrint);
    };
    window.addEventListener('afterprint', onAfterPrint);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Exportar resumo em formato JSON
  const handleExportarJson = () => {
    if (!dadosConsolidados) return;
    const payload = {
      titulo: `Fechamento Mensal - ${dadosConsolidados.mesAnoFormatado}`,
      geradoEm: new Date().toISOString(),
      geradoPor: currentUser || 'ADMINISTRADOR',
      ...dadosConsolidados
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fechamento-mensal-${dadosConsolidados.mesAno}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Exportar dados em formato CSV para Excel
  const handleExportarCsv = () => {
    if (!dadosConsolidados) return;
    let csv = "Empresa;Cotação;Data;Contato;Telefone;Situação;Valor (R$);Observações\n";
    dadosConsolidados.empresas.forEach(emp => {
      emp.cotacoes.forEach(cot => {
        const linha = [
          `"${emp.empresa.replace(/"/g, '""')}"`,
          `"${cot.numero}"`,
          `"${cot.data}"`,
          `"${(cot.contato || '').replace(/"/g, '""')}"`,
          `"${(cot.telefone || '').replace(/"/g, '""')}"`,
          `"${cot.situacao}"`,
          cot.valor_total.toFixed(2).replace('.', ','),
          `"${(cot.observacoes || '').replace(/"/g, '""')}"`
        ].join(';');
        csv += linha + "\n";
      });
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fechamento-mensal-${dadosConsolidados.mesAno}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sqlCreateTableScript = `-- Script de Criação da Tabela no Supabase SQL Editor
CREATE TABLE IF NOT EXISTS fechamentos_mensais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_ano VARCHAR(7) NOT NULL UNIQUE,
  total_geral NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_empresas INTEGER NOT NULL DEFAULT 0,
  total_cotacoes INTEGER DEFAULT 0,
  fechado_por VARCHAR(100),
  resumo_json JSONB NOT NULL,
  fechado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita Row Level Security e libera acesso à tabela
ALTER TABLE fechamentos_mensais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total fechamentos_mensais" 
ON fechamentos_mensais FOR ALL USING (true) WITH CHECK (true);`;

  const copiarSql = () => {
    navigator.clipboard.writeText(sqlCreateTableScript);
    setCopiadoSql(true);
    setTimeout(() => setCopiadoSql(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* =========================================================================
          MODAL INTERATIVO (TELA DE USUÁRIO)
          ========================================================================= */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto no-print">
        <div 
          className="bg-slate-900 border border-slate-700 w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          role="dialog"
          aria-modal="true"
        >
          {/* HEADER PRINCIPAL */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base md:text-lg font-black text-white tracking-tight">
                    Fechamento Mensal no Supabase
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Histórico & Consolidação
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Consolidação automática de cotações com situação <span className="text-emerald-400 font-bold">APROVADO</span> e gravação com UPSERT
                </p>
              </div>
            </div>

            {/* Ações rápidas do Header */}
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* BANNER DE DISPARO AUTOMÁTICO DO DIA 1º */}
          {isAutoOpenDia1 && (
            <div className="bg-gradient-to-r from-blue-900/60 via-indigo-900/50 to-blue-900/60 border-b border-blue-500/40 px-6 py-3 flex items-center justify-between gap-3 text-xs text-blue-200">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0 animate-pulse" />
                <span>
                  <strong className="text-white font-bold">Disparo Automático no Login (1º do Mês):</strong> Hoje é dia 1º! O Fechamento Consolidado do Mês Anterior (<strong className="text-amber-300">{formatarMesAnoLabel(mesAnoSelecionado)}</strong>) foi carregado automaticamente para verificação e gravação.
                </span>
              </div>
              <span className="bg-blue-500/30 border border-blue-400/40 px-2 py-0.5 rounded text-[10px] text-blue-200 font-mono shrink-0">
                Dia de Fechamento Oficial
              </span>
            </div>
          )}

          {/* NAVEGAÇÃO DE ABAS & SELEÇÃO DE MÊS */}
          <div className="bg-slate-950/70 border-b border-slate-800 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('fechamento')}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'fechamento'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-300" />
                <span>📋 Fechamento do Mês</span>
              </button>

              <button
                onClick={() => setActiveTab('historico')}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'historico'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                }`}
              >
                <History className="w-3.5 h-3.5 text-purple-400" />
                <span>📊 Histórico de Fechamentos</span>
                {historicoFechamentos.length > 0 && (
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded-full border border-purple-500/30">
                    {historicoFechamentos.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('sql')}
                className={`px-3 py-1.5 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sql'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span>Tabela Supabase (SQL)</span>
              </button>
            </div>

            {/* SELETOR DE MÊS / ANO */}
            {activeTab === 'fechamento' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">Mês de Referência:</span>
                <select
                  value={mesAnoSelecionado}
                  onChange={(e) => setMesAnoSelecionado(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {opcoesMeses.map(op => (
                    <option key={op.valor} value={op.valor}>
                      {op.label}
                    </option>
                  ))}
                </select>

                <input
                  type="month"
                  value={mesAnoSelecionado}
                  onChange={(e) => {
                    if (e.target.value) setMesAnoSelecionado(e.target.value);
                  }}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  title="Selecionar qualquer mês específico"
                />

                <button
                  onClick={() => carregarDadosDoMes(mesAnoSelecionado)}
                  disabled={loading}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-lg border border-slate-700 text-xs flex items-center gap-1 transition-colors"
                  title="Recarregar cotações do mês"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
                </button>
              </div>
            )}
          </div>

          {/* MENSAGENS DE SUCESSO / ERRO */}
          {saveSuccessMsg && (
            <div className="bg-emerald-950/80 border-b border-emerald-800/80 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
              <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200 text-xs">
                ✕
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-950/80 border-b border-red-800/80 px-6 py-2.5 flex items-center justify-between text-xs text-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200 text-xs">
                ✕
              </button>
            </div>
          )}

          {/* =========================================================================
              ABA 1: FECHAMENTO CONSOLIDADO DO MÊS SELECIONADO
              ========================================================================= */}
          {activeTab === 'fechamento' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Barra de Status do Fechamento e Ações Principais */}
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Resumo Consolidado — {formatarMesAnoLabel(mesAnoSelecionado)}
                    </h3>
                    {fechamentoSalvo ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Salvo no Supabase
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        ⚡ Não Gravado no Banco (Cálculo em Tempo Real)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {fechamentoSalvo ? (
                      <>
                        Último fechamento gravado em <strong className="text-slate-300">{new Date(fechamentoSalvo.fechado_em || fechamentoSalvo.created_at || '').toLocaleString('pt-BR')}</strong> por <strong className="text-slate-300">{fechamentoSalvo.fechado_por || 'ADMIN'}</strong>
                      </>
                    ) : (
                      <>Clique em "Salvar Fechamento no Banco" para registrar oficialmente o mês na tabela <code className="text-blue-300 font-mono">fechamentos_mensais</code></>
                    )}
                  </p>
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleSalvarNoBanco}
                    disabled={saving || loading || !dadosConsolidados || dadosConsolidados.totalCotacoes === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer transition-all"
                    title="Faz o UPSERT na tabela fechamentos_mensais com os totais e resumo JSON"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Gravando no Banco...' : fechamentoSalvo ? 'Atualizar no Banco (UPSERT)' : 'Salvar Fechamento no Banco'}</span>
                  </button>

                  <button
                    onClick={handleImprimir}
                    disabled={loading || !dadosConsolidados || dadosConsolidados.totalCotacoes === 0}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir A4 / PDF</span>
                  </button>

                  <button
                    onClick={handleExportarCsv}
                    disabled={loading || !dadosConsolidados || dadosConsolidados.totalCotacoes === 0}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Exportar dados para planilha Excel (CSV)"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Excel</span>
                  </button>

                  <button
                    onClick={handleExportarJson}
                    disabled={loading || !dadosConsolidados}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Exportar payload completo em JSON"
                  >
                    <Download className="w-4 h-4 text-blue-400" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>

              {/* CARDS DE MÉTRICAS CONSOLIDADAS */}
              {dadosConsolidados && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Geral */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Geral Aprovado</span>
                      <span className="text-lg md:text-xl font-black text-emerald-400 font-mono">
                        {brl(dadosConsolidados.totalGeral)}
                      </span>
                    </div>
                  </div>

                  {/* Total de Empresas */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                      <Building className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Empresas Atendidas</span>
                      <span className="text-lg md:text-xl font-black text-white font-mono">
                        {dadosConsolidados.totalEmpresas}
                      </span>
                    </div>
                  </div>

                  {/* Total de Cotações Aprovadas */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cotações Aprovadas</span>
                      <span className="text-lg md:text-xl font-black text-purple-300 font-mono">
                        {dadosConsolidados.totalCotacoes}
                      </span>
                    </div>
                  </div>

                  {/* Ticket Médio */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ticket Médio p/ Cotação</span>
                      <span className="text-lg md:text-xl font-black text-amber-300 font-mono">
                        {brl(dadosConsolidados.ticketMedio)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* LISTA DETALHADA POR EMPRESA */}
              <div className="bg-slate-850 border border-slate-800 rounded-xl overflow-hidden">
                {/* Barra de controle da lista */}
                <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/80 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Detalhamento por Empresa ({empresasFiltradas.length} empresas)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Filtrar empresa ou cotação..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg pl-8 pr-3 py-1.5 w-48 sm:w-64 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="text-slate-400 hover:text-white absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => expandirTodas(true)}
                      className="text-xs text-slate-300 hover:text-white bg-slate-900 px-2.5 py-1.5 rounded border border-slate-700"
                      title="Expandir todas as empresas"
                    >
                      Expandir Todas
                    </button>
                    <button
                      onClick={() => expandirTodas(false)}
                      className="text-xs text-slate-300 hover:text-white bg-slate-900 px-2.5 py-1.5 rounded border border-slate-700"
                      title="Recolher todas as empresas"
                    >
                      Recolher
                    </button>
                  </div>
                </div>

                {/* Conteúdo da lista */}
                {loading ? (
                  <div className="py-16 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-400" />
                    Consultando cotações com 'situacao' = 'APROVADO' no Supabase...
                  </div>
                ) : !dadosConsolidados || dadosConsolidados.empresas.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="font-semibold text-slate-300">Nenhuma cotação com situação 'APROVADO' encontrada para {formatarMesAnoLabel(mesAnoSelecionado)}.</p>
                    <p className="text-[11px] text-slate-500 mt-1">Selecione outro mês de referência no topo ou certifique-se de que as cotações foram aprovadas no período.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {empresasFiltradas.map((emp, idx) => {
                      const isExpandida = !!empresasExpandidas[emp.empresa];
                      return (
                        <div key={emp.empresa} className="bg-slate-900/50 hover:bg-slate-800/30 transition-colors">
                          {/* Linha Cabeçalho da Empresa */}
                          <div 
                            onClick={() => toggleExpansaoEmpresa(emp.empresa)}
                            className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-slate-500 font-mono text-xs w-6 text-right shrink-0">
                                #{idx + 1}
                              </span>
                              <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 font-bold text-xs">
                                {emp.empresa.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs md:text-sm font-bold text-white truncate">
                                  {emp.empresa}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                  <span>{emp.quantidadeCotacoes} {emp.quantidadeCotacoes === 1 ? 'cotação aprovada' : 'cotações aprovadas'}</span>
                                  <span>•</span>
                                  <span className="text-slate-400">{emp.percentualDoTotal || 0}% do total do mês</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0">
                              <span className="text-sm md:text-base font-black text-emerald-400 font-mono">
                                {brl(emp.total)}
                              </span>
                              <div className="text-slate-400">
                                {isExpandida ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </div>
                            </div>
                          </div>

                          {/* Lista interna de Cotações da Empresa */}
                          {isExpandida && (
                            <div className="bg-slate-950/60 border-t border-slate-800 px-4 py-3">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="text-slate-400 border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider">
                                      <th className="py-2 px-2">Cotação Nº</th>
                                      <th className="py-2 px-2">Data</th>
                                      <th className="py-2 px-2">Contato / Tel</th>
                                      <th className="py-2 px-2">Observações</th>
                                      <th className="py-2 px-2">Situação</th>
                                      <th className="py-2 px-2 text-right">Valor Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/60 font-mono">
                                    {emp.cotacoes.map((cot) => (
                                      <tr key={cot.id} className="hover:bg-slate-900/60">
                                        <td className="py-2 px-2 font-bold text-blue-400">
                                          {cot.numero}
                                        </td>
                                        <td className="py-2 px-2 text-slate-300">
                                          {cot.data}
                                        </td>
                                        <td className="py-2 px-2 text-slate-400 font-sans">
                                          {cot.contato || cot.telefone || '—'}
                                        </td>
                                        <td className="py-2 px-2 text-slate-400 max-w-xs truncate font-sans" title={cot.observacoes}>
                                          {cot.observacoes || '—'}
                                        </td>
                                        <td className="py-2 px-2 font-sans">
                                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                            {cot.situacao || 'APROVADO'}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2 text-right font-black text-emerald-400">
                                          {brl(cot.valor_total)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              ABA 2: HISTÓRICO DE FECHAMENTOS (SUPABASE)
              ========================================================================= */}
          {activeTab === 'historico' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Histórico de Fechamentos Salvos no Supabase
                  </h3>
                  <p className="text-xs text-slate-400">
                    Registro permanente da tabela <code className="text-purple-300 font-mono">fechamentos_mensais</code>
                  </p>
                </div>

                <button
                  onClick={carregarHistorico}
                  disabled={loadingHistorico}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistorico ? 'animate-spin text-purple-400' : ''}`} />
                  <span>Recarregar Histórico</span>
                </button>
              </div>

              {loadingHistorico ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-purple-400" />
                  Carregando histórico do Supabase...
                </div>
              ) : historicoFechamentos.length === 0 ? (
                <div className="bg-slate-850 border border-slate-800 rounded-xl p-12 text-center text-slate-400 text-xs">
                  <History className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <p className="font-semibold text-slate-300">Nenhum fechamento registrado no banco de dados ainda.</p>
                  <p className="text-slate-500 mt-1">Acesse a aba "Fechamento do Mês" e clique no botão "Salvar Fechamento no Banco" para registrar o primeiro mês.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {historicoFechamentos.map((item) => (
                    <div 
                      key={item.mes_ano}
                      className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-purple-500/50 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-black text-white">
                            {formatarMesAnoLabel(item.mes_ano)}
                          </span>
                          <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
                            {item.mes_ano}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Fechado por: <span className="text-slate-300">{item.fechado_por || 'ADMIN'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Data: {item.fechado_em ? new Date(item.fechado_em).toLocaleString('pt-BR') : '—'}
                        </div>
                      </div>

                      <div className="bg-slate-900/80 rounded-lg p-2.5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Total Geral</span>
                          <span className="text-base font-black text-emerald-400 font-mono">
                            {brl(item.total_geral)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase">Empresas</span>
                          <span className="text-xs font-bold text-slate-200">
                            {item.total_empresas} ({item.total_cotacoes || item.resumo_json?.geral?.total_cotacoes || 0} cotações)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-700/60">
                        <button
                          onClick={() => {
                            setMesAnoSelecionado(item.mes_ano);
                            setActiveTab('fechamento');
                          }}
                          className="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold py-1.5 rounded-lg text-center transition-colors cursor-pointer"
                        >
                          Visualizar Detalhes
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              ABA 3: SCRIPT SQL SUPABASE
              ========================================================================= */}
          {activeTab === 'sql' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-bold text-white mb-1">
                  Estrutura da Tabela no Supabase: <code className="text-blue-400">fechamentos_mensais</code>
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  Caso a tabela ainda não tenha sido criada no projeto Supabase, acesse o painel do Supabase &gt; SQL Editor, cole o script abaixo e clique em <strong>Run</strong>:
                </p>

                <div className="relative">
                  <pre className="bg-slate-950 p-4 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto border border-slate-800 leading-relaxed">
                    {sqlCreateTableScript}
                  </pre>
                  <button
                    onClick={copiarSql}
                    className="absolute top-3 right-3 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 border border-slate-600"
                  >
                    {copiadoSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiadoSql ? 'Copiado!' : 'Copiar Script SQL'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FOOTER DO MODAL */}
          <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
            <div>
              <span>Operador conectado: </span>
              <strong className="text-white">{currentUser || sessionStorage.getItem('usuario_logado') || 'ADMINISTRADOR'}</strong>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs px-4 py-2 rounded-xl border border-slate-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          VIEW DE IMPRESSÃO A4 (EXIBIDA SOMENTE EM WINDOW.PRINT)
          ========================================================================= */}
      <div className="secao-fechamento-print bg-white text-black p-8 max-w-4xl mx-auto">
        {/* CABEÇALHO DA EMPRESA */}
        <CompanyHeader 
          documentType="RELATÓRIO DE FECHAMENTO MENSAL" 
          documentNumber={`FECH-${mesAnoSelecionado}`}
          documentDate={new Date().toLocaleDateString('pt-BR')}
          compact={false}
          tag="OFICIAL"
          tagColor="blue"
        />

        {/* TÍTULO DO RELATÓRIO */}
        <div className="text-center my-6 border-b-2 border-black pb-3">
          <h1 className="text-xl font-black uppercase tracking-wider">
            Fechamento de Cotações Aprovadas — {formatarMesAnoLabel(mesAnoSelecionado)}
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Emitido em {new Date().toLocaleString('pt-BR')} por {currentUser || 'ADMINISTRADOR'} • Base: Tabela Cotacoes (Supabase)
          </p>
        </div>

        {/* RESUMO EXECUTIVO */}
        {dadosConsolidados && (
          <div className="grid grid-cols-4 gap-3 my-4 border border-black p-3 text-center bg-gray-50">
            <div>
              <span className="text-[10px] text-gray-600 uppercase font-bold block">Total Geral Faturado</span>
              <span className="text-base font-black text-black font-mono">{brl(dadosConsolidados.totalGeral)}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-600 uppercase font-bold block">Empresas Atendidas</span>
              <span className="text-base font-bold text-black font-mono">{dadosConsolidados.totalEmpresas}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-600 uppercase font-bold block">Cotações Aprovadas</span>
              <span className="text-base font-bold text-black font-mono">{dadosConsolidados.totalCotacoes}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-600 uppercase font-bold block">Ticket Médio</span>
              <span className="text-base font-bold text-black font-mono">{brl(dadosConsolidados.ticketMedio)}</span>
            </div>
          </div>
        )}

        {/* DETALHAMENTO DE EMPRESAS E COTAÇÕES */}
        <div className="mt-6">
          <h2 className="text-xs font-black uppercase border-b border-black pb-1 mb-3">
            Detalhamento por Empresa & Cotações Aprovadas
          </h2>

          {dadosConsolidados?.empresas.map((emp, index) => (
            <div key={emp.empresa} className="mb-4 break-inside-avoid">
              <div className="bg-gray-200 px-3 py-1.5 flex items-center justify-between font-bold text-xs border border-gray-400">
                <span>#{index + 1} — {emp.empresa} ({emp.quantidadeCotacoes} cotações)</span>
                <span className="font-mono font-black">{brl(emp.total)}</span>
              </div>
              <table className="w-full text-[10px] border-collapse border border-gray-300 mt-1">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="border border-gray-300 p-1 text-left">Nº Cotação</th>
                    <th className="border border-gray-300 p-1 text-left">Data</th>
                    <th className="border border-gray-300 p-1 text-left">Contato</th>
                    <th className="border border-gray-300 p-1 text-left">Observações</th>
                    <th className="border border-gray-300 p-1 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {emp.cotacoes.map((c) => (
                    <tr key={c.id}>
                      <td className="border border-gray-300 p-1 font-mono font-bold">{c.numero}</td>
                      <td className="border border-gray-300 p-1 font-mono">{c.data}</td>
                      <td className="border border-gray-300 p-1">{c.contato || '—'}</td>
                      <td className="border border-gray-300 p-1 text-gray-600 truncate max-w-xs">{c.observacoes || '—'}</td>
                      <td className="border border-gray-300 p-1 text-right font-mono font-bold">{brl(c.valor_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* ASSINATURAS */}
        <div className="mt-12 pt-8 border-t border-gray-400 grid grid-cols-2 gap-8 text-center text-xs break-inside-avoid">
          <div>
            <div className="border-t border-black w-3/4 mx-auto mb-1"></div>
            <p className="font-bold">Responsável Financeiro</p>
            <p className="text-[10px] text-gray-600">USICORTE METAIS</p>
          </div>
          <div>
            <div className="border-t border-black w-3/4 mx-auto mb-1"></div>
            <p className="font-bold">Diretoria Executiva</p>
            <p className="text-[10px] text-gray-600">Conferido e Homologado</p>
          </div>
        </div>
      </div>
    </>
  );
}
