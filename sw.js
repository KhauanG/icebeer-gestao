// Service Worker para Ice Beer v4.0
// Suporte PWA com cache inteligente e sincronização offline

const CACHE_NAME = 'ice-beer-v4.0.0';
const STATIC_CACHE = 'ice-beer-static-v4.0.0';
const DYNAMIC_CACHE = 'ice-beer-dynamic-v4.0.0';
const API_CACHE = 'ice-beer-api-v4.0.0';

// Arquivos essenciais para cache estático
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  // CDN Libraries (cached for offline use)
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// URLs que devem ser armazenadas dinamicamente
const DYNAMIC_URLS = [
  'https://www.gstatic.com/firebasejs/',
  'https://fonts.googleapis.com/',
  'https://fonts.gstatic.com/',
  'https://cdnjs.cloudflare.com/'
];

// Configurações de cache
const CACHE_CONFIG = {
  maxAge: 24 * 60 * 60 * 1000, // 24 horas
  maxEntries: 100,
  networkTimeoutSeconds: 10
};

// ===============================
// INSTALAÇÃO DO SERVICE WORKER
// ===============================

self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Instalando v4.0.0');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 Service Worker: Cacheando assets estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker: Instalação concluída');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Service Worker: Erro na instalação:', error);
      })
  );
});

// ===============================
// ATIVAÇÃO DO SERVICE WORKER
// ===============================

self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Ativando v4.0.0');
  
  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      cleanOldCaches(),
      // Tomar controle de todas as abas
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker: Ativação concluída');
    })
  );
});

async function cleanOldCaches() {
  const cacheNames = await caches.keys();
  const validCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
  
  const deletePromises = cacheNames
    .filter(cacheName => !validCaches.includes(cacheName))
    .map(cacheName => {
      console.log('🗑️ Service Worker: Removendo cache antigo:', cacheName);
      return caches.delete(cacheName);
    });
  
  return Promise.all(deletePromises);
}

// ===============================
// INTERCEPTAÇÃO DE REQUESTS
// ===============================

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Estratégias diferentes baseadas no tipo de request
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isApiRequest(request)) {
    event.respondWith(handleApiRequest(request));
  } else if (isDynamicAsset(request)) {
    event.respondWith(handleDynamicAsset(request));
  } else if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
  }
});

// ===============================
// ESTRATÉGIAS DE CACHE
// ===============================

// Cache First para assets estáticos
async function handleStaticAsset(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, networkResponse.clone());
    
    return networkResponse;
  } catch (error) {
    console.error('❌ Service Worker: Erro em asset estático:', error);
    return createErrorResponse('Asset não disponível offline');
  }
}

// Network First para APIs (com fallback para cache)
async function handleApiRequest(request) {
  try {
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), CACHE_CONFIG.networkTimeoutSeconds * 1000)
      )
    ]);
    
    // Cachear apenas respostas bem-sucedidas de GET
    if (request.method === 'GET' && networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ Service Worker: Rede indisponível, buscando cache:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return createErrorResponse('Dados não disponíveis offline');
  }
}

// Stale While Revalidate para assets dinâmicos
async function handleDynamicAsset(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      const cache = caches.open(DYNAMIC_CACHE);
      cache.then(c => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  }).catch(error => {
    console.warn('⚠️ Service Worker: Erro em asset dinâmico:', error);
    return cachedResponse;
  });
  
  return cachedResponse || fetchPromise;
}

// Network First para navegação (com fallback para index.html)
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ Service Worker: Navegação offline, servindo app shell');
    
    const cachedIndex = await caches.match('/index.html');
    if (cachedIndex) {
      return cachedIndex;
    }
    
    return createErrorResponse('App não disponível offline');
  }
}

// ===============================
// FUNÇÕES AUXILIARES
// ===============================

function isStaticAsset(request) {
  const url = new URL(request.url);
  return (
    STATIC_ASSETS.some(asset => request.url.includes(asset)) ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.json')
  );
}

function isApiRequest(request) {
  const url = new URL(request.url);
  return (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.pathname.includes('/api/')
  );
}

function isDynamicAsset(request) {
  const url = new URL(request.url);
  return DYNAMIC_URLS.some(dynamicUrl => request.url.startsWith(dynamicUrl));
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function createErrorResponse(message) {
  return new Response(
    JSON.stringify({
      error: true,
      message: message,
      timestamp: new Date().toISOString()
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

// ===============================
// BACKGROUND SYNC
// ===============================

self.addEventListener('sync', event => {
  console.log('🔄 Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'sales-sync') {
    event.waitUntil(syncSalesData());
  } else if (event.tag === 'cache-cleanup') {
    event.waitUntil(performCacheCleanup());
  }
});

async function syncSalesData() {
  try {
    console.log('📊 Service Worker: Sincronizando dados de vendas...');
    
    // Aqui você implementaria a lógica de sincronização
    // Por exemplo, buscar dados pendentes do IndexedDB e enviar para o servidor
    
    const pendingData = await getPendingSalesData();
    if (pendingData.length > 0) {
      for (const data of pendingData) {
        await syncSingleSalesEntry(data);
      }
      console.log('✅ Service Worker: Sincronização de vendas concluída');
    }
  } catch (error) {
    console.error('❌ Service Worker: Erro na sincronização:', error);
    throw error; // Re-throw para tentar novamente
  }
}

async function getPendingSalesData() {
  // Implementar busca de dados pendentes
  // Esta é uma função placeholder
  return [];
}

async function syncSingleSalesEntry(data) {
  // Implementar sincronização individual
  // Esta é uma função placeholder
  console.log('Sincronizando entrada:', data);
}

async function performCacheCleanup() {
  console.log('🧹 Service Worker: Limpeza de cache iniciada...');
  
  try {
    const caches_list = await caches.keys();
    
    for (const cacheName of caches_list) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      for (const request of requests) {
        const response = await cache.match(request);
        const dateHeader = response.headers.get('date');
        
        if (dateHeader) {
          const responseDate = new Date(dateHeader);
          const now = new Date();
          const age = now.getTime() - responseDate.getTime();
          
          if (age > CACHE_CONFIG.maxAge) {
            await cache.delete(request);
            console.log('🗑️ Service Worker: Removido do cache (expirado):', request.url);
          }
        }
      }
      
      // Limitar número de entradas por cache
      const remainingRequests = await cache.keys();
      if (remainingRequests.length > CACHE_CONFIG.maxEntries) {
        const excess = remainingRequests.length - CACHE_CONFIG.maxEntries;
        for (let i = 0; i < excess; i++) {
          await cache.delete(remainingRequests[i]);
        }
        console.log(`🗑️ Service Worker: Removidas ${excess} entradas excedentes do cache`);
      }
    }
    
    console.log('✅ Service Worker: Limpeza de cache concluída');
  } catch (error) {
    console.error('❌ Service Worker: Erro na limpeza de cache:', error);
  }
}

// ===============================
// PUSH NOTIFICATIONS
// ===============================

self.addEventListener('push', event => {
  console.log('🔔 Service Worker: Push notification recebida');
  
  const options = {
    body: 'Novos dados disponíveis no Ice Beer',
    icon: '/manifest-icon-192.png',
    badge: '/manifest-icon-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Abrir App',
        icon: '/images/checkmark.png'
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: '/images/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Ice Beer', options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('🔔 Service Worker: Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// ===============================
// PERIODIC BACKGROUND SYNC
// ===============================

self.addEventListener('periodicsync', event => {
  console.log('⏰ Service Worker: Periodic sync triggered:', event.tag);
  
  if (event.tag === 'daily-cache-cleanup') {
    event.waitUntil(performCacheCleanup());
  } else if (event.tag === 'data-backup') {
    event.waitUntil(performDataBackup());
  }
});

async function performDataBackup() {
  try {
    console.log('💾 Service Worker: Iniciando backup de dados...');
    
    // Implementar lógica de backup
    // Por exemplo, comprimir e salvar dados importantes
    
    console.log('✅ Service Worker: Backup concluído');
  } catch (error) {
    console.error('❌ Service Worker: Erro no backup:', error);
  }
}

// ===============================
// SHARE TARGET (PWA Share)
// ===============================

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
  }
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const title = formData.get('title');
    const text = formData.get('text');
    const url = formData.get('url');
    
    console.log('📤 Service Worker: Share target:', { title, text, url });
    
    // Processar dados compartilhados
    // Redirecionar para a página principal com os dados
    return Response.redirect('/?shared=true', 303);
  } catch (error) {
    console.error('❌ Service Worker: Erro no share target:', error);
    return Response.redirect('/', 303);
  }
}

// ===============================
// ERROR HANDLING E LOGGING
// ===============================

self.addEventListener('error', event => {
  console.error('❌ Service Worker: Erro global:', event.error);
  
  // Enviar erro para sistema de logging se necessário
  // reportError(event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('❌ Service Worker: Promise rejeitada:', event.reason);
  
  // Enviar erro para sistema de logging se necessário
  // reportError(event.reason);
});

// ===============================
// CACHE VERSIONING E MIGRATION
// ===============================

async function migrateCacheData() {
  try {
    const oldCaches = await caches.keys();
    const oldVersionCaches = oldCaches.filter(name => 
      name.includes('ice-beer') && !name.includes('v4.0.0')
    );
    
    if (oldVersionCaches.length > 0) {
      console.log('🔄 Service Worker: Migrando dados de cache antigo...');
      
      for (const oldCacheName of oldVersionCaches) {
        const oldCache = await caches.open(oldCacheName);
        const requests = await oldCache.keys();
        
        // Migrar apenas dados importantes
        const newCache = await caches.open(DYNAMIC_CACHE);
        for (const request of requests) {
          if (shouldMigrateRequest(request)) {
            const response = await oldCache.match(request);
            await newCache.put(request, response);
          }
        }
        
        // Deletar cache antigo
        await caches.delete(oldCacheName);
      }
      
      console.log('✅ Service Worker: Migração de cache concluída');
    }
  } catch (error) {
    console.error('❌ Service Worker: Erro na migração de cache:', error);
  }
}

function shouldMigrateRequest(request) {
  // Determinar quais requests devem ser migrados
  const url = new URL(request.url);
  return (
    isApiRequest(request) ||
    url.pathname.includes('/user-data/') ||
    url.pathname.includes('/sales-data/')
  );
}

// ===============================
// INICIALIZAÇÃO E MONITORING
// ===============================

console.log('🚀 Service Worker Ice Beer v4.0.0 carregado');
console.log('📋 Funcionalidades ativas:');
console.log('  ✅ Cache inteligente (Static/Dynamic/API)');
console.log('  ✅ Background Sync');
console.log('  ✅ Push Notifications');
console.log('  ✅ Periodic Sync');
console.log('  ✅ Share Target');
console.log('  ✅ Offline Support');
console.log('  ✅ Cache Versioning');

// Performance monitoring
const perfMarks = {
  install: 'sw-install',
  activate: 'sw-activate',
  firstFetch: 'sw-first-fetch'
};

self.addEventListener('install', () => {
  performance.mark(perfMarks.install);
});

self.addEventListener('activate', () => {
  performance.mark(perfMarks.activate);
});

let firstFetch = true;
self.addEventListener('fetch', () => {
  if (firstFetch) {
    performance.mark(perfMarks.firstFetch);
    firstFetch = false;
  }
});