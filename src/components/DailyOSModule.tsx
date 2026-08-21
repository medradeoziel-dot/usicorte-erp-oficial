import React, { useState, useEffect } from 'react';
import { Client, ItemOS, OrdemServico } from '../types';
import { 
  FileText, 
  PlusCircle, 
  Lock, 
  CheckCircle2, 
  Clock, 
  User, 
  Calendar, 
  DollarSign, 
  Printer, 
  Trash2, 
  AlertCircle,
  Building2,
  TrendingUp,
  Package
} from 'lucide-react';
import { formatCurrency } from '../utils/calculator';
import Logo from './Logo';

interface DailyOSModuleProps {
  clients: Client[];
  onNavigateToClients?: () => void;
}

export default function DailyOSModule({ clients, onNavigateToClients }: DailyOSModuleProps) {
  // Persistence key
  const STORAGE_KEY = 's_ordens_servico_diarias';

  // State
  const [ordens, setOrdens] = useState<OrdemServico[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao carregar ordens de serviço salvas', e);
      }
    }
    // Initial sample seed if empty
    const dataHoje = new Date().toISOString().split('T')[0];
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return [
      {
        id: '1001',
        clienteId: 'seed-1',
        clienteNome: 'Brasil Tecnologias Ltda',
        data: dataHoje,
        status: 'ABERTA',
        itens: [
          {
            id: 'item-os-1',
            descricao: 'Corte Plasma Chapa Aço SAE 1020 1/2" x 1200 x 2400 mm',
            quantidade: 2,
            valorUnitario: 6316.57,
            valorTotal: 12633.14,
            horario: horaAtual
          }
        ]
      }
    ];
  });

  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [descricaoItem, setDescricaoItem] = useState('');
  const [quantidade, setQuantidade] = useState<number | string>(1);
  const [valorUnitario, setValorUnitario] = useState<number | string>(0);
  const [filtroData, setFiltroData] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filtroStatus, setFiltroStatus] = useState<'TODAS' | 'ABERTA' | 'CONCLUIDA'>('TODAS');

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ordens));
  }, [ordens]);

  // Fallback client list if no props passed
  const listaClientes = clients && clients.length > 0 ? clients : [
    { id: '1', name: 'Metalúrgica Silva', document: '12.345.678/0001-90', phone: '(11) 98888-7777', email: 'contato@metalurgicasilva.com.br', type: 'CNPJ', cep: '', street: '', neighborhood: '', city: 'São Paulo', state: 'SP', situation: 'ATIVA', enabled: true, registrationDate: '' },
    { id: '2', name: 'Indústria Mecânica AçoForte', document: '98.765.432/0001-10', phone: '(11) 97777-6666', email: 'compras@acoforte.ind.br', type: 'CNPJ', cep: '', street: '', neighborhood: '', city: 'Santo André', state: 'SP', situation: 'ATIVA', enabled: true, registrationDate: '' },
    { id: '3', name: 'Usinagem Precision', document: '45.678.901/0001-22', phone: '(11) 96666-5555', email: 'precision@usinagem.com.br', type: 'CNPJ', cep: '', street: '', neighborhood: '', city: 'Bernardo do Campo', state: 'SP', situation: 'ATIVA', enabled: true, registrationDate: '' }
  ];

  // 1. Lógica Principal: Adicionar item à OS do Dia (Cria ou Reutiliza OS ABERTA do Cliente)
  const handleAdicionarItem = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clienteSelecionado) {
      alert('Por favor, selecione um cliente.');
      return;
    }

    if (!descricaoItem.trim()) {
      alert('Por favor, digite a descrição do produto ou serviço.');
      return;
    }

    const qty = Number(quantidade) > 0 ? Number(quantidade) : 1;
    const vUnit = Number(valorUnitario) >= 0 ? Number(valorUnitario) : 0;

    const dataHoje = new Date().toISOString().split('T')[0];
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const clienteObj = listaClientes.find(c => c.id === clienteSelecionado);
    const clienteNomeStr = clienteObj ? clienteObj.name : 'Cliente Desconhecido';

    const novoItem: ItemOS = {
      id: Math.random().toString(36).substring(2, 9),
      descricao: descricaoItem.trim(),
      quantidade: qty,
      valorUnitario: vUnit,
      valorTotal: qty * vUnit,
      horario: horaAtual
    };

    // Verifica se já existe OS ABERTA para o cliente HOJE
    const osExistente = ordens.find(
      os => os.clienteId === clienteSelecionado && os.data === dataHoje && os.status === 'ABERTA'
    );

    if (osExistente) {
      // Reutiliza a OS existente adicionando o novo item
      setOrdens(prev =>
        prev.map(os =>
          os.id === osExistente.id
            ? { ...os, itens: [...os.itens, novoItem] }
            : os
        )
      );
      alert(`✅ Item adicionado à OS existente #${osExistente.id} do cliente ${clienteNomeStr}!`);
    } else {
      // Cria uma nova OS para o dia
      const novaOS: OrdemServico = {
        id: Math.floor(1000 + Math.random() * 9000).toString(),
        clienteId: clienteSelecionado,
        clienteNome: clienteNomeStr,
        data: dataHoje,
        status: 'ABERTA',
        itens: [novoItem]
      };
      setOrdens(prev => [novaOS, ...prev]);
      alert(`🚀 Nova OS #${novaOS.id} criada para hoje para o cliente ${clienteNomeStr}!`);
    }

    // Limpa formulário
    setDescricaoItem('');
    setQuantidade(1);
    setValorUnitario(0);
  };

  // 2. Lógica de Fechamento em Lote no fim do dia
  const handleEncerrarExpediente = () => {
    const dataHoje = new Date().toISOString().split('T')[0];
    const ordensAbertasHoje = ordens.filter(os => os.data === dataHoje && os.status === 'ABERTA');

    if (ordensAbertasHoje.length === 0) {
      alert('Atenção: Não há Nenhuma Ordem de Serviço aberta no dia de hoje para encerrar.');
      return;
    }

    if (confirm(`Deseja fechar e consolidar ${ordensAbertasHoje.length} OS(s) aberta(s) no dia de hoje (${new Date().toLocaleDateString('pt-BR')})?`)) {
      setOrdens(prev =>
        prev.map(os =>
          os.data === dataHoje && os.status === 'ABERTA'
            ? { ...os, status: 'CONCLUIDA' }
            : os
        )
      );
      alert('🔒 Expediente encerrado com sucesso! Todas as Ordens de Serviço do dia foram concluídas.');
    }
  };

  // Excluir item de uma OS
  const handleRemoverItemOS = (osId: string, itemId: string) => {
    if (!confirm('Deseja remover este item da Ordem de Serviço?')) return;

    setOrdens(prev =>
      prev.map(os => {
        if (os.id !== osId) return os;
        const novosItens = os.itens.filter(i => i.id !== itemId);
        return { ...os, itens: novosItens };
      }).filter(os => os.itens.length > 0) // Remove OS se ficar sem itens
    );
  };

  // Alternar status individual da OS
  const handleAlternarStatusOS = (osId: string) => {
    setOrdens(prev =>
      prev.map(os => {
        if (os.id !== osId) return os;
        const novoStatus = os.status === 'ABERTA' ? 'CONCLUIDA' : 'ABERTA';
        return { ...os, status: novoStatus };
      })
    );
  };

  // Excluir OS inteira
  const handleExcluirOS = (osId: string) => {
    if (!confirm(`Tem certeza que deseja excluir a OS #${osId}?`)) return;
    setOrdens(prev => prev.filter(os => os.id !== osId));
  };

  // Imprimir/Gerar espelho da OS
  const handleImprimirOS = (os: OrdemServico) => {
    const totalOS = os.itens.reduce((acc, i) => acc + i.valorTotal, 0);
    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ordem de Serviço #${os.id} - Usicorte Metais</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
          .header { text-align: center; border-bottom: 2px solid #e52321; padding-bottom: 15px; margin-bottom: 20px; }
          .logo-title { font-size: 24px; font-weight: bold; color: #111; }
          .logo-sub { font-size: 14px; color: #e52321; font-weight: bold; margin-top: 5px; }
          .info-box { background: #f8f9fa; border: 1px solid #ddd; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ccc; padding: 10px; text-align: left; font-size: 13px; }
          th { background: #111; color: #fff; }
          .total { text-align: right; font-size: 16px; font-weight: bold; margin-top: 20px; color: #000; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-title">USICORTE METAIS</div>
          <div class="logo-sub">ORDEM DE SERVIÇO DIÁRIA #${os.id}</div>
        </div>

        <div class="info-box">
          <strong>Cliente:</strong> ${os.clienteNome}<br/>
          <strong>Data da OS:</strong> ${new Date(os.data + 'T00:00:00').toLocaleDateString('pt-BR')}<br/>
          <strong>Status:</strong> ${os.status}
        </div>

        <h3>Itens Lançados na Ordem de Serviço</h3>
        <table>
          <thead>
            <tr>
              <th>Horário</th>
              <th>Descrição do Produto / Serviço</th>
              <th style="text-align: center;">Qtd</th>
              <th style="text-align: right;">Valor Unit. (R$)</th>
              <th style="text-align: right;">Total (R$)</th>
            </tr>
          </thead>
          <tbody>
            ${os.itens.map(item => `
              <tr>
                <td>${item.horario}</td>
                <td>${item.descricao}</td>
                <td style="text-align: center;">${item.quantidade}</td>
                <td style="text-align: right;">R$ ${item.valorUnitario.toFixed(2)}</td>
                <td style="text-align: right; font-weight: bold;">R$ ${item.valorTotal.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total">
          TOTAL ACUMULADO DA OS: R$ ${totalOS.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>

        <div class="footer">
          Usicorte Metais - Sistema Integrado de Gestão ERP &bull; Emitido em ${new Date().toLocaleString('pt-BR')}
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    win.document.close();
  };

  // Filtragem de Ordens
  const dataHojeStr = new Date().toISOString().split('T')[0];
  const ordensFiltradas = ordens.filter(os => {
    const bateData = filtroData ? os.data === filtroData : true;
    const bateStatus = filtroStatus === 'TODAS' ? true : os.status === filtroStatus;
    return bateData && bateStatus;
  });

  // Estatísticas rápidas
  const totalAbertasHoje = ordens.filter(os => os.data === dataHojeStr && os.status === 'ABERTA').length;
  const totalConcluidasHoje = ordens.filter(os => os.data === dataHojeStr && os.status === 'CONCLUIDA').length;
  const faturamentoHoje = ordens
    .filter(os => os.data === dataHojeStr)
    .reduce((acc, os) => acc + os.itens.reduce((iAcc, item) => iAcc + item.valorTotal, 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans -m-6 p-6">
      
      {/* CABEÇALHO / NAVBAR COM A LOGO USICORTE METAIS E AÇÃO DE FECHAMENTO */}
      <header className="bg-black border border-slate-800 p-4 px-6 rounded-2xl mb-6 flex flex-wrap justify-between items-center gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          {/* LOGO SVG VETORIZADA OFICIAL */}
          <Logo className="h-12 w-auto" />

          <span className="text-xs bg-red-600/20 text-red-500 font-bold px-3 py-1.5 rounded-full border border-red-600/30 tracking-wider">
            ERP / POV INDUSTRIAL
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleEncerrarExpediente}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 transition shadow-lg shadow-red-600/20 active:scale-95 cursor-pointer"
            title="Consolida e altera o status de todas as OSs abertas hoje para CONCLUIDA"
          >
            <Lock className="w-4 h-4" />
            Encerrar Expediente (Fechar OSs do Dia)
          </button>
        </div>
      </header>

      {/* KPI BARS DE MONITORAMENTO RÁPIDO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900/90 border border-amber-500/30 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider block">OSs Abertas Hoje</span>
            <span className="text-2xl font-black text-white">{totalAbertasHoje} <span className="text-xs font-normal text-slate-400">ordem(ns)</span></span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider block">OSs Concluídas Hoje</span>
            <span className="text-2xl font-black text-white">{totalConcluidasHoje} <span className="text-xs font-normal text-slate-400">concluída(s)</span></span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-blue-500/30 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-blue-400 font-bold uppercase tracking-wider block">Movimentação Acumulada Hoje</span>
            <span className="text-2xl font-black text-emerald-400">
              R$ {faturamentoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* PAINEL PRINCIPAL */}
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* COLUNA 1: LANÇAMENTO RÁPIDO DE OS DIÁRIA */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xl">
          <div>
            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <PlusCircle className="w-5 h-5 text-red-500" />
              <h2 className="text-base font-bold text-slate-100">
                1. Lançamento Diário de OS
              </h2>
            </div>

            <form onSubmit={handleAdicionarItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">
                  SELECIONE O CLIENTE
                </label>
                <select
                  value={clienteSelecionado}
                  onChange={e => setClienteSelecionado(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 focus:border-red-500 outline-none transition"
                >
                  <option value="">-- Selecione o Cliente --</option>
                  {listaClientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.document ? `(${c.document})` : ''}
                    </option>
                  ))}
                </select>
                {onNavigateToClients && (
                  <button 
                    type="button" 
                    onClick={onNavigateToClients}
                    className="text-[11px] text-red-400 hover:text-red-300 mt-1 inline-flex items-center gap-1 cursor-pointer"
                  >
                    + Cadastrar novo cliente se necessário
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">
                  DESCRIÇÃO DO SERVIÇO / PRODUTO
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Corte Plasma Chapa 3/16 SAE 1020, Usinagem de Bucha Bronze, Dobra CNC..."
                  value={descricaoItem}
                  onChange={e => setDescricaoItem(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 focus:border-red-500 outline-none transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">
                    QUANTIDADE (QTD)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantidade}
                    onChange={e => setQuantidade(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 focus:border-red-500 outline-none font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">
                    VALOR UNIT. (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={valorUnitario}
                    onChange={e => setValorUnitario(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-emerald-400 font-bold focus:border-red-500 outline-none text-right"
                  />
                </div>
              </div>

              {/* Subtotal estimado do item */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
                <span className="text-slate-400 font-semibold">Total do Item a Lançar:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  R$ {(Number(quantidade || 0) * Number(valorUnitario || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 active:scale-98 text-white font-bold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Adicionar à OS do Dia
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1 bg-slate-950/40 p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Lógica de Agrupamento Diário Automático:
            </div>
            <p className="leading-relaxed text-slate-400">
              Ao adicionar um item para um cliente que já possui uma <strong className="text-slate-200">OS ABERTA</strong> hoje, o item é anexado automaticamente à mesma OS. Caso não exista, uma nova OS do dia é gerada.
            </p>
          </div>
        </div>

        {/* COLUNAS 2 e 3: MONITOR DE OSs DO DIA */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xl">
          <div>
            {/* Filtros e Cabeçalho do Painel */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-300" />
                <h2 className="text-base font-bold text-slate-100">
                  2. Painel de Acompanhamento (OSs Abertas & Registradas)
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                {/* Filtro por Data */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-lg">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={filtroData}
                    onChange={e => setFiltroData(e.target.value)}
                    className="bg-transparent text-slate-200 font-semibold outline-none cursor-pointer"
                  />
                </div>

                {/* Filtro por Status */}
                <select
                  value={filtroStatus}
                  onChange={e => setFiltroStatus(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 font-semibold px-2.5 py-1.5 rounded-lg outline-none cursor-pointer"
                >
                  <option value="TODAS">Todos Status</option>
                  <option value="ABERTA">Somente ABERTAS</option>
                  <option value="CONCLUIDA">Somente CONCLUÍDAS</option>
                </select>

                <button
                  onClick={() => {
                    setFiltroData(new Date().toISOString().split('T')[0]);
                    setFiltroStatus('TODAS');
                  }}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Hoje
                </button>
              </div>
            </div>

            {/* LISTAGEM DE ORDENS DE SERVIÇO */}
            {ordensFiltradas.length === 0 ? (
              <div className="text-center text-slate-500 py-16 text-sm bg-slate-950/50 rounded-2xl border border-dashed border-slate-800">
                <Package className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
                Nenhuma Ordem de Serviço registrada para a data ou filtro selecionado.
                <p className="text-xs text-slate-600 mt-1">Faça um lançamento ao lado para iniciar a movimentação do dia.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[580px] overflow-y-auto pr-2 custom-scrollbar">
                {ordensFiltradas.map(os => {
                  const totalOS = os.itens.reduce((acc, i) => acc + i.valorTotal, 0);

                  return (
                    <div 
                      key={os.id} 
                      className={`bg-slate-950 border rounded-xl p-4 transition-all shadow-md ${
                        os.status === 'ABERTA' 
                          ? 'border-amber-500/40 hover:border-amber-500/70' 
                          : 'border-emerald-500/30 hover:border-emerald-500/60'
                      }`}
                    >
                      {/* Cabeçalho do Card da OS */}
                      <div className="flex flex-wrap justify-between items-center border-b border-slate-800/80 pb-3 mb-3 gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-red-500 text-sm bg-red-950/40 px-2.5 py-1 rounded-md border border-red-800/50">
                            OS #{os.id}
                          </span>
                          <span className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            {os.clienteNome}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Badge de Status com Ação de Alternância */}
                          <button
                            onClick={() => handleAlternarStatusOS(os.id)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                              os.status === 'ABERTA' 
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                            }`}
                            title="Clique para alternar o status manualmente"
                          >
                            {os.status === 'ABERTA' ? (
                              <>
                                <Clock className="w-3 h-3 animate-spin" /> ABERTA
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> CONCLUÍDA
                              </>
                            )}
                          </button>

                          {/* Botão Imprimir */}
                          <button
                            onClick={() => handleImprimirOS(os)}
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-800 transition cursor-pointer"
                            title="Imprimir / Espelho da OS"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Botão Excluir OS */}
                          <button
                            onClick={() => handleExcluirOS(os.id)}
                            className="p-1.5 bg-slate-900 hover:bg-red-950 text-slate-500 hover:text-red-400 rounded-lg border border-slate-800 hover:border-red-800/50 transition cursor-pointer"
                            title="Excluir OS"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Tabela de Itens da OS */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left text-slate-300">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                              <th className="py-1.5 px-1">Hora</th>
                              <th className="py-1.5 px-2">Descrição do Serviço / Produto</th>
                              <th className="py-1.5 px-2 text-center">Qtd</th>
                              <th className="py-1.5 px-2 text-right">Valor Unit.</th>
                              <th className="py-1.5 px-2 text-right">Total Item</th>
                              <th className="py-1.5 px-1 text-center w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900">
                            {os.itens.map(item => (
                              <tr key={item.id} className="hover:bg-slate-900/50 transition">
                                <td className="py-2 px-1 text-slate-500 font-mono">{item.horario}</td>
                                <td className="py-2 px-2 font-medium text-slate-200">{item.descricao}</td>
                                <td className="py-2 px-2 text-center font-bold text-slate-100">{item.quantidade}</td>
                                <td className="py-2 px-2 text-right text-slate-300">
                                  R$ {item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-2 px-2 text-right text-emerald-400 font-bold">
                                  R$ {item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-2 px-1 text-center">
                                  <button
                                    onClick={() => handleRemoverItemOS(os.id, item.id)}
                                    className="text-slate-600 hover:text-red-400 p-1 rounded hover:bg-red-950/30 transition cursor-pointer"
                                    title="Remover este item da OS"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Totalizador Acumulado da OS */}
                      <div className="flex justify-between items-center pt-3 mt-2 border-t border-slate-800/80 text-xs">
                        <span className="text-slate-400">
                          Total de Itens: <strong className="text-slate-200">{os.itens.length}</strong>
                        </span>

                        <div className="text-right">
                          <span className="text-slate-400 font-semibold mr-2">Total Acumulado na OS:</span>
                          <span className="text-emerald-400 text-sm font-black">
                            R$ {totalOS.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
