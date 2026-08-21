export interface Client {
  id: string; // Unique ID (for local storage)
  type: 'CNPJ' | 'CPF';
  document: string; // CNPJ or CPF formatted
  name: string; // Razão Social or Client Name
  fantasyName?: string; // Nome Fantasia (CNPJ only)
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  situation: string; // Ativa, Inativa, etc.
  contactPerson?: string;
  phone: string;
  email: string;
  enabled: boolean;
  registrationDate: string;
}

export interface QuoteItem {
  id: string;
  date: string;
  companyName: string; // Empresa / Cliente
  description: string; // Descrição do material ou serviço
  constant: string | number; // Constante (ex: 7.85, 1.0, etc.)
  constantName?: string; // Nome do Material selecionado (ex: BRONZE REDONDO, CHAPA)
  constanteNome?: string; // Alias em português
  material?: string; // Alias material
  pricePerKg?: number; // Preço / Valor por Kg (R$)
  geometryType?: 'REDONDO_QUADRADO' | 'CHAPA_RETANGULO' | 'TUBO_BUCHA' | 'chapa' | 'macico' | 'bucha'; // Tipo de geometria para cálculo de peso
  profileType?: 'chapa' | 'macico' | 'bucha';
  materialProfileId?: string;
  measure: string; // Medida (ex: 1/2", 10mm, 50x50)
  diameter: string; // Diâmetro (Ø) / Especificações
  thickness?: string; // Espessura
  thicknessMm?: number;
  diameterMm?: number;
  widthLength: string; // Largura / Comprimento ("Larg" / "M")
  widthMm?: number; // Largura em milímetros
  lengthMm?: number; // Comprimento em milímetros
  unitPrice: number; // Valor Unitário (R$)
  quantity: number; // Quantidade (QTD)
  subtotal: number; // Subtotal = unitPrice * quantity
  unitWeightKg?: number; // Peso Unitário em Kg
  totalWeightKg?: number; // Peso Total do Item em Kg (unitWeightKg * quantity)
  notes?: string;
  // Campos auxiliares em português para compatibilidade direta com relatórios
  descricao?: string;
  observacao?: string;
  info?: string;
  valorUnitario?: number;
  qtd?: number;
  pesoTotal?: number;
  medidasFormatadas?: string;
  drawingImage?: string; // Foto ou imagem do desenho técnico em base64 / URL
  fotoDesenho?: string;
}

export interface Quote {
  id: string; // Ex: ORC-2026-001
  quoteNumber: string;
  clientId?: string;
  clientName: string;
  clientDocument?: string;
  contactPerson?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientCity?: string;
  clientState?: string;
  date: string;
  validityDays: number;
  paymentTerms: string;
  status: 'Rascunho' | 'Enviado' | 'Aprovado' | 'Faturado' | 'Cancelado';
  items: QuoteItem[];
  discount: number; // Desconto em R$
  discountAmount?: number;
  discountPercent?: number; // Desconto em %
  shipping: number; // Frete em R$
  shippingAmount?: number;
  subtotalTotal: number; // Soma dos subtotais
  subtotal?: number;
  grandTotal: number; // Subtotal - Desconto + Frete
  totalAmount?: number;
  totalWeightKg?: number; // Peso Total do Pedido (soma de todos os itens em Kg)
  observations?: string;
  drawingImage?: string;
  fotoDesenho?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  descricao_situacao_cadastral: string;
  cep: string;
  logradouro: string;
  bairro: string;
  municipio: string;
  uf: string;
  ddd_telefone_1: string;
  email: string;
}

export interface ItemOS {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  horario: string;
}

export interface OrdemServico {
  id: string;
  clienteId: string;
  clienteNome: string;
  data: string; // YYYY-MM-DD
  status: 'ABERTA' | 'CONCLUIDA';
  itens: ItemOS[];
}


