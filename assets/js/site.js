// Consentimiento de cookies, Google Analytics 4 y Google Ads con Consent Mode v2,
// eventos de contacto, conservación de gclid/UTM entre páginas y menú móvil.
// Ningún script de Google se carga antes de que la persona acepte.
(() => {
  'use strict';

  const STORAGE_KEY = 'cu-consent';
  const CONSENT_VERSION = 1;
  const PASS_PARAMS = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  let config = {};
  try {
    config = JSON.parse(document.getElementById('cu-config').textContent);
  } catch (err) {
    config = {};
  }
  const isSet = (id) => typeof id === 'string' && id.length > 3 && !id.includes('XXXX');
  const pageSlug = document.body.dataset.page || 'portada';

  // ---------- Elección guardada ----------

  const readConsent = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved && saved.v === CONSENT_VERSION ? saved : null;
    } catch (err) {
      return null; // almacenamiento bloqueado o dato corrupto: se vuelve a preguntar
    }
  };

  const saveConsent = (analytics, ads) => {
    const choice = { v: CONSENT_VERSION, analytics, ads, ts: new Date().toISOString() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch (err) {
      // Sin almacenamiento la elección vale solo para esta página; el banner volverá a aparecer.
    }
    return choice;
  };

  // ---------- Google tag ----------

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  let tagLoaded = false;
  let ga4Configured = false;
  let adsConfigured = false;
  let consent = readConsent();

  const consentState = (c) => ({
    analytics_storage: c.analytics ? 'granted' : 'denied',
    ad_storage: c.ads ? 'granted' : 'denied',
    ad_user_data: c.ads ? 'granted' : 'denied',
    ad_personalization: c.ads ? 'granted' : 'denied',
  });

  const useAnalytics = () => Boolean(consent && consent.analytics && isSet(config.ga4Id));
  const useAds = () => Boolean(consent && consent.ads && isSet(config.adsId));

  function applyConsent() {
    if (!useAnalytics() && !useAds()) return;
    if (!tagLoaded) {
      tagLoaded = true;
      gtag('consent', 'default', {
        analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
        wait_for_update: 500,
      });
      gtag('consent', 'update', consentState(consent));
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(useAnalytics() ? config.ga4Id : config.adsId)}`;
      document.head.appendChild(script);
      gtag('js', new Date());
    } else {
      gtag('consent', 'update', consentState(consent));
    }
    if (useAnalytics() && !ga4Configured) {
      ga4Configured = true;
      gtag('config', config.ga4Id);
    }
    if (useAds() && !adsConfigured) {
      adsConfigured = true;
      gtag('config', config.adsId);
    }
  }

  function clearGoogleCookies() {
    const host = location.hostname;
    const domains = ['', host, `.${host}`, `.${host.replace(/^www\./, '')}`];
    document.cookie.split(';').map((c) => c.split('=')[0].trim())
      .filter((name) => /^(_ga|_gid|_gcl|_gac)/.test(name))
      .forEach((name) => domains.forEach((d) => {
        document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
      }));
  }

  // ---------- Eventos de contacto ----------

  const linkKind = (a) => {
    if (a.dataset.track) return a.dataset.track;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('mailto:')) return 'email';
    if (href.startsWith('tel:')) return 'phone';
    if (/wa\.me|whatsapp\.com/.test(href)) return 'whatsapp';
    return null;
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || !tagLoaded) return;
    const kind = linkKind(link);
    if (!kind) return;
    if (useAnalytics()) {
      gtag('event', `${kind}_click`, {
        link_location: link.dataset.loc || 'otro',
        materia: link.dataset.materia || pageSlug,
      });
    }
    const label = config.labels && config.labels[kind];
    if (useAds() && isSet(label)) {
      gtag('event', 'conversion', { send_to: `${config.adsId}/${label}` });
    }
  });

  // ---------- gclid y UTM: se agregan a los enlaces internos, sin guardarlos ----------

  const params = new URLSearchParams(location.search);
  const carried = PASS_PARAMS.filter((key) => params.get(key));
  if (carried.length) {
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (href.startsWith('#')) return;
      let url;
      try {
        url = new URL(href, location.href);
      } catch (err) {
        return; // un enlace mal formado no debe detener el resto del script
      }
      if (url.origin !== location.origin) return;
      carried.forEach((key) => {
        if (!url.searchParams.has(key)) url.searchParams.set(key, params.get(key));
      });
      a.setAttribute('href', url.pathname + url.search + url.hash);
    });
  }

  // ---------- Banner de cookies ----------

  const banner = document.getElementById('cookie');
  const prefs = document.getElementById('cookie-prefs');
  const configButton = banner.querySelector('[data-consent="config"]');

  const togglePrefs = (open) => {
    prefs.hidden = !open;
    configButton.setAttribute('aria-expanded', String(open));
  };

  let opener = null;

  const showBanner = ({ openPrefs = false, focus = false } = {}) => {
    if (focus) opener = document.activeElement;
    prefs.elements.analytics.checked = Boolean(consent && consent.analytics);
    prefs.elements.ads.checked = Boolean(consent && consent.ads);
    banner.hidden = false;
    document.documentElement.toggleAttribute('data-cookie-visible', true);
    togglePrefs(openPrefs);
    if (focus) banner.querySelector('.cookie-title').focus();
  };

  const hideBanner = () => {
    const hadFocus = banner.contains(document.activeElement);
    banner.hidden = true;
    document.documentElement.toggleAttribute('data-cookie-visible', false);
    // Devuelve el foco a donde estaba, para que el teclado no salte al inicio de la página.
    if (hadFocus) (opener && opener.isConnected ? opener : document.getElementById('contenido')).focus();
    opener = null;
  };

  const decide = (analytics, ads) => {
    const previous = consent;
    consent = saveConsent(analytics, ads);
    hideBanner();
    const revoked = previous && ((previous.analytics && !analytics) || (previous.ads && !ads));
    if (revoked && tagLoaded) {
      // gtag.js no se puede descargar de la página: se borran sus cookies y se recarga sin él.
      clearGoogleCookies();
      location.reload();
      return;
    }
    if (revoked) clearGoogleCookies();
    applyConsent();
  };

  banner.addEventListener('click', (event) => {
    const button = event.target.closest('[data-consent]');
    if (!button) return;
    const action = button.dataset.consent;
    if (action === 'accept') decide(true, true);
    if (action === 'reject') decide(false, false);
    if (action === 'config') togglePrefs(prefs.hidden);
  });

  prefs.addEventListener('submit', (event) => {
    event.preventDefault();
    decide(prefs.elements.analytics.checked, prefs.elements.ads.checked);
  });

  banner.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && consent) hideBanner();
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-cookie-open]')) showBanner({ openPrefs: true, focus: true });
  });

  if (consent) applyConsent();
  else showBanner();

  // ---------- Volver arriba: aparece después de una pantalla de scroll ----------

  const toTop = document.querySelector('.to-top');
  if (toTop) {
    const update = () => { toTop.hidden = window.scrollY < window.innerHeight; };
    update();
    window.addEventListener('scroll', update, { passive: true });
    toTop.addEventListener('click', (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0 });
      document.getElementById('contenido').focus({ preventScroll: true });
    });
  }

  // ---------- Proceso animado: la línea avanza con el scroll y cada paso se marca al llegar ----------

  const processList = document.querySelector('.process-list');
  if (processList && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    processList.classList.add('is-animated');
    const processSteps = [...processList.querySelectorAll('.process-step')];
    const updateProcess = () => {
      const box = processList.getBoundingClientRect();
      // Avanza desde que la lista entra al 85 % de la pantalla, en un tramo de al menos media pantalla.
      const distance = Math.max(box.height, window.innerHeight * 0.5);
      const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.85 - box.top) / distance));
      processList.style.setProperty('--progress', progress.toFixed(3));
      const last = processSteps.length - 1;
      processSteps.forEach((step, i) => step.classList.toggle('is-active', progress >= i / last - 0.001));
    };
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { updateProcess(); ticking = false; });
    };
    updateProcess();
    // Las transiciones se activan después del primer cálculo, para no parpadear al cargar.
    requestAnimationFrame(() => processList.classList.add('is-ready'));
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  // ---------- Menú móvil ----------

  const header = document.querySelector('.site-header');
  const toggle = header && header.querySelector('.nav-toggle');
  if (toggle) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      header.toggleAttribute('data-open', open);
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    header.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && header.hasAttribute('data-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }
})();
