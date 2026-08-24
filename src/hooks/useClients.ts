import { useState, useEffect } from 'react';
import { Client } from '../types';
import { fetchClientesDb, saveClienteDb, deleteClienteDb } from '../lib/db';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDbSynced, setIsDbSynced] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      // 1. Carrega do LocalStorage primeiro para resposta instantânea
      const saved = localStorage.getItem('s_clientes');
      let localClients: Client[] = [];
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // Remove eventuais resquícios de sementes antigas de teste
            localClients = parsed.filter(c => !String(c.id).startsWith('seed-'));
            setClients(localClients);
          }
        } catch (e) {
          console.error('Error loading saved clients from localStorage:', e);
        }
      }

      // 2. Tenta carregar do Supabase em background
      try {
        const dbClients = await fetchClientesDb();
        if (dbClients && dbClients.length > 0) {
          setClients(dbClients);
          localStorage.setItem('s_clientes', JSON.stringify(dbClients));
          setIsDbSynced(true);
        } else if (localClients.length > 0) {
          setIsDbSynced(true);
        }
      } catch (err) {
        console.warn('Banco Supabase em modo fallback local:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);


  const saveClientsToStorage = (updatedList: Client[]) => {
    setClients(updatedList);
    localStorage.setItem('s_clientes', JSON.stringify(updatedList));
  };

  const handleSaveClient = async (client: Client) => {
    const exists = clients.some(c => c.id === client.id);
    const updatedList = exists
      ? clients.map(c => (c.id === client.id ? client : c))
      : [client, ...clients];

    saveClientsToStorage(updatedList);
    setActiveClient(null);

    // Salva no Supabase
    try {
      const { data } = await saveClienteDb(client);
      if (data && data.id) {
        const syncedList = updatedList.map(c => c.id === client.id ? { ...c, id: data.id } : c);
        saveClientsToStorage(syncedList);
      }
    } catch (e) {
      console.warn("Erro ao salvar cliente no banco:", e);
    }
  };

  const handleDeleteClient = async (id: string) => {
    const updatedList = clients.filter(c => c.id !== id);
    saveClientsToStorage(updatedList);
    setActiveClient(null);

    // Deleta no Supabase
    try {
      await deleteClienteDb(id);
    } catch (e) {
      console.warn("Erro ao excluir cliente no banco:", e);
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
    isLoading,
    isDbSynced
  };
}
