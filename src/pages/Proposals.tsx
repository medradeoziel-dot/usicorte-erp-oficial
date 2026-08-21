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
} from "lucide-react";
import { clientes, pedidosPorCliente, itensPorPedido } from "@/lib/mockData";
import type { ViewType, ItemPedido } from "@/lib/types";
import { useLocalStorage } from "@/lib/useLocalStorage";
import LabelPreview from "@/components/LabelPreview";
import A4Preview from "@/components/A4Preview";

const viewOptions: { value: ViewType; label: string }[] = [
  { value: "a4-inteiro", label: "A4 Inteiro" },
  { value: "proposta-4col", label: "Proposta 4 Colunas" },
  { value: "a4-2vias", label: "A4 2 Vias" },
  { value: "etiqueta-80x80", label: "Etiqueta 80×80" },
];

export default function Proposals() {
  const [clienteId, setClienteId] = useLocalStorage<number>("clienteId", clientes[0].id);
  const [pedidoId, setPedidoId] = useLocalStorage<string>("pedidoId", "");
  const [viewType, setViewType] = useLocalStorage<ViewType>("viewType", "etiqueta-80x80");
  const [pecaAtiva, setPecaAtiva] = useLocalStorage<number>("pecaAtiva", 1);
  const [fotosPorPeca, setFotosPorPeca] = useLocalStorage<Record<number, string>>("fotosPorPeca", {});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const pedidos = pedidosPorCliente[clienteId] ?? [];
  const itens: ItemPedido[] = pedidoId ? (itensPorPedido[pedidoId] ?? []) : [];
  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const pedido = pedidos.find((p) => p.id === pedidoId) ?? null;

  useEffect(() => {
    const pedidosDoCliente = pedidosPorCliente[clienteId] ?? [];
    const pedidoValido = pedidosDoCliente.some((p) => p.id === pedidoId);
    if (!pedidoValido) {
      setPedidoId(pedidosDoCliente[0]?.id ?? "");
    }
  }, [clienteId, pedidoId, setPedidoId]);

  useEffect(() => {
    setPecaAtiva(itens[0]?.id ?? 1);
  }, [pedidoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveImage = useCallback(
    (base64: string) => {
      setFotosPorPeca((prev) => ({ ...prev, [pecaAtiva]: base64 }));
    },
    [pecaAtiva]
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
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
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
      `"${i.observacoes}"`,
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
    <div className="flex flex-col h-full min-h-0">
      <div className="bg-slate-800/60 border-b border-slate-700/60 px-6 py-4 space-y-4 flex-shrink-0">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider">Cliente</label>
            <div className="relative">
              <select
                value={clienteId}
                onChange={(e) => setClienteId(Number(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 cursor-pointer"
              >
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider">Pedido / Cotação</label>
            <div className="relative">
              <select
                value={pedidoId}
                onChange={(e) => setPedidoId(e.target.value)}
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
                  className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                    viewType === opt.value
                      ? "bg-amber-500 text-slate-900"
                      : "text-slate-400 hover:text-white hover:bg-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors border border-slate-600 hover:border-slate-500"
          >
            <Printer size={14} />
            Imprimir Pedido (A4)
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors border border-slate-600 hover:border-slate-500"
          >
            <Tag size={14} />
            Imprimir Etiqueta da Peça
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <FileText size={14} />
            Imprimir Proposta (A4)
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors border border-slate-600"
          >
            <Download size={14} />
            Exportar CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors border border-slate-600"
          >
            <Download size={14} />
            Exportar JSON
          </button>
        </div>
      </div>

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
                    className={`w-10 h-10 rounded-lg font-bold text-sm transition-all relative ${
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
                <span>Pressione <kbd className="bg-slate-600 px-1 py-0.5 rounded text-slate-300">Ctrl+V</kbd> para colar</span>
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
                    <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">OK</span>
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
                className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-amber-500/50 text-slate-300 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-all"
              >
                <Upload size={13} />
                {hasFotoAtiva ? "Alterar Arquivo" : "Carregar Arquivo"}
              </button>

              {hasFotoAtiva && (
                <button
                  onClick={handleRemoveFoto}
                  className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/60 text-red-400 text-xs font-medium py-2.5 rounded-lg transition-all"
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
