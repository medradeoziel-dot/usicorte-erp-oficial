import type { Cliente, Pedido, ItemPedido } from "./types";

export const clientes: Cliente[] = [
  { id: 1, nome: "Auto Peças Silva Ltda", cnpj: "12.345.678/0001-90", telefone: "(11) 98765-4321", cidade: "São Paulo - SP" },
  { id: 2, nome: "Mecânica Rodrigues & Cia", cnpj: "98.765.432/0001-10", telefone: "(11) 91234-5678", cidade: "Santo André - SP" },
  { id: 3, nome: "Indústria Metalúrgica Santos", cnpj: "11.222.333/0001-44", telefone: "(19) 99876-5432", cidade: "Campinas - SP" },
  { id: 4, nome: "Ferramentaria Omega Ltda", cnpj: "55.666.777/0001-88", telefone: "(11) 97654-3210", cidade: "Guarulhos - SP" },
];

export const pedidosPorCliente: Record<number, Pedido[]> = {
  1: [
    { id: "COT-2026-2651", data: "2026-08-10", status: "Aprovado" },
    { id: "COT-2026-2589", data: "2026-07-22", status: "Pendente" },
  ],
  2: [
    { id: "COT-2026-2643", data: "2026-08-15", status: "Aprovado" },
    { id: "COT-2026-2611", data: "2026-08-02", status: "Em Produção" },
  ],
  3: [
    { id: "COT-2026-2601", data: "2026-08-01", status: "Em Produção" },
    { id: "COT-2026-2598", data: "2026-07-28", status: "Aprovado" },
  ],
  4: [
    { id: "COT-2026-2633", data: "2026-08-12", status: "Entregue" },
  ],
};

export const itensPorPedido: Record<string, ItemPedido[]> = {
  "COT-2026-2651": [
    {
      id: 1,
      descricao: "Flange Usinada",
      material: "ABNT 1020",
      medida: "Ø 150mm × 25mm",
      quantidade: 4,
      valorUnit: 285.0,
      observacoes: "Furação padrão flanges PN10 — 4 furos Ø18mm equidistantes",
    },
    {
      id: 2,
      descricao: "Eixo Escalonado",
      material: "ABNT 4340",
      medida: "Ø 45mm × 320mm",
      quantidade: 2,
      valorUnit: 520.0,
      observacoes: "Tratamento térmico: cementação e têmpera HRC 58-62",
    },
    {
      id: 3,
      descricao: "Bucha de Bronze",
      material: "Bronze TM23",
      medida: "Ø ext 80mm / Ø int 55mm × 60mm",
      quantidade: 6,
      valorUnit: 180.0,
      observacoes: "Acabamento Ra 1,6µm no diâmetro interno",
    },
  ],
  "COT-2026-2589": [
    {
      id: 1,
      descricao: "Pino de Articulação",
      material: "ABNT 1045",
      medida: "Ø 30mm × 180mm",
      quantidade: 10,
      valorUnit: 95.0,
      observacoes: "Cementação e têmpera HRC 58-62 — rechear com feltro",
    },
    {
      id: 2,
      descricao: "Arruela de Encosto",
      material: "Aço Inox 304",
      medida: "Ø ext 48mm / Ø int 31mm × 4mm",
      quantidade: 10,
      valorUnit: 42.0,
      observacoes: "Acabamento liso, cantos vivos",
    },
  ],
  "COT-2026-2643": [
    {
      id: 1,
      descricao: "Tampa de Redutor",
      material: "Alumínio 6061",
      medida: "120mm × 120mm × 15mm",
      quantidade: 3,
      valorUnit: 340.0,
      observacoes: "Anodização natural — rosca M8 nos 4 cantos",
    },
    {
      id: 2,
      descricao: "Parafuso Especial M16",
      material: "ABNT 4140",
      medida: "M16 × 1,5 × 80mm",
      quantidade: 20,
      valorUnit: 45.0,
      observacoes: "Rosca especial conforme desenho cliente — cabeça sextavada",
    },
  ],
  "COT-2026-2611": [
    {
      id: 1,
      descricao: "Suporte Basculante",
      material: "ABNT 1020 Chapa 10mm",
      medida: "200mm × 150mm",
      quantidade: 5,
      valorUnit: 230.0,
      observacoes: "Solda MIG, eletrodo ER70S-6 — pintura epóxi cinza",
    },
  ],
  "COT-2026-2601": [
    {
      id: 1,
      descricao: "Carcaça de Bomba",
      material: "Ferro Fundido GH190",
      medida: "200mm × 180mm × 150mm",
      quantidade: 1,
      valorUnit: 1850.0,
      observacoes: "Usinagem completa conforme desenho 2024-BBA-001",
    },
  ],
  "COT-2026-2598": [
    {
      id: 1,
      descricao: "Arruela de Ajuste",
      material: "Aço Inox 304",
      medida: "Ø ext 60mm / Ø int 30mm × 2mm",
      quantidade: 50,
      valorUnit: 28.0,
      observacoes: "Acabamento escovado — tolerância h7 no diâmetro interno",
    },
    {
      id: 2,
      descricao: "Suporte em L",
      material: "ABNT 1020 Chapa 6mm",
      medida: "100mm × 100mm × 6mm",
      quantidade: 8,
      valorUnit: 115.0,
      observacoes: "Dobramento e solda MIG conforme projeto — furos Ø10mm",
    },
  ],
  "COT-2026-2633": [
    {
      id: 1,
      descricao: "Placa de Fixação",
      material: "ABNT 1020",
      medida: "250mm × 200mm × 12mm",
      quantidade: 2,
      valorUnit: 390.0,
      observacoes: "Furos escareados conforme croqui",
    },
    {
      id: 2,
      descricao: "Anel de Vedação Metálico",
      material: "Aço Inox 316L",
      medida: "Ø ext 90mm / Ø int 78mm × 5mm",
      quantidade: 4,
      valorUnit: 215.0,
      observacoes: "Polimento especular Ra 0,8µm nas faces",
    },
    {
      id: 3,
      descricao: "Porca Sextavada Especial",
      material: "ABNT 1045",
      medida: "M24 × 3,0 — s/w 36mm",
      quantidade: 12,
      valorUnit: 58.0,
      observacoes: "Têmpera e revenimento HRC 28-32",
    },
  ],
};
