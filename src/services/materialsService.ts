import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/db';
import { 
  MaterialProfile, 
  DADOS_MATERIAIS_MAP, 
  tabelaConstantes,
  TabelaConstanteItem
} from '../utils/calculator';

export type TipoGeometriaExtensa = 'Redondo / Maciço' | 'Chapa / Placa' | 'Bucha / Tubo';

export interface MaterialSupabaseRecord {
  id: string;
  nome: string;
  tipo: string;
  constante: number;
  preco_base: number;
  created_at?: string;
}

export interface MaterialItem {
  id: string;
  nome: string;
  tipo: 'macico' | 'chapa' | 'bucha';
  tipoExtenso: TipoGeometriaExtensa;
  k: number;
  precoKg: number;
  created_at?: string;
}

const STORAGE_KEY = 's_materiais_cadastrados';
export const EVENT_MATERIAIS_SYNC = 'usicorte_materiais_sync';

export function normalizarTipo(tipoRaw?: string): 'macico' | 'chapa' | 'bucha' {
  const t = (tipoRaw || '').toLowerCase();
  if (t.includes('chapa') || t.includes('placa')) return 'chapa';
  if (t.includes('bucha') || t.includes('tubo')) return 'bucha';
  return 'macico';
}

export function tipoParaExtenso(tipoRaw?: string): TipoGeometriaExtensa {
  const norm = normalizarTipo(tipoRaw);
  if (norm === 'chapa') return 'Chapa / Placa';
  if (norm === 'bucha') return 'Bucha / Tubo';
  return 'Redondo / Maciço';
}

export function mapSupabaseToItem(record: any): MaterialItem {
  const normTipo = normalizarTipo(record.tipo);
  const kVal = Number(record.constante != null ? record.constante : (record.k != null ? record.k : 0.00785));
  const precoVal = Number(record.preco_base != null ? record.preco_base : (record.precoKg != null ? record.precoKg : 22.00));
  
  return {
    id: String(record.id || record.nome),
    nome: (record.nome || record.name || '').trim().toUpperCase(),
    tipo: normTipo,
    tipoExtenso: record.tipo && ['Redondo / Maciço', 'Chapa / Placa', 'Bucha / Tubo'].includes(record.tipo)
      ? (record.tipo as TipoGeometriaExtensa)
      : tipoParaExtenso(normTipo),
    k: kVal,
    precoKg: precoVal,
    created_at: record.created_at
  };
}

export function materialItemToProfile(item: MaterialItem): MaterialProfile {
  return {
    id: item.id,
    name: item.nome,
    tipo: item.tipo,
    k: item.k,
    defaultPriceKg: item.precoKg,
    description: `${item.nome} (k=${item.k} | R$ ${item.precoKg.toFixed(2).replace('.', ',')}/Kg)`
  };
}

export function materialItemToConstante(item: MaterialItem): TabelaConstanteItem {
  return {
    nome: item.nome,
    k: item.k,
    precoKg: item.precoKg,
    tipo: item.tipo
  };
}

/**
 * Atualiza o mapa global DADOS_MATERIAIS_MAP e constantes com a lista dinâmica
 */
export function syncGlobalMaterials(items: MaterialItem[]) {
  items.forEach(item => {
    const slug = item.nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const data = {
      tipo: item.tipo,
      k: item.k,
      precoKg: item.precoKg,
      id: item.id,
      nome: item.nome
    };

    DADOS_MATERIAIS_MAP[item.nome] = data;
    DADOS_MATERIAIS_MAP[item.nome.toLowerCase()] = data;
    DADOS_MATERIAIS_MAP[item.id] = data;
    if (slug) {
      DADOS_MATERIAIS_MAP[slug] = data;
    }
  });
}

/**
 * Carrega a lista inicial do cache local ou defaults
 */
export function getCachedMaterials(): MaterialItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const items = parsed.map(mapSupabaseToItem);
        syncGlobalMaterials(items);
        return items;
      }
    }
  } catch (err) {
    console.warn('Erro ao ler cache local de materiais:', err);
  }

  // Fallback padrão com os materiais canônicos
  const defaults: MaterialItem[] = tabelaConstantes.map(c => ({
    id: c.nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_'),
    nome: c.nome,
    tipo: c.tipo,
    tipoExtenso: tipoParaExtenso(c.tipo),
    k: c.k,
    precoKg: c.precoKg
  }));

  syncGlobalMaterials(defaults);
  return defaults;
}

/**
 * Salva no cache local e emite evento para sincronização instantânea em toda a aplicação
 */
export function saveCachedMaterials(items: MaterialItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    syncGlobalMaterials(items);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_MATERIAIS_SYNC, { detail: items }));
    }
  } catch (err) {
    console.warn('Erro ao salvar cache de materiais:', err);
  }
}

/**
 * Busca todos os materiais da tabela 'materiais' do Supabase
 */
export async function fetchMateriaisDb(): Promise<MaterialItem[]> {
  try {
    const { data, error } = await db
      .from('materiais')
      .select('*')
      .order('nome', { ascending: true });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      const mapped = data.map(mapSupabaseToItem);
      saveCachedMaterials(mapped);
      return mapped;
    }

    if (error) {
      console.warn('Erro ao buscar materiais do Supabase:', error);
    }
  } catch (err) {
    console.warn('Falha de conexão com Supabase materiais:', err);
  }

  return getCachedMaterials();
}

/**
 * Cria um novo material no Supabase e atualiza o cache e combobox
 */
export async function createMaterialDb(payload: {
  nome: string;
  tipo: TipoGeometriaExtensa;
  constante: number;
  preco_base: number;
}): Promise<{ data: MaterialItem | null; error: string | null }> {
  const cleanNome = payload.nome.trim().toUpperCase();
  if (!cleanNome) {
    return { data: null, error: 'O nome do material é obrigatório.' };
  }

  const kVal = Number(payload.constante);
  if (isNaN(kVal) || kVal < 0) {
    return { data: null, error: 'A constante metalúrgica (k) deve ser um número válido.' };
  }

  const precoVal = Number(payload.preco_base);
  if (isNaN(precoVal) || precoVal < 0) {
    return { data: null, error: 'O preço base por Kg deve ser um número válido maior ou igual a zero.' };
  }

  try {
    const { data, error } = await db
      .from('materiais')
      .insert({
        nome: cleanNome,
        tipo: payload.tipo,
        constante: kVal,
        preco_base: precoVal
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir material no Supabase:', error);
      return { data: null, error: error.message || 'Falha ao gravar material no banco.' };
    }

    const newItem = mapSupabaseToItem(data);

    // Atualiza cache e notifica
    const current = getCachedMaterials();
    const updatedList = [newItem, ...current.filter(m => m.id !== newItem.id)].sort((a, b) => a.nome.localeCompare(b.nome));
    saveCachedMaterials(updatedList);

    return { data: newItem, error: null };
  } catch (err: any) {
    console.error('Exceção ao criar material:', err);
    return { data: null, error: err?.message || 'Erro inesperado ao cadastrar material.' };
  }
}

/**
 * Edita um material existente no Supabase e atualiza o cache e combobox
 */
export async function updateMaterialDb(
  id: string,
  payload: {
    nome: string;
    tipo: TipoGeometriaExtensa;
    constante: number;
    preco_base: number;
  }
): Promise<{ data: MaterialItem | null; error: string | null }> {
  const cleanNome = payload.nome.trim().toUpperCase();
  if (!cleanNome) {
    return { data: null, error: 'O nome do material é obrigatório.' };
  }

  const kVal = Number(payload.constante);
  if (isNaN(kVal) || kVal < 0) {
    return { data: null, error: 'A constante metalúrgica (k) deve ser um número válido.' };
  }

  const precoVal = Number(payload.preco_base);
  if (isNaN(precoVal) || precoVal < 0) {
    return { data: null, error: 'O preço base por Kg deve ser um número válido maior ou igual a zero.' };
  }

  try {
    const { data, error } = await db
      .from('materiais')
      .update({
        nome: cleanNome,
        tipo: payload.tipo,
        constante: kVal,
        preco_base: precoVal
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar material no Supabase:', error);
      return { data: null, error: error.message || 'Falha ao atualizar material no banco.' };
    }

    const updatedItem = mapSupabaseToItem(data);

    // Atualiza cache e notifica
    const current = getCachedMaterials();
    const updatedList = current.map(m => m.id === id ? updatedItem : m).sort((a, b) => a.nome.localeCompare(b.nome));
    saveCachedMaterials(updatedList);

    return { data: updatedItem, error: null };
  } catch (err: any) {
    console.error('Exceção ao atualizar material:', err);
    return { data: null, error: err?.message || 'Erro inesperado ao atualizar material.' };
  }
}

/**
 * Exclui um material do Supabase e atualiza o cache e combobox
 */
export async function deleteMaterialDb(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await db
      .from('materiais')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir material do Supabase:', error);
      return { success: false, error: error.message || 'Falha ao excluir material no banco.' };
    }

    // Atualiza cache e notifica
    const current = getCachedMaterials();
    const updatedList = current.filter(m => m.id !== id);
    saveCachedMaterials(updatedList);

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Exceção ao excluir material:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao excluir material.' };
  }
}

/**
 * Hook do React para gerenciar e escutar alterações dinâmicas nos materiais em tempo real
 */
export function useMaterialsCatalog() {
  const [materials, setMaterials] = useState<MaterialItem[]>(() => getCachedMaterials());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchMateriaisDb();
      setMaterials(items);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar materiais.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();

    const handleSync = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setMaterials(e.detail);
      } else {
        reload();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(EVENT_MATERIAIS_SYNC, handleSync);
    }

    // Canal Supabase Realtime com identificador único por instância para evitar conflito de canal já subscrito
    const channelId = `realtime_materiais_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = db
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materiais' }, () => {
        reload();
      })
      .subscribe();

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(EVENT_MATERIAIS_SYNC, handleSync);
      }
      try {
        db.removeChannel(channel);
      } catch (err) {
        // Ignora caso canal já fechado
      }
    };
  }, [reload]);

  const profiles: MaterialProfile[] = materials.map(materialItemToProfile);
  const constantes: TabelaConstanteItem[] = materials.map(materialItemToConstante);

  return {
    materials,
    profiles,
    constantes,
    loading,
    error,
    reload
  };
}

