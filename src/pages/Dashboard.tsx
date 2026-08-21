import { TrendingUp, FileText, Users, Package, Clock, CheckCircle, AlertCircle, ArrowUpRight } from "lucide-react";

const stats = [
  { label: "Orçamentos no Mês", value: "47", change: "+12%", up: true, icon: <FileText size={20} /> },
  { label: "Clientes Ativos", value: "134", change: "+3", up: true, icon: <Users size={20} /> },
  { label: "Itens em Produção", value: "23", change: "-5", up: false, icon: <Package size={20} /> },
  { label: "Faturamento Mês", value: "R$ 84.720", change: "+18%", up: true, icon: <TrendingUp size={20} /> },
];

const recentOrders = [
  { id: "COT-2026-2651", cliente: "Auto Peças Silva Ltda", valor: "R$ 2.220,00", status: "Aprovado", data: "10/08/2026" },
  { id: "COT-2026-2643", cliente: "Mecânica Rodrigues & Cia", valor: "R$ 1.920,00", status: "Em Produção", data: "15/08/2026" },
  { id: "COT-2026-2633", cliente: "Ferramentaria Omega Ltda", valor: "R$ 3.636,00", status: "Entregue", data: "12/08/2026" },
  { id: "COT-2026-2611", cliente: "Mecânica Rodrigues & Cia", valor: "R$ 1.150,00", status: "Em Produção", data: "02/08/2026" },
  { id: "COT-2026-2601", cliente: "Indústria Metalúrgica Santos", valor: "R$ 1.850,00", status: "Em Produção", data: "01/08/2026" },
];

const statusStyles: Record<string, string> = {
  Aprovado: "bg-green-500/15 text-green-400 border border-green-500/30",
  "Em Produção": "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  Entregue: "bg-slate-500/15 text-slate-400 border border-slate-500/30",
  Pendente: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
};

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-slate-800 border border-slate-700/60 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div className="text-slate-400">{s.icon}</div>
              <span
                className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  s.up ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                }`}
              >
                <ArrowUpRight size={10} className={s.up ? "" : "rotate-90"} />
                {s.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-white mt-3">{s.value}</p>
            <p className="text-slate-400 text-sm mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 border border-slate-700/60 rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
          <h2 className="text-white font-semibold">Pedidos Recentes</h2>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Clock size={14} />
            <span>Agosto 2026</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/40">
                <th className="text-left px-6 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Cotação</th>
                <th className="text-left px-6 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Cliente</th>
                <th className="text-left px-6 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Data</th>
                <th className="text-right px-6 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Valor</th>
                <th className="text-right px-6 py-3 text-slate-500 text-xs font-medium uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-3.5 text-amber-400 text-sm font-mono font-medium">{o.id}</td>
                  <td className="px-6 py-3.5 text-slate-300 text-sm">{o.cliente}</td>
                  <td className="px-6 py-3.5 text-slate-400 text-sm">{o.data}</td>
                  <td className="px-6 py-3.5 text-white text-sm font-semibold text-right">{o.valor}</td>
                  <td className="px-6 py-3.5 text-right">
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[o.status]}`}>
                      {o.status === "Entregue" ? <CheckCircle size={10} /> : o.status === "Pendente" ? <AlertCircle size={10} /> : null}
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
