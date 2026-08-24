import { Client, Quote } from '../types';

export const INITIAL_CLIENTS: Client[] = [];

export const INITIAL_QUOTE: Quote = {
  id: '',
  quoteNumber: '',
  clientName: '',
  clientDocument: '',
  contactPerson: '',
  clientPhone: '',
  clientEmail: '',
  clientCity: '',
  clientState: '',
  date: new Date().toISOString().split('T')[0],
  validityDays: 10,
  paymentTerms: 'À Vista',
  status: 'Rascunho',
  items: [],
  discount: 0,
  discountAmount: 0,
  shipping: 0,
  shippingAmount: 0,
  subtotalTotal: 0,
  subtotal: 0,
  grandTotal: 0,
  totalAmount: 0,
  totalWeightKg: 0,
  observations: 'Preços com impostos inclusos. Material sujeito a conferência no ato do recebimento.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
