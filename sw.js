/**
 * @file sw.js
 * @description Service Worker do FinCalc.
 *              Implementa estratégias de cache para performance e
 *              funcionamento offline da aplicação PWA.
 *
 *              ESTRATÉGIAS POR TIPO DE RECURSO:
 *              - Cache First:    CSS, JS, fontes, ícones (imutáveis)
 *              - Network First:  JSON de dados (podem atualizar)
 *              - Stale While:    Páginas HTML (sempre frescas, mas rápidas)
 *              - Network Only:   AdSense, Analytics (nunca cacheados)
 *
 *              VERSÃO: atualizar CACHE_VERSION ao fazer deploy.
 *              Isso força o browser a baixar o novo SW e limpar caches antigos.
 *
 * @version 1.0.0
 */

'use strict';

/* ============================================================
   CONFIGURAÇÃO DE CACHE
   ============================================================ */

const CACHE_VERSION   = 'fincalc-v1';
const CACHE_STATIC    = `${CACHE_VERSION}-static`;
const CACHE_PAGES     = `${CACHE_VERSION}-pages`;
const CACHE_DATA      = `${CACHE_VERSION}-data`;

/** Todos os caches gerenciados por este SW */
const ALL_CACHES = [CACHE_STATIC, CACHE_PAGES, CACHE_DATA];

/** Recursos que NUNCA devem ser cacheados */
const NEVER_CACHE = [
  'pagead2.googlesyndication.com',
  'googletagmanager.com',
  'doubleclick.net',
  'google-analytics.com',
  'fonts.googleapis.com',  // CSS das fontes — deixa o browser gerenciar
];

/** Recursos estáticos pre-cacheados na instalação */
const PRECACHE_STATIC = [
  '/',
  '/css/tokens.css',
  '/css/reset.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/calculator.css',
  '/js/core/app.js',
  '/js/utils/formatters.js',
  '/js/utils/validators.js',
  '/js/calculators/financiamento.js',
  '/assets/icons/favicon.ico',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/manifest.json',
  '/404.html',
];

/** Páginas pre-cacheadas na instalação */
const PRECACHE_PAGES = [
  '/financiamento/',
  '/consorcio/',
  '/juros-compostos/',
  '/amortizacao/',
  '/cet/',
  '/refinanciamento/',
  '/blog/',
];

/* ============================================================
   UTILITÁRIOS INTERNOS
   ============================================================ */

/**
 * Verifica se uma URL deve ser ignorada pelo SW.
 * @param {string} url
 * @returns {boolean}
 */
function deveIgnorar(url) {
  return NEVER_CACHE.some(domain => url.includes(domain));
}

/**
 * Verifica se a request é navegação (página HTML).
 * @param {Request} request
 * @returns {boolean}
 */
function ehNavegacao(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' &&
     request.headers.get('accept')?.includes('text/html'));
}

/**
 * Verifica se é um recurso estático (CSS, JS, imagem, fonte).
 * @param {string} url
 * @returns {boolean}
 */
function ehEstatico(url) {
  return /\.(css|js|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico|gif)(\?.*)?$/.test(url);
}

/**
 * Verifica se é dado JSON.
 * @param {string} url
 * @returns {boolean}
 */
function ehDadoJSON(url) {
  return url.includes('/data/') && url.endsWith('.json');
}

/* ============================================================
   EVENTO: INSTALL
   Pre-cacheia recursos essenciais.
   ============================================================ */

self.addEventListener('install', (event) => {
  console.log('[SW] Instalando versão:', CACHE_VERSION);

  event.waitUntil(
    Promise.all([

      // Cache de estáticos
      caches.open(CACHE_STATIC).then(async (cache) => {
        console.log('[SW] Pre-cacheando recursos estáticos...');
        // addAll falha se qualquer recurso falhar — usar add individual para resiliência
        const results = await Promise.allSettled(
          PRECACHE_STATIC.map(url => cache.add(url))
        );
        const falhas = results.filter(r => r.status === 'rejected');
        if (falhas.length > 0) {
          console.warn('[SW] Recursos não cacheados:', falhas.length);
        }
        return cache;
      }),

      // Cache de páginas
      caches.open(CACHE_PAGES).then(async (cache) => {
        console.log('[SW] Pre-cacheando páginas...');
        const results = await Promise.allSettled(
          PRECACHE_PAGES.map(url => cache.add(url))
        );
        const falhas = results.filter(r => r.status === 'rejected');
        if (falhas.length > 0) {
          console.warn('[SW] Páginas não cacheadas:', falhas.length);
        }
        return cache;
      }),

    ]).then(() => {
      console.log('[SW] Instalação concluída');
      // Força ativação imediata sem esperar as abas fecharem
      return self.skipWaiting();
    })
  );
});

/* ============================================================
   EVENTO: ACTIVATE
   Limpa caches de versões anteriores.
   ============================================================ */

self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando versão:', CACHE_VERSION);

  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      const expirados = cacheNames.filter(
        name => name.startsWith('fincalc-') && !ALL_CACHES.includes(name)
      );

      if (expirados.length > 0) {
        console.log('[SW] Removendo caches antigos:', expirados);
        await Promise.all(expirados.map(name => caches.delete(name)));
      }

      // Assume controle imediato de todas as abas abertas
      await self.clients.claim();
      console.log('[SW] Ativação concluída');
    })
  );
});

/* ============================================================
   ESTRATÉGIAS DE CACHE
   ============================================================ */

/**
 * CACHE FIRST — para recursos estáticos imutáveis.
 * Retorna do cache. Se não tiver, busca na rede e cacheia.
 * Ideal para: CSS, JS, fontes, imagens.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Recurso não disponível offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/**
 * NETWORK FIRST — para dados que podem mudar.
 * Tenta a rede primeiro. Se falhar, retorna do cache.
 * Ideal para: JSON de dados de referência (/data/*.json).
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_DATA);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(JSON.stringify({ error: 'Sem conexão' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}

/**
 * STALE WHILE REVALIDATE — para páginas HTML.
 * Retorna o cache imediatamente (rápido) e atualiza em background.
 * Ideal para: páginas HTML das calculadoras e blog.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_PAGES);
  const cached = await cache.match(request);

  // Atualiza em background (não bloqueia a resposta)
  const revalidate = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Se tem cache, retorna imediatamente
  if (cached) return cached;

  // Sem cache: aguarda a rede
  try {
    return await revalidate || paginaOffline();
  } catch {
    return paginaOffline();
  }
}

/**
 * Página de fallback para quando não há conexão e a página não está cacheada.
 * @returns {Response}
 */
function paginaOffline() {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sem conexão | FinCalc</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
      background: #0a0e1a;
      color: #f0f4ff;
      padding: 24px;
      text-align: center;
    }
    .wrap { max-width: 400px; }
    .icon { font-size: 4rem; margin-bottom: 24px; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 12px; }
    p  { color: #8899b4; line-height: 1.6; margin-bottom: 24px; }
    a  {
      display: inline-block;
      padding: 12px 24px;
      background: #3b82f6;
      color: #fff;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="icon">📡</div>
    <h1>Sem conexão com a internet</h1>
    <p>
      Esta página não está disponível offline.
      Verifique sua conexão e tente novamente.
    </p>
    <a href="/">Voltar ao início</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    status:  503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/* ============================================================
   EVENTO: FETCH
   Intercepta todas as requisições e aplica a estratégia correta.
   ============================================================ */

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Ignora requisições não-GET
  if (request.method !== 'GET') return;

  // Ignora domínios externos que nunca devem ser cacheados
  if (deveIgnorar(url)) return;

  // Ignora extensões do Chrome e protocolos especiais
  if (!url.startsWith('http')) return;

  // ── Roteamento por tipo de recurso ──────────────────────────

  // 1. Dados JSON — Network First
  if (ehDadoJSON(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 2. Recursos estáticos — Cache First
  if (ehEstatico(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 3. Navegação (páginas HTML) — Stale While Revalidate
  if (ehNavegacao(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 4. Qualquer outra coisa — Network Only (deixa o browser resolver)
});

/* ============================================================
   EVENTO: MESSAGE
   Recebe mensagens da aplicação (ex: forçar atualização).
   ============================================================ */

self.addEventListener('message', (event) => {
  if (!event.data) return;

  // Força atualização imediata do SW
  if (event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Atualização forçada solicitada');
    self.skipWaiting();
  }

  // Limpa todos os caches (útil para debug)
  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => {
      Promise.all(keys.map(k => caches.delete(k))).then(() => {
        console.log('[SW] Todos os caches limpos');
        event.source?.postMessage({ type: 'CACHE_CLEARED' });
      });
    });
  }

  // Responde com a versão atual do cache
  if (event.data.type === 'GET_VERSION') {
    event.source?.postMessage({
      type:    'VERSION',
      version: CACHE_VERSION,
    });
  }
});

/* ============================================================
   EVENTO: PUSH (NOTIFICAÇÕES — FUTURO)
   Estrutura preparada para notificações push no futuro.
   ============================================================ */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data    = event.data.json();
    const title   = data.title   || 'FinCalc';
    const options = {
      body:    data.body    || 'Nova atualização disponível.',
      icon:    data.icon    || '/assets/icons/icon-192.png',
      badge:   data.badge   || '/assets/icons/icon-192.png',
      data:    { url: data.url || '/' },
      vibrate: [100, 50, 100],
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch {
    console.warn('[SW] Erro ao processar push notification');
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Se já tem uma aba aberta, foca nela
        for (const client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // Senão, abre uma nova
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
