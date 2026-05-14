/**
 * @file app.js
 * @description Inicialização global da aplicação FinCalc.
 *              Responsável por orquestrar todos os comportamentos de UI
 *              que são comuns a TODAS as páginas do site:
 *              - Header sticky com sombra ao rolar
 *              - Menu mobile (hambúrguer)
 *              - Accordion genérico
 *              - Lazy load do AdSense
 *              - Google Analytics 4 (eventos)
 *              - Service Worker (PWA)
 *              - Ano dinâmico no footer
 *              - Gestão de foco (acessibilidade)
 *              - Detecção de preferências do sistema
 *
 *              REGRAS DESTE MÓDULO:
 *              - Sem lógica de negócio (cálculos ficam em /calculators/)
 *              - Sem manipulação de resultado de calculadora
 *              - Apenas infraestrutura e comportamentos globais de UI
 *              - Deve funcionar em TODAS as páginas sem erro
 *              - Falha silenciosa: se um elemento não existir, ignorar
 *
 * @module App
 *
 * DEPENDÊNCIAS: nenhuma — este módulo é autocontido
 *
 * CARREGAMENTO:
 *   <script defer src="/js/core/app.js" type="module"></script>
 *   Deve ser o ÚLTIMO script carregado (após formatters e validators)
 */

'use strict';

/* ============================================================
   CONFIGURAÇÃO DA APLICAÇÃO
   ============================================================ */

const APP_CONFIG = {
  /** ID de medição do Google Analytics 4. Substituir pelo real. */
  GA_MEASUREMENT_ID: 'G-XXXXXXXXXX',

  /** Publisher ID do AdSense. Substituir pelo real após aprovação. */
  ADSENSE_PUBLISHER_ID: 'ca-pub-XXXXXXXXXXXXXXXX',

  /** Ativar carregamento do AdSense (false durante desenvolvimento) */
  ADSENSE_ENABLED: false,

  /** Ativar Google Analytics (false durante desenvolvimento) */
  GA_ENABLED: false,

  /** Delay em ms antes de carregar AdSense após interação */
  ADSENSE_DELAY_MS: 2000,

  /** Versão do cache do Service Worker */
  SW_CACHE_VERSION: 'fincalc-v1',
};

/* ============================================================
   UTILITÁRIOS INTERNOS
   ============================================================ */

/**
 * Seleciona um elemento do DOM com segurança.
 * Retorna null sem lançar erro se não encontrar.
 *
 * @param {string} selector - Seletor CSS ou ID
 * @param {Element} [root=document]
 * @returns {Element|null}
 */
function $(selector, root = document) {
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

/**
 * Seleciona múltiplos elementos com segurança.
 *
 * @param {string} selector
 * @param {Element} [root=document]
 * @returns {Element[]}
 */
function $$(selector, root = document) {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

/**
 * Registra um event listener com segurança (ignora se elemento null).
 *
 * @param {Element|null} el
 * @param {string} event
 * @param {Function} handler
 * @param {object} [options]
 */
function on(el, event, handler, options) {
  if (!el) return;
  el.addEventListener(event, handler, options);
}

/**
 * Log interno — só exibe no console em desenvolvimento.
 * Em produção, silencia tudo.
 *
 * @param {...*} args
 */
function log(...args) {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    console.log('[FinCalc]', ...args);
  }
}

/* ============================================================
   MÓDULO: HEADER
   ============================================================ */

/**
 * Inicializa o header sticky com sombra ao rolar a página.
 * Adiciona a classe .is-scrolled quando scrollY > 8px.
 */
function initHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;

  let ticking = false;

  const updateHeader = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }, { passive: true });

  // Estado inicial (caso a página já esteja scrollada ao carregar)
  updateHeader();

  log('Header iniciado');
}

/* ============================================================
   MÓDULO: MENU MOBILE
   ============================================================ */

/**
 * Inicializa o menu mobile (hambúrguer + drawer).
 * Gerencia: abertura, fechamento, Escape, scroll do body,
 * foco ao fechar e links internos.
 */
function initMobileMenu() {
  const btn  = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');

  if (!btn || !menu) return;

  let isOpen       = false;
  let lastFocused  = null;

  const openMenu = () => {
    isOpen      = true;
    lastFocused = document.activeElement;

    btn.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    menu.classList.add('is-open');
    menu.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    // Move foco para o primeiro link do menu
    const firstLink = menu.querySelector('a, button');
    if (firstLink) {
      setTimeout(() => firstLink.focus(), 50);
    }
  };

  const closeMenu = () => {
    isOpen = false;

    btn.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
    document.body.style.overflow = '';

    // Aguarda transição antes de esconder do DOM
    setTimeout(() => {
      if (!isOpen) menu.setAttribute('hidden', '');
    }, 300);

    // Devolve foco ao botão hambúrguer
    if (lastFocused) {
      lastFocused.focus();
      lastFocused = null;
    }
  };

  const toggleMenu = () => {
    if (isOpen) { closeMenu(); } else { openMenu(); }
  };

  // Botão hambúrguer
  on(btn, 'click', toggleMenu);

  // Fechar ao clicar em link do menu
  $$('a', menu).forEach(link => on(link, 'click', closeMenu));

  // Fechar ao pressionar Escape
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeMenu();
  });

  // Fechar ao clicar fora do menu (overlay)
  on(document, 'click', (e) => {
    if (isOpen && !menu.contains(e.target) && !btn.contains(e.target)) {
      closeMenu();
    }
  });

  // Trap de foco dentro do menu quando aberto
  on(menu, 'keydown', (e) => {
    if (!isOpen || e.key !== 'Tab') return;

    const focusable = $$('a, button', menu).filter(el => !el.disabled);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  log('Menu mobile iniciado');
}

/* ============================================================
   MÓDULO: ACCORDION
   ============================================================ */

/**
 * Inicializa todos os accordions da página.
 * Suporta múltiplos accordions independentes.
 * Padrão: apenas um item aberto por vez por accordion.
 */
function initAccordions() {
  const accordions = $$('.accordion');

  accordions.forEach(accordion => {
    const triggers = $$('.accordion__trigger', accordion);

    triggers.forEach(trigger => {
      on(trigger, 'click', () => {
        const item   = trigger.closest('.accordion__item');
        const isOpen = item.classList.contains('is-open');

        // Fecha todos os itens do accordion pai
        $$('.accordion__item', accordion).forEach(i => {
          i.classList.remove('is-open');
          const t = i.querySelector('.accordion__trigger');
          if (t) t.setAttribute('aria-expanded', 'false');
        });

        // Abre o clicado se estava fechado
        if (!isOpen) {
          item.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });

      // Navegação por teclado: Enter e Space abrem/fecham
      on(trigger, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          trigger.click();
        }
      });
    });
  });

  if (accordions.length > 0) log(`${accordions.length} accordion(s) iniciado(s)`);
}

/* ============================================================
   MÓDULO: OPCIONAL SECTION (formulários)
   ============================================================ */

/**
 * Inicializa seções opcionais colapsáveis nos formulários.
 * Padrão: identificados pela classe .optional-section.
 */
function initOptionalSections() {
  const sections = $$('.optional-section');

  sections.forEach(section => {
    const toggle = section.querySelector('.optional-section__toggle');
    if (!toggle) return;

    on(toggle, 'click', () => {
      const isOpen = section.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  });

  if (sections.length > 0) log(`${sections.length} seção(ões) opcional(is) iniciada(s)`);
}

/* ============================================================
   MÓDULO: ANO NO FOOTER
   ============================================================ */

/**
 * Atualiza o ano automaticamente no footer.
 * Seleciona todos os elementos #footer-year na página.
 */
function initFooterYear() {
  const year = new Date().getFullYear();
  $$('#footer-year, .footer-year').forEach(el => {
    el.textContent = year;
  });
}

/* ============================================================
   MÓDULO: TABS
   ============================================================ */

/**
 * Inicializa componentes de abas (.tabs) na página.
 * Gerencia: ativação de aba, troca de painel, teclado.
 */
function initTabs() {
  const tabGroups = $$('.tabs');

  tabGroups.forEach(tabGroup => {
    const tabs   = $$('.tabs__tab', tabGroup);
    const panels = $$('.tabs__panel', tabGroup);

    if (tabs.length === 0) return;

    const activateTab = (index) => {
      tabs.forEach((tab, i) => {
        const isActive = i === index;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
      });
      panels.forEach((panel, i) => {
        panel.classList.toggle('is-active', i === index);
        panel.hidden = i !== index;
      });
    };

    tabs.forEach((tab, index) => {
      on(tab, 'click', () => activateTab(index));

      on(tab, 'keydown', (e) => {
        let newIndex = index;
        if (e.key === 'ArrowRight') newIndex = (index + 1) % tabs.length;
        if (e.key === 'ArrowLeft')  newIndex = (index - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home')       newIndex = 0;
        if (e.key === 'End')        newIndex = tabs.length - 1;
        if (newIndex !== index) {
          e.preventDefault();
          activateTab(newIndex);
          tabs[newIndex].focus();
        }
      });
    });

    // Ativa a primeira aba por padrão
    activateTab(0);
  });

  if (tabGroups.length > 0) log(`${tabGroups.length} tab group(s) iniciado(s)`);
}

/* ============================================================
   MÓDULO: TOAST
   ============================================================ */

/**
 * Sistema global de notificações toast.
 * Disponível via window.FinCalc.toast(msg, tipo).
 */
function initToast() {
  const container = document.getElementById('toast-container');
  if (!container) return;

  /**
   * Exibe um toast.
   * @param {string} message
   * @param {'info'|'success'|'warning'|'danger'} [tipo='info']
   * @param {number} [duration=3500]
   */
  window.FinCalc = window.FinCalc || {};
  window.FinCalc.toast = (message, tipo = 'info', duration = 3500) => {
    const toast = document.createElement('div');
    toast.className = `toast toast--${tipo}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'opacity 200ms, transform 200ms';
      setTimeout(() => toast.remove(), 220);
    }, duration);
  };

  log('Toast iniciado');
}

/* ============================================================
   MÓDULO: GOOGLE ANALYTICS 4
   ============================================================ */

/**
 * Carrega o script do GA4 e configura eventos customizados.
 * Só ativa se APP_CONFIG.GA_ENABLED for true.
 */
function initAnalytics() {
  if (!APP_CONFIG.GA_ENABLED) {
    log('Analytics desativado (desenvolvimento)');
    return;
  }

  const id = APP_CONFIG.GA_MEASUREMENT_ID;
  if (!id || id.includes('XXXXXXXXXX')) return;

  // Carrega gtag.js
  const script = document.createElement('script');
  script.async  = true;
  script.src    = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id, {
    send_page_view: true,
    anonymize_ip:   true,
  });

  // Expõe função de evento para outros módulos
  window.FinCalc = window.FinCalc || {};
  window.FinCalc.trackEvent = (eventName, params = {}) => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  };

  log('Analytics iniciado:', id);
}

/* ============================================================
   MÓDULO: ADSENSE
   ============================================================ */

/**
 * Carrega o AdSense de forma lazy — apenas após a primeira
 * interação do usuário (scroll, click ou touchstart).
 * Isso melhora o LCP e evita penalidades de performance.
 */
function initAdSense() {
  if (!APP_CONFIG.ADSENSE_ENABLED) {
    log('AdSense desativado (desenvolvimento)');
    return;
  }

  const pid = APP_CONFIG.ADSENSE_PUBLISHER_ID;
  if (!pid || pid.includes('XXXXXXXX')) return;

  let loaded = false;

  const load = () => {
    if (loaded) return;
    loaded = true;

    setTimeout(() => {
      const script        = document.createElement('script');
      script.async        = true;
      script.crossOrigin  = 'anonymous';
      script.src          = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pid}`;
      document.head.appendChild(script);
      log('AdSense carregado');
    }, APP_CONFIG.ADSENSE_DELAY_MS);
  };

  ['scroll', 'click', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, load, { once: true, passive: true });
  });
}

/* ============================================================
   MÓDULO: SERVICE WORKER (PWA)
   ============================================================ */

/**
 * Registra o Service Worker para cache offline.
 * Só funciona em HTTPS ou localhost.
 */
function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        log('Service Worker registrado:', registration.scope);
      })
      .catch(err => {
        log('Service Worker falhou:', err.message);
      });
  });
}

/* ============================================================
   MÓDULO: PREFERÊNCIAS DO SISTEMA
   ============================================================ */

/**
 * Detecta preferências do sistema operacional e aplica
 * classes utilitárias ao <html> para CSS condicional.
 */
function initSystemPreferences() {
  const html = document.documentElement;

  // Detecta preferência de movimento reduzido
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    html.classList.add('prefers-reduced-motion');
  }

  // Detecta modo de alto contraste
  if (window.matchMedia('(forced-colors: active)').matches) {
    html.classList.add('forced-colors');
  }

  // Detecta conexão lenta (salva dados)
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection) {
    if (connection.saveData || connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
      html.classList.add('save-data');
      log('Conexão lenta detectada — modo econômico ativado');
    }
  }
}

/* ============================================================
   MÓDULO: SKIP LINK (ACESSIBILIDADE)
   ============================================================ */

/**
 * Melhora o comportamento do skip link para navegação por teclado.
 * Garante que o foco seja visível ao pular para o conteúdo principal.
 */
function initSkipLink() {
  const skipLink = $('.skip-link');
  const main     = document.getElementById('main-content');

  if (!skipLink || !main) return;

  on(skipLink, 'click', (e) => {
    e.preventDefault();
    main.setAttribute('tabindex', '-1');
    main.focus();
    main.addEventListener('blur', () => {
      main.removeAttribute('tabindex');
    }, { once: true });
  });
}

/* ============================================================
   MÓDULO: LAZY LOADING DE IMAGENS
   ============================================================ */

/**
 * Ativa lazy loading nativo em imagens que usam data-src.
 * Para navegadores que não suportam loading="lazy" nativo.
 */
function initLazyImages() {
  const lazyImages = $$('img[data-src]');
  if (lazyImages.length === 0) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        img.src = img.dataset.src;
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
        img.removeAttribute('data-src');
        img.removeAttribute('data-srcset');
        observer.unobserve(img);
      });
    }, { rootMargin: '200px 0px' });

    lazyImages.forEach(img => observer.observe(img));
  } else {
    // Fallback: carrega todas imediatamente
    lazyImages.forEach(img => {
      img.src = img.dataset.src;
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    });
  }

  log(`${lazyImages.length} imagem(ns) lazy carregada(s)`);
}

/* ============================================================
   MÓDULO: LINK ATIVO NA NAVEGAÇÃO
   ============================================================ */

/**
 * Marca automaticamente o link de navegação ativo
 * com base na URL atual da página.
 */
function initActiveNavLinks() {
  const currentPath = window.location.pathname;

  $$('.site-nav__link, .mobile-menu__link, .footer-col__link').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    // Correspondência exata ou prefixo de rota
    const isActive = href !== '/' && currentPath.startsWith(href);
    if (isActive) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

/* ============================================================
   MÓDULO: PERFORMANCE — PRELOAD DE PRÓXIMA PÁGINA
   ============================================================ */

/**
 * Pré-carrega a próxima página provável ao hover em links internos.
 * Melhora a percepção de velocidade de navegação.
 * Limitado a 3 preloads por página para não desperdiçar banda.
 */
function initLinkPreload() {
  // Só ativa em conexões rápidas
  const connection = navigator.connection || navigator.mozConnection;
  if (connection && (connection.saveData || connection.effectiveType === '2g')) return;

  let preloaded = new Set();
  let preloadCount = 0;
  const MAX_PRELOADS = 3;

  $$('a[href]').forEach(link => {
    const href = link.getAttribute('href');

    // Só pré-carrega links internos relativos
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto')) return;

    on(link, 'mouseenter', () => {
      if (preloadCount >= MAX_PRELOADS || preloaded.has(href)) return;

      const prefetch = document.createElement('link');
      prefetch.rel  = 'prefetch';
      prefetch.href = href;
      document.head.appendChild(prefetch);

      preloaded.add(href);
      preloadCount++;
    }, { once: true });
  });
}

/* ============================================================
   MÓDULO: COPY BUTTON GLOBAL
   ============================================================ */

/**
 * Inicializa botões de cópia com atributo data-copy.
 * Uso: <button data-copy="texto a copiar">Copiar</button>
 */
function initCopyButtons() {
  on(document, 'click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;

    const text = btn.dataset.copy;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      const original = btn.textContent;
      btn.textContent = '✓ Copiado!';
      setTimeout(() => { btn.textContent = original; }, 2000);

      if (window.FinCalc?.toast) {
        window.FinCalc.toast('Copiado!', 'success', 2000);
      }
    } catch {
      // Fallback para navegadores sem clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity  = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  });
}

/* ============================================================
   MÓDULO: SCROLL TO TOP
   ============================================================ */

/**
 * Botão flutuante de voltar ao topo.
 * Aparece após rolar 400px e some ao chegar no topo.
 * Inserido dinamicamente se não existir no HTML.
 */
function initScrollToTop() {
  // Cria o botão se não existir
  let btn = document.getElementById('scroll-to-top');

  if (!btn) {
    btn = document.createElement('button');
    btn.id          = 'scroll-to-top';
    btn.className   = 'scroll-to-top-btn';
    btn.setAttribute('aria-label', 'Voltar ao topo da página');
    btn.setAttribute('title', 'Voltar ao topo');
    btn.innerHTML   = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`;

    // Estilos inline — sem depender de arquivo CSS extra
    Object.assign(btn.style, {
      position:        'fixed',
      bottom:          '24px',
      right:           '24px',
      width:           '44px',
      height:          '44px',
      borderRadius:    '50%',
      background:      'var(--color-bg-surface)',
      border:          '1px solid var(--color-border-light)',
      color:           'var(--color-text-secondary)',
      cursor:          'pointer',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      boxShadow:       'var(--shadow-lg)',
      opacity:         '0',
      visibility:      'hidden',
      transform:       'translateY(8px)',
      transition:      'opacity 200ms, visibility 200ms, transform 200ms',
      zIndex:          'var(--z-toast)',
    });

    document.body.appendChild(btn);
  }

  const show = () => {
    btn.style.opacity    = '1';
    btn.style.visibility = 'visible';
    btn.style.transform  = 'translateY(0)';
  };

  const hide = () => {
    btn.style.opacity    = '0';
    btn.style.visibility = 'hidden';
    btn.style.transform  = 'translateY(8px)';
  };

  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) { show(); } else { hide(); }
  }, { passive: true });

  on(btn, 'click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ============================================================
   INICIALIZAÇÃO PRINCIPAL
   Orquestra todos os módulos na ordem correta.
   ============================================================ */

/**
 * Ponto de entrada da aplicação.
 * Chamado quando o DOM estiver pronto.
 */
function init() {
  log('Inicializando FinCalc v1.0.0...');

  // ── Preferências do sistema (sem DOM) ─────────────────────
  initSystemPreferences();

  // ── UI crítica (afeta acima do fold) ──────────────────────
  initHeader();
  initFooterYear();
  initActiveNavLinks();

  // ── Interatividade principal ───────────────────────────────
  initMobileMenu();
  initAccordions();
  initOptionalSections();
  initTabs();
  initSkipLink();

  // ── Utilitários ───────────────────────────────────────────
  initToast();
  initCopyButtons();
  initScrollToTop();
  initLazyImages();

  // ── Performance ───────────────────────────────────────────
  initLinkPreload();

  // ── Serviços externos (lazy) ──────────────────────────────
  initAnalytics();
  initAdSense();

  // ── PWA ───────────────────────────────────────────────────
  initServiceWorker();

  log('FinCalc iniciado com sucesso ✓');
}

/* ============================================================
   BOOTSTRAP — AGUARDA DOM READY
   ============================================================ */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM já pronto (script carregado com defer após parsing)
  init();
}

/* ============================================================
   EXPORTS — API PÚBLICA DO MÓDULO
   Permite que outros módulos usem utilitários do app.
   ============================================================ */

export {
  $,
  $$,
  on,
  log,
  APP_CONFIG,
};
