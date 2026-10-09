import React, { useState, useEffect, useMemo } from 'react';
import { Quote, Client } from '../types';
import { 
  transmitirNfeSefaz, 
  prepararItensFiscais, 
  ItemFiscalNfe,
  NfeTransmissionResult,
  formatarChaveAcesso,
  abrirPreDanfeEmNovaAba,
  montarEnderecoSemDuplicacao,
  buscarInscricaoEstadual
} from '../services/nfeService';
import { updateCotacaoNfeStatusDb } from '../lib/db';
import { fetchCompanyData, CompanyFiscalData, DEFAULT_COMPANY_DATA } from '../services/companyService';
import { formatCurrency } from '../utils/calculator';
import { 
  Building2, 
  User, 
  FileText, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Printer, 
  Download, 
  Loader2, 
  ShieldCheck, 
  BadgePercent,
  Check,
  ExternalLink,
  Info,
  Eye
} from 'lucide-react';

interface EmissaoNfeModalProps {
  quote: Quote;
  client?: Client | null;
  onSuccess: (updatedQuote: Quote) => void;
  onClose: () => void;
}

export default function EmissaoNfeModal({
  quote,
  client,
  onSuccess,
  onClose
}: EmissaoNfeModalProps) {
  const [company, setCompany] = useState<CompanyFiscalData>(DEFAULT_COMPANY_DATA);
  const [loadingCompany, setLoadingCompany] = useState<boolean>(true);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [transmissionResult, setTransmissionResult] = useState<NfeTransmissionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPreDanfeModal, setShowPreDanfeModal] = useState<boolean>(false);
  const [openingNewTab, setOpeningNewTab] = useState<boolean>(false);

  const handleOpenPreDanfeNewTab = async () => {
    setOpeningNewTab(true);
    try {
      await abrirPreDanfeEmNovaAba(quote, client);
    } finally {
      setOpeningNewTab(false);
    }
  };

  // 1. Busca os dados oficiais do Emitente (UsiCorte Metais - busca da tabela 'emitente')
  useEffect(() => {
    let isMounted = true;
    async function loadEmitente() {
      try {
        const data = await fetchCompanyData();
        if (isMounted) {
          setCompany(data);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados do emitente:', err);
      } finally {
        if (isMounted) setLoadingCompany(false);
      }
    }
    loadEmitente();
    return () => { isMounted = false; };
  }, []);

  // 2. Dados do Destinatário / Cliente
  const clienteInfo = useMemo(() => {
    const nome = client?.name || client?.nome || quote.clientName || 'Cliente Balcão';
    const doc = client?.document || client?.documento || quote.clientDocument || 'Não informado';
    const ie = buscarInscricaoEstadual(client) !== 'ISENTO' 
      ? buscarInscricaoEstadual(client) 
      : buscarInscricaoEstadual(quote);
    const indicadorIe = client?.indicador_ie || client?.indicadorIe || (doc.replace(/\D/g, '').length > 11 ? '1' : '9');
    const cidade = client?.city || client?.cidade || quote.clientCity || 'BAURU';
    const uf = (client?.state || client?.uf || quote.clientState || 'SP').toUpperCase();
    const endereco = client?.street || client?.endereco || 'Endereço Comercial';

    return { nome, doc, ie, indicadorIe, cidade, uf, endereco };
  }, [client, quote]);

  // 3. Validação de CFOP Automática:
  // Se a UF do cliente for "SP" => cfop_interno (5102)
  // Se a UF for diferente de "SP" => cfop_externo (6102)
  const itensFiscais: ItemFiscalNfe[] = useMemo(() => {
    return prepararItensFiscais(quote.items, clienteInfo.uf);
  }, [quote.items, clienteInfo.uf]);

  const valorTotal = useMemo(() => {
    return quote.grandTotal || quote.subtotalTotal || itensFiscais.reduce((acc, it) => acc + it.subtotal, 0);
  }, [quote, itensFiscais]);

  const isOperacaoInterestadual = clienteInfo.uf !== 'SP';

  const proximoNumeroNfe = useMemo(() => {
    if (quote.nfe_numero) return quote.nfe_numero;
    const ultimo = typeof company.ultimo_numero_nfe === 'number' && !isNaN(company.ultimo_numero_nfe)
      ? company.ultimo_numero_nfe
      : 0;
    return String(ultimo + 1).padStart(6, '0');
  }, [quote.nfe_numero, company.ultimo_numero_nfe]);

  const serieNfe = useMemo(() => {
    return String(quote.serie_nfe || company.serie_nfe || '1');
  }, [quote.serie_nfe, company.serie_nfe]);

  // 4. Confirmar & Transmitir SEFAZ
  const handleTransmitirSefaz = async () => {
    setIsTransmitting(true);
    setErrorMessage(null);

    // 1. Altera o status_nfe para "Processando"
    try {
      await updateCotacaoNfeStatusDb(quote.id || quote.quoteNumber, {
        status_nfe: 'Processando'
      });
      onSuccess({
        ...quote,
        status_nfe: 'Processando'
      });
    } catch (e) {
      console.warn('Aviso ao registrar status Processando:', e);
    }

    try {
      // 2. Envia a solicitação para a API fiscal / SEFAZ
      const res = await transmitirNfeSefaz(quote, client);

      if (res.sucesso && res.statusNfe === 'Emitida') {
        // 3. Sucesso: Grava a nfe_chave, nfe_numero, danfe_url, xml_url e muda o status para "Emitida"
        setTransmissionResult(res);
        const updatedQuote: Quote = {
          ...quote,
          status_nfe: 'Emitida',
          nfe_chave: res.nfeChave,
          nfe_numero: res.nfeNumero,
          danfe_url: res.danfeUrl,
          xml_url: res.xmlUrl,
          mensagem_erro_nfe: undefined,
          nfe_emitida_em: res.dataEmissao
        };
        onSuccess(updatedQuote);
      } else {
        // 4. Rejeição/Erro: Salva o erro em mensagem_erro_nfe e exibe o alerta explicativo na tela
        const msg = res.mensagemErro || 'Rejeição desconhecida pela SEFAZ.';
        setErrorMessage(msg);
        try {
          await updateCotacaoNfeStatusDb(quote.id || quote.quoteNumber, {
            status_nfe: 'Erro',
            mensagem_erro_nfe: msg
          });
        } catch {}
        const errorQuote: Quote = {
          ...quote,
          status_nfe: 'Erro',
          mensagem_erro_nfe: msg
        };
        onSuccess(errorQuote);
      }
    } catch (err: any) {
      const msg = err?.message || 'Falha na comunicação com os servidores da SEFAZ.';
      setErrorMessage(msg);
      try {
        await updateCotacaoNfeStatusDb(quote.id || quote.quoteNumber, {
          status_nfe: 'Erro',
          mensagem_erro_nfe: msg
        });
      } catch {}
      const errorQuote: Quote = {
        ...quote,
        status_nfe: 'Erro',
        mensagem_erro_nfe: msg
      };
      onSuccess(errorQuote);
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleOpenDanfe = () => {
    if (transmissionResult?.danfeUrl) {
      window.open(transmissionResult.danfeUrl, '_blank');
    }
  };

  const handleDownloadXml = () => {
    if (transmissionResult?.xmlUrl) {
      const a = document.createElement('a');
      a.href = transmissionResult.xmlUrl;
      a.download = `NFe-${transmissionResult.nfeChave || 'nfe'}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950/70 border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-base">
                  Revisão Fiscal & Emissão de NF-e
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Cotação {quote.quoteNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Conferência cadastral e tributária antes da transmissão para a SEFAZ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          
          {/* Sucesso Banner */}
          {transmissionResult && transmissionResult.sucesso && (
            <div className="p-4 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-100 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <h4 className="font-bold text-sm text-emerald-200">
                    NF-e Autorizada com Sucesso pela SEFAZ!
                  </h4>
                  <p className="text-xs text-emerald-300/90">
                    Nota Fiscal Eletrônica nº <strong className="text-white font-mono">{transmissionResult.nfeNumero}</strong> emitida e vinculada a esta cotação.
                  </p>
                  <div className="p-2.5 bg-slate-950/70 rounded-lg border border-emerald-500/30 font-mono text-[11px] text-slate-200 break-all select-all mt-2">
                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Chave de Acesso (44 dígitos):</span>
                    {formatarChaveAcesso(transmissionResult.nfeChave || '')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  onClick={handleOpenDanfe}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Visualizar / Imprimir DANFE
                </button>
                <button
                  onClick={handleDownloadXml}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar XML da NF-e
                </button>
              </div>
            </div>
          )}

          {/* Erro Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 flex items-start gap-3 animate-in fade-in duration-200">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-rose-200">Rejeição na Transmissão Fiscal</h4>
                <p className="text-xs text-rose-300 leading-relaxed font-mono">
                  {errorMessage}
                </p>
                <p className="text-[11px] text-rose-400/90 mt-1">
                  Corrija o cadastro do cliente ou do produto e tente transmitir novamente.
                </p>
              </div>
            </div>
          )}

          {/* 1. Cabeçalho: Dados do Emitente e Dados do Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Box Emitente */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  Emitente (UsiCorte Metais)
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  {company.taxRegime || 'Simples Nacional'}
                </span>
              </div>
              <div className="space-y-1 text-slate-300">
                <p className="font-bold text-slate-100">{company.corporateName || company.razao_social || 'L. M. BANZATTO METAIS'}</p>
                <p className="text-[11px] text-slate-400">{company.tradeName || company.nome_fantasia || 'USICORTE METAIS'}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-500 block">CNPJ:</span>
                    <strong className="text-slate-200 font-mono">{company.cnpj || '25.038.430/0001-23'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Inscrição Estadual:</span>
                    <strong className="text-slate-200 font-mono">{company.ie || company.inscricao_estadual || '20963213114'}</strong>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  {montarEnderecoSemDuplicacao(company.street || company.endereco, company.number || company.numero, company.complement || (company as any).complemento, company.neighborhood || company.bairro)} • {company.city || company.cidade}/{company.state || company.uf || 'SP'}
                </p>
              </div>
            </div>

            {/* Box Destinatário / Cliente */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-400" />
                  Destinatário (Cliente)
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  isOperacaoInterestadual 
                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/30' 
                    : 'bg-blue-950/60 text-blue-300 border-blue-500/30'
                }`}>
                  {isOperacaoInterestadual ? 'Operação Interestadual' : 'Operação Interna (SP)'}
                </span>
              </div>
              <div className="space-y-1 text-slate-300">
                <p className="font-bold text-slate-100">{clienteInfo.nome}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-500 block">Documento:</span>
                    <strong className="text-slate-200 font-mono">{clienteInfo.doc}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Inscrição Estadual:</span>
                    <strong className="text-slate-200 font-mono">{clienteInfo.ie || 'ISENTO'}</strong>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400">
                    {clienteInfo.cidade} - <strong className="text-indigo-300">{clienteInfo.uf}</strong>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Indicador IE: <strong className="text-slate-300 font-mono">{clienteInfo.indicadorIe}</strong>
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* 2. Validação Automática de CFOP */}
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                Regra SEFAZ Aplicada: Destinatário em <strong>{clienteInfo.uf}</strong> ➔ CFOP Automático definido para:
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                isOperacaoInterestadual
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {isOperacaoInterestadual ? '6102 (Interestadual)' : '5102 (Dentro de SP)'}
              </span>
            </div>
          </div>

          {/* 3. Tabela de Itens Fiscais */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Itens Fiscais da NF-e ({itensFiscais.length})
              </h4>
              <span className="text-[11px] text-slate-400">
                Tributação: Simples Nacional (CSOSN 102)
              </span>
            </div>

            <div className="rounded-xl border border-slate-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-800 text-slate-300 uppercase font-semibold text-[10px] border-b border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">Item</th>
                      <th className="py-2.5 px-3">Código & Descrição</th>
                      <th className="py-2.5 px-3 text-center">NCM</th>
                      <th className="py-2.5 px-3 text-center">CFOP</th>
                      <th className="py-2.5 px-3 text-center">UN</th>
                      <th className="py-2.5 px-3 text-right">Qtd</th>
                      <th className="py-2.5 px-3 text-right">Unitário</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                    {itensFiscais.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-center font-mono text-slate-500 font-bold">
                          {it.ordem}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-bold text-slate-200 block">{it.descricao}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Cód: {it.codigo}</span>
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-300">
                          {it.ncm}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                            isOperacaoInterestadual ? 'text-amber-400 bg-amber-950/40' : 'text-emerald-400 bg-emerald-950/40'
                          }`}>
                            {it.cfop}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-blue-400">
                          {it.unidade}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-200">
                          {it.quantidade.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-300">
                          {formatCurrency(it.valorUnitario)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                          {formatCurrency(it.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Resumo dos Valores */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between flex-wrap gap-4">
            <div className="text-slate-400 text-xs space-y-0.5">
              <p>• Regime Tributário: <strong className="text-slate-200">Simples Nacional (ME/EPP)</strong></p>
              <p>• Imposto ICMS / IPI destacado: <strong className="text-slate-200">R$ 0,00 (Sem permissão de crédito)</strong></p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                Valor Total da NF-e
              </span>
              <span className="text-xl font-mono font-extrabold text-emerald-400">
                {formatCurrency(valorTotal)}
              </span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isTransmitting}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            {transmissionResult?.sucesso ? 'Fechar' : 'Cancelar'}
          </button>

          <div className="flex items-center gap-2.5">
            {transmissionResult?.sucesso ? (
              <>
                <button
                  type="button"
                  onClick={handleDownloadXml}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Baixar XML
                </button>
                <button
                  type="button"
                  onClick={handleOpenDanfe}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir DANFE
                </button>
              </>
            ) : (
              <>
                {/* BOTÃO DE PRÉ-VISUALIZAÇÃO DA DANFE */}
                <button
                  type="button"
                  onClick={() => setShowPreDanfeModal(true)}
                  disabled={isTransmitting || loadingCompany}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-indigo-300 hover:text-indigo-200 border border-indigo-500/40 hover:border-indigo-400 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Visualizar modelo de conferência (Pré-DANFE) antes de transmitir para a SEFAZ"
                >
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <span>👁️ Pré-visualizar DANFE</span>
                </button>

                {/* BOTÃO DE TRANSMISSÃO PRINCIPAL */}
                <button
                  type="button"
                  onClick={handleTransmitirSefaz}
                  disabled={isTransmitting || loadingCompany}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isTransmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Transmitindo para SEFAZ...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Confirmar & Transmitir SEFAZ</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>

      {/* ========================================================================= */}
      {/* MODAL ESPELHO DE PRÉ-VISUALIZAÇÃO DA DANFE (MODO DE CONFERÊNCIA FISCAL)   */}
      {/* ========================================================================= */}
      {showPreDanfeModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden">
            
            {/* Top Bar da Pré-Visualização */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border-b border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-100 text-base">
                      Pré-Visualização da DANFE (Espelho Fiscal)
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      RASCUNHO / PRÉVIA
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Modo de conferência idêntico ao documento que será gerado pela SEFAZ
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenPreDanfeNewTab}
                  disabled={openingNewTab}
                  className="px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Abrir Pré-DANFE em uma nova aba do navegador para impressão rápida"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{openingNewTab ? 'Abrindo...' : 'Abrir em Nova Aba'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreDanfeModal(false)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Banner de Aviso de Conferência */}
            <div className="px-5 py-2.5 bg-amber-950/80 border-b border-amber-500/40 text-amber-200 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>MODO DE CONFERÊNCIA - NOTA AINDA NÃO TRANSMITIDA PARA A SEFAZ (PRÉVIA - SEM VALOR FISCAL)</span>
              </div>
              <span className="text-[11px] text-amber-300/80 hidden sm:inline">
                Cotação nº {quote.quoteNumber}
              </span>
            </div>

            {/* Corpo Espelho da DANFE (Layout Fiscal em Papel Branco A4) */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-950/60 flex justify-center">
              <div className="bg-white text-black p-6 rounded-lg shadow-xl max-w-4xl w-full text-[11px] font-sans relative border border-slate-300 select-text">
                
                {/* Marca d'água Diagonal Central */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 overflow-hidden">
                  <div className="rotate-[-25deg] border-4 border-dashed border-red-500/30 text-red-500/20 font-black text-3xl sm:text-5xl uppercase tracking-widest p-6 text-center rounded-2xl">
                    PRÉVIA - SEM VALOR FISCAL<br />
                    <span className="text-xl sm:text-2xl font-bold tracking-normal">MODO DE CONFERÊNCIA</span>
                  </div>
                </div>

                {/* 1. Cabeçalho DANFE */}
                <div className="grid grid-cols-12 border border-black mb-1.5">
                  {/* Emitente */}
                  <div className="col-span-6 p-2 border-r border-black flex items-center gap-2.5 overflow-hidden">
                    <div className="flex items-center justify-center shrink-0 w-20 h-12">
                      <img 
                        src="/logo-usicorte.png" 
                        alt="Logo UsiCorte" 
                        className="max-h-12 h-12 w-auto object-contain shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h2 className="font-extrabold text-[11px] leading-tight uppercase text-black truncate">
                        {company.corporateName || company.razao_social || 'L. M. BANZATTO METAIS'}
                      </h2>
                      <h3 className="font-bold text-[9px] text-red-700 leading-snug uppercase mt-0.5 truncate">
                        {company.tradeName || company.nome_fantasia || 'USICORTE METAIS'}
                      </h3>
                      <p className="text-[7.5px] text-gray-700 mt-1 leading-tight truncate">
                        {montarEnderecoSemDuplicacao(company.street || company.endereco, company.number || company.numero, company.complement || (company as any).complemento, company.neighborhood || company.bairro)} • {company.city || company.cidade}/{company.state || company.uf || 'SP'} • CEP: {company.cep || '17031-190'} • Tel: {company.phone || company.telefone || '(14) 3203-2000'} • {company.email || 'contato@usicorte.com.br'}
                      </p>
                    </div>
                  </div>

                  {/* DANFE Box */}
                  <div className="col-span-2 p-2 border-r border-black text-center flex flex-col justify-center">
                    <span className="font-extrabold text-base leading-none">PRÉ-DANFE</span>
                    <span className="text-[8px] leading-tight text-gray-600 mt-0.5">Documento Auxiliar da Nota Fiscal Eletrônica</span>
                    <div className="my-1 text-[9px] font-bold">
                      0 - ENTRADA<br />
                      <strong>1 - SAÍDA [ 1 ]</strong>
                    </div>
                    <span className="font-bold text-[11px]">Nº {quote.nfe_numero || String(quote.quoteNumber || '1').replace(/\D/g, '').slice(-6).padStart(6, '0') || '000001'}</span>
                    <span className="text-[9px]">SÉRIE 1</span>
                  </div>

                  {/* Chave de Acesso / Protocolo */}
                  <div className="col-span-4 p-2 flex flex-col justify-between">
                    <div>
                      <span className="block text-[8px] font-bold uppercase text-gray-500">CHAVE DE ACESSO (SIMULAÇÃO):</span>
                      <span className="font-mono text-[9px] font-bold text-gray-800 break-all">
                        CHAVE SERÁ GERADA APÓS TRANSMISSÃO SEFAZ
                      </span>
                    </div>
                    <div className="text-[9px] text-gray-500 my-1">
                      Documento emitido exclusivamente para prévia e conferência de dados fiscais.
                    </div>
                    <div className="pt-1 border-t border-gray-300">
                      <span className="block text-[8px] font-bold uppercase text-gray-500">PROTOCOLO DE AUTORIZAÇÃO:</span>
                      <span className="font-bold text-[10px] text-amber-800">
                        NÃO TRANSMITIDA (PRÉVIA FISCAL)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Natureza da Operação / Inscrição Estadual / CNPJ */}
                <div className="border border-black mb-1.5 p-1.5 grid grid-cols-12 text-[10px]">
                  <div className="col-span-6">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">NATUREZA DA OPERAÇÃO</span>
                    <strong className="text-[11px]">VENDA DE MERCADORIA (PRÉVIA FISCAL)</strong>
                  </div>
                  <div className="col-span-3 border-l border-black pl-2">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">INSCRIÇÃO ESTADUAL</span>
                    <strong className="font-mono">{company.ie || company.inscricao_estadual || '20963213114'}</strong>
                  </div>
                  <div className="col-span-3 border-l border-black pl-2">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">CNPJ</span>
                    <strong className="font-mono">{company.cnpj || '25.038.430/0001-23'}</strong>
                  </div>
                </div>

                {/* 2. Destinatário / Remetente */}
                <div className="text-[9px] font-bold uppercase mb-0.5 text-gray-700">DESTINATÁRIO / REMETENTE</div>
                <div className="border border-black mb-1.5 p-1.5 space-y-1 text-[10px]">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-7">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">NOME / RAZÃO SOCIAL</span>
                      <strong className="text-[11px]">{clienteInfo.nome}</strong>
                    </div>
                    <div className="col-span-3">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">CNPJ / CPF</span>
                      <strong className="font-mono">{clienteInfo.doc}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">DATA DA EMISSÃO</span>
                      <strong>{new Date().toLocaleDateString('pt-BR')}</strong>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 border-t border-gray-200 pt-1">
                    <div className="col-span-6">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">ENDEREÇO</span>
                      <span>{clienteInfo.endereco}</span>
                    </div>
                    <div className="col-span-3">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">MUNICÍPIO</span>
                      <span>{clienteInfo.cidade}</span>
                    </div>
                    <div className="col-span-1">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">UF</span>
                      <strong>{clienteInfo.uf}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">INSCRIÇÃO ESTADUAL</span>
                      <strong className="font-mono">{clienteInfo.ie}</strong>
                    </div>
                  </div>
                </div>

                {/* 3. Cálculo do Imposto */}
                <div className="text-[9px] font-bold uppercase mb-0.5 text-gray-700">CÁLCULO DO IMPOSTO</div>
                <div className="border border-black mb-1.5 p-1.5 grid grid-cols-6 gap-2 text-center text-[10px]">
                  <div>
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">BASE CÁLC. ICMS</span>
                    <strong>R$ 0,00</strong>
                  </div>
                  <div className="border-l border-gray-300">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">VALOR DO ICMS</span>
                    <strong>R$ 0,00</strong>
                  </div>
                  <div className="border-l border-gray-300">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">BASE CÁLC. ICMS ST</span>
                    <strong>R$ 0,00</strong>
                  </div>
                  <div className="border-l border-gray-300">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">VALOR ICMS ST</span>
                    <strong>R$ 0,00</strong>
                  </div>
                  <div className="border-l border-gray-300">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">TOTAL PRODUTOS</span>
                    <strong>{formatCurrency(valorTotal)}</strong>
                  </div>
                  <div className="border-l border-black bg-gray-50">
                    <span className="block text-[8px] font-bold text-red-700 uppercase">TOTAL DA NOTA</span>
                    <strong className="text-red-700 font-bold">{formatCurrency(valorTotal)}</strong>
                  </div>
                </div>

                {/* 4. Tabela de Produtos / Serviços */}
                <div className="text-[9px] font-bold uppercase mb-0.5 text-gray-700">DADOS DOS PRODUTOS / SERVIÇOS</div>
                <div className="border border-black mb-1.5 overflow-hidden">
                  <table className="w-full text-left border-collapse text-[9px]">
                    <thead className="bg-gray-100 border-b border-black text-center font-bold text-[8px]">
                      <tr>
                        <th className="p-1 border-r border-black w-14">CÓDIGO</th>
                        <th className="p-1 border-r border-black text-left">DESCRIÇÃO DOS PRODUTOS / SERVIÇOS</th>
                        <th className="p-1 border-r border-black w-16">NCM</th>
                        <th className="p-1 border-r border-black w-12">CSOSN</th>
                        <th className="p-1 border-r border-black w-12">CFOP</th>
                        <th className="p-1 border-r border-black w-8">UN</th>
                        <th className="p-1 border-r border-black w-12 text-right">QTD</th>
                        <th className="p-1 border-r border-black w-16 text-right">V. UNIT</th>
                        <th className="p-1 w-16 text-right">V. TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                      {itensFiscais.map((it) => (
                        <tr key={it.id}>
                          <td className="p-1 border-r border-black text-center font-mono">{it.codigo}</td>
                          <td className="p-1 border-r border-black font-semibold">{it.descricao}</td>
                          <td className="p-1 border-r border-black text-center font-mono">{it.ncm}</td>
                          <td className="p-1 border-r border-black text-center font-mono">{it.csosn.split(' ')[0]}</td>
                          <td className="p-1 border-r border-black text-center font-mono font-bold text-indigo-900">{it.cfop}</td>
                          <td className="p-1 border-r border-black text-center font-bold">{it.unidade}</td>
                          <td className="p-1 border-r border-black text-right font-mono">{it.quantidade.toFixed(2)}</td>
                          <td className="p-1 border-r border-black text-right font-mono">{formatCurrency(it.valorUnitario)}</td>
                          <td className="p-1 text-right font-mono font-bold">{formatCurrency(it.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 5. Dados Adicionais / Observações ao Fisco */}
                <div className="text-[9px] font-bold uppercase mb-0.5 text-gray-700">DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES</div>
                <div className="border border-black p-2 text-[9px] leading-relaxed bg-gray-50/50">
                  <p className="font-semibold">
                    DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI E ICMS.
                  </p>
                  <p className="text-gray-600">
                    Trib aprox: R$ 0,00 Fed, R$ 0,00 Est e R$ 0,00 Mun - Fonte: IBPT. Cotação de Venda Ref: Nº {quote.quoteNumber}.
                  </p>
                  <p className="text-red-700 font-bold mt-1">
                    ATENÇÃO: MODO DE CONFERÊNCIA. ESTE DOCUMENTO É UMA PRÉVIA E NÃO POSSUI VALIDADE JURÍDICA OU FISCAL.
                  </p>
                </div>

              </div>
            </div>

            {/* Rodapé do Modal Espelho com Ações */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowPreDanfeModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Voltar para Revisão
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleOpenPreDanfeNewTab}
                  disabled={openingNewTab}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Prévia / Nova Aba</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPreDanfeModal(false);
                    handleTransmitirSefaz();
                  }}
                  disabled={isTransmitting || loadingCompany}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Confirmar & Transmitir SEFAZ</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

