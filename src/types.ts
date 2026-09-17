export interface Client {
  id: string; // Unique ID (UUID do Supabase ou gerado)
  type: 'CNPJ' | 'CPF';
  document: string; // CNPJ ou CPF
  name: string; // Razão Social ou Nome do Cliente
  fantasyName?: string; // Nome Fantasia
  situation: string; // Situação (ATIVA, INATIVA, etc.)
  cep: string;
  street: string; // Endereço / Logradouro / Rua
  neighborhood: string; // Bairro
  city: string; // Cidade
  state: string; // UF
  contactPerson?: string; // Contato / Representante
  phone: string; // Telefone
  email: string; // E-mail
  enabled: boolean; // Habilitado
  registrationDate: string; // Data de Cadastro (YYYY-MM-DD)
  // Aliases opcionais em português para interoperabilidade direta com o Supabase
  tipo?: 'CNPJ' | 'CPF' | string;
  documento?: string;
  nome?: string;
  nome_fantasia?: string;
  situacao?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  contato?: string;
  telefone?: string;
  habilitado?: boolean;
  data_cadastro?: string;
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
  // Campos auxiliares em português para compatibilidade direta com relatórios e edição
  descricao?: string;
  produto?: string;
  medida?: string;
  medidaFormatada?: string;
  medidasFormatadas?: string;
  descricaoMedida?: string;
  espessura?: string | number;
  espessuraMm?: number;
  largura?: string | number;
  larguraMm?: number;
  comprimento?: string | number;
  comprimentoMm?: number;
  diametro?: string | number;
  diametroMm?: number;
  observacao?: string;
  info?: string;
  valorUnitario?: number;
  qtd?: number;
  pesoTotal?: number;
  drawingImage?: string; // Foto ou imagem do desenho técnico em base64 / URL
  fotoDesenho?: string;
  desenhoUrl?: string;
  desenho_url?: string;
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
  status: 'Pendente' | 'Rascunho' | 'Enviado' | 'Aprovado' | 'Faturado' | 'Cancelado' | 'Rejeitado';
  paymentStatus?: 'Pendente' | 'Pago';
  paymentDate?: string;
  paymentMethod?: string;
  paymentNotes?: string;
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

// ==========================================
// MÓDULO DE ESTOQUE DE MATÉRIA-PRIMA & RETALHOS
// ==========================================

export type TipoMaterialEstoque = 'chapa' | 'barra' | 'perfil' | 'tubo';

export interface MaterialEstoque {
  id: string;
  codigo: string; // Ex: 'MAT-001'
  nome: string; // Ex: 'Chapa A36 1/4" (6.35mm)'
  tipo: TipoMaterialEstoque;
  material: string; // Ex: 'A36', '1020', '1045', 'Inox 304', 'Alumínio', 'Bronze'
  espessuraMm: number; // Espessura em mm
  larguraMm: number; // Largura da chapa/perfil em mm
  comprimentoMm: number; // Comprimento em mm
  densidade: number; // Ex: 0.00785 (Aço Carbono), 0.00800 (Inox), etc.
  pesoUnitarioKg: number; // Peso de 1 unidade/chapa em KG (ou 1 barra de 6m)
  quantidade: number; // Quantidade de unidades/barras em estoque (conferência)
  pesoTotalKg: number; // Saldo total estritamente em KG (controle principal)
  estoqueMinimoKg: number; // Alerta em KG
  estoqueMinimoQtd: number; // Alerta em Unidades
  custoKg: number; // Custo de compra por KG (R$)
  precoVendaKg: number; // Preço base sugerido de venda por KG (R$)
  localizacao: string; // Pátio, Rack, Prateleira
  fornecedor?: string;
  observacoes?: string;
  atualizadoEm: string;
  ncm?: string;
  constanteK?: number;
  bitolaMm?: number;
  metroLinearTotal?: number;
}

export interface EntradaNotaFiscalData {
  numeroNF: string;
  fornecedor?: string;
  dataEmissao?: string;
  tipoProduto: string;
  bitolaMm: number;
  constanteK: number;
  ncm: string;
  pesoBarra6m: number;
  pesoTotalKgNF: number;
  valorKgNF: number;
  freteTotalNF: number;
  qtdItensNF: number;
  precoVendaKg: number;
  qtdBarras6m: number;
  metroLinearTotal: number;
  subtotal: number;
  ipiValor: number;
  freteRateado: number;
  custoTotalItem: number;
  custoRealKg: number;
  lucroKg: number;
  margemLucroPercent: number;
  materialDestinoId?: string;
  nomeMaterial: string;
  localizacao?: string;
  lancarContasPagar?: boolean;
}

export interface RetalhoEstoque {
  id: string;
  codigo: string; // Ex: 'RET-001'
  materialId?: string;
  materialNome: string;
  tipo: TipoMaterialEstoque;
  espessuraMm: number;
  larguraMm: number;
  comprimentoMm: number;
  pesoKg: number;
  cotacaoOrigem?: string; // Ex: 'COT-2026-0001'
  localizacao: string; // Ex: 'Rack de Retalhos Chapa 1'
  status: 'disponivel' | 'utilizado' | 'descartado';
  dataEntrada: string;
  dataUso?: string;
  observacao?: string;
}

export interface MovimentacaoEstoque {
  id: string;
  materialId: string;
  materialNome: string;
  tipo: 'entrada' | 'saida_venda' | 'saida_ajuste' | 'entrada_retalho' | 'devolucao';
  quantidade: number;
  pesoKg: number;
  referenciaDoc?: string; // Ex: 'COT-2026-0001', 'OS-12', 'NF-1002'
  custoTotal: number;
  data: string;
  usuario?: string;
  observacao?: string;
}

// ==========================================
// MÓDULO FINANCEIRO (CAIXA E CONTAS)
// ==========================================

export type TipoLancamento = 'receita' | 'despesa';

export type CategoriaLancamento = 
  | 'venda_cotacao' 
  | 'fechamento_cotacoes'
  | 'ordem_servico' 
  | 'compra_chapa' 
  | 'custo_operacional' 
  | 'frete' 
  | 'despesa_fixa' 
  | 'energia' 
  | 'manutencao' 
  | 'impostos' 
  | 'folha_pagamento'
  | 'outros';

export type FormaPagamentoFinanceiro = 'PIX' | 'Boleto' | 'Cartão de Crédito' | 'Cartão de Débito' | 'Transferência' | 'Dinheiro' | 'A Prazo';

export type StatusFinanceiro = 'pendente' | 'pago' | 'atrasado' | 'cancelado';

export interface LancamentoFinanceiro {
  id: string;
  tipo: TipoLancamento;
  categoria: CategoriaLancamento;
  descricao: string;
  clienteFornecedor: string;
  documentoRef?: string; // Ex: 'COT-2026-0001', 'OS-05', 'NF-8921'
  valor: number;
  dataVencimento: string; // YYYY-MM-DD
  dataCompetencia: string; // YYYY-MM-DD
  dataPagamento?: string; // YYYY-MM-DD
  formaPagamento: FormaPagamentoFinanceiro;
  status: StatusFinanceiro;
  observacoes?: string;
  cotacaoId?: string;
  criadoEm: string;
}

// ==========================================
// CONTAS A RECEBER / GESTÃO DE BOLETOS & PARCELAS
// ==========================================

export interface ContaReceberParcela {
  id: string;
  clienteId?: string;
  clienteNome: string;
  cotacaoId?: string;
  cotacaoNumero: string;
  numeroParcela: number; // 1, 2, 3...
  totalParcelas: number; // 3
  valorParcela: number;
  dataVencimento: string; // YYYY-MM-DD
  dataEmissao: string; // YYYY-MM-DD
  dataPagamento?: string; // YYYY-MM-DD
  status: 'Pendente' | 'Baixado' | 'Atrasado';
  formaPagamento?: string;
  banco?: string;
  codigoBarras?: string;
  nossoNumero?: string;
  observacoes?: string;
  lancamentoId?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

// ==========================================
// DADOS DA EMPRESA / EMITENTE (NF-e E CABEÇALHO)
// ==========================================

export interface CompanyFiscalData {
  id?: string;
  // Dados Fiscais
  personType: 'Jurídica' | 'Física';
  corporateName: string; // Razão Social (L. M. BANZATTO METAIS)
  tradeName: string; // Nome Fantasia (USICORTE METAIS)
  cnpj: string; // CNPJ (25.038.430/0001-23)
  ie: string; // Inscrição Estadual / IE (209632312114)
  im?: string; // Inscrição Municipal / IM (558747)
  cnae?: string; // CNAE Principal (4744001)
  taxRegime: string; // Regime Tributário (Simples Nacional, etc.)

  // Endereço Completo
  cep: string; // CEP (17031-350)
  street: string; // Endereço (RUA CORONEL IVON CESAR PIMENTEL)
  number: string; // Número (3-41)
  complement?: string; // Complemento
  neighborhood: string; // Bairro (PARQUE PAULISTA)
  city: string; // Cidade (BAURU)
  state: string; // UF (SP)
  ibgeCode?: string; // Código IBGE Cidade (3506003)
  countryCode?: string; // Código País (1058 - BRASIL)

  // Contato e Mídia
  email: string; // E-mail (financeirousicorte@gmail.com)
  website?: string; // Website (WWW.USICORTEMETAIS.COM.BR)
  phone: string; // Telefone ((14) 99880-9362)
  mobile?: string; // Celular / WhatsApp ((14) 99819-6873)
  logoUrl?: string; // Upload da Logomarca da Empresa (Base64 ou URL)

  // Responsável Legal
  legalRepresentativeName?: string; // Nome do Responsável (MARCOS MARTINS)
  legalRepresentativeDoc?: string; // CPF/CNPJ Representante (092.345.510/0001-94)

  // 5. Configuração de Numeração Sequencial de Cotações / Pedidos
  nextQuoteSequential?: number; // Próximo Número Sequencial (ex: 140 ou 50000)
  quotePrefix?: string; // Prefixo Personalizado (ex: 'COT-2026-')
  proximo_numero_sequencial?: number; // Nome do campo na tabela emitente
  proximo_numero_cotacao?: number;
  prefixo_cotacao?: string;

  // 6. Informações para Pagamento & Chave PIX (Dinâmico)
  chavePix?: string; // Chave PIX
  tipoChavePix?: string; // Tipo da Chave (Ex: CNPJ / E-mail)
  favorecidoPix?: string; // Favorecido / Titular do PIX
  bancoNome?: string; // Banco (Nome do Banco)
  bancoAgencia?: string; // Agência
  bancoConta?: string; // Conta Corrente
  bancoTitular?: string; // Titular / Razão Social do Banco
  bancoCnpj?: string; // CNPJ do Banco
  instrucoesPagamento?: string; // Texto de Observação / Instrução (Ex: WhatsApp/E-mail para envio de comprovante)

  // Aliases em português para integração direta com Supabase
  tipo_pessoa?: string;
  razao_social?: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  regime_tributario?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  ibge_cidade?: string;
  codigo_pais?: string;
  telefone?: string;
  celular?: string;
  logo_url?: string;
  nome_responsavel?: string;
  documento_responsavel?: string;
  chave_pix?: string;
  tipo_chave_pix?: string;
  favorecido_pix?: string;
  banco_nome?: string;
  banco_agencia?: string;
  banco_conta?: string;
  banco_titular?: string;
  banco_cnpj?: string;
  instrucoes_pagamento?: string;
  updated_at?: string;
}

export type StatusProposta = 'rascunho' | 'pendente' | 'aprovado' | 'faturado' | 'rejeitado' | 'cancelado' | string;

export interface ItemCotacaoResumo {
  id: string;
  cotacaoNumero: string;
  clienteNome: string;
  clienteId?: string;
  data: string;
  valorTotal: number;
  status: StatusProposta;
  itensCount: number;
}

// ============================================================================
// FECHAMENTO MENSAL & HISTÓRICO SUPABASE
// ============================================================================

export interface FechamentoCotacaoDetalhe {
  id: string;
  numero: string;
  data: string;
  cliente_nome: string;
  valor_total: number;
  contato?: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
  situacao?: string;
  status?: string;
  forma_pagamento?: string;
  data_pagamento?: string | null;
}

export interface FechamentoEmpresaResumo {
  empresa: string;
  total: number;
  quantidadeCotacoes: number;
  percentualDoTotal?: number;
  cotacoes: FechamentoCotacaoDetalhe[];
}

export interface FechamentoMensalResumoJson {
  empresas: FechamentoEmpresaResumo[];
  geral: {
    mes_ano: string; // Ex: '2026-08'
    mes_ano_formatado: string; // Ex: 'Agosto de 2026'
    total_geral: number;
    total_empresas: number;
    total_cotacoes: number;
    ticket_medio: number;
    fechado_em: string;
    fechado_por: string;
  };
}

export interface FechamentoMensal {
  id?: string;
  mes_ano: string; // 'YYYY-MM' (ex: '2026-08')
  total_geral: number;
  total_empresas: number;
  total_cotacoes?: number;
  fechado_por?: string;
  fechado_em?: string;
  resumo_json: FechamentoMensalResumoJson;
  created_at?: string;
  updated_at?: string;
}


