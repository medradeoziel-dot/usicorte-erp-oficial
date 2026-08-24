import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Printer,
  Tag,
  FileText,
  Download,
  Upload,
  Trash2,
  Clipboard,
  ChevronDown,
  ImageIcon,
  Database,
  RefreshCw,
  Save,
  CheckCircle2,
  Plus,
  AlertCircle
} from "lucide-react";
import { clientes as mockClientes, pedidosPorCliente as mockPedidos, itensPorPedido as mockItens } from "@/lib/mockData";
import type { ViewType, ItemPedido, Cliente as LocalCliente, Pedido } from "@/lib/types";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { db, fetchCotacaoById, type SupabaseCotacao, type SupabaseCliente, type SupabaseCotacaoItem, type StatusCotacao, uploadDesenhoStorage } from "@/lib/db";
import LabelPreview from "@/components/LabelPreview";
import A4Preview from "@/components/A4Preview";

const viewOptions: { value: ViewType; label: string }[] = [
  { value: "a4-inteiro", label: "A4 Inteiro" },
  { value: "proposta-4col", label: "Proposta 4 Colunas" },
  { value: "a4-2vias", label: "A4 2 Vias" },
  { value: "etiqueta-80x80", label: "Etiqueta 80×80" },
];

function getUrlQuoteId(): string | null {
  if (typeof window === "undefined") return null;
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("id") || searchParams.get("cotacaoId") || searchParams.get("pedidoId") || searchParams.get("numero") || null;
}

export default function Proposals() {
  // Lista de clientes e pedidos carregados do banco / mock
  const [dbClientes, setDbClientes] = useState<LocalCliente[]>(mockClientes);
  const [dbPedidosPorCliente, setDbPedidosPorCliente] = useState<Record<number, Pedido[]>>(mockPedidos);
  const [dbItensPorPedido, setDbItensPorPedido] = useState<Record<string, ItemPedido[]>>(mockItens);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);
  const [isSavingDb, setIsSavingDb] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [clienteId, setClienteId] = useLocalStorage<number>("clienteId", mockClientes[0].id);
  const [pedidoId, setPedidoId] = useLocalStorage<string>("pedidoId", "");
  const [viewType, setViewType] = useLocalStorage<ViewType>("viewType", "etiqueta-80x80");
  const [pecaAtiva, setPecaAtiva] = useLocalStorage<number>("pecaAtiva", 1);
  const [fotosPorPeca, setFotosPorPeca] = useLocalStorage<Record<number, string>>("fotosPorPeca", {});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Busca uma cotação específica pelo ID diretamente no banco com .eq('id', id) ou .eq('numero', id)
  const loadSpecificQuoteFromDb = useCallback(async (targetId: string) => {
    if (!targetId) return null;
    setIsLoadingDb(true);
    try {
      // 1. Busca filtrada especificamente por ID no banco Supabase
      let { data: cot, error } = await db
        .from("cotacoes")
        .select("*, cotacao_itens(*)")
        .eq("id", targetId)
        .maybeSingle();

      // Fallback para busca por número da cotação
      if (!cot || error) {
        const res = await db
          .from("cotacoes")
          .select("*, cotacao_itens(*)")
          .eq("numero", targetId)
          .maybeSingle();
        cot = res.data;
      }

      if (cot) {
        const numId = cot.numero || `COT-${cot.id ? String(cot.id).slice(0, 5) : targetId}`;
        const cotClienteNome = cot.cliente_nome || "Cliente Selecionado";

        // Cria ou localiza o cliente no estado
        const existingClient = dbClientes.find(
          (c) => c.nome.toLowerCase() === cotClienteNome.toLowerCase()
        );
        const activeCId = existingClient ? existingClient.id : 999;

        if (!existingClient) {
          const newClient: LocalCliente = {
            id: activeCId,
            nome: cotClienteNome,
            cnpj: cot.documento || "",
            telefone: cot.telefone || "",
            cidade: cot.endereco || "",
            email: cot.email || "",
            contato: cot.contato || "",
          };
          setDbClientes((prev) => [newClient, ...prev]);
        }

        setClienteId(activeCId);
        setPedidoId(numId);

        // Mapeia os itens da cotação obtidos do banco
        const mappedItens: ItemPedido[] = (cot.cotacao_itens && cot.cotacao_itens.length > 0)
          ? cot.cotacao_itens.map((it: any, itemIdx: number) => ({
              id: it.ordem !== undefined ? it.ordem + 1 : itemIdx + 1,
              descricao: it.descricao || it.produto || `Peça #${itemIdx + 1}`,
              material: it.material || it.produto || "Aço Carbono",
              medida: it.medida || "Conforme desenho",
              quantidade: Number(it.quantidade) || 1,
              valorUnit: Number(it.valor_unitario) || 0,
              observacoes: it.observacao || "",
              foto: it.desenho_url || undefined,
            }))
          : [
              {
                id: 1,
                descricao: cot.observacoes || "Item da cotação",
                material: "Aço Carbono",
                medida: "Conforme projeto",
                quantidade: 1,
                valorUnit: Number(cot.valor_total) || 0,
                observacoes: cot.observacoes || "",
              },
            ];

        // Atualiza pedidos e itens com a cotação carregada por ID
        const novoPedidoObj: Pedido = {
          id: numId,
          data: cot.data || new Date().toISOString().slice(0, 10),
          status: cot.status === 'aprovado' ? 'Aprovado' : cot.status === 'rejeitado' ? 'Cancelado' : cot.status === 'pendente' ? 'Pendente' : 'Rascunho',
          clienteNome: cotClienteNome,
          total: Number(cot.valor_total) || 0,
        };

        setDbPedidosPorCliente((prev) => ({
          ...prev,
          [activeCId]: [novoPedidoObj, ...(prev[activeCId] || []).filter((p) => p.id !== numId)],
        }));

        setDbItensPorPedido((prev) => ({
          ...prev,
          [numId]: mappedItens,
        }));

        // Mapeia fotos/desenhos dos itens
        const initialFotos: Record<number, string> = {};
        mappedItens.forEach((it) => {
          if (it.foto) {
            initialFotos[it.id] = it.foto;
          }
        });
        if (Object.keys(initialFotos).length > 0) {
          setFotosPorPeca(initialFotos);
        }

        setPecaAtiva(mappedItens[0]?.id || 1);
        return cot;
      }
    } catch (err) {
      console.error("Erro ao carregar cotação filtrada por ID:", err);
    } finally {
      setIsLoadingDb(false);
    }
    return null;
  }, [dbClientes, setClienteId, setPedidoId, setFotosPorPeca, setPecaAtiva]);

  // Carregar lista geral de clientes e cotações do Supabase
  const loadDatabaseData = useCallback(async () => {
    setIsLoadingDb(true);
    try {
      // 1. Clientes do Supabase
      const { data: supaClientes, error: errClientes } = await db
        .from("clientes")
        .select("*")
        .order("nome", { ascending: true });

      // 2. Cotações do Supabase
      const { data: supaCotacoes, error: errCotacoes } = await db
        .from("cotacoes")
        .select("*, cotacao_itens(*)")
        .order("created_at", { ascending: false });

      let currentClientsList = [...mockClientes];
      if (!errClientes && supaClientes && supaClientes.length > 0) {
        const mappedClients: LocalCliente[] = supaClientes.map((c: any, index: number) => ({
          id: typeof c.id === "number" ? c.id : (index + 100),
          nome: c.nome || c.empresa || "Cliente",
          cnpj: c.documento || "",
          telefone: c.telefone || "",
          cidade: c.endereco || "",
          email: c.email || "",
          contato: c.contato || "",
        }));

        const combinedClients = [...mappedClients];
        mockClientes.forEach((mc) => {
          if (!combinedClients.some((c) => c.nome.toLowerCase() === mc.nome.toLowerCase())) {
            combinedClients.push(mc);
          }
        });
        currentClientsList = combinedClients;
        setDbClientes(combinedClients);
      }

      if (!errCotacoes && supaCotacoes && supaCotacoes.length > 0) {
        const newPedidosPorCliente: Record<number, Pedido[]> = { ...mockPedidos };
        const newItensPorPedido: Record<string, ItemPedido[]> = { ...mockItens };

        supaCotacoes.forEach((cot: any, idx: number) => {
          const numId = cot.numero || `COT-DB-${cot.id ? String(cot.id).slice(0, 5) : idx + 1}`;
          const clientMatch = currentClientsList.find(
            (c) => c.nome.toLowerCase() === (cot.cliente_nome || "").toLowerCase()
          ) || currentClientsList[0];

          const cId = clientMatch ? clientMatch.id : 1;
          if (!newPedidosPorCliente[cId]) {
            newPedidosPorCliente[cId] = [];
          }

          if (!newPedidosPorCliente[cId].some((p) => p.id === numId)) {
            newPedidosPorCliente[cId].unshift({
              id: numId,
              data: cot.data || new Date().toISOString().slice(0, 10),
              status: cot.status === 'aprovado' ? 'Aprovado' : cot.status === 'rejeitado' ? 'Cancelado' : cot.status === 'pendente' ? 'Pendente' : 'Rascunho',
              clienteNome: cot.cliente_nome,
              total: Number(cot.valor_total) || 0
            });
          }

          if (cot.cotacao_itens && cot.cotacao_itens.length > 0) {
            newItensPorPedido[numId] = cot.cotacao_itens.map((it: any, itemIdx: number) => ({
              id: it.ordem !== undefined ? it.ordem + 1 : itemIdx + 1,
              descricao: it.descricao || it.produto || `Peça #${itemIdx + 1}`,
              material: it.material || "Aço Carbono",
              medida: it.medida || "Conforme desenho",
              quantidade: Number(it.quantidade) || 1,
              valorUnit: Number(it.valor_unitario) || 0,
              observacoes: it.observacao || "",
              foto: it.desenho_url || undefined
            }));
          }
        });

        setDbPedidosPorCliente(newPedidosPorCliente);
        setDbItensPorPedido(newItensPorPedido);

        // Se houver um ID passado via URL, prioriza carregar essa cotação específica
        const urlId = getUrlQuoteId();
        if (urlId) {
          loadSpecificQuoteFromDb(urlId);
        }
      }
    } catch (error) {
      console.warn("Conexão ao Supabase em modo local:", error);
    } finally {
      setIsLoadingDb(false);
    }
  }, [loadSpecificQuoteFromDb]);

  useEffect(() => {
    const urlId = getUrlQuoteId();
    if (urlId) {
      loadSpecificQuoteFromDb(urlId);
    } else {
      loadDatabaseData();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pedidos = dbPedidosPorCliente[clienteId] ?? [];
  const itens: ItemPedido[] = pedidoId ? (dbItensPorPedido[pedidoId] ?? []) : [];
  const cliente = dbClientes.find((c) => c.id === clienteId) ?? null;
  const pedido = pedidos.find((p) => p.id === pedidoId) ?? null;

  // Atualiza o ID na URL quando o usuário troca o pedido no select
  const handleSelectPedido = (newPedidoId: string) => {
    setPedidoId(newPedidoId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("id", newPedidoId);
      window.history.pushState({}, "", url.toString());
    }
  };

  useEffect(() => {
    const pedidosDoCliente = dbPedidosPorCliente[clienteId] ?? [];
    const pedidoValido = pedidosDoCliente.some((p) => p.id === pedidoId);
    // Só inicializa o primeiro se não houver pedidoId selecionado e não houver ID na URL
    if (!pedidoId && pedidosDoCliente.length > 0 && !getUrlQuoteId()) {
      setPedidoId(pedidosDoCliente[0]?.id ?? "");
    }
  }, [clienteId, pedidoId, dbPedidosPorCliente, setPedidoId]);

  useEffect(() => {
    if (itens && itens.length > 0) {
      setPecaAtiva(itens[0]?.id ?? 1);
    }
  }, [pedidoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveImage = useCallback(
    (base64: string) => {
      setFotosPorPeca((prev) => ({ ...prev, [pecaAtiva]: base64 }));
    },
    [pecaAtiva, setFotosPorPeca]
  );

  const readFileAsBase64 = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") saveImage(result);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const pasteItems = e.clipboardData?.items;
      if (!pasteItems) return;
      for (const item of pasteItems) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) readFileAsBase64(file);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [saveImage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFileAsBase64(file);
    e.target.value = "";
  };

  const handleRemoveFoto = () => {
    setFotosPorPeca((prev) => {
      const next = { ...prev };
      delete next[pecaAtiva];
      return next;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Salvar cotação ativa no Supabase (cotacoes + cotacao_itens)
  const handleSaveToDatabase = async () => {
    if (!pedidoId || !cliente) return;
    setIsSavingDb(true);
    setStatusFeedback(null);

    try {
      const totalGeral = itens.reduce((acc, it) => acc + (it.valorUnit * it.quantidade), 0);
      const statusMap: Record<string, StatusCotacao> = {
        'Aprovado': 'aprovado',
        'Pendente': 'pendente',
        'Cancelado': 'rejeitado',
        'Rascunho': 'rascunho',
      };
      const statusSupa: StatusCotacao = statusMap[pedido?.status || 'Pendente'] || 'pendente';

      // 1. Insere ou atualiza cabeçalho da cotação
      const { data: cotacaoSalva, error: cotErr } = await db
        .from("cotacoes")
        .upsert(
          {
            numero: pedidoId,
            data: pedido?.data || new Date().toISOString().slice(0, 10),
            cliente_nome: cliente.nome,
            contato: cliente.contato || "",
            telefone: cliente.telefone || "",
            email: cliente.email || "",
            status: statusSupa,
            observacoes: `Proposta gerada no Usicorte Vendas para ${cliente.nome}`,
            valor_total: totalGeral,
          },
          { onConflict: 'numero' }
        )
        .select()
        .single();

      if (cotErr) throw cotErr;

      // 2. Insere itens
      if (cotacaoSalva?.id && itens.length > 0) {
        // Limpa itens anteriores da cotação para re-gravação limpa
        await db.from("cotacao_itens").delete().eq("cotacao_id", cotacaoSalva.id);

        const itensPayload = itens.map((it, idx) => ({
          cotacao_id: cotacaoSalva.id,
          ordem: idx,
          produto: it.descricao,
          material: it.material,
          medida: it.medida,
          descricao: it.descricao,
          observacao: it.observacoes || "",
          quantidade: it.quantidade,
          valor_unitario: it.valorUnit,
          valor_total: it.valorUnit * it.quantidade,
          desenho_url: fotosPorPeca[it.id] || null,
          cortado: false,
        }));

        const { error: itemsErr } = await db.from("cotacao_itens").insert(itensPayload);
        if (itemsErr) throw itemsErr;
      }

      setStatusFeedback({
        type: 'success',
        message: `Cotação ${pedidoId} e ${itens.length} itens gravados no banco Supabase com sucesso!`
      });
      setTimeout(() => setStatusFeedback(null), 4500);
    } catch (err: any) {
      console.error("Erro ao salvar no banco:", err);
      setStatusFeedback({
        type: 'error',
        message: `Falha ao gravar no banco: ${err?.message || 'Verifique as permissões de acesso'}`
      });
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleExportCSV = () => {
    if (!itens.length) return;
    const header = ["Peça", "Descrição", "Material", "Medida", "Qtd", "Valor Unit.", "Total", "Observações"];
    const rows = itens.map((i) => [
      `#${i.id}`,
      i.descricao,
      i.material,
      i.medida,
      i.quantidade,
      i.valorUnit.toFixed(2),
      (i.valorUnit * i.quantidade).toFixed(2),
      `"${i.observacoes || ""}"`,
    ]);
    const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
    downloadFile(csv, `${pedidoId}.csv`, "text/csv;charset=utf-8;");
  };

  const handleExportJSON = () => {
    if (!itens.length) return;
    const data = {
      pedido: pedidoId,
      cliente: cliente,
      itens: itens,
      fotos: fotosPorPeca
    };
    downloadFile(JSON.stringify(data, null, 2), `${pedidoId}.json`, "application/json");
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasFotoAtiva = !!fotosPorPeca[pecaAtiva];

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-950">
      {/* Banner de feedback do banco */}
      {statusFeedback && (
        <div className={`px-6 py-2 text-xs font-semibold flex items-center gap-2 border-b ${
          statusFeedback.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' 
            : 'bg-rose-950/80 border-rose-800 text-rose-300'
        }`}>
          {statusFeedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{statusFeedback.message}</span>
        </div>
      )}

      {/* Barra superior de controles e filtros */}
      <div className="bg-slate-800/60 border-b border-slate-700/60 px-6 py-4 space-y-4 flex-shrink-0">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider flex items-center justify-between">
              <span>Cliente</span>
              {isLoadingDb && <span className="text-[10px] text-amber-400 animate-pulse">Sincronizando...</span>}
            </label>
            <div className="relative">
              <select
                value={clienteId}
                onChange={(e) => setClienteId(Number(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 cursor-pointer"
              >
                {dbClientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider">Pedido / Cotação</label>
            <div className="relative">
              <select
                value={pedidoId}
                onChange={(e) => handleSelectPedido(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 cursor-pointer font-mono"
              >
                {pedidos.map((p) => (
                  <option key={p.id} value={p.id}>{p.id} — {p.status}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider">Visualização</label>
            <div className="flex gap-1 bg-slate-700/60 rounded-lg p-1 border border-slate-600">
              {viewOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setViewType(opt.value)}
                  className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all cursor-pointer ${
                    viewType === opt.value
                      ? "bg-amber-500 text-slate-900 font-bold shadow"
                      : "text-slate-400 hover:text-white hover:bg-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Botão de Salvar no Banco */}
          <button
            onClick={handleSaveToDatabase}
            disabled={isSavingDb || !pedidoId}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
            title="Salvar esta cotação e seus itens diretamente na tabela cotacoes do Supabase"
          >
            <Save size={14} className={isSavingDb ? "animate-spin" : ""} />
            {isSavingDb ? "Gravando no Banco..." : "Salvar no Banco (Supabase)"}
          </button>

          {/* Botão de Atualizar do Banco */}
          <button
            onClick={loadDatabaseData}
            disabled={isLoadingDb}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg transition-colors border border-slate-600 cursor-pointer"
            title="Recarregar cotações e clientes mais recentes do Supabase"
          >
            <RefreshCw size={13} className={isLoadingDb ? "animate-spin" : ""} />
            Atualizar
          </button>

          <div className="h-5 w-px bg-slate-700 mx-1 hidden sm:block" />

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors border border-slate-600 hover:border-slate-500 cursor-pointer"
          >
            <Printer size={14} />
            Imprimir Pedido (A4)
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors border border-slate-600 hover:border-slate-500 cursor-pointer"
          >
            <Tag size={14} />
            Imprimir Etiqueta da Peça
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <FileText size={14} />
            Imprimir Proposta (A4)
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors border border-slate-600 cursor-pointer"
          >
            <Download size={14} />
            Exportar CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors border border-slate-600 cursor-pointer"
          >
            <Download size={14} />
            Exportar JSON
          </button>
        </div>
      </div>

      {/* Conteúdo Principal / Visualizador */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {viewType === "etiqueta-80x80" && (
          <div className="w-72 flex-shrink-0 bg-slate-800/40 border-r border-slate-700/60 flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-slate-700/60">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Selecionar Peça</p>
              <div className="flex flex-wrap gap-2">
                {itens.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setPecaAtiva(item.id)}
                    className={`w-10 h-10 rounded-lg font-bold text-sm transition-all relative cursor-pointer ${
                      item.id === pecaAtiva
                        ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/30"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600"
                    }`}
                  >
                    #{item.id}
                    {fotosPorPeca[item.id] && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border border-slate-800" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {itens.find((i) => i.id === pecaAtiva) && (
              <div className="p-4 border-b border-slate-700/60 space-y-1.5">
                <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Peça #{pecaAtiva}</p>
                <p className="text-white text-sm font-medium">{itens.find((i) => i.id === pecaAtiva)?.descricao}</p>
                <p className="text-slate-400 text-xs">{itens.find((i) => i.id === pecaAtiva)?.material}</p>
                <p className="text-slate-400 text-xs">{itens.find((i) => i.id === pecaAtiva)?.medida}</p>
              </div>
            )}

            <div className="p-4 space-y-3">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Desenho Técnico — Peça #{pecaAtiva}</p>

              <div className="flex items-center gap-2 bg-slate-700/40 border border-dashed border-slate-600 rounded-lg px-3 py-2.5 text-slate-400 text-xs">
                <Clipboard size={13} />
                <span>Pressione <kbd className="bg-slate-600 px-1 py-0.5 rounded text-slate-300 font-mono text-[10px]">Ctrl+V</kbd> para colar</span>
              </div>

              {hasFotoAtiva ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-600 bg-slate-700">
                  <img
                    key={pecaAtiva}
                    src={fotosPorPeca[pecaAtiva]}
                    alt={`Desenho peça #${pecaAtiva}`}
                    className="w-full h-36 object-contain bg-white"
                  />
                  <div className="absolute top-2 right-2">
                    <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">OK</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 h-28 bg-slate-700/40 border border-dashed border-slate-600 rounded-lg text-slate-500">
                  <ImageIcon size={20} />
                  <span className="text-xs">Sem imagem — Peça #{pecaAtiva}</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-amber-500/50 text-slate-300 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-all cursor-pointer"
              >
                <Upload size={13} />
                {hasFotoAtiva ? "Alterar Arquivo" : "Carregar Arquivo"}
              </button>

              {hasFotoAtiva && (
                <button
                  onClick={handleRemoveFoto}
                  className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/60 text-red-400 text-xs font-medium py-2.5 rounded-lg transition-all cursor-pointer"
                >
                  <Trash2 size={13} />
                  Remover Foto — Peça #{pecaAtiva}
                </button>
              )}

              <div className="pt-2 border-t border-slate-700/60">
                <p className="text-slate-500 text-xs font-medium mb-2">Status das Peças</p>
                <div className="space-y-1.5">
                  {itens.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs cursor-pointer group"
                      onClick={() => setPecaAtiva(item.id)}
                    >
                      <span className={`group-hover:text-white transition-colors ${item.id === pecaAtiva ? "text-amber-400 font-semibold" : "text-slate-400"}`}>
                        #{item.id} — {item.descricao}
                      </span>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${fotosPorPeca[item.id] ? "bg-green-400" : "bg-slate-600"}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6 bg-slate-900/50">
          {!pedidoId ? (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Selecione um cliente e um pedido para visualizar.
            </div>
          ) : viewType === "etiqueta-80x80" ? (
            <LabelPreview
              pedidoId={pedidoId}
              cliente={cliente}
              itens={itens}
              pecaAtiva={pecaAtiva}
              fotosPorPeca={fotosPorPeca}
              onSelectPeca={setPecaAtiva}
            />
          ) : (
            <div className="flex justify-center">
              <A4Preview
                pedido={pedido!}
                cliente={cliente}
                itens={itens}
                fotosPorPeca={fotosPorPeca}
                mode={viewType as "a4-inteiro" | "a4-2vias" | "proposta-4col"}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

