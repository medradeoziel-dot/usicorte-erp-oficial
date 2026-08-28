import React from 'react';
import CompanyHeader from './CompanyHeader';
import { CompanyFiscalData, Client } from '../types';
import { formatCurrency, formatSafeDate } from '../utils/calculator';
import { getLocalCompanyData, DEFAULT_COMPANY_DATA } from '../services/companyService';
import { RegistroPagamentoCotacao } from '../services/inventoryFinanceService';

export interface ExtratoCotacaoItem {
  id?: string;
  numero: string;
  data: string;
  cliente: string;
  clienteDoc?: string;
  clienteTelefone?: string;
  clienteEndereco?: string;
  clienteCidade?: string;
  clienteContato?: string;
  valor: number;
  pesoKg?: number;
  qtdItens?: number;
  itensResumo?: string;
  statusCotacao?: string;
  pagamento?: RegistroPagamentoCotacao;
}

interface ExtratoCobrancaPrintProps {
  cotacoes: ExtratoCotacaoItem[];
  clienteInfo?: Partial<Client> & Record<string, any>;
  periodoInicio?: string;
  periodoFim?: string;
  observacoesExtrato?: string;
  chavePixCustom?: string;
  dadosBancariosCustom?: string;
}

export default function ExtratoCobrancaPrint({
  cotacoes,
  clienteInfo,
  periodoInicio,
  periodoFim,
  observacoesExtrato,
  chavePixCustom,
  dadosBancariosCustom
}: ExtratoCobrancaPrintProps) {
  const companyData: CompanyFiscalData = getLocalCompanyData() || DEFAULT_COMPANY_DATA;

  // Totais
  const totalValor = cotacoes.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
  const totalPeso = cotacoes.reduce((acc, c) => acc + (Number(c.pesoKg) || 0), 0);
  const totalItens = cotacoes.reduce((acc, c) => acc + (Number(c.qtdItens) || 1), 0);

  // Cliente
  const nomeClientePrincipal = clienteInfo?.nomeFantasia || clienteInfo?.nome || cotacoes[0]?.cliente || 'CLIENTE';
  const docCliente = clienteInfo?.document || clienteInfo?.documento || cotacoes[0]?.clienteDoc || '';
  const foneCliente = clienteInfo?.phone || clienteInfo?.telefone || cotacoes[0]?.clienteTelefone || '';
  const emailCliente = clienteInfo?.email || '';
  const enderecoCliente = clienteInfo?.street || clienteInfo?.endereco || cotacoes[0]?.clienteEndereco || '';
  const cidadeUfCliente = (clienteInfo?.city || clienteInfo?.cidade) 
    ? `${clienteInfo?.city || clienteInfo?.cidade} / ${clienteInfo?.state || clienteInfo?.uf || 'SP'}`
    : (cotacoes[0]?.clienteCidade || '');
  const contatoCliente = clienteInfo?.contactPerson || clienteInfo?.contato || cotacoes[0]?.clienteContato || '';

  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // Formatação de período
  const periodoTexto = (periodoInicio && periodoFim)
    ? `${formatSafeDate(periodoInicio)} até ${formatSafeDate(periodoFim)}`
    : periodoInicio
    ? `A partir de ${formatSafeDate(periodoInicio)}`
    : periodoFim
    ? `Até ${formatSafeDate(periodoFim)}`
    : 'Consolidado Geral';

  const chavePix = chavePixCustom || companyData.cnpj || '25.038.430/0001-23';
  const dadosBancarios = dadosBancariosCustom || 'Banco: BANCO DO BRASIL | Agência: 0037-X | Conta Corrente: 45.890-1';

  return (
    <div className="secao-extrato bg-white text-black p-6 sm:p-8 max-w-[850px] mx-auto font-sans leading-relaxed text-xs">
      {/* 1. CABEÇALHO OFICIAL COM LOGO E DADOS DA EMPRESA */}
      <CompanyHeader 
        compact={false}
        showBorder={true}
        documentType="EXTRATO DE COBRANÇA E FECHAMENTO"
        documentDate={dataAtual}
        tag="FATURAMENTO"
        tagColor="blue"
      />

      {/* 2. DADOS DO CLIENTE & METADADOS DO EXTRATO */}
      <div className="border border-slate-400 rounded-lg p-3.5 mb-4 bg-slate-50/70">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
              Dados do Cliente / Sacado
            </div>
            <div className="text-sm font-black text-slate-900 uppercase">
              {nomeClientePrincipal}
            </div>
            {docCliente && (
              <div className="text-xs text-slate-800 font-semibold mt-0.5">
                <span className="text-slate-600">CNPJ/CPF:</span> <span className="font-mono">{docCliente}</span>
              </div>
            )}
            {enderecoCliente && (
              <div className="text-xs text-slate-700 mt-0.5">
                <span className="text-slate-600">Endereço:</span> {enderecoCliente} {cidadeUfCliente ? ` - ${cidadeUfCliente}` : ''}
              </div>
            )}
            {foneCliente && (
              <div className="text-xs text-slate-700 mt-0.5">
                <span className="text-slate-600">Telefone / Whats:</span> {foneCliente}
                {contatoCliente ? ` (A/C ${contatoCliente})` : ''}
              </div>
            )}
            {emailCliente && (
              <div className="text-xs text-slate-700 mt-0.5">
                <span className="text-slate-600">E-mail:</span> {emailCliente}
              </div>
            )}
          </div>

          <div className="md:text-right border-t md:border-t-0 pt-2 md:pt-0 border-slate-200 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                Resumo do Faturamento
              </div>
              <div className="text-xs text-slate-800">
                <span className="text-slate-600">Período de Referência:</span> <strong>{periodoTexto}</strong>
              </div>
              <div className="text-xs text-slate-800 mt-0.5">
                <span className="text-slate-600">Data de Emissão do Extrato:</span> <strong>{dataAtual}</strong>
              </div>
              <div className="text-xs text-slate-800 mt-0.5">
                <span className="text-slate-600">Total de Pedidos/Cotações:</span> <strong>{cotacoes.length}</strong>
              </div>
            </div>

            <div className="mt-2 inline-block md:self-end bg-blue-50 border border-blue-200 rounded px-3 py-1.5 text-left">
              <span className="text-[10px] uppercase font-bold text-blue-800 block">Total a Cobrar</span>
              <span className="text-base font-black text-blue-950 font-mono">
                {formatCurrency(totalValor)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. TABELA ORGANIZADA DE COTAÇÕES / PEDIDOS SELECIONADOS */}
      <div className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-900 mb-1.5 flex items-center justify-between">
          <span>Demonstrativo Detalhado de Cotações / Pedidos</span>
          <span className="text-[10px] text-slate-600 font-normal">
            ({cotacoes.length} {cotacoes.length === 1 ? 'registro' : 'registros'})
          </span>
        </div>

        <table className="w-full border-collapse border border-slate-400 text-xs">
          <thead>
            <tr className="bg-slate-200 text-slate-900 border-b border-slate-400 font-bold uppercase text-[10px]">
              <th className="border border-slate-400 px-2 py-1.5 text-center w-12">Item</th>
              <th className="border border-slate-400 px-2 py-1.5 text-center w-24">Nº Cotação</th>
              <th className="border border-slate-400 px-2 py-1.5 text-center w-20">Data</th>
              <th className="border border-slate-400 px-3 py-1.5 text-left">Descrição dos Materiais / Serviços</th>
              <th className="border border-slate-400 px-2 py-1.5 text-center w-20">Status</th>
              <th className="border border-slate-400 px-2 py-1.5 text-right w-28">Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            {cotacoes.map((c, index) => {
              const isPago = c.pagamento?.status === 'Pago';
              return (
                <tr 
                  key={c.id || c.numero || index}
                  className={`border-b border-slate-300 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                >
                  <td className="border border-slate-300 px-2 py-2 text-center text-slate-600 font-mono text-[11px]">
                    {String(index + 1).padStart(2, '0')}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center font-mono font-bold text-slate-900 text-[11px]">
                    {c.numero}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center text-slate-700 whitespace-nowrap">
                    {formatSafeDate(c.data)}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-slate-800">
                    <div className="font-semibold text-[11.5px] leading-snug uppercase tracking-wide">
                      SERVIÇOS DE CORTE DIVERSOS
                    </div>
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center">
                    <span 
                      className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                        isPago 
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {isPago ? 'Pago' : 'Pendente'}
                    </span>
                    {isPago && c.pagamento?.dataPagamento && (
                      <span className="block text-[8.5px] text-slate-500 mt-0.5">
                        {formatSafeDate(c.pagamento.dataPagamento)}
                      </span>
                    )}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
                    {formatCurrency(c.valor)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {/* SUBTOTAIS E DESTAQUE TOTAL */}
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
              <td colSpan={4} className="border border-slate-400 px-3 py-2 text-right uppercase text-slate-700 text-[11px]">
                Subtotal de {cotacoes.length} {cotacoes.length === 1 ? 'Cotação' : 'Cotações'}:
              </td>
              <td colSpan={2} className="border border-slate-400 px-3 py-2 text-right font-mono text-xs text-slate-900">
                {formatCurrency(totalValor)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 4. QUADRO DE DESTAQUE: TOTAL GERAL A PAGAR */}
      <div className="border-2 border-slate-900 rounded-lg p-3.5 mb-4 bg-slate-900 text-white flex items-center justify-between shadow-sm">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-slate-300 block">
            Valor Total Geral a Pagar
          </span>
          <span className="text-[11px] text-slate-400">
            Referente a todas as cotações listadas acima
          </span>
        </div>
        <div className="text-right">
          <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
            {formatCurrency(totalValor)}
          </span>
        </div>
      </div>

      {/* 5. DADOS PARA PAGAMENTO (CHAVE PIX E DADOS BANCÁRIOS) */}
      <div className="border border-slate-300 rounded-lg p-3.5 mb-4 bg-slate-50">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2 flex items-center gap-1.5">
          <span>💳 Informações para Pagamento & Chave PIX</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-white border border-slate-200 rounded p-2.5">
            <div className="text-[10px] font-bold uppercase text-slate-600 mb-0.5">Chave PIX Oficial</div>
            <div className="text-sm font-mono font-black text-slate-900 select-all">
              {chavePix}
            </div>
            <div className="text-[10px] text-slate-600 mt-1">
              Favorecido: <strong>{companyData.corporateName || DEFAULT_COMPANY_DATA.corporateName}</strong>
            </div>
            <div className="text-[9.5px] text-slate-500 mt-0.5">
              Tipo da Chave: CNPJ / E-mail ({companyData.email || 'financeirousicorte@gmail.com'})
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-2.5">
            <div className="text-[10px] font-bold uppercase text-slate-600 mb-0.5">Dados Bancários / Transferência</div>
            <div className="text-xs text-slate-900 font-semibold leading-relaxed">
              {dadosBancarios}
            </div>
            <div className="text-[10px] text-slate-600 mt-1">
              Titular: <strong>{companyData.corporateName || DEFAULT_COMPANY_DATA.corporateName}</strong>
            </div>
            <div className="text-[9.5px] text-slate-500 mt-0.5">
              CNPJ: {companyData.cnpj || DEFAULT_COMPANY_DATA.cnpj}
            </div>
          </div>
        </div>

        <div className="mt-2.5 text-[10px] text-slate-600 italic bg-amber-50 border border-amber-200 rounded p-2 text-center">
          📌 <strong>Importante:</strong> Após efetuar o pagamento, favor encaminhar o comprovante para o WhatsApp <strong>(14) 99880-9362 / (14) 99819-6873</strong> ou e-mail <strong>financeirousicorte@gmail.com</strong> para rápida conciliação e baixa no sistema.
        </div>
      </div>

      {/* 6. OBSERVAÇÕES E RODAPÉ DO EXTRATO */}
      {observacoesExtrato && (
        <div className="border border-slate-300 rounded p-2.5 mb-4 text-xs text-slate-700 bg-white">
          <strong className="text-slate-900 block mb-0.5 text-[10.5px] uppercase">Observações Complementares:</strong>
          <p className="whitespace-pre-line">{observacoesExtrato}</p>
        </div>
      )}

      {/* 7. ASSINATURAS / TERMO DE CONFERÊNCIA */}
      <div className="grid grid-cols-2 gap-8 pt-6 mt-4 border-t border-slate-300 text-center text-xs">
        <div>
          <div className="border-b border-slate-400 w-4/5 mx-auto mb-1"></div>
          <div className="font-bold text-slate-900">{companyData.tradeName || 'USICORTE METAIS'}</div>
          <div className="text-[10px] text-slate-600">Departamento Financeiro / Vendas</div>
        </div>

        <div>
          <div className="border-b border-slate-400 w-4/5 mx-auto mb-1"></div>
          <div className="font-bold text-slate-900 uppercase">{nomeClientePrincipal}</div>
          <div className="text-[10px] text-slate-600">Conferência & De Acordo</div>
        </div>
      </div>
    </div>
  );
}
