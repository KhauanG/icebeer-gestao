// ===============================
// 🔧 SERVICE WORKER ICE BEER v4.0
// Versão Corrigida e Otimizada
// ===============================

const CACHE_NAME = 'ice-beer-v4.0.1';
const STATIC_CACHE = 'ice-beer-static-v4.0.1';
const DYNAMIC_CACHE = 'ice-beer-dynamic-v4.0.1';
const API_CACHE = 'ice-beer-api-v4.0.1';

// Assets essenciais para cache estático
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// URLs para cache dinâmico
const DYNAMIC_URLS = [
  'https://www.gstatic.com/firebasejs/',
  'https://fonts.googleapis.com/',
  'https://fonts.gstatic.com/',
  'https://cdnjs.cloudflare.com/'
];

// URLs da API Firebase
const API_URLS = [
  'https://firestore.googleapis.com/',
  'https://identitytoolkit.googleapis.com/',
  'https://securetoken.googleapis.com/'
];

// Configurações
const CONFIG = {
  maxAge: 24 * 60 * 60 * 1000, // 24 horas
  maxEntries: 100,
  networkTimeoutSeconds: 10,
  version: '4.0.1'
};

// ===============================
// INSTALAÇÃO
// ===============================

self.addEventListener('install', event => {
  console.log(`🔧 SW: Instalando v${CONFIG.version}`);
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        console.log('📦 SW: Cacheando assets estáticos');
        return cache.addAll(STATIC_ASSETS.filter(url => {
          try {
            new URL(url, self.location);
            return true;
          } catch (e) {
            console.warn('❌ SW: URL inválida ignorada:', url);
            return false;
          }
        }));
      }),
      self.skipWaiting()
    ]).then(() => {
      console.log('✅ SW: Instalação concluída');
    }).catch(error => {
      console.error('❌ SW: Erro na instalação:', error);
    })
  );
});

// ===============================
// ATIVAÇÃO
// ===============================

self.addEventListener('activate', event => {
  console.log(`🚀 SW: Ativando v${CONFIG.version}`);
  
  event.waitUntil(
    Promise.all([
      cleanOldCaches(),
      self.clients.claim()
    ]).then(() => {
      console.log('✅ SW: Ativação concluída');
    }).catch(error => {
      console.error('❌ SW: Erro na ativação:', error);
    })
  );
});

async function cleanOldCaches() {
  try {
    const cacheNames = await caches.keys();
    const validCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
    
    const deletePromises = cacheNames
      .filter(cacheName => !validCaches.includes(cacheName) && cacheName.includes('ice-beer'))
      .map(cacheName => {
        console.log('🗑️ SW: Removendo cache antigo:', cacheName);
        return caches.delete(cacheName);
      });
    
    return Promise.all(deletePromises);
  } catch (error) {
    console.error('❌ SW: Erro ao limpar caches:', error);
  }
}

// ===============================
// INTERCEPTAÇÃO DE REQUESTS
// ===============================

self.addEventListener('fetch', event => {
  // Ignorar extensões do Chrome e requests não-HTTP
  if (!event.request.url.startsWith('http')) {
    return;
  }

  const { request } = event;
  const url = new URL(request.url);
  
  // Skip para same-origin requests com parâmetros de cache-busting
  if (url.origin === self.location.origin && url.search.includes('_sw-precache')) {
    return;
  }

  try {
    if (isStaticAsset(request)) {
      event.respondWith(handleStaticAsset(request));
    } else if (isApiRequest(request)) {
      event.respondWith(handleApiRequest(request));
    } else if (isDynamicAsset(request)) {
      event.respondWith(handleDynamicAsset(request));
    } else if (isNavigationRequest(request)) {
      event.respondWith(handleNavigationRequest(request));
    }
  } catch (error) {
    console.error('❌ SW: Erro no fetch handler:', error);
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
    
    const networkResponse = await fetchWithTimeout(request);
    
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ SW: Erro em asset estático:', error);
    return createErrorResponse('Asset não disponível offline');
  }
}

// Network First para APIs
async function handleApiRequest(request) {
  try {
    const networkResponse = await fetchWithTimeout(request);
    
    // Cache apenas GET requests bem-sucedidas
    if (request.method === 'GET' && networkResponse && networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ SW: Rede indisponível, tentando cache:', error.message);
    
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    return createErrorResponse('Dados não disponíveis offline');
  }
}

// Stale While Revalidate para assets dinâmicos
async function handleDynamicAsset(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetchWithTimeout(request).then(networkResponse => {
    if (networkResponse && networkResponse.ok) {
      caches.open(DYNAMIC_CACHE).then(cache => {
        cache.put(request, networkResponse.clone());
      });
    }
    return networkResponse;
  }).catch(error => {
    console.warn('⚠️ SW: Erro em asset dinâmico:', error);
    return cachedResponse;
  });
  
  return cachedResponse || fetchPromise;
}

// Network First para navegação
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetchWithTimeout(request);
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ SW: Navegação offline, servindo app shell');
    
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
  
  // Assets locais estáticos
  if (url.origin === self.location.origin) {
    return url.pathname.endsWith('.css') ||
           url.pathname.endsWith('.js') ||
           url.pathname.endsWith('.png') ||
           url.pathname.endsWith('.jpg') ||
           url.pathname.endsWith('.svg') ||
           url.pathname.endsWith('.ico') ||
           url.pathname.endsWith('.json') ||
           url.pathname === '/' ||
           url.pathname === '/index.html';
  }
  
  // CDN assets
  return STATIC_ASSETS.some(asset => request.url.includes(asset));
}

function isApiRequest(request) {
  return API_URLS.some(apiUrl => request.url.includes(apiUrl));
}

function isDynamicAsset(request) {
  return DYNAMIC_URLS.some(dynamicUrl => request.url.startsWith(dynamicUrl));
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && 
          request.headers.get('accept') && 
          request.headers.get('accept').includes('text/html'));
}

async function fetchWithTimeout(request, timeout = CONFIG.networkTimeoutSeconds * 1000) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Network timeout')), timeout)
    )
  ]);
}

function createErrorResponse(message) {
  const errorBody = JSON.stringify({
    error: true,
    message: message,
    timestamp: new Date().toISOString(),
    version: CONFIG.version
  });
  
  return new Response(errorBody, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}

// ===============================
// BACKGROUND SYNC
// ===============================

self.addEventListener('sync', event => {
  console.log('🔄 SW: Background sync:', event.tag);
  
  switch (event.tag) {
    case 'sales-sync':
      event.waitUntil(syncSalesData());
      break;
    case 'cache-cleanup':
      event.waitUntil(performCacheCleanup());
      break;
    default:
      console.log('🔄 SW: Sync tag não reconhecida:', event.tag);
  }
});

async function syncSalesData() {
  try {
    console.log('📊 SW: Sincronizando dados de vendas...');
    
    // Buscar dados pendentes do IndexedDB
    const pendingData = await getPendingSalesData();
    
    if (pendingData.length > 0) {
      for (const data of pendingData) {
        try {
          await syncSingleSalesEntry(data);
        } catch (error) {
          console.error('❌ SW: Erro ao sincronizar entrada:', error);
        }
      }
      console.log(`✅ SW: ${pendingData.length} entradas sincronizadas`);
    }
  } catch (error) {
    console.error('❌ SW: Erro na sincronização:', error);
    throw error;
  }
}

async function getPendingSalesData() {
  // Implementação para buscar dados pendentes do IndexedDB
  // Por enquanto retorna array vazio
  return [];
}

async function syncSingleSalesEntry(data) {
  // Implementação para sincronizar entrada individual
  console.log('🔄 SW: Sincronizando entrada:', data.id || 'sem ID');
  return Promise.resolve();
}

async function performCacheCleanup() {
  console.log('🧹 SW: Iniciando limpeza de cache...');
  
  try {
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
      if (!cacheName.includes('ice-beer')) continue;
      
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      let removedCount = 0;
      
      for (const request of requests) {
        try {
          const response = await cache.match(request);
          if (!response) continue;
          
          const dateHeader = response.headers.get('date');
          if (dateHeader) {
            const responseDate = new Date(dateHeader);
            const age = Date.now() - responseDate.getTime();
            
            if (age > CONFIG.maxAge) {
              await cache.delete(request);
              removedCount++;
            }
          }
        } catch (error) {
          console.warn('⚠️ SW: Erro ao processar request no cache:', error);
        }
      }
      
      // Limitar número de entradas
      const remainingRequests = await cache.keys();
      if (remainingRequests.length > CONFIG.maxEntries) {
        const excess = remainingRequests.length - CONFIG.maxEntries;
        for (let i = 0; i < excess; i++) {
          try {
            await cache.delete(remainingRequests[i]);
            removedCount++;
          } catch (error) {
            console.warn('⚠️ SW: Erro ao remover entrada do cache:', error);
          }
        }
      }
      
      if (removedCount > 0) {
        console.log(`🗑️ SW: ${removedCount} entradas removidas de ${cacheName}`);
      }
    }
    
    console.log('✅ SW: Limpeza de cache concluída');
  } catch (error) {
    console.error('❌ SW: Erro na limpeza de cache:', error);
  }
}

// ===============================
// PUSH NOTIFICATIONS
// ===============================

self.addEventListener('push', event => {
  console.log('🔔 SW: Push notification recebida');
  
  let options = {
    body: 'Novos dados disponíveis no Ice Beer',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 'ice-beer-notification'
    },
    actions: [
      {
        action: 'explore',
        title: 'Abrir App'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ],
    requireInteraction: false,
    silent: false
  };
  
  // Tentar extrair dados da notificação push
  if (event.data) {
    try {
      const pushData = event.data.json();
      options = { ...options, ...pushData };
    } catch (error) {
      console.warn('⚠️ SW: Erro ao processar dados do push:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification('🍺 Ice Beer', options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('🔔 SW: Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.matchAll().then(clientList => {
        // Procurar por cliente já aberto
        for (const client of clientList) {
          if (client.url.includes('ice-beer') && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Abrir nova janela se não encontrar cliente
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// ===============================
// SHARE TARGET
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
    const title = formData.get('title') || '';
    const text = formData.get('text') || '';
    const url = formData.get('url') || '';
    
    console.log('📤 SW: Share target dados:', { title, text, url });
    
    // Processar arquivos compartilhados
    const files = formData.getAll('files');
    if (files.length > 0) {
      console.log('📁 SW: Arquivos compartilhados:', files.length);
    }
    
    // Redirecionar para página principal com dados
    const params = new URLSearchParams({
      shared: 'true',
      ...(title && { title }),
      ...(text && { text }),
      ...(url && { url })
    });
    
    return Response.redirect(`/?${params.toString()}`, 303);
  } catch (error) {
    console.error('❌ SW: Erro no share target:', error);
    return Response.redirect('/', 303);
  }
}

// ===============================
// ERROR HANDLING
// ===============================

self.addEventListener('error', event => {
  console.error('❌ SW: Erro global:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('❌ SW: Promise rejeitada:', event.reason);
});

// ===============================
// MENSAGENS DO CLIENTE
// ===============================

self.addEventListener('message', event => {
  console.log('📨 SW: Mensagem recebida:', event.data);
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'CACHE_STATS':
      getCacheStats().then(stats => {
        event.ports[0].postMessage({ type: 'CACHE_STATS_RESPONSE', stats });
      });
      break;
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
    default:
      console.log('🤷 SW: Tipo de mensagem não reconhecido:', event.data.type);
  }
});

async function getCacheStats() {
  try {
    const cacheNames = await caches.keys();
    const stats = {};
    
    for (const cacheName of cacheNames) {
      if (cacheName.includes('ice-beer')) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        stats[cacheName] = keys.length;
      }
    }
    
    return stats;
  } catch (error) {
    console.error('❌ SW: Erro ao obter stats do cache:', error);
    return {};
  }
}

async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames
      .filter(name => name.includes('ice-beer'))
      .map(name => caches.delete(name));
    
    await Promise.all(deletePromises);
    console.log('✅ SW: Todos os caches limpos');
  } catch (error) {
    console.error('❌ SW: Erro ao limpar caches:', error);
  }
}

// ===============================
// INICIALIZAÇÃO
// ===============================

console.log(`🚀 Service Worker Ice Beer v${CONFIG.version} carregado`);
console.log('📋 Funcionalidades ativas:');
console.log('  ✅ Cache estratégico (Static/Dynamic/API)');
console.log('  ✅ Background Sync');
console.log('  ✅ Push Notifications');
console.log('  ✅ Share Target');
console.log('  ✅ Offline Support');
console.log('  ✅ Error Handling');
console.log('  ✅ Cache Management');

// Performance monitoring
performance.mark('sw-load');

self.addEventListener('install', () => {
  performance.mark('sw-install');
});

self.addEventListener('activate', () => {
  performance.mark('sw-activate');
  
  // Medir performance de inicialização
  try {
    performance.measure('sw-install-time', 'sw-load', 'sw-install');
    performance.measure('sw-activate-time', 'sw-install', 'sw-activate');
  } catch (error) {
    // Performance API pode não estar disponível
    console.warn('⚠️ SW: Performance API não disponível');
  }
});

// Cleanup automático a cada 6 horas
setInterval(() => {
  performCacheCleanup();
}, 6 * 60 * 60 * 1000);