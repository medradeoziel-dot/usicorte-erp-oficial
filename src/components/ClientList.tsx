import React, { useState } from 'react';
import { Client } from '../types';
import { Search, UserCheck, UserX, FileText, ArrowRight, Database, Download } from 'lucide-react';
import { formatCNPJ, formatCPF } from '../utils/validators';

interface ClientListProps {
  clients: Client[];
  activeClientId?: string;
  onSelectClient: (client: Client) => void;
  onExportClients: () => void;
}

export default function ClientList({ clients, activeClientId, onSelectClient, onExportClients }: ClientListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = clients.filter(c => {
    const term = searchTerm.toLowerCase();
    const doc = c.document.replace(/\D/g, '');
    return (
      c.name.toLowerCase().includes(term) ||
      (c.fantasyName && c.fantasyName.toLowerCase().includes(term)) ||
      doc.includes(term) ||
      c.city.toLowerCase().includes(term) ||
      c.state.toLowerCase().includes(term)
    );
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div id="clients-list-sidebar" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col h-full overflow-hidden max-h-[820px]">
      
      {/* Header and counter */}
      <div className="pb-4 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-500" />
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Clientes Salvos</h3>
            <p className="text-[10px] text-slate-400">Banco de Dados Local (LocalStorage)</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {clients.length > 0 && (
            <button
              onClick={onExportClients}
              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200/50 rounded-lg transition-colors"
              title="Exportar Clientes em JSON"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100/50 font-mono">
            {clients.length}
          </span>
        </div>
      </div>

      {/* Live search input */}
      <div className="my-4 relative shrink-0">
        <input
          type="text"
          placeholder="Pesquisar por nome, documento, cidade..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-800"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
      </div>

      {/* Clients loop */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[220px]">
        {filteredClients.length === 0 ? (
          <div className="text-center py-16 text-slate-400 flex flex-col items-center justify-center">
            <div className="p-3 bg-slate-50 rounded-full mb-3 border border-slate-100">
              <FileText className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Nenhum cliente cadastrado</p>
            <p className="text-[10px] text-slate-400 max-w-[200px] mt-1">
              Preencha o formulário e clique em "Salvar" para popular a listagem local.
            </p>
          </div>
        ) : (
          filteredClients.map((client) => {
            const isActive = client.id === activeClientId;
            return (
              <div
                key={client.id}
                onClick={() => onSelectClient(client)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2 relative group select-none ${
                  isActive
                    ? 'bg-indigo-50/50 border-indigo-200 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100/50 border-slate-100 hover:border-slate-200'
                }`}
              >
                {/* Header status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[9px] font-bold rounded uppercase font-mono tracking-wide">
                      {client.type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatDate(client.registrationDate)}
                    </span>
                  </div>

                  {/* Enabled/Disabled badge */}
                  <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    client.enabled 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/60' 
                      : 'bg-rose-50 text-rose-700 border border-rose-100/60'
                  }`}>
                    {client.enabled ? (
                      <>
                        <UserCheck className="w-2.5 h-2.5" />
                        Ativo
                      </>
                    ) : (
                      <>
                        <UserX className="w-2.5 h-2.5" />
                        Bloqueado
                      </>
                    )}
                  </span>
                </div>

                {/* Name */}
                <div>
                  <h4 className={`text-xs font-bold line-clamp-1 group-hover:text-indigo-600 transition-colors ${
                    isActive ? 'text-indigo-900' : 'text-slate-800'
                  }`}>
                    {client.name}
                  </h4>
                  {client.fantasyName && (
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {client.fantasyName}
                    </p>
                  )}
                </div>

                {/* Document and location footer */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/40 font-mono mt-0.5">
                  <span>
                    {client.type === 'CNPJ' ? formatCNPJ(client.document) : formatCPF(client.document)}
                  </span>
                  <span className="text-slate-400 text-[10px] uppercase font-sans">
                    {client.city}, {client.state}
                  </span>
                </div>

                {/* Click animation prompt */}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
