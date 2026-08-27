import { useState, useEffect, useCallback } from 'react';
import { Client } from '../types';
import { fetchClientesDb, saveClienteDb, deleteClienteDb } from '../lib/db';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDbSynced, setIsDbSynced] = useState<boolean>(false);

  const refreshClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const dbClients = await fetchClientesDb();
      if (dbClients && dbClients.length > 0) {
        setClients(dbClients);
        localStorage.setItem('s_clientes', JSON.stringify(dbClients));
        setIsDbSynced(true);
      } else {
        const saved = localStorage.getItem('s_clientes');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              setClients(parsed);
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar clientes do Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Carrega do LocalStorage primeiro para resposta instantânea
    const saved = localStorage.getItem('s_clientes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(c => !String(c.id).startsWith('seed-'));
          setClients(valid);
        }
      } catch (e) {
        console.error('Error loading saved clients from localStorage:', e);
      }
    }

    // 2. Busca do Supabase
    refreshClients();
  }, [refreshClients]);

  const saveClientsToStorage = (updatedList: Client[]) => {
    setClients(updatedList);
    localStorage.setItem('s_clientes', JSON.stringify(updatedList));
  };

  const handleSaveClient = async (client: Client): Promise<{ success: boolean; error?: any; client?: Client }> => {
    setIsSaving(true);
    try {
      // 1. Salva diretamente na tabela 'clientes' do Supabase
      const { data: savedDbClient, error } = await saveClienteDb(client);

      const finalClient: Client = (savedDbClient && savedDbClient.id) 
        ? savedDbClient 
        : client;

      // 2. Atualiza estado local e cache
      const exists = clients.some(c => c.id === client.id || (savedDbClient?.id && c.id === savedDbClient.id));
      const updatedList = exists
        ? clients.map(c => (c.id === client.id || (savedDbClient?.id && c.id === savedDbClient.id)) ? finalClient : c)
        : [finalClient, ...clients];

      saveClientsToStorage(updatedList);
      setIsDbSynced(true);
      setActiveClient(null);

      if (error) {
        console.warn("Aviso ao salvar no Supabase:", error);
        return { success: false, error, client: finalClient };
      }

      return { success: true, client: finalClient };
    } catch (e) {
      console.error("Erro ao salvar cliente no banco:", e);
      return { success: false, error: e };
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClient = async (id: string): Promise<{ success: boolean; error?: any }> => {
    const updatedList = clients.filter(c => c.id !== id);
    saveClientsToStorage(updatedList);
    setActiveClient(null);

    // Deleta no Supabase
    try {
      const { error } = await deleteClienteDb(id);
      if (error) {
        console.warn("Aviso ao excluir cliente no Supabase:", error);
        return { success: false, error };
      }
      return { success: true };
    } catch (e) {
      console.warn("Erro ao excluir cliente no banco:", e);
      return { success: false, error: e };
    }
  };

  const handleExportClients = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(clients, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "clientes_export.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return {
    clients,
    activeClient,
    setActiveClient,
    handleSaveClient,
    handleDeleteClient,
    handleExportClients,
    refreshClients,
    isLoading,
    isSaving,
    isDbSynced
  };
}
