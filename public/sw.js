// Service Worker para Usi Corte Metais PWA
const CACHE_NAME = 'usicorte-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/icon.svg'
];

// Instalação do Service Worker e Pre-cache dos ativos estáticos principais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Aviso ao pré-cachear alguns arquivos:', err);
      });
    })
  );
  // Ativação imediata da nova versão
  self.skipWaiting();
});

// Ativação e limpeza de versões antigas de cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições com estratégia Network-First (para dados vivos) com fallback para cache
self.addEventListener('fetch', (event) => {
  // Apenas métodos GET são cacheados
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Ignora chamadas para APIs externas (Supabase, ViaCEP, Receita, etc.) e extensões
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('viacep.com.br') ||
    url.hostname.includes('receitaws.com.br') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return;
  }

  // Para navegações de página (HTML)
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
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) return cachedResponse;
          return caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }

  // Para ativos estáticos (scripts, css, imagens, fontes)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Atualiza o cache em background (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Se não está no cache, busca na rede
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch((err) => {
        console.warn('[SW] Falha na rede para:', event.request.url);
      });
    })
  );
});
