import type { Client, Quote, QuoteItem } from '../types';

export type ViewType = 'a4-inteiro' | 'proposta-4col' | 'a4-2vias' | 'etiqueta-80x80';

export interface Cliente {
  id: number;
  nome: string;
  cnpj: string;
  telefone: string;
  cidade: string;
  email?: string;
  contato?: string;
}

export interface Pedido {
  id: string;
  data: string;
  status: string;
  clienteNome?: string;
  total?: number;
}

export interface ItemPedido {
  id: number;
  descricao: string;
  material: string;
  medida: string;
  quantidade: number;
  valorUnit: number;
  observacoes?: string;
  foto?: string;
}

export * from '../types';
