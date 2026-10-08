import React, { useRef } from 'react';
import { Quote, Client } from '../types';
import { CompanyFiscalData, DEFAULT_COMPANY_DATA } from '../services/companyService';
import { ItemFiscalNfe, prepararItensFiscais, formatarChaveAcesso, gerarChaveAcessoNfe } from '../services/nfeService';
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
  Scissors
} from 'lucide-react';

interface DanfeEspelhoA4Props {
  quote: Quote;
  client?: Client | null;
  company?: CompanyFiscalData;
  isPrevia?: boolean;
  onClose: () => void;
  onTransmitir?: () => void;
  onOpenEdit?: () => void;
  isTransmitting?: boolean;
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
  isPrevia = quote.status_nfe !== 'Emitida',
  onClose,
  onTransmitir,
  onOpenEdit,
  isTransmitting = false
}: DanfeEspelhoA4Props) {
  const printRef = useRef<HTMLDivElement>(null);

  // 1. Dados do Emitente
  const emitente = {
    razaoSocial: company.corporateName || company.razao_social || 'L. M. BANZATTO METAIS',
    nomeFantasia: company.tradeName || company.nome_fantasia || 'USICORTE METAIS',
    cnpj: company.cnpj || '25.038.430/0001-23',
    ie: company.ie || company.inscricao_estadual || '20963213114',
    endereco: company.street || company.endereco || 'RUA PADRE FRANCISCO VAN DER MAAS, 3-41',
    bairro: company.neighborhood || company.bairro || 'PARQUE PAULISTA',
    cidade: company.city || company.cidade || 'BAURU',
    uf: company.state || company.uf || 'SP',
    cep: company.cep || '17031-190',
    telefone: company.phone || company.telefone || '(14) 3203-2000',
    email: company.email || 'contato@usicorte.com.br'
  };

  // 2. Destinatário
  const destUf = (client?.state || client?.uf || quote.clientState || 'SP').toUpperCase();
  const clienteInfo = {
    nome: client?.name || client?.nome || quote.clientName || 'CLIENTE BALCÃO / CONSUMIDOR FINAL',
    doc: client?.document || client?.documento || quote.clientDocument || 'NÃO INFORMADO',
    ie: client?.inscricao_estadual || client?.inscricaoEstadual || client?.ie || 'ISENTO',
    endereco: client?.street || client?.endereco || quote.clientStreet || 'ENDEREÇO COMERCIAL',
    bairro: client?.neighborhood || client?.bairro || 'CENTRO',
    cidade: client?.city || client?.cidade || quote.clientCity || 'BAURU',
    uf: destUf,
    cep: client?.cep || quote.clientCep || '17000-000',
    telefone: client?.phone || client?.telefone || quote.clientPhone || '-'
  };

  // 3. Itens Fiscais
  const itensFiscais: ItemFiscalNfe[] = prepararItensFiscais(quote.items, destUf);

  // 4. Totais e Cálculos
  const totalProdutos = quote.subtotalTotal || itensFiscais.reduce((acc, it) => acc + it.subtotal, 0);
  const valorFrete = quote.shipping || 0;
  const valorDesconto = quote.discount || 0;
  const valorTotalNota = quote.grandTotal || (totalProdutos - valorDesconto + valorFrete);

  const pesoTotal = quote.totalWeightKg || quote.items?.reduce((acc, it) => acc + (it.totalWeightKg || it.pesoTotal || 0), 0) || 0;

  // 5. Dados da NF-e
  const numeroNfe = quote.nfe_numero || String(quote.quoteNumber || '1').replace(/\D/g, '').slice(-6).padStart(6, '0') || '000001';
  const serie = quote.serie_nfe || '1';
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

  // 7. Duplicatas / Parcelas
  const duplicatas = [
    {
      numero: `${numeroNfe}/01`,
      vencimento: formatSafeDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      valor: valorTotalNota
    }
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-between overflow-y-auto p-2 sm:p-4 print:p-0 print:bg-white print:static print:z-auto print:inset-auto">
      
      {/* Barra de Ações Superior (Oculta na Impressão) */}
      <div className="w-full max-w-[210mm] bg-slate-900 border border-slate-800 rounded-t-xl px-4 py-3 flex items-center justify-between gap-3 text-slate-100 shadow-xl shrink-0 print:hidden mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-1.5 rounded-lg ${isPrevia ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
            <FileText className="w-5 h-5 shrink-0" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-sm tracking-wide flex items-center gap-2 truncate">
              {isPrevia ? 'Espelho DANFE (Prévia Oficial A4)' : 'DANFE Oficial - Modelo 55'}
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase tracking-wider ${
                isPrevia ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {isPrevia ? 'Modo Conferência' : 'Emitida SEFAZ'}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 truncate">
              NF-e Nº {numeroNfe} • Série {serie} • {clienteInfo.nome}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenEdit && (
            <button
              type="button"
              onClick={onOpenEdit}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Revisar Dados
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
            title="Imprimir DANFE na folha A4 oficial"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir A4</span>
          </button>

          {isPrevia && onTransmitir && (
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

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          FOLHA A4 OFICIAL - ESPELHO RIGOROSO DA DANFE MODELO 55
          ========================================================================= */}
      <div 
        ref={printRef}
        id="folha-danfe-a4"
        className="w-full max-w-[210mm] min-h-[297mm] bg-white text-black p-[6mm] shadow-2xl relative select-text border border-gray-300 font-sans print:shadow-none print:border-none print:p-[4mm] print:m-0 print:w-full print:max-w-none text-[8.5px] leading-tight"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        
        {/* Marca d'água Diagonal Central de Conferência */}
        {isPrevia && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-30 overflow-hidden">
            <div className="rotate-[-28deg] border-4 border-dashed border-red-600/25 text-red-600/20 font-black text-4xl sm:text-5xl uppercase tracking-widest p-8 text-center rounded-2xl max-w-xl">
              PRÉVIA - SEM VALOR FISCAL<br />
              <span className="text-xl sm:text-2xl font-bold tracking-normal text-red-700/25">
                MODO DE CONFERÊNCIA
              </span>
            </div>
          </div>
        )}

        {/* =========================================================================
            1. CANHOTO SUPERIOR (Declaração de Recebimento)
            ========================================================================= */}
        <div className="border border-black mb-1">
          <div className="grid grid-cols-12">
            <div className="col-span-10 p-1 border-r border-black flex flex-col justify-between">
              <div className="text-[7.5px] uppercase font-semibold leading-tight text-gray-800">
                RECEBEMOS DE <strong>{emitente.razaoSocial}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO.
              </div>
              <div className="grid grid-cols-12 gap-1 mt-2 pt-1 border-t border-black">
                <div className="col-span-4 border-r border-black pr-1">
                  <span className="block text-[6.5px] font-bold uppercase text-gray-600">DATA DE RECEBIMENTO</span>
                  <div className="h-5 flex items-end font-mono text-[8px] text-gray-400">___ / ___ / ______</div>
                </div>
                <div className="col-span-8 pl-1">
                  <span className="block text-[6.5px] font-bold uppercase text-gray-600">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span>
                  <div className="h-5 flex items-end font-mono text-[8px] text-gray-400">________________________________________________________________</div>
                </div>
              </div>
            </div>

            <div className="col-span-2 p-1 text-center flex flex-col justify-center items-center bg-gray-50/50">
              <span className="font-extrabold text-[12px] leading-tight">NF-e</span>
              <span className="font-bold text-[9px] mt-0.5">Nº {numeroNfe}</span>
              <span className="text-[7.5px] text-gray-700">SÉRIE {serie}</span>
            </div>
          </div>
        </div>

        {/* Linha pontilhada de destaque com tesourinha */}
        <div className="relative flex items-center justify-center my-1 border-b border-dashed border-gray-500">
          <span className="absolute bg-white px-2 text-[7px] text-gray-500 uppercase tracking-widest flex items-center gap-1 font-mono">
            <Scissors className="w-2.5 h-2.5 rotate-90" /> Destaque aqui
          </span>
        </div>

        {/* =========================================================================
            2. CABEÇALHO DA EMISSÃO
            ========================================================================= */}
        <div className="grid grid-cols-12 border border-black mb-1">
          {/* Coluna 1: Emitente & Logo */}
          <div className="col-span-5 p-1.5 border-r border-black flex flex-col justify-between">
            <div className="flex items-start gap-2">
              <div className="w-24 shrink-0">
                <Logo variant="print" className="h-9 w-auto" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-[10px] uppercase leading-tight tracking-tight text-black">
                  {emitente.razaoSocial}
                </h1>
                <h2 className="font-bold text-[9px] text-red-700 uppercase leading-none mt-0.5">
                  {emitente.nomeFantasia}
                </h2>
              </div>
            </div>
            
            <div className="text-[7.5px] text-gray-800 mt-1 leading-tight">
              <span>{emitente.endereco} - {emitente.bairro}</span><br />
              <span>{emitente.cidade} - {emitente.uf} • CEP: {emitente.cep}</span><br />
              <span>Fone: {emitente.telefone} • E-mail: {emitente.email}</span>
            </div>
          </div>

          {/* Coluna 2: DANFE Box */}
          <div className="col-span-3 p-1.5 border-r border-black text-center flex flex-col justify-between items-center bg-gray-50/30">
            <div>
              <span className="font-black text-sm tracking-widest block leading-none">DANFE</span>
              <span className="text-[7px] leading-tight block text-gray-700 mt-0.5">
                Documento Auxiliar da<br />Nota Fiscal Eletrônica
              </span>
            </div>

            <div className="border border-black px-2 py-0.5 my-1 text-[8px] font-bold inline-block">
              <span className="text-gray-500">0 - ENTRADA</span><br />
              <strong className="text-black">1 - SAÍDA [ 1 ]</strong>
            </div>

            <div>
              <div className="font-bold text-[10px] leading-tight">Nº {numeroNfe}</div>
              <div className="text-[8px] font-semibold text-gray-800">SÉRIE {serie}</div>
              <div className="text-[7.5px] text-gray-600">FOLHA 1 / 1</div>
            </div>
          </div>

          {/* Coluna 3: Código de Barras & Chave de Acesso */}
          <div className="col-span-4 p-1.5 flex flex-col justify-between">
            <div>
              <BarcodeSimulado chave={chaveAcessoRaw} />
              
              <div className="mt-0.5">
                <span className="block text-[6.5px] font-bold uppercase text-gray-600">CHAVE DE ACESSO</span>
                <div className="font-mono text-[8px] font-bold text-black tracking-wider break-all leading-tight">
                  {chaveFormatada}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-300 pt-1 mt-1 text-[7px] text-gray-700 leading-tight">
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

            <div className="border-t border-black pt-0.5 mt-0.5">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
              <div className="font-bold text-[8.5px] text-black truncate">
                {protocolo}
              </div>
            </div>
          </div>
        </div>

        {/* Natureza da Operação / Inscrição Estadual / CNPJ */}
        <div className="border border-black mb-1 grid grid-cols-12 divide-x divide-black text-[8px]">
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
        <div className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 mb-0.5">
          DESTINATÁRIO / REMETENTE
        </div>
        <div className="border border-black mb-1 divide-y divide-black text-[8px]">
          {/* Linha 1 */}
          <div className="grid grid-cols-12 divide-x divide-black">
            <div className="col-span-7 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">NOME / RAZÃO SOCIAL</span>
              <strong className="text-[9px] uppercase truncate block">{clienteInfo.nome}</strong>
            </div>
            <div className="col-span-3 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">CNPJ / CPF</span>
              <strong className="font-mono text-[8.5px]">{clienteInfo.doc}</strong>
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
              <span className="uppercase truncate block">{clienteInfo.endereco}</span>
            </div>
            <div className="col-span-3 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">BAIRRO / DISTRITO</span>
              <span className="uppercase truncate block">{clienteInfo.bairro}</span>
            </div>
            <div className="col-span-1 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">CEP</span>
              <span className="font-mono">{clienteInfo.cep}</span>
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
              <span className="uppercase truncate block">{clienteInfo.cidade}</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">FONE / FAX</span>
              <span>{clienteInfo.telefone}</span>
            </div>
            <div className="col-span-1 p-1 text-center">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">UF</span>
              <strong className="text-[8.5px]">{clienteInfo.uf}</strong>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">INSCRIÇÃO ESTADUAL</span>
              <strong className="font-mono">{clienteInfo.ie}</strong>
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
        <div className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 mb-0.5">
          FATURA / DUPLICATAS
        </div>
        <div className="border border-black mb-1 p-1">
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
            {duplicatas.map((dup, idx) => (
              <div key={idx} className="border border-gray-400 p-1 rounded-xs bg-gray-50/50 text-[7.5px]">
                <div className="flex justify-between text-gray-600 text-[6.5px]">
                  <span>Nº DUP:</span>
                  <strong className="text-black font-mono">{dup.numero}</strong>
                </div>
                <div className="flex justify-between text-gray-600 text-[6.5px] mt-0.5">
                  <span>VENC:</span>
                  <strong className="text-black">{dup.vencimento}</strong>
                </div>
                <div className="flex justify-between text-gray-800 font-bold mt-0.5 border-t border-gray-300 pt-0.5">
                  <span>VALOR:</span>
                  <strong className="text-black font-mono">{formatCurrency(dup.valor)}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* =========================================================================
            5. CÁLCULO DO IMPOSTO (GRADE OFICIAL COMPLETA)
            ========================================================================= */}
        <div className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 mb-0.5">
          CÁLCULO DO IMPOSTO
        </div>
        <div className="border border-black mb-1 divide-y divide-black text-[8px]">
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
        <div className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 mb-0.5">
          TRANSPORTADOR / VOLUMES TRANSPORTADOS
        </div>
        <div className="border border-black mb-1 divide-y divide-black text-[8px]">
          {/* Linha 1 */}
          <div className="grid grid-cols-12 divide-x divide-black">
            <div className="col-span-5 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">RAZÃO SOCIAL</span>
              <span className="uppercase font-semibold truncate block">NOSSO CARRO / RETIRA NO BALCÃO</span>
            </div>
            <div className="col-span-3 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">FRETE POR CONTA</span>
              <strong>{valorFrete > 0 ? '0 - EMITENTE (CIF)' : '9 - SEM FRETE'}</strong>
            </div>
            <div className="col-span-1 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">CÓD. ANTT</span>
              <span>-</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">PLACA DO VEÍCULO</span>
              <span className="font-mono">-</span>
            </div>
            <div className="col-span-1 p-1 text-center">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">UF</span>
              <span>SP</span>
            </div>
          </div>

          {/* Linha 2 */}
          <div className="grid grid-cols-12 divide-x divide-black">
            <div className="col-span-5 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">ENDEREÇO</span>
              <span className="uppercase truncate block">{emitente.endereco}</span>
            </div>
            <div className="col-span-4 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">MUNICÍPIO</span>
              <span className="uppercase">{emitente.cidade}</span>
            </div>
            <div className="col-span-1 p-1 text-center">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">UF</span>
              <span>{emitente.uf}</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">INSCRIÇÃO ESTADUAL</span>
              <span className="font-mono">{emitente.ie}</span>
            </div>
          </div>

          {/* Linha 3 */}
          <div className="grid grid-cols-12 divide-x divide-black">
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">QUANTIDADE</span>
              <strong className="font-mono">{itensFiscais.length || 1}</strong>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">ESPÉCIE</span>
              <span>VOLUMES</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">MARCA</span>
              <strong>USICORTE</strong>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">NUMERAÇÃO</span>
              <span className="font-mono">-</span>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">PESO BRUTO</span>
              <strong className="font-mono">{pesoTotal ? pesoTotal.toFixed(3) : '0,000'} kg</strong>
            </div>
            <div className="col-span-2 p-1">
              <span className="block text-[6.5px] font-bold uppercase text-gray-600">PESO LÍQUIDO</span>
              <strong className="font-mono">{pesoTotal ? pesoTotal.toFixed(3) : '0,000'} kg</strong>
            </div>
          </div>
        </div>

        {/* =========================================================================
            7. TABELA COMPLETA DE DADOS DO PRODUTO / SERVIÇOS
            ========================================================================= */}
        <div className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 mb-0.5">
          DADOS DO PRODUTO / SERVIÇOS
        </div>
        <div className="border border-black mb-1 overflow-hidden">
          <table className="w-full text-left border-collapse text-[7.5px] leading-tight">
            <thead className="bg-gray-100 border-b border-black text-center font-bold text-[6.5px]">
              <tr>
                <th className="p-0.5 border-r border-black w-10">CÓD. PROD.</th>
                <th className="p-0.5 border-r border-black text-left">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                <th className="p-0.5 border-r border-black w-14">NCM/SH</th>
                <th className="p-0.5 border-r border-black w-10">CST</th>
                <th className="p-0.5 border-r border-black w-10">CFOP</th>
                <th className="p-0.5 border-r border-black w-7">UNID.</th>
                <th className="p-0.5 border-r border-black w-10 text-right">QUANT.</th>
                <th className="p-0.5 border-r border-black w-14 text-right">V. UNIT.</th>
                <th className="p-0.5 border-r border-black w-14 text-right">V. TOTAL</th>
                <th className="p-0.5 border-r border-black w-10 text-right">DESC.</th>
                <th className="p-0.5 border-r border-black w-12 text-right">B. CÁLC. ICMS</th>
                <th className="p-0.5 border-r border-black w-10 text-right">V. ICMS</th>
                <th className="p-0.5 border-r border-black w-9 text-right">V. IPI</th>
                <th className="p-0.5 border-r border-black w-7 text-center">ALÍQ. ICMS</th>
                <th className="p-0.5 w-7 text-center">ALÍQ. IPI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {itensFiscais.map((it, idx) => (
                <tr key={it.id || idx} className="hover:bg-gray-50/50">
                  <td className="p-0.5 border-r border-black text-center font-mono">{it.codigo}</td>
                  <td className="p-0.5 border-r border-black">
                    <span className="font-bold block uppercase">{it.descricao}</span>
                    <span className="text-[6.5px] text-gray-600 block">
                      Trib aprox: R$ {(it.subtotal * 0.1345).toFixed(2).replace('.', ',')} Fed/Est (Fonte: IBPT)
                    </span>
                  </td>
                  <td className="p-0.5 border-r border-black text-center font-mono">{it.ncm}</td>
                  <td className="p-0.5 border-r border-black text-center font-mono">{it.csosn.split(' ')[0]}</td>
                  <td className="p-0.5 border-r border-black text-center font-mono font-bold">{it.cfop}</td>
                  <td className="p-0.5 border-r border-black text-center font-bold">{it.unidade}</td>
                  <td className="p-0.5 border-r border-black text-right font-mono">{it.quantidade.toFixed(2)}</td>
                  <td className="p-0.5 border-r border-black text-right font-mono">{formatCurrency(it.valorUnitario)}</td>
                  <td className="p-0.5 border-r border-black text-right font-mono font-bold">{formatCurrency(it.subtotal)}</td>
                  <td className="p-0.5 border-r border-black text-right font-mono">0,00</td>
                  <td className="p-0.5 border-r border-black text-right font-mono">0,00</td>
                  <td className="p-0.5 border-r border-black text-right font-mono">0,00</td>
                  <td className="p-0.5 border-r border-black text-right font-mono">0,00</td>
                  <td className="p-0.5 border-r border-black text-center font-mono">0%</td>
                  <td className="p-0.5 text-center font-mono">0%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* =========================================================================
            8. DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES
            ========================================================================= */}
        <div className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 mb-0.5">
          DADOS ADICIONAIS
        </div>
        <div className="border border-black grid grid-cols-12 divide-x divide-black text-[7.5px] min-h-[52px]">
          <div className="col-span-8 p-1.5 flex flex-col justify-between leading-normal">
            <div>
              <span className="block text-[6.5px] font-bold uppercase text-gray-600 mb-0.5">
                INFORMAÇÕES COMPLEMENTARES
              </span>
              <p className="font-bold text-black uppercase">
                DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI E ICMS.
              </p>
              <p className="text-gray-800 mt-0.5">
                Valor aproximado dos tributos: R$ {ibptFed.toFixed(2).replace('.', ',')} Federal (8,50%), R$ {ibptEst.toFixed(2).replace('.', ',')} Estadual (4,95%) e R$ 0,00 Municipal. Fonte: IBPT.
              </p>
              <p className="text-gray-800 mt-0.5">
                Pedido de Venda / Cotação UsiCorte Ref: Nº {quote.quoteNumber || 'COT-1'}. {quote.observations ? `Observações: ${quote.observations}.` : ''}
              </p>
            </div>
            
            {isPrevia && (
              <div className="mt-1 pt-1 border-t border-dashed border-red-400 text-red-700 font-bold text-[7px] uppercase">
                ⚠️ MODO DE CONFERÊNCIA: ESTA PRÉVIA NÃO POSSUI VALIDADE FISCAL OU JURÍDICA. VALORES SUJEITOS À TRANSMISSÃO SEFAZ.
              </div>
            )}
          </div>

          <div className="col-span-4 p-1.5 flex flex-col justify-between bg-gray-50/40">
            <span className="block text-[6.5px] font-bold uppercase text-gray-600">
              RESERVADO AO FISCO
            </span>
            <div className="h-10 border border-dashed border-gray-300 rounded flex items-center justify-center text-[7px] text-gray-400 font-mono">
              [ÁREA DO FISCO]
            </div>
          </div>
        </div>

        {/* Rodapé da Folha A4 */}
        <div className="mt-2 text-center text-[6.5px] text-gray-500 font-mono flex items-center justify-between border-t border-gray-200 pt-1">
          <span>UsiCorte Metais ERP • Sistema de Emissão e Gestão Industrial</span>
          <span>DANFE Modelo 55 - Versão 4.00</span>
          <span>Data de Impressão: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</span>
        </div>

      </div>

    </div>
  );
}
