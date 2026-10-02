// Service Worker para Usi Corte Metais PWA
// Versão 3: Correção de ERR_CACHE_MISS, bypass total de APIs/Supabase e limpeza estrita de caches
const CACHE_NAME = 'usicorte-pwa-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/icon.svg'
];

// Instalação do Service Worker e pré-cache dos ativos estáticos essenciais (App Shell)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Aviso ao pré-cachear arquivos estáticos:', err);
      });
    })
  );
  // Ativação imediata da nova versão sem aguardar fechamento das abas
  self.skipWaiting();
});

// Ativação e limpeza rigorosa de todas as versões antigas de cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removendo cache obsoleto:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  // 1. Apenas métodos GET são processados pelo Service Worker
  // POST, PUT, PATCH, DELETE, OPTIONS passam 100% direto pela rede
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // 2. Ignora esquemas que não sejam HTTP/HTTPS (chrome-extension:, data:, blob:, ws:)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. BYPASS TOTAL DE APIS E ROTAS DINÂMICAS (Network-Only)
  // Requisições para o Supabase, serviços de CEP/CNPJ, rotas de API e módulos Vite
  // NUNCA passam pelo cache do Service Worker para evitar ERR_CACHE_MISS e dados desatualizados
  const isSupabaseRequest = 
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.in') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/auth/v1/') ||
    url.pathname.includes('/storage/v1/') ||
    url.pathname.includes('/functions/v1/');

  const isExternalApi = 
    url.hostname.includes('viacep.com.br') ||
    url.hostname.includes('receitaws.com.br') ||
    url.hostname.includes('brasilapi.com.br') ||
    url.hostname.includes('googleapis.com') ||
    url.pathname.startsWith('/api/');

  const isViteDev = 
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@fs/') ||
    url.pathname.startsWith('/@id/') ||
    url.pathname.includes('node_modules') ||
    url.searchParams.has('t') ||
    url.searchParams.has('v');

  if (isSupabaseRequest || isExternalApi || isViteDev) {
    // Retorna sem chamar event.respondWith: a requisição segue pela rede normalmente
    return;
  }

  // 4. Navegações de página (HTML / SPA): Network-First com fallback seguro
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Fallback offline seguro para a aplicação SPA sem tela em branco
          const cachedPage = await caches.match(event.request);
          if (cachedPage) return cachedPage;

          const cachedIndex = (await caches.match('/index.html')) || (await caches.match('/'));
          if (cachedIndex) return cachedIndex;

          return new Response(
            '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>UsiCorte - Sem Conexão</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family:sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:20px;"><h2>UsiCorte Metais</h2><p>Sem conexão de rede no momento. Verifique sua internet.</p></div></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        })
    );
    return;
  }

  // 5. Ativos estáticos da mesma origem (JS, CSS, Imagens, Fontes): Cache com Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Atualiza em background de forma assíncrona
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Se não estava no cache, busca na rede
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
          .catch((err) => {
            console.warn('[SW] Falha de rede para recurso estático:', event.request.url, err);
            // Retorna resposta segura em vez de undefined para impedir ERR_CACHE_MISS
            return new Response('', { status: 408, statusText: 'Network Request Failed' });
          });
      })
    );
  }
});

// Listener para forçar ativação de nova versão a partir do frontend
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
