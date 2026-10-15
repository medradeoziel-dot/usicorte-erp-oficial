import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Quote, Client } from '../types';
import { CompanyFiscalData, DEFAULT_COMPANY_DATA, fetchCompanyData, getLocalCompanyData, extrairComponentesEndereco } from '../services/companyService';
import { 
  ItemFiscalNfe, 
  prepararItensFiscais, 
  formatarChaveAcesso, 
  gerarChaveAcessoNfe, 
  formatarNumeroDanfe,
  DuplicataDanfe,
  ClienteDanfeDestinatario,
  fetchClienteCompletoParaDanfe,
  gerarDuplicatasProporcionais,
  detectarFormaPagamentoInicial,
  montarEnderecoSemDuplicacao,
  buscarInscricaoEstadual,
  obterOuBaixarXmlNfe,
  isNfeAutorizada,
  isNfeCancelada,
  obterNomePadraoDanfePdf,
  formatarDescricaoCompletaItemNfe,
  obterAliquotaIcmsSimples,
  calcularCreditoIcmsSimples
} from '../services/nfeService';
export { buscarInscricaoEstadual, formatarDescricaoCompletaItemNfe };
import { formatCurrency, formatNumberBR, formatSafeDate } from '../utils/calculator';
import Logo from './Logo';
import { 
  X, 
  Printer, 
  Send, 
  Download, 
  ExternalLink, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  Scissors,
  Ban
} from 'lucide-react';

interface DanfeEspelhoA4Props {
  quote: Quote;
  client?: Client | null;
  company?: CompanyFiscalData;
  isPrevia?: boolean;
  onClose?: () => void;
  onTransmitir?: () => void;
  onCancelar?: () => void;
  onOpenEdit?: () => void;
  isTransmitting?: boolean;
  formaPagamento?: 'A_VISTA' | 'A_PRAZO' | string;
  duplicatas?: DuplicataDanfe[];
  clienteDestinatario?: ClienteDanfeDestinatario;
  hideHeaderToolbar?: boolean;
}

// Gera padrão gráfico de código de barras Code-128 para a Chave de Acesso
function BarcodeSimulado({ chave }: { chave: string }) {
  const cleanChave = chave.replace(/\D/g, '') || '35260125038430000123550010000000011000000018';
  
  // Converte a chave em um padrão pseudo-realista de barras com espessuras variadas
  const bars: { width: number; isBlack: boolean }[] = [];
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });

  for (let i = 0; i < cleanChave.length; i++) {
    const digit = parseInt(cleanChave[i], 10) || 0;
    const w1 = (digit % 3) + 1;
    const w2 = ((digit + 1) % 2) + 1;
    const w3 = ((digit + 2) % 3) + 1;
    const w4 = ((digit + 3) % 2) + 1;
    bars.push({ width: w1, isBlack: true });
    bars.push({ width: w2, isBlack: false });
    bars.push({ width: w3, isBlack: true });
    bars.push({ width: w4, isBlack: false });
  }

  bars.push({ width: 3, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 2, isBlack: true });

  let currentX = 5;
  const renderedBars = bars.map((b, idx) => {
    const x = currentX;
    currentX += b.width * 1.4;
    if (!b.isBlack) return null;
    return (
      <rect
        key={idx}
        x={x}
        y="0"
        width={b.width * 1.3}
        height="38"
        fill="#000000"
      />
    );
  });

  return (
    <svg 
      className="w-full h-9 my-0.5 select-none" 
      viewBox={`0 0 ${Math.max(currentX + 5, 260)} 38`} 
      preserveAspectRatio="none"
    >
      {renderedBars}
    </svg>
  );
}

export default function DanfeEspelhoA4({
  quote,
  client,
  company = DEFAULT_COMPANY_DATA,
  isPrevia: isPreviaProp,
  onClose,
  onTransmitir,
  onCancelar,
  onOpenEdit,
  isTransmitting = false,
  formaPagamento,
  duplicatas: duplicatasProp,
  clienteDestinatario,
  hideHeaderToolbar = false
}: DanfeEspelhoA4Props) {
  const isCancelada = isNfeCancelada(quote.status_nfe);
  const isAutorizada = isNfeAutorizada(quote.status_nfe);
  const isPrevia = isPreviaProp !== undefined ? isPreviaProp : (!isAutorizada && !isCancelada);
  const printRef = useRef<HTMLDivElement>(null);

  // 1. Dados Oficiais do Emitente (Carregamento direto da tabela 'emitente' do Supabase com fallback local)
  const [currentCompany, setCurrentCompany] = useState<CompanyFiscalData>(() => company || getLocalCompanyData());

  useEffect(() => {
    let isMounted = true;
    async function carregarEmitenteSupabase() {
      try {
        const fresh = await fetchCompanyData(true);
        if (isMounted && fresh) {
          setCurrentCompany(fresh);
        }
      } catch (err) {
        console.warn('Aviso: Falha ao carregar dados frescos da tabela emitente para o DANFE:', err);
      }
    }
    carregarEmitenteSupabase();

    const handleCompanyUpdate = (e: CustomEvent) => {
      if (isMounted && e.detail) {
        setCurrentCompany(prev => ({
          ...prev,
          ...e.detail
        }));
      }
    };
    window.addEventListener('company-data-updated', handleCompanyUpdate as EventListener);
    return () => {
      isMounted = false;
      window.removeEventListener('company-data-updated', handleCompanyUpdate as EventListener);
    };
  }, [company]);

  // Montagem dinâmica dos componentes do endereço do Emitente
  const { logradouro, numero, bairro } = useMemo(() => {
    return extrairComponentesEndereco(
      currentCompany.logradouro || currentCompany.street || currentCompany.endereco,
      currentCompany.number || currentCompany.numero,
      currentCompany.neighborhood || currentCompany.bairro
    );
  }, [currentCompany]);

  const rawComplemento = currentCompany.complement || currentCompany.complemento || '';
  const cidadeEmitente = (currentCompany.city || currentCompany.cidade || 'BAURU').toUpperCase();
  const ufEmitente = (currentCompany.state || currentCompany.uf || 'SP').toUpperCase();
  const cepEmitente = currentCompany.cep || '17031-350';

  // Contatos dinâmicos (email_contato e telefone_1 / telefone_2)
  const emailContatoEmitente = currentCompany.email_contato || currentCompany.email || 'vendas.usicorte@gmail.com';
  const tel1 = currentCompany.telefone_1 || currentCompany.phone || currentCompany.telefone || '(14) 99880-9362';
  const tel2 = currentCompany.telefone_2 || currentCompany.mobile || currentCompany.celular || '';
  const telefonesFormatadosEmitente = [tel1, tel2].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' / ');

  // 1. CORREÇÃO DO ENDEREÇO DO EMITENTE (REMOVER DUPLICAÇÕES DE TEXTO)
  const enderecoEmitenteFormatado = useMemo(() => {
    return montarEnderecoSemDuplicacao(
      logradouro,
      numero,
      rawComplemento,
      bairro
    );
  }, [logradouro, numero, rawComplemento, bairro]);

  const razaoSocialEmitente = useMemo(() => {
    const list = [
      currentCompany?.corporateName,
      currentCompany?.razao_social,
      currentCompany?.tradeName,
      currentCompany?.nome_fantasia,
      company?.corporateName,
      company?.razao_social,
      company?.tradeName,
      company?.nome_fantasia
    ];
    for (const item of list) {
      if (item && typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed && trimmed.toUpperCase() !== 'UNDEFINED' && trimmed.toLowerCase() !== 'undefined' && trimmed.toUpperCase() !== 'NULL') {
          return trimmed.toUpperCase();
        }
      }
    }
    return 'L. M. BANZATTO METAIS';
  }, [currentCompany, company]);

  const nomeFantasiaEmitente = useMemo(() => {
    const list = [
      currentCompany?.tradeName,
      currentCompany?.nome_fantasia,
      currentCompany?.corporateName,
      currentCompany?.razao_social,
      company?.tradeName,
      company?.nome_fantasia
    ];
    for (const item of list) {
      if (item && typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed && trimmed.toUpperCase() !== 'UNDEFINED' && trimmed.toLowerCase() !== 'undefined' && trimmed.toUpperCase() !== 'NULL') {
          return trimmed.toUpperCase();
        }
      }
    }
    return 'USICORTE METAIS';
  }, [currentCompany, company]);

  const emitente = useMemo(() => ({
    razaoSocial: razaoSocialEmitente,
    nomeFantasia: nomeFantasiaEmitente,
    cnpj: currentCompany.cnpj || '25.038.430/0001-23',
    ie: currentCompany.ie || currentCompany.inscricao_estadual || '209632312114',
    endereco: enderecoEmitenteFormatado,
    logradouro,
    numero,
    complemento: rawComplemento,
    bairro,
    cidade: cidadeEmitente,
    uf: ufEmitente,
    cep: cepEmitente,
    telefone: telefonesFormatadosEmitente,
    telefones: telefonesFormatadosEmitente,
    telefone_1: tel1,
    telefone_2: tel2,
    email: emailContatoEmitente,
    email_contato: emailContatoEmitente,
    ultimo_numero_nfe: currentCompany.ultimo_numero_nfe,
    serie_nfe: currentCompany.serie_nfe
  }), [currentCompany, razaoSocialEmitente, nomeFantasiaEmitente, enderecoEmitenteFormatado, logradouro, numero, rawComplemento, bairro, cidadeEmitente, ufEmitente, cepEmitente, telefonesFormatadosEmitente, tel1, tel2, emailContatoEmitente]);

  // 1. Linha única de endereço formatada sem sobreposição: Rua, Número, Bairro, CEP, Telefone e E-mail
  const enderecoEmitenteLinhaUnica = useMemo(() => {
    const partes: string[] = [];
    if (enderecoEmitenteFormatado) partes.push(enderecoEmitenteFormatado);
    if (emitente.cidade && emitente.uf) partes.push(`${emitente.cidade}/${emitente.uf}`);
    if (emitente.cep) partes.push(`CEP: ${emitente.cep}`);
    if (emitente.telefone) partes.push(`Tel: ${emitente.telefone}`);
    if (emitente.email) partes.push(`E-mail: ${emitente.email}`);
    return partes.join(' • ');
  }, [enderecoEmitenteFormatado, emitente.cidade, emitente.uf, emitente.cep, emitente.telefone, emitente.email]);

  // 2. Destinatário Real Carregado do Supabase (tabela clientes)
  const [destinatarioAsync, setDestinatarioAsync] = useState<ClienteDanfeDestinatario | null>(null);

  useEffect(() => {
    if (clienteDestinatario) return;
    let isMounted = true;
    async function carregarClienteReal() {
      const cli = await fetchClienteCompletoParaDanfe(quote, client);
      if (isMounted) setDestinatarioAsync(cli);
    }
    carregarClienteReal();
    return () => { isMounted = false; };
  }, [quote, client, clienteDestinatario]);

  const destinatario: ClienteDanfeDestinatario = useMemo(() => {
    if (clienteDestinatario) {
      const ieExib = buscarInscricaoEstadual(clienteDestinatario) !== 'ISENTO'
        ? buscarInscricaoEstadual(clienteDestinatario)
        : buscarInscricaoEstadual(client);

      const rz = clienteDestinatario.razao_social || (client as any)?.razao_social || client?.name || quote.cliente_nome || quote.clientName;
      const nf = clienteDestinatario.nome_fantasia || (client as any)?.nome_fantasia || client?.fantasyName || '';
      const nomeExib = (rz && nf && rz !== nf)
        ? `${rz} (${nf})`
        : (clienteDestinatario.nome || rz || 'CLIENTE BALCÃO');

      return {
        ...clienteDestinatario,
        nome: nomeExib,
        ie: ieExib,
        inscricao_estadual: ieExib,
        inscricaoEstadual: ieExib
      };
    }
    if (destinatarioAsync) {
      const ieExib = buscarInscricaoEstadual(destinatarioAsync) !== 'ISENTO'
        ? buscarInscricaoEstadual(destinatarioAsync)
        : buscarInscricaoEstadual(client);

      const rz = destinatarioAsync.razao_social || (client as any)?.razao_social || client?.name || quote.cliente_nome || quote.clientName;
      const nf = destinatarioAsync.nome_fantasia || (client as any)?.nome_fantasia || client?.fantasyName || '';
      const nomeExib = (rz && nf && rz !== nf)
        ? `${rz} (${nf})`
        : (destinatarioAsync.nome || rz || 'CLIENTE BALCÃO');

      return {
        ...destinatarioAsync,
        nome: nomeExib,
        ie: ieExib,
        inscricao_estadual: ieExib,
        inscricaoEstadual: ieExib
      };
    }
    const destUf = (client?.state || client?.uf || quote.clientState || 'SP').toUpperCase();
    const ieExib = buscarInscricaoEstadual(client) !== 'ISENTO'
      ? buscarInscricaoEstadual(client)
      : buscarInscricaoEstadual(quote);

    const rz = (client as any)?.razao_social || client?.name || client?.nome || quote.cliente_nome || quote.clientName || 'CLIENTE BALCÃO';
    const nf = (client as any)?.nome_fantasia || client?.fantasyName || '';
    const nomeExib = (rz && nf && rz !== nf)
      ? `${rz} (${nf})`
      : (rz || 'CLIENTE BALCÃO / CONSUMIDOR FINAL');

    return {
      nome: nomeExib,
      doc: client?.document || client?.documento || quote.clientDocument || 'NÃO INFORMADO',
      endereco: client?.street || client?.endereco || quote.clientStreet || 'ENDEREÇO COMERCIAL',
      bairro: client?.neighborhood || client?.bairro || quote.clientNeighborhood || 'CENTRO',
      cidade: client?.city || client?.cidade || quote.clientCity || 'BAURU',
      uf: destUf,
      cep: client?.cep || quote.clientCep || '17000-000',
      ie: ieExib,
      inscricao_estadual: ieExib,
      inscricaoEstadual: ieExib,
      telefone: client?.phone || client?.telefone || quote.clientPhone || '-'
    };
  }, [clienteDestinatario, destinatarioAsync, client, quote]);

  // 2. CORREÇÃO DEFINITIVA DA INSCRIÇÃO ESTADUAL DO DESTINATÁRIO/CLIENTE:
  // Atualiza a verificação para testar todas as possíveis variações da coluna de Inscrição Estadual trazida da tabela clientes do Supabase
  const ieExibicao = useMemo(() => {
    const fromDest = buscarInscricaoEstadual(destinatario);
    if (fromDest !== 'ISENTO') return fromDest;
    const fromCliDest = buscarInscricaoEstadual(clienteDestinatario);
    if (fromCliDest !== 'ISENTO') return fromCliDest;
    const fromAsync = buscarInscricaoEstadual(destinatarioAsync);
    if (fromAsync !== 'ISENTO') return fromAsync;
    const fromClient = buscarInscricaoEstadual(client);
    if (fromClient !== 'ISENTO') return fromClient;
    const fromQuote = buscarInscricaoEstadual(quote);
    if (fromQuote !== 'ISENTO') return fromQuote;
    return 'ISENTO';
  }, [destinatario, clienteDestinatario, destinatarioAsync, client, quote]);

  const destUf = (destinatario.uf || 'SP').toUpperCase();

  // 3. Itens Fiscais
  const itensFiscais: ItemFiscalNfe[] = prepararItensFiscais(quote.items, destUf);

  // 4. Totais e Cálculos
  const totalProdutos = quote.subtotalTotal || itensFiscais.reduce((acc, it) => acc + it.subtotal, 0);
  const valorFrete = quote.shipping || 0;
  const valorDesconto = quote.discount || 0;
  const valorTotalNota = quote.grandTotal || (totalProdutos - valorDesconto + valorFrete);
  const aliquotaIcmsSimples = obterAliquotaIcmsSimples(company);
  const creditoIcms = useMemo(() => {
    return calcularCreditoIcmsSimples(valorTotalNota, aliquotaIcmsSimples);
  }, [valorTotalNota, aliquotaIcmsSimples]);

  const pesoTotal = quote.totalWeightKg || quote.items?.reduce((acc, it) => acc + (it.totalWeightKg || it.pesoTotal || 0), 0) || 0;

  // 5. Dados da NF-e
  const emitenteUltimo = typeof emitente.ultimo_numero_nfe === 'number' && !isNaN(emitente.ultimo_numero_nfe)
    ? emitente.ultimo_numero_nfe
    : 0;
  const rawNfeNum = (quote.nfe_numero && String(quote.nfe_numero) !== String(quote.quoteNumber) && !String(quote.nfe_numero).toUpperCase().includes('COT'))
    ? String(quote.nfe_numero).replace(/\D/g, '')
    : '';
  const numeroNfe = rawNfeNum ? rawNfeNum.padStart(6, '0') : String(emitenteUltimo + 1).padStart(6, '0');
  const serie = String(quote.serie_nfe || emitente.serie_nfe || '1');
  const chaveAcessoRaw = quote.nfe_chave || gerarChaveAcessoNfe(emitente.uf, new Date(), emitente.cnpj, serie, numeroNfe);
  const chaveFormatada = isPrevia ? 'CHAVE SERÁ GERADA APÓS TRANSMISSÃO SEFAZ' : formatarChaveAcesso(chaveAcessoRaw);

  const dataEmissaoObj = quote.nfe_emitida_em ? new Date(quote.nfe_emitida_em) : new Date(quote.date || Date.now());
  const dataEmissaoFormatada = formatSafeDate(dataEmissaoObj);
  const horaEmissaoFormatada = dataEmissaoObj.toLocaleTimeString('pt-BR');

  const protocolo = quote.protocolo_nfe || (isPrevia ? 'NÃO TRANSMITIDA (PRÉVIA FISCAL)' : '135260000000001 (Autorizado o uso da NF-e)');

  // 6. IBPT e Impostos aproximados
  const valorIbptAprox = totalProdutos * 0.1345;
  const ibptFed = totalProdutos * 0.085;
  const ibptEst = totalProdutos * 0.0495;

  // 7. Regra de Forma de Pagamento e Fatura / Duplicatas:
  // A) Pagamento À Vista (PDV, Dinheiro, PIX, Débito):
  //    indPag = 0, quadro FATURA / DUPLICATAS VAZIO, sem linhas de duplicata
  // B) Pagamento a Prazo / Faturado (Duplicata):
  //    indPag = 1, exibe as parcelas configuradas (Nº DUP, VENC, VALOR)
  const isAVista = useMemo(() => {
    if (formaPagamento) {
      const fp = formaPagamento.toUpperCase();
      return fp === 'A_VISTA' || fp.includes('VISTA') || fp === 'PIX' || fp === 'DINHEIRO' || fp === 'DEBITO';
    }
    return detectarFormaPagamentoInicial(quote) === 'A_VISTA';
  }, [formaPagamento, quote]);

  const duplicatasExibir = useMemo(() => {
    if (isAVista) return [];
    if (duplicatasProp !== undefined) return duplicatasProp;
    return gerarDuplicatasProporcionais(valorTotalNota, 1, numeroNfe);
  }, [isAVista, duplicatasProp, valorTotalNota, numeroNfe]);

  const [isDownloadingXml, setIsDownloadingXml] = useState<boolean>(false);

  const handleDownloadXml = async () => {
    setIsDownloadingXml(true);
    try {
      await obterOuBaixarXmlNfe(quote, client, company);
    } catch (e) {
      console.error('Erro ao baixar XML:', e);
    } finally {
      setIsDownloadingXml(false);
    }
  };

  // Captura antes e depois da impressão (inclusive via Ctrl+P) para isolamento do DANFE
  useEffect(() => {
    const handleBeforePrint = () => {
      document.body.classList.add('print-danfe');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('print-danfe');
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('print-danfe');
    };
  }, []);

  const handlePrint = () => {
    const originalTitle = document.title;
    const num = numeroNfe || quote.nfe_numero || quote.quoteNumber;
    const chave = chaveAcessoRaw || quote.nfe_chave || quote.chave_acesso;
    const tituloPadrao = isPrevia
      ? `PREVIA_DANFE_NFe_${formatarNumeroDanfe(num)}`
      : obterNomePadraoDanfePdf(num, chave);
    document.title = tituloPadrao;
    document.body.classList.add('print-danfe');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-danfe');
      document.title = originalTitle;
    }, 500);
  };

  return (
    <div className="danfe-container danfe-print-view danfe-inner-overlay w-full flex flex-col items-center py-2 print:py-0 print:block print:w-full print:m-0 print:p-0">
      {/* Estilos CSS Scoped para isolamento total da DANFE:
          TODAS as regras são restritas a .danfe-container, .danfe-print-view e body.print-danfe.
          Nenhuma regra global é aplicada a body, div, table ou outros relatórios do ERP. */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 3mm 4mm 3mm 4mm;
          }

          body.print-danfe {
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          /* Oculta completamente a raiz do app APENAS na impressão da DANFE */
          body.print-danfe #root {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          /* Isolamento estrito com wrapper exclusivo .danfe-container e .danfe-print-view */
          .danfe-container,
          .danfe-print-view,
          .danfe-container *,
          .danfe-print-view * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }

          .danfe-container table,
          .danfe-print-view table,
          body.print-danfe .danfe-container table {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border-collapse: collapse !important;
          }

          .danfe-container tr,
          .danfe-print-view tr,
          body.print-danfe .danfe-container tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          body.print-danfe .danfe-modal-portal,
          body.print-danfe .danfe-modal-overlay,
          body.print-danfe .danfe-modal-dialog,
          body.print-danfe .danfe-modal-scroll {
            display: block !important;
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            transform: none !important;
            animation: none !important;
            transition: none !important;
            float: none !important;
            width: 100% !important;
          }

          .danfe-container .no-print,
          .danfe-container .btn-no-print,
          .danfe-print-view .no-print,
          .danfe-print-view .btn-no-print,
          body.print-danfe .no-print,
          body.print-danfe .btn-no-print {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .danfe-container #container-impressao-danfe,
          .danfe-print-view #container-impressao-danfe,
          body.print-danfe #container-impressao-danfe {
            display: block !important;
            position: static !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            transform: none !important;
          }

          .danfe-container.danfe-inner-overlay,
          .danfe-print-view.danfe-inner-overlay,
          body.print-danfe .danfe-inner-overlay {
            display: block !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          .danfe-container .danfe-print-container,
          .danfe-container #folha-danfe-a4,
          .danfe-container .danfe-folha-a4,
          .danfe-print-view .danfe-print-container,
          .danfe-print-view #folha-danfe-a4,
          .danfe-print-view .danfe-folha-a4,
          body.print-danfe .danfe-print-container,
          body.print-danfe #folha-danfe-a4,
          body.print-danfe .danfe-folha-a4 {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            position: static !important;
            top: 0 !important;
            left: auto !important;
            width: 100% !important;
            max-width: 202mm !important;
            min-height: 285mm !important;
            height: 285mm !important;
            max-height: 288mm !important;
            margin: 0 auto !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            padding: 0 1.5mm 0 1.5mm !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 7pt !important;
            border: 1px solid #000000 !important;
            overflow: visible !important;
            box-shadow: none !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
          }

          .danfe-container .danfe-canhoto-topo,
          .danfe-print-view .danfe-canhoto-topo,
          body.print-danfe .danfe-canhoto-topo {
            margin-top: 0 !important;
            padding-top: 0 !important;
            height: 15mm !important;
            min-height: 15mm !important;
            max-height: 15mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            width: 100% !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .danfe-container .danfe-bloco-emitente,
          .danfe-print-view .danfe-bloco-emitente,
          body.print-danfe .danfe-bloco-emitente {
            width: 83mm !important;
            min-width: 83mm !important;
            max-width: 83mm !important;
            box-sizing: border-box !important;
          }

          .danfe-container .danfe-bloco-danfe,
          .danfe-print-view .danfe-bloco-danfe,
          body.print-danfe .danfe-bloco-danfe {
            width: 35mm !important;
            min-width: 35mm !important;
            max-width: 35mm !important;
            box-sizing: border-box !important;
          }

          .danfe-container .danfe-bloco-chave,
          .danfe-print-view .danfe-bloco-chave,
          body.print-danfe .danfe-bloco-chave {
            flex: 1 1 auto !important;
            min-width: 78mm !important;
            box-sizing: border-box !important;
          }

          .danfe-container .danfe-secao-produtos,
          .danfe-print-view .danfe-secao-produtos,
          body.print-danfe .danfe-secao-produtos {
            flex: 1 1 auto !important;
            min-height: 20mm !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: visible !important;
            width: 100% !important;
          }

          /* Bloco Dados Adicionais FIXADO no rodapé apenas da DANFE */
          .danfe-container .danfe-bloco-rodape,
          .danfe-print-view .danfe-bloco-rodape,
          body.print-danfe .danfe-bloco-rodape {
            margin-top: auto !important;
            flex-shrink: 0 !important;
            width: 100% !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .danfe-container .danfe-bloco-rodape-quadro,
          .danfe-print-view .danfe-bloco-rodape-quadro,
          body.print-danfe .danfe-bloco-rodape-quadro {
            min-height: 32mm !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            width: 100% !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
      
      {/* Barra de Ações Superior (Oculta na Impressão e quando desativada) */}
      {!hideHeaderToolbar && (
        <div className="w-full max-w-[210mm] bg-slate-900 border border-slate-800 rounded-t-xl px-4 py-3 flex items-center justify-between gap-3 text-slate-100 shadow-xl shrink-0 print:hidden mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-1.5 rounded-lg ${
              isCancelada 
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                : isPrevia 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {isCancelada ? <Ban className="w-5 h-5 shrink-0 text-rose-400" /> : <FileText className="w-5 h-5 shrink-0" />}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm tracking-wide flex items-center gap-2 truncate">
                {isCancelada 
                  ? 'DANFE de NF-e Cancelada (Sem Valor Fiscal)' 
                  : isPrevia 
                    ? 'Espelho DANFE (Prévia Oficial A4)' 
                    : 'DANFE Oficial - Modelo 55'}
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase tracking-wider ${
                  isCancelada 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                    : isPrevia 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {isCancelada ? 'CANCELADA (STATUS 101)' : isPrevia ? 'Modo Conferência' : 'Emitida SEFAZ'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                NF-e Nº {formatarNumeroDanfe(numeroNfe)} • Série {serie} • {destinatario.nome}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenEdit && !isCancelada && (
              <button
                type="button"
                onClick={onOpenEdit}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Revisar Dados
              </button>
            )}

            {!isPrevia && !isCancelada && (
              <button
                type="button"
                onClick={handleDownloadXml}
                disabled={isDownloadingXml}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Baixar arquivo XML oficial da NF-e (Modelo 55)"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloadingXml ? 'Baixando...' : 'Baixar XML'}</span>
              </button>
            )}

            {isAutorizada && onCancelar && (
              <button
                type="button"
                onClick={onCancelar}
                className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                title="Cancelar NF-e Homologada na SEFAZ"
              >
                <Ban className="w-4 h-4" />
                <span>CANCELAR NF-E</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
              title="Imprimir DANFE na folha A4 oficial"
            >
              <Printer className="w-4 h-4" />
              <span>{isCancelada ? 'Imprimir Cancelada' : 'Imprimir DANFE'}</span>
            </button>

            {isPrevia && !isCancelada && onTransmitir && (
              <button
                type="button"
                onClick={onTransmitir}
                disabled={isTransmitting}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Transmitir esta nota para a SEFAZ"
              >
                <Send className="w-4 h-4" />
                <span>{isTransmitting ? 'Transmitindo...' : 'Transmitir SEFAZ'}</span>
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          FOLHA A4 OFICIAL - ESPELHO RIGOROSO DA DANFE MODELO 55
          ========================================================================= */}
      <div 
        ref={printRef}
        id="folha-danfe-a4"
        className="danfe-print-container danfe-folha-a4 bg-white text-black shadow-2xl relative select-text font-sans flex flex-col justify-between leading-tight mx-auto print:shadow-none print:m-0 print:top-0 print:border-black"
        style={{
          width: '100%',
          maxWidth: '202mm',
          minHeight: '286mm',
          maxHeight: '289mm',
          height: 'auto',
          padding: '0 2mm 1mm 2mm',
          paddingTop: 0,
          boxSizing: 'border-box',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '7pt',
          border: '1px solid #000000'
        }}
      >
        
        {/* Marca d'água Diagonal Central */}
        {isCancelada ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-30 overflow-hidden">
            <div className="rotate-[-28deg] border-4 border-dashed border-red-600/30 text-red-600/30 font-black text-4xl sm:text-5xl uppercase tracking-widest p-8 text-center rounded-2xl max-w-xl">
              NF-E CANCELADA<br />
              <span className="text-xl sm:text-2xl font-bold tracking-normal text-red-700/30">
                SEM VALOR FISCAL (STATUS 101)
              </span>
            </div>
          </div>
        ) : isPrevia ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-30 overflow-hidden">
            <div className="rotate-[-28deg] border-4 border-dashed border-red-600/25 text-red-600/20 font-black text-4xl sm:text-5xl uppercase tracking-widest p-8 text-center rounded-2xl max-w-xl">
              PRÉVIA - SEM VALOR FISCAL<br />
              <span className="text-xl sm:text-2xl font-bold tracking-normal text-red-700/25">
                MODO DE CONFERÊNCIA
              </span>
            </div>
          </div>
        ) : null}

        {/* =========================================================================
            1. CANHOTO SUPERIOR (Declaração de Recebimento - Fixo em 15mm)
            ========================================================================= */}
        <div 
          className="danfe-canhoto-topo border border-black mb-1 overflow-hidden w-full print:mt-0 print:pt-0" 
          style={{ height: '15mm', minHeight: '15mm', maxHeight: '15mm', border: '1px solid #000' }}
        >
          <div className="flex h-full">
            <div className="p-1 border-r border-black flex flex-col justify-between flex-1" style={{ borderRight: '1px solid #000' }}>
              <div className="text-[6.5pt] uppercase font-semibold leading-tight text-gray-800">
                RECEBEMOS DE <strong className="text-black">{emitente.razaoSocial && emitente.razaoSocial.toUpperCase() !== 'UNDEFINED' ? emitente.razaoSocial : 'L. M. BANZATTO METAIS'}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO. EMISSÃO: <strong>{dataEmissaoFormatada}</strong> • DESTINATÁRIO: <strong className="uppercase">{destinatario.nome}</strong> • VALOR TOTAL: <strong>{formatCurrency(valorTotalNota)}</strong>
              </div>
              <div className="flex gap-2 pt-0.5 border-t border-black text-[5.5pt]" style={{ borderTop: '1px solid #000' }}>
                <div className="border-r border-black pr-2 shrink-0" style={{ width: '45mm', borderRight: '1px solid #000' }}>
                  <span className="block font-bold uppercase text-gray-600">DATA DE RECEBIMENTO</span>
                  <div className="font-mono text-gray-400">___ / ___ / ______</div>
                </div>
                <div className="flex-1">
                  <span className="block font-bold uppercase text-gray-600">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span>
                  <div className="font-mono text-gray-400 truncate">___________________________________________________</div>
                </div>
              </div>
            </div>

            <div className="p-1 text-center flex flex-col justify-center items-center bg-gray-50/50 shrink-0" style={{ width: '35mm' }}>
              <span className="font-extrabold text-[10pt] leading-none">NF-e</span>
              <span className="font-bold text-[7.5pt] mt-0.5 leading-tight">Nº {formatarNumeroDanfe(numeroNfe)}</span>
              <span className="text-[6pt] text-gray-700 leading-none">SÉRIE {serie}</span>
            </div>
          </div>
        </div>

        {/* Linha pontilhada de destaque com tesourinha */}
        <div className="relative flex items-center justify-center my-0.5 border-b border-dashed border-gray-500 w-full">
          <span className="absolute bg-white px-2 text-[6pt] text-gray-500 uppercase tracking-widest flex items-center gap-1 font-mono">
            <Scissors className="w-2.5 h-2.5 rotate-90" /> Destaque aqui
          </span>
        </div>

        {/* =========================================================================
            2. CABEÇALHO DA EMISSÃO (Emitente 83mm + DANFE 35mm + Chave Flexível = 100%)
            ========================================================================= */}
        <div className="flex border border-black mb-1 overflow-hidden w-full" style={{ border: '1px solid #000' }}>
          {/* Coluna 1: Emitente & Logo (83mm fixos) */}
          <div 
            className="danfe-bloco-emitente border-r border-black flex flex-col items-center justify-center text-center p-1.5 shrink-0 overflow-hidden"
            style={{ width: '83mm', minWidth: '83mm', maxWidth: '83mm', borderRight: '1px solid #000' }}
          >
            {/* 1. Logo Usicorte Metais */}
            <div className="flex items-center justify-center w-full mb-0.5">
              <Logo variant="print" className="h-7 w-auto max-h-8 mx-auto" />
            </div>

            {/* 2. Razão Social do Emitente */}
            <h1 className="font-extrabold text-[8.5pt] uppercase tracking-tight text-black leading-tight">
              {emitente.razaoSocial}
            </h1>

            {/* 3. Nome Fantasia do Emitente */}
            <h2 className="font-bold text-[7.5pt] text-red-700 uppercase leading-snug tracking-normal mt-0.5">
              {emitente.nomeFantasia}
            </h2>

            {/* 4. BLOCO DO ENDEREÇO E CONTATO DINÂMICOS DO EMITENTE */}
            <div className="text-[6pt] leading-tight text-gray-800 font-normal space-y-0.5 w-full mt-1">
              <div>{emitente.logradouro}{emitente.numero && emitente.numero !== 'S/N' ? `, ${emitente.numero}` : ''}{rawComplemento ? ` - ${rawComplemento}` : ''}</div>
              <div>{emitente.bairro} - {emitente.cidade} - {emitente.uf} - CEP: {emitente.cep}</div>
              <div className="text-gray-900 font-medium">Fone: {emitente.telefones || '(14) 99880-9362'} • Email: {emitente.email_contato}</div>
            </div>
          </div>

          {/* Coluna 2: DANFE Box (35mm fixos) */}
          <div 
            className="danfe-bloco-danfe border-r border-black text-center flex flex-col justify-between items-center bg-gray-50/30 p-1 shrink-0 overflow-hidden"
            style={{ width: '35mm', minWidth: '35mm', maxWidth: '35mm', borderRight: '1px solid #000' }}
          >
            <div>
              <span className="font-black text-[11pt] tracking-widest block leading-none">DANFE</span>
              <span className="text-[5.5pt] leading-tight block text-gray-700 mt-0.5">
                Documento Auxiliar da<br />Nota Fiscal Eletrônica
              </span>
            </div>

            <div className="border border-black px-1.5 py-0.5 my-0.5 text-[6.5pt] font-bold inline-block leading-tight" style={{ border: '1px solid #000' }}>
              <span className="text-gray-500">0 - ENTRADA</span><br />
              <strong className="text-black">1 - SAÍDA [ 1 ]</strong>
            </div>

            <div>
              <div className="font-bold text-[8pt] leading-tight">Nº {formatarNumeroDanfe(numeroNfe)}</div>
              <div className="text-[6.5pt] font-semibold text-gray-800">SÉRIE {serie}</div>
              <div className="text-[6pt] text-gray-600">FOLHA 1 / 1</div>
            </div>
          </div>

          {/* Coluna 3: Código de Barras & Chave de Acesso (flexível com min-width) */}
          <div 
            className="danfe-bloco-chave flex flex-col justify-between p-1 shrink-0 overflow-hidden flex-1"
            style={{ minWidth: '78mm' }}
          >
            <div className="min-w-0">
              <BarcodeSimulado chave={chaveAcessoRaw} />
              
              <div className="mt-0.5">
                <span className="block text-[5.5pt] font-bold uppercase text-gray-600">CHAVE DE ACESSO</span>
                <div className="font-mono text-[6pt] font-bold text-black tracking-normal break-all leading-tight">
                  {chaveFormatada}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-300 pt-0.5 text-[5.5pt] text-gray-700 leading-tight">
              {isPrevia ? (
                <span className="text-red-700 font-semibold block">
                  Documento emitido exclusivamente para prévia e conferência tributária.
                </span>
              ) : (
                <span>
                  Consulta de autenticidade no portal nacional da NF-e <strong>www.nfe.fazenda.gov.br/portal</strong> ou no site da Sefaz Autorizadora.
                </span>
              )}
            </div>

            <div className="border-t border-black pt-0.5" style={{ borderTop: '1px solid #000' }}>
              <span className="block text-[5.5pt] font-bold uppercase text-gray-600">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
              <div className="font-bold text-[6.5pt] text-black truncate leading-tight">
                {protocolo}
              </div>
            </div>
          </div>
        </div>

        {/* Natureza da Operação / Inscrição Estadual / CNPJ */}
        <div className="border border-black mb-1 grid grid-cols-12 divide-x divide-black text-[8px] w-full" style={{ border: '1px solid #000' }}>
          <div className="col-span-6 p-1">
            <span className="block text-[6.5px] font-bold uppercase text-gray-600">NATUREZA DA OPERAÇÃO</span>
            <strong className="text-[9px] uppercase">{isPrevia ? 'VENDA DE MERCADORIA (MODO DE CONFERÊNCIA)' : 'VENDA DE PRODUÇÃO DO ESTABELECIMENTO / MERCADORIA'}</strong>
          </div>
          <div className="col-span-3 p-1">
            <span className="block text-[6.5px] font-bold uppercase text-gray-600">INSCRIÇÃO ESTADUAL</span>
            <strong className="font-mono text-[8.5px]">{emitente.ie}</strong>
          </div>
          <div className="col-span-3 p-1">
            <span className="block text-[6.5px] font-bold uppercase text-gray-600">CNPJ</span>
            <strong className="font-mono text-[8.5px]">{emitente.cnpj}</strong>
          </div>
        </div>

        {/* =========================================================================
            3. DESTINATÁRIO / REMETENTE
            ========================================================================= */}
        <div className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 mb-0.5 w-full">
          DESTINATÁRIO / REMETENTE
        </div>
        <div className="border border-black mb-1 divide-y divide-black text-[8px] w-full" style={{ border: '1px solid #000' }}>
          {/* Linha 1 */}
          <div className="grid grid-cols-12 divide-x divide-black">
            <div className="col-span-7 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">NOME / RAZÃO SOCIAL</span>
              <strong className="text-[9px] uppercase truncate block">{destinatario.nome}</strong>
            </div>
            <div className="col-span-3 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">CNPJ / CPF</span>
              <strong className="font-mono text-[8.5px]">{destinatario.doc}</strong>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">DATA DA EMISSÃO</span>
              <strong className="text-[8.5px]">{dataEmissaoFormatada}</strong>
            </div>
          </div>

          {/* Linha 2 */}
          <div className="grid grid-cols-12 divide-x divide-black">
            <div className="col-span-6 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">ENDEREÇO</span>
              <span className="uppercase truncate block">{destinatario.endereco}</span>
            </div>
            <div className="col-span-3 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">BAIRRO / DISTRITO</span>
              <span className="uppercase truncate block">{destinatario.bairro}</span>
            </div>
            <div className="col-span-1 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">CEP</span>
              <span className="font-mono">{destinatario.cep}</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">DATA DE SAÍDA / ENTRADA</span>
              <strong className="text-[8.5px]">{dataEmissaoFormatada}</strong>
            </div>
          </div>

          {/* Linha 3 */}
          <div className="grid grid-cols-12 divide-x divide-black">
            <div className="col-span-5 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">MUNICÍPIO</span>
              <span className="uppercase truncate block">{destinatario.cidade}</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">FONE / FAX</span>
              <span>{destinatario.telefone}</span>
            </div>
            <div className="col-span-1 p-1 text-center">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">UF</span>
              <strong className="text-[8.5px]">{destinatario.uf}</strong>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">INSCRIÇÃO ESTADUAL</span>
              <strong className="font-mono">{ieExibicao}</strong>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">HORA DE SAÍDA</span>
              <span>{horaEmissaoFormatada}</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            4. FATURA / DUPLICATAS
            ========================================================================= */}
        <div className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 mb-0.5 w-full">
          FATURA / DUPLICATAS
        </div>
        <div className="border border-black mb-1 p-1 min-h-[28px] flex items-center w-full" style={{ border: '1px solid #000' }}>
          {isAVista || duplicatasExibir.length === 0 ? (
            <div className="w-full h-4">
              {/* Quadro rigorosamente vazio para Pagamento À Vista (indPag: 0) */}
            </div>
          ) : (
            <div className="w-full grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {duplicatasExibir.map((dup, idx) => (
                <div key={idx} className="border border-gray-400 p-1 rounded-xs bg-gray-50/50 text-[7.5px]">
                  <div className="flex justify-between text-gray-600 text-[6.5px]">
                    <span>Nº DUP:</span>
                    <strong className="text-black font-mono">{dup.numero}</strong>
                  </div>
                  <div className="flex justify-between text-gray-600 text-[6.5px] mt-0.5">
                    <span>VENC:</span>
                    <strong className="text-black">{formatSafeDate(dup.vencimento)}</strong>
                  </div>
                  <div className="flex justify-between text-gray-800 font-bold mt-0.5 border-t border-gray-300 pt-0.5">
                    <span>VALOR:</span>
                    <strong className="text-black font-mono">{formatCurrency(dup.valor)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* =========================================================================
            5. CÁLCULO DO IMPOSTO (GRADE OFICIAL COMPLETA)
            ========================================================================= */}
        <div className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 mb-0.5 w-full">
          CÁLCULO DO IMPOSTO
        </div>
        <div className="border border-black mb-1 divide-y divide-black text-[8px] w-full" style={{ border: '1px solid #000' }}>
          {/* Linha 1 */}
          <div className="grid grid-cols-6 divide-x divide-black text-center">
            <div className="p-1">
              <span className="block text-[6px] font-bold uppercase text-gray-600">BASE DE CÁLCULO DO ICMS</span>
              <strong className="font-mono">R$ 0,00</strong>
            </div>
            <div className="p-1">
              <span className="block text-[6px] font-bold uppercase text-gray-600">VALOR DO ICMS</span>
              <strong className="font-mono">R$ 0,00</strong>
            </div>
            <div className="p-1">
              <span className="block text-[6px] font-bold uppercase text-gray-600">BASE DE CÁLC. ICMS ST</span>
              <strong className="font-mono">R$ 0,00</strong>
            </div>
            <div className="p-1">
              <span className="block text-[6px] font-bold uppercase text-gray-600">VALOR DO ICMS ST</span>
              <strong className="font-mono">R$ 0,00</strong>
            </div>
            <div className="p-1">
              <span className="block text-[6px] font-bold uppercase text-gray-600">V. APROX. TRIBUTOS (IBPT)</span>
              <strong className="font-mono text-gray-800">{formatCurrency(valorIbptAprox)}</strong>
            </div>
            <div className="p-1 bg-gray-50/50">
              <span className="block text-[6px] font-bold uppercase text-gray-600">VALOR TOTAL DOS PRODUTOS</span>
              <strong className="font-mono text-[9px]">{formatCurrency(totalProdutos)}</strong>
            </div>
          </div>

          {/* Linha 2 */}
          <div className="grid grid-cols-6 divide-x divide-black text-center">
            <div className="p-1">
              <span className="block text-[6px] font-bold uppercase text-gray-600">VALOR DO FRETE</span>
              <strong className="font-mono">{formatCurrency(valorFrete)}</strong>
            </div>
            <div className="p-1">
              <span className="block text-[6px] font-bold uppercase text-gray-600">VALOR DO SEGURO</span>
              <strong className="font-mono">R$ 0,00</strong>
            </div>
            <div className="p-1">
              <span className="block text-[6px] font-bold uppercase text-gray-600">DESCONTO</span>
              <strong className="font-mono">{formatCurrency(valorDesconto)}</strong>
            </div>
            <div className="p-1">
              <span className="block text-[6px] font-bold uppercase text-gray-600">OUTRAS DESP. ACESSÓRIAS</span>
              <strong className="font-mono">R$ 0,00</strong>
            </div>
            <div className="p-1">
              <span className="block text-[6px] font-bold uppercase text-gray-600">VALOR DO IPI</span>
              <strong className="font-mono">R$ 0,00</strong>
            </div>
            <div className="p-1 bg-gray-100">
              <span className="block text-[6px] font-bold uppercase text-red-800">VALOR TOTAL DA NOTA</span>
              <strong className="font-mono text-[10px] text-red-900 font-extrabold">{formatCurrency(valorTotalNota)}</strong>
            </div>
          </div>
        </div>

        {/* =========================================================================
            6. TRANSPORTADOR / VOLUMES TRANSPORTADOS
            ========================================================================= */}
        <div className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 mb-0.5 w-full">
          TRANSPORTADOR / VOLUMES TRANSPORTADOS
        </div>
        <div className="border border-black mb-1 divide-y divide-black text-[8px] w-full" style={{ border: '1px solid #000' }}>
          {/* Linha 1 */}
          <div className="grid grid-cols-12 divide-x divide-black">
            <div className="col-span-4 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">RAZÃO SOCIAL</span>
              <span className="uppercase font-semibold truncate block">-</span>
            </div>
            <div className="col-span-3 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">FRETE POR CONTA</span>
              <strong>9 - SEM FRETE</strong>
            </div>
            <div className="col-span-1 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">CÓD. ANTT</span>
              <span>-</span>
            </div>
            <div className="col-span-1 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">PLACA VEÍCULO</span>
              <span className="font-mono">-</span>
            </div>
            <div className="col-span-1 p-1 text-center">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">UF</span>
              <span>-</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">CNPJ / CPF</span>
              <span className="font-mono truncate block">-</span>
            </div>
          </div>

          {/* Linha 2 */}
          <div className="grid grid-cols-12 divide-x divide-black">
            <div className="col-span-5 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">ENDEREÇO</span>
              <span className="uppercase truncate block">-</span>
            </div>
            <div className="col-span-4 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">MUNICÍPIO</span>
              <span className="uppercase">-</span>
            </div>
            <div className="col-span-1 p-1 text-center">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">UF</span>
              <span>-</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">INSCRIÇÃO ESTADUAL</span>
              <span className="font-mono">-</span>
            </div>
          </div>

          {/* Linha 3 */}
          <div className="grid grid-cols-12 divide-x divide-black">
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">QUANTIDADE</span>
              <span className="font-mono">-</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">ESPÉCIE</span>
              <span>-</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">MARCA</span>
              <span>-</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">NUMERAÇÃO</span>
              <span className="font-mono">-</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">PESO BRUTO</span>
              <span className="font-mono">-</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">PESO LÍQUIDO</span>
              <span className="font-mono">-</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            7. TABELA COMPLETA DE DADOS DO PRODUTO / SERVIÇOS
            ========================================================================= */}
        <div className="danfe-secao-produtos flex-1 flex flex-col min-h-[20mm] mb-1 w-full">
          <div className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 mb-0.5 shrink-0">
            DADOS DO PRODUTO / SERVIÇOS
          </div>
          <div className="border border-black flex-1 flex flex-col" style={{ border: '1px solid #000' }}>
            <table className="w-full text-left border-collapse text-[7px] leading-tight">
              <thead className="bg-gray-100 border-b border-black text-center font-bold text-[6px]" style={{ borderBottom: '1px solid #000' }}>
                <tr>
                  <th className="p-0.5 border-r border-black w-10" style={{ borderRight: '1px solid #000' }}>CÓD. PROD.</th>
                  <th className="p-0.5 border-r border-black text-left" style={{ borderRight: '1px solid #000' }}>DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                  <th className="p-0.5 border-r border-black w-14" style={{ borderRight: '1px solid #000' }}>NCM/SH</th>
                  <th className="p-0.5 border-r border-black w-10" style={{ borderRight: '1px solid #000' }}>CST</th>
                  <th className="p-0.5 border-r border-black w-10" style={{ borderRight: '1px solid #000' }}>CFOP</th>
                  <th className="p-0.5 border-r border-black w-7" style={{ borderRight: '1px solid #000' }}>UNID.</th>
                  <th className="p-0.5 border-r border-black w-10 text-right" style={{ borderRight: '1px solid #000' }}>QUANT.</th>
                  <th className="p-0.5 border-r border-black w-14 text-right" style={{ borderRight: '1px solid #000' }}>V. UNIT.</th>
                  <th className="p-0.5 border-r border-black w-14 text-right" style={{ borderRight: '1px solid #000' }}>V. TOTAL</th>
                  <th className="p-0.5 border-r border-black w-10 text-right" style={{ borderRight: '1px solid #000' }}>DESC.</th>
                  <th className="p-0.5 border-r border-black w-12 text-right" style={{ borderRight: '1px solid #000' }}>B. CÁLC. ICMS</th>
                  <th className="p-0.5 border-r border-black w-10 text-right" style={{ borderRight: '1px solid #000' }}>V. ICMS</th>
                  <th className="p-0.5 border-r border-black w-9 text-right" style={{ borderRight: '1px solid #000' }}>V. IPI</th>
                  <th className="p-0.5 border-r border-black w-7 text-center" style={{ borderRight: '1px solid #000' }}>ALÍQ. ICMS</th>
                  <th className="p-0.5 w-7 text-center">ALÍQ. IPI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {itensFiscais.map((it, idx) => (
                  <tr key={it.id || idx} className="hover:bg-gray-50/50">
                    <td className="p-0.5 border-r border-black text-center font-mono" style={{ borderRight: '1px solid #000' }}>{it.codigo}</td>
                    <td className="p-0.5 border-r border-black" style={{ borderRight: '1px solid #000' }}>
                      <span className="font-bold block uppercase">{it.descricao}</span>
                      <span className="text-[6px] text-gray-600 block">
                        Trib aprox: R$ {(it.subtotal * 0.1345).toFixed(2).replace('.', ',')} Fed/Est (Fonte: IBPT)
                      </span>
                    </td>
                    <td className="p-0.5 border-r border-black text-center font-mono" style={{ borderRight: '1px solid #000' }}>{it.ncm}</td>
                    <td className="p-0.5 border-r border-black text-center font-mono" style={{ borderRight: '1px solid #000' }}>
                      {(it.csosn && !it.csosn.includes('102')) ? (it.csosn.includes('101') ? '101' : it.csosn.split(' ')[0]) : '101'}
                    </td>
                    <td className="p-0.5 border-r border-black text-center font-mono font-bold" style={{ borderRight: '1px solid #000' }}>{it.cfop}</td>
                    <td className="p-0.5 border-r border-black text-center font-bold" style={{ borderRight: '1px solid #000' }}>{it.unidade}</td>
                    <td className="p-0.5 border-r border-black text-right font-mono" style={{ borderRight: '1px solid #000' }}>{it.quantidade.toFixed(2)}</td>
                    <td className="p-0.5 border-r border-black text-right font-mono">{formatCurrency(it.valorUnitario)}</td>
                    <td className="p-0.5 border-r border-black text-right font-mono font-bold">{formatCurrency(it.subtotal)}</td>
                    <td className="p-0.5 border-r border-black text-right font-mono">0,00</td>
                    <td className="p-0.5 border-r border-black text-right font-mono">0,00</td>
                    <td className="p-0.5 border-r border-black text-right font-mono">0,00</td>
                    <td className="p-0.5 border-r border-black text-right font-mono">0,00</td>
                    <td className="p-0.5 border-r border-black text-center font-mono" style={{ borderRight: '1px solid #000' }}>0%</td>
                    <td className="p-0.5 text-center font-mono">0%</td>
                  </tr>
                ))}
                {/* Linhas vazias organizadas para preenchimento harmônico do espelho quando há poucos itens */}
                {Array.from({ length: Math.max(0, 6 - itensFiscais.length) }).map((_, emptyIdx) => (
                  <tr key={`empty-${emptyIdx}`} className="h-[17px]">
                    <td className="p-0.5 border-r border-black text-center font-mono" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 border-r border-black" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 border-r border-black text-center font-mono" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 border-r border-black text-center font-mono" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 border-r border-black text-center font-mono" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 border-r border-black text-center font-mono" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 border-r border-black text-right font-mono" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 border-r border-black text-right font-mono" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 border-r border-black text-right font-mono" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 border-r border-black text-right font-mono" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 border-r border-black text-right font-mono" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 border-r border-black text-right font-mono" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 border-r border-black text-right font-mono" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 border-r border-black text-center font-mono" style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                    <td className="p-0.5 text-center font-mono">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================================
            8. BLOCO DE DADOS ADICIONAIS NO RODAPÉ (Altura flexível mínima de 32mm)
            ========================================================================= */}
        <div 
          className="danfe-bloco-rodape mt-auto shrink-0 pt-0.5 w-full"
          style={{ pageBreakInside: 'avoid', breakInside: 'avoid', pageBreakAfter: 'avoid', breakAfter: 'avoid', marginTop: 'auto' }}
        >
          <div className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 mb-0.5">
            DADOS ADICIONAIS
          </div>
          <div 
            className="danfe-bloco-rodape-quadro border border-black grid grid-cols-12 divide-x divide-black text-[7px]" 
            style={{ minHeight: '32mm', border: '1px solid #000', pageBreakInside: 'avoid', breakInside: 'avoid' }}
          >
            <div className="col-span-8 p-1.5 flex flex-col justify-between leading-normal overflow-hidden" style={{ borderRight: '1px solid #000' }}>
              <div>
                <span className="block text-[6.5px] font-bold uppercase text-gray-600 mb-0.5">
                  INFORMAÇÕES COMPLEMENTARES
                </span>
                <p className="font-bold text-black uppercase">
                  DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. {creditoIcms.textoCredito}
                </p>
                <p className="text-gray-800 mt-0.5">
                  Valor aproximado dos tributos: R$ {ibptFed.toFixed(2).replace('.', ',')} Federal (8,50%), R$ {ibptEst.toFixed(2).replace('.', ',')} Estadual (4,95%) e R$ 0,00 Municipal. Fonte: IBPT.
                </p>
                {quote.origemCotacoes && quote.origemCotacoes.length > 1 ? (
                  <p className="text-gray-900 mt-0.5 font-bold">
                    Ref. Cotações: <span className="font-semibold text-black">{quote.origemCotacoes.join(', ')}</span>.
                    {quote.observations && !quote.observations.includes('Ref. Cotações') ? ` Observações: ${quote.observations}.` : ''}
                  </p>
                ) : (
                  <p className="text-gray-800 mt-0.5 truncate">
                    Pedido de Venda / Cotação UsiCorte Ref: Nº {quote.quoteNumber || 'COT-1'}. {quote.observations ? `Observações: ${quote.observations}.` : ''}
                  </p>
                )}
              </div>
              
              {isPrevia && (
                <div className="mt-1 pt-1 border-t border-dashed border-red-400 text-red-700 font-bold text-[7px] uppercase">
                  ⚠️ MODO DE CONFERÊNCIA: ESTA PRÉVIA NÃO POSSUI VALIDADE FISCAL OU JURÍDICA. VALORES SUJEITOS À TRANSMISSÃO SEFAZ.
                </div>
              )}
            </div>

            <div className="col-span-4 p-1.5 flex flex-col justify-between bg-gray-50/40 overflow-hidden">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">
                RESERVADO AO FISCO
              </span>
              <div className="h-6 border border-dashed border-gray-300 rounded flex items-center justify-center text-[7px] text-gray-400 font-mono">
                [ÁREA DO FISCO]
              </div>
            </div>
          </div>

          {/* Rodapé da Folha A4 */}
          <div className="mt-1 text-center text-[6px] text-gray-500 font-mono flex items-center justify-between border-t border-gray-200 pt-0.5">
            <span>UsiCorte Metais ERP • Sistema de Emissão e Gestão Industrial</span>
            {quote.origemCotacoes && quote.origemCotacoes.length > 1 && (
              <span className="font-bold text-gray-800">
                Ref. Cotações: {quote.origemCotacoes.join(', ')}
              </span>
            )}
            <span>DANFE Modelo 55 - Versão 4.00</span>
            <span>Data de Impressão: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</span>
          </div>
        </div>

      </div>

    </div>
  );
}
