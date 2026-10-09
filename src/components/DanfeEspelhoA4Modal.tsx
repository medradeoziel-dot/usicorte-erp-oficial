import React, { useEffect, useState, useMemo } from 'react';
import { Quote, Client } from '../types';
import { CompanyFiscalData, DEFAULT_COMPANY_DATA, getLocalCompanyData } from '../services/companyService';
import DanfeEspelhoA4 from './DanfeEspelhoA4';
import { 
  abrirDanfeEmNovaAba, 
  abrirPreDanfeEmNovaAba,
  DuplicataDanfe,
  ClienteDanfeDestinatario,
  fetchClienteCompletoParaDanfe,
  gerarDuplicatasProporcionais,
  detectarFormaPagamentoInicial,
  buscarInscricaoEstadual
} from '../services/nfeService';
import { formatCurrency, formatSafeDate } from '../utils/calculator';
import { 
  X, 
  Printer, 
  ExternalLink, 
  Send, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  CreditCard,
  Banknote,
  Calendar,
  Layers,
  RefreshCw,
  Sliders,
  Check,
  Building,
  UserCheck
} from 'lucide-react';

interface DanfeEspelhoA4ModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quote;
  client?: Client | null;
  company?: CompanyFiscalData;
  isPrevia?: boolean;
  onTransmit?: () => void;
  isTransmitting?: boolean;
}

export default function DanfeEspelhoA4Modal({
  isOpen,
  onClose,
  quote,
  client,
  company: initialCompany,
  isPrevia: isPreviaProp,
  onTransmit,
  isTransmitting = false
}: DanfeEspelhoA4ModalProps) {
  const [company, setCompany] = useState<CompanyFiscalData>(initialCompany || getLocalCompanyData());
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isOpeningTab, setIsOpeningTab] = useState<boolean>(false);

  // 1. CORREÇÃO DEFINITIVA DA BUSCA DO CLIENTE (SUPABASE)
  const [clienteDestinatario, setClienteDestinatario] = useState<ClienteDanfeDestinatario | null>(null);
  const [carregandoCliente, setCarregandoCliente] = useState<boolean>(true);

  // 2. REGRA DE FORMA DE PAGAMENTO E FATURA / DUPLICATAS
  const [formaPagamento, setFormaPagamento] = useState<'A_VISTA' | 'A_PRAZO'>(() => {
    return detectarFormaPagamentoInicial(quote);
  });
  const [numeroParcelas, setNumeroParcelas] = useState<number>(() => {
    return detectarFormaPagamentoInicial(quote) === 'A_PRAZO' ? 2 : 1;
  });
  const [diasIntervalo, setDiasIntervalo] = useState<number>(30);
  const [duplicatas, setDuplicatas] = useState<DuplicataDanfe[]>([]);
  const [showConfigDuplicatas, setShowConfigDuplicatas] = useState<boolean>(() => {
    return detectarFormaPagamentoInicial(quote) === 'A_PRAZO';
  });

  const valorTotalNota = useMemo(() => {
    return quote?.grandTotal || quote?.subtotalTotal || quote?.items?.reduce((acc, it) => acc + (it.subtotal || (it.unitPrice || 0) * (it.quantity || 1)), 0) || 0;
  }, [quote]);

  const numeroNfe = useMemo(() => {
    return quote?.nfe_numero || String((company.ultimo_numero_nfe || 0) + 1).padStart(6, '0');
  }, [quote, company]);

  // Carrega os dados oficiais da empresa emitente
  useEffect(() => {
    if (initialCompany) {
      setCompany(initialCompany);
    } else {
      setCompany(getLocalCompanyData());
    }
  }, [initialCompany, isOpen]);

  // 1. Busca Completa do Cliente no Supabase usando cliente_id ou nome
  useEffect(() => {
    if (!isOpen || !quote) return;
    let isMounted = true;
    setCarregandoCliente(true);

    async function carregarCliente() {
      try {
        const cli = await fetchClienteCompletoParaDanfe(quote, client);
        if (isMounted) {
          setClienteDestinatario(cli);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados completos do cliente para DANFE:', err);
      } finally {
        if (isMounted) {
          setCarregandoCliente(false);
        }
      }
    }

    carregarCliente();
    return () => { isMounted = false; };
  }, [isOpen, quote, client]);

  // Inicializa a forma de pagamento e duplicatas conforme a cotação recebida
  useEffect(() => {
    if (!quote) return;
    const fpInicial = detectarFormaPagamentoInicial(quote);
    setFormaPagamento(fpInicial);

    if (fpInicial === 'A_PRAZO') {
      const dups = gerarDuplicatasProporcionais(valorTotalNota, numeroParcelas, numeroNfe, diasIntervalo);
      setDuplicatas(dups);
      setShowConfigDuplicatas(true);
    } else {
      setDuplicatas([]);
      setShowConfigDuplicatas(false);
    }
  }, [quote, valorTotalNota, numeroNfe]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recalcula parcelas ao alterar número de parcelas ou intervalo quando em modo A_PRAZO
  const handleRecalcularProporcional = (qtdParcelas: number = numeroParcelas, intervalo: number = diasIntervalo) => {
    const dups = gerarDuplicatasProporcionais(valorTotalNota, qtdParcelas, numeroNfe, intervalo);
    setDuplicatas(dups);
  };

  // Alteração de modo de pagamento: À Vista vs A Prazo
  const handleSelectModoPagamento = (novoModo: 'A_VISTA' | 'A_PRAZO') => {
    setFormaPagamento(novoModo);
    if (novoModo === 'A_VISTA') {
      // Regra A: À vista => quadro FATURA / DUPLICATAS vazio
      setDuplicatas([]);
      setShowConfigDuplicatas(false);
    } else {
      // Regra B: A prazo => gera e exibe duplicatas proporcionais
      const qtd = Math.max(1, numeroParcelas || 1);
      const dups = gerarDuplicatasProporcionais(valorTotalNota, qtd, numeroNfe, diasIntervalo);
      setDuplicatas(dups);
      setShowConfigDuplicatas(true);
    }
  };

  // Atualização inline de vencimento e valor da parcela
  const handleUpdateVencimento = (index: number, novoVencimento: string) => {
    setDuplicatas(prev => prev.map((dup, idx) => idx === index ? { ...dup, vencimento: novoVencimento } : dup));
  };

  const handleUpdateValor = (index: number, novoValor: number) => {
    setDuplicatas(prev => prev.map((dup, idx) => idx === index ? { ...dup, valor: Math.max(0, novoValor || 0) } : dup));
  };

  // Ajusta automaticamente a diferença de centavos na 1ª parcela
  const handleAjustarDiferencaNaPrimeira = () => {
    const somaAtual = duplicatas.reduce((acc, d) => acc + (d.valor || 0), 0);
    const diferenca = Number((valorTotalNota - somaAtual).toFixed(2));
    if (diferenca !== 0 && duplicatas.length > 0) {
      setDuplicatas(prev => prev.map((dup, idx) => {
        if (idx === 0) {
          return { ...dup, valor: Number((dup.valor + diferenca).toFixed(2)) };
        }
        return dup;
      }));
    }
  };

  // Soma atual das duplicatas
  const somaDuplicatas = useMemo(() => {
    return Number(duplicatas.reduce((acc, d) => acc + (d.valor || 0), 0).toFixed(2));
  }, [duplicatas]);

  const diferencaDuplicatas = Number((valorTotalNota - somaDuplicatas).toFixed(2));

  if (!isOpen || !quote) return null;

  const isPrevia = isPreviaProp !== undefined ? isPreviaProp : (quote.status_nfe !== 'Emitida');

  const handlePrint = () => {
    setIsPrinting(true);
    document.body.classList.add('print-danfe');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('print-danfe');
        setIsPrinting(false);
      }, 500);
    }, 150);
  };

  const handleOpenNewTab = async () => {
    setIsOpeningTab(true);
    try {
      const isAVista = formaPagamento === 'A_VISTA';
      if (isPrevia) {
        await abrirPreDanfeEmNovaAba(quote, client, duplicatas, isAVista);
      } else {
        await abrirDanfeEmNovaAba(quote, client, duplicatas, isAVista);
      }
    } finally {
      setIsOpeningTab(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border-b border-slate-700 flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${isPrevia ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-base">
                  {isPrevia ? 'Pré-Visualização da DANFE (Espelho Fiscal Modelo 55)' : 'DANFE Oficial - Modelo 55'}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${isPrevia ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'}`}>
                  {isPrevia ? 'PRÉVIA / CONFERÊNCIA' : 'EMITIDA'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isPrevia 
                  ? 'Verifique os dados tributários e do destinatário antes da transmissão definitiva' 
                  : `Documento Auxiliar da NF-e nº ${quote.nfe_numero || '—'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Imprimir documento em formato A4"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleOpenNewTab}
              disabled={isOpeningTab}
              className="px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Abrir DANFE em uma nova aba"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{isOpeningTab ? 'Abrindo...' : 'Nova Aba'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1. Barra de Confirmação do Destinatário Real Carregado do Supabase */}
        <div className="px-5 py-2 bg-slate-950/80 border-b border-slate-800 text-xs flex items-center justify-between flex-wrap gap-2 text-slate-300 shrink-0 no-print">
          <div className="flex items-center gap-2 min-w-0">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-slate-400">Destinatário Fiscal:</span>
            {carregandoCliente ? (
              <span className="text-amber-400 italic text-[11px]">Buscando dados cadastrais no Supabase...</span>
            ) : (() => {
              const ieCli = buscarInscricaoEstadual(clienteDestinatario) !== 'ISENTO'
                ? buscarInscricaoEstadual(clienteDestinatario)
                : buscarInscricaoEstadual(client);
              return (
                <span className="font-bold text-slate-100 truncate">
                  {clienteDestinatario?.nome || quote.cliente_nome || quote.clientName}
                  <span className="text-slate-400 font-normal font-mono ml-2 text-[11px]">
                    CNPJ/CPF: {clienteDestinatario?.doc || quote.clientDocument || 'NÃO INFORMADO'}
                  </span>
                  <span className="text-slate-400 font-normal font-mono ml-2 text-[11px]">
                    IE: {ieCli}
                  </span>
                  <span className="text-slate-400 font-normal ml-2 text-[11px]">
                    • {clienteDestinatario?.cidade || quote.clientCity || 'BAURU'}/{clienteDestinatario?.uf || quote.clientState || 'SP'}
                  </span>
                </span>
              );
            })()}
          </div>
          <div className="text-[11px] font-mono font-bold text-slate-200">
            Total da Nota: <span className="text-emerald-400">{formatCurrency(valorTotalNota)}</span>
          </div>
        </div>

        {/* 2. PAINEL DE GESTÃO DE FORMA DE PAGAMENTO & DUPLICATAS (NOVO) */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800 shrink-0 no-print space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-200">Forma de Pagamento (Fatura / Duplicatas):</span>
            </div>

            {/* Alternador de Modo de Pagamento: À VISTA vs A PRAZO */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
              <button
                type="button"
                onClick={() => handleSelectModoPagamento('A_VISTA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  formaPagamento === 'A_VISTA'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>À Vista (PDV / PIX / Dinheiro / Débito)</span>
                <span className="text-[10px] opacity-80 font-mono">(indPag: 0)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectModoPagamento('A_PRAZO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  formaPagamento === 'A_PRAZO'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>A Prazo / Duplicata (Boleto / Faturado)</span>
                <span className="text-[10px] opacity-80 font-mono">(indPag: 1)</span>
              </button>
            </div>
          </div>

          {/* Sub-painel expansível: Configurar Duplicatas */}
          {formaPagamento === 'A_PRAZO' && (
            <div className="p-3 bg-slate-950/80 rounded-xl border border-purple-500/30 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <label className="text-slate-400 text-xs font-medium">Nº de Parcelas:</label>
                    <select
                      value={numeroParcelas}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        setNumeroParcelas(val);
                        handleRecalcularProporcional(val, diasIntervalo);
                      }}
                      className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs font-bold focus:outline-hidden focus:border-purple-500"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                        <option key={n} value={n}>{n}x {n === 1 ? 'Parcela Única' : 'Parcelas'}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="text-slate-400 text-xs font-medium">Intervalo:</label>
                    <select
                      value={diasIntervalo}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 30;
                        setDiasIntervalo(val);
                        handleRecalcularProporcional(numeroParcelas, val);
                      }}
                      className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs font-bold focus:outline-hidden focus:border-purple-500"
                    >
                      <option value={15}>A cada 15 dias</option>
                      <option value={28}>A cada 28 dias</option>
                      <option value={30}>A cada 30 dias (Padrão)</option>
                      <option value={45}>A cada 45 dias</option>
                      <option value={60}>A cada 60 dias</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRecalcularProporcional(numeroParcelas, diasIntervalo)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    title="Recalcula as parcelas de forma proporcional a partir do valor total"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Dividir Proporcional</span>
                  </button>
                </div>

                {/* Validação de soma das parcelas */}
                <div className="flex items-center gap-2">
                  <div className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border flex items-center gap-1.5 ${
                    Math.abs(diferencaDuplicatas) < 0.01
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                  }`}>
                    {Math.abs(diferencaDuplicatas) < 0.01 ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Soma das parcelas: {formatCurrency(somaDuplicatas)} (Confere com total)</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Soma: {formatCurrency(somaDuplicatas)} (Diferença: {formatCurrency(diferencaDuplicatas)})</span>
                        <button
                          type="button"
                          onClick={handleAjustarDiferencaNaPrimeira}
                          className="ml-1 underline text-[10px] text-amber-200 hover:text-white cursor-pointer font-sans"
                        >
                          Ajustar na 1ª
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid de Inputs de Parcelas / Duplicatas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1 border-t border-slate-800">
                {duplicatas.map((dup, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                      <span className="font-mono text-purple-300">{dup.numero}</span>
                      <span className="text-[10px] text-slate-500">Parcela {idx + 1}/{duplicatas.length}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Vencimento:</label>
                        <input
                          type="date"
                          value={dup.vencimento}
                          onChange={(e) => handleUpdateVencimento(idx, e.target.value)}
                          className="w-full px-2 py-1 bg-slate-950 text-slate-100 border border-slate-700 rounded text-xs font-mono focus:outline-hidden focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Valor (R$):</label>
                        <input
                          type="number"
                          step="0.01"
                          value={dup.valor}
                          onChange={(e) => handleUpdateValor(idx, parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-slate-950 text-slate-100 border border-slate-700 rounded text-xs font-mono font-bold text-emerald-400 focus:outline-hidden focus:border-purple-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {formaPagamento === 'A_VISTA' && (
            <div className="px-3 py-1.5 bg-emerald-950/40 rounded-lg border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Modo À Vista Ativo:</strong> O quadro &quot;FATURA / DUPLICATAS&quot; da DANFE será mantido rigorosamente vazio (sem linha de duplicata ou vencimento), em conformidade com as regras fiscais do modelo 55 (indPag: 0 - Pagamento à vista).
              </span>
            </div>
          )}
        </div>

        {/* Conteúdo com Scroll da Folha A4 */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-950/60 flex justify-center">
          <div id="container-impressao-danfe" className="w-full max-w-[820px]">
            <DanfeEspelhoA4
              quote={quote}
              client={client}
              company={company}
              isPrevia={isPrevia}
              onClose={onClose}
              onTransmitir={onTransmit}
              isTransmitting={isTransmitting}
              formaPagamento={formaPagamento}
              duplicatas={duplicatas}
              clienteDestinatario={clienteDestinatario || undefined}
            />
          </div>
        </div>

        {/* Rodapé de Ações do Modal */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>Imprimir</span>
            </button>

            {isPrevia && onTransmit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTransmit();
                }}
                disabled={isTransmitting}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Confirmar & Transmitir SEFAZ</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
