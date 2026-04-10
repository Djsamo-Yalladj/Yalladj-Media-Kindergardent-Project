/* ============================================================
   YallaDJ Media — Admin Panel JS
   Login | Sidebar | Navigation | Dashboard stats
   ============================================================ */

(function () {
  'use strict';

  /* ---- Config ---- */
  const ADMIN_PASSWORD  = 'yalladj2026';
  const SESSION_KEY     = 'yalladj_admin_session';
  const LAST_SAVED_KEY  = 'yalladj_last_saved';

  /* ---- Editor state ---- */
  let dirtySection = null;
  const editorInitialized = {};

  /* ---- Section titles for topbar ---- */
  const SECTION_TITLES = {
    home:     'Dashboard',
    hero:     'Hero Editor',
    pain:     'Pain Points Editor',
    services: 'Services Editor',
    packages: 'Packages Editor',
    process:  'Process Editor',
    trust:    'Why Choose Us Editor',
    portfolio:'Portfolio Editor',
    app:      'App Showcase Editor',
    upsell:   'Upsells Editor',
    contact:  'Contact Editor',
    footer:   'Footer Editor',
    settings: 'General Settings',
  };

  /* ---- DOM refs ---- */
  const loginScreen  = document.getElementById('login-screen');
  const adminApp     = document.getElementById('admin-app');
  const loginForm    = document.getElementById('login-form');
  const passwordInput= document.getElementById('admin-password');
  const rememberMe   = document.getElementById('remember-me');
  const loginError   = document.getElementById('login-error');
  const logoutBtn    = document.getElementById('logout-btn');
  const hamburger    = document.getElementById('hamburger');
  const sidebar      = document.getElementById('sidebar');
  const sidebarClose = document.getElementById('sidebar-close');
  const overlay      = document.getElementById('sidebar-overlay');
  const topbarTitle  = document.getElementById('topbar-title');
  const topbarTime   = document.getElementById('topbar-time');
  const toast        = document.getElementById('toast');
  const lastSavedBanner = document.getElementById('last-saved-banner');
  const lastSavedTime   = document.getElementById('last-saved-time');

  /* ============================================================
     AUTH
     ============================================================ */
  function checkSession() {
    const stored = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return stored === 'authenticated';
  }

  function doLogin(e) {
    e.preventDefault();
    const pwd = passwordInput.value.trim();
    if (pwd === ADMIN_PASSWORD) {
      const storage = rememberMe.checked ? localStorage : sessionStorage;
      storage.setItem(SESSION_KEY, 'authenticated');
      loginError.classList.add('hidden');
      showApp();
    } else {
      loginError.classList.remove('hidden');
      passwordInput.value = '';
      passwordInput.focus();
      // Shake animation
      loginError.style.animation = 'none';
      requestAnimationFrame(() => { loginError.style.animation = ''; });
    }
  }

  function doLogout() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    adminApp.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    passwordInput.value = '';
    loginError.classList.add('hidden');
  }

  function showApp() {
    loginScreen.classList.add('hidden');
    adminApp.classList.remove('hidden');
    initDashboard();
    navigateTo('home');
    startClock();
  }

  /* ============================================================
     CLOCK
     ============================================================ */
  function startClock() {
    function tick() {
      const now = new Date();
      topbarTime.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    tick();
    setInterval(tick, 60000);
  }

  /* ============================================================
     NAVIGATION
     ============================================================ */
  function navigateTo(sectionId) {
    // Unsaved changes guard
    if (dirtySection && dirtySection !== sectionId) {
      if (!confirm('You have unsaved changes. Leave without saving?')) return;
      dirtySection = null;
    }

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.section === sectionId);
    });

    // Show/hide sections
    document.querySelectorAll('.admin-section').forEach(el => {
      el.classList.toggle('active', el.id === 'section-' + sectionId);
    });

    // Update topbar title
    topbarTitle.textContent = SECTION_TITLES[sectionId] || 'Admin';

    // Close mobile sidebar
    closeSidebar();

    // Lazy-init editors on first visit
    if (!editorInitialized[sectionId]) {
      editorInitialized[sectionId] = true;
      if      (sectionId === 'hero')     initHeroEditor();
      else if (sectionId === 'pain')     initPainEditor();
      else if (sectionId === 'services') initServicesEditor();
    }
  }

  /* ============================================================
     SIDEBAR (mobile)
     ============================================================ */
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* ============================================================
     DASHBOARD STATS
     ============================================================ */
  function initDashboard() {
    // Last saved timestamp
    const saved = localStorage.getItem(LAST_SAVED_KEY);
    if (saved) {
      lastSavedBanner.classList.remove('hidden');
      lastSavedTime.textContent = saved;
    }

    // Stat: Active Packages
    try {
      const pkgData = localStorage.getItem('yalladj_packages');
      if (pkgData) {
        const pkg = JSON.parse(pkgData);
        const count = Array.isArray(pkg.packages)
          ? pkg.packages.filter(p => p.visible !== false).length
          : 3;
        document.getElementById('stat-packages').textContent = count;
      }
    } catch (e) { /* use default 3 */ }

    // Stat: Pain Points
    try {
      const painData = localStorage.getItem('yalladj_pain');
      if (painData) {
        const pain = JSON.parse(painData);
        const count = Array.isArray(pain.cards) ? pain.cards.length : 4;
        document.getElementById('stat-pain').textContent = count;
      }
    } catch (e) { /* use default 4 */ }

    // Stat: Upsell Services
    try {
      const upsellData = localStorage.getItem('yalladj_upsell');
      if (upsellData) {
        const upsell = JSON.parse(upsellData);
        const count = Array.isArray(upsell.items) ? upsell.items.length : 6;
        document.getElementById('stat-upsell').textContent = count;
      }
    } catch (e) { /* use default 6 */ }
  }

  /* ============================================================
     TOAST
     ============================================================ */
  let toastTimer = null;
  window.showToast = function (message, duration = 3000) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
  };

  /* ============================================================
     EVENT LISTENERS
     ============================================================ */

  // Login form submit
  loginForm.addEventListener('submit', doLogin);

  // Logout
  logoutBtn.addEventListener('click', doLogout);

  // Sidebar nav links
  document.querySelectorAll('.nav-item[data-section]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.section);
    });
  });

  // Section tiles on dashboard home
  document.querySelectorAll('.section-tile[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.goto));
  });

  // Hamburger
  hamburger.addEventListener('click', openSidebar);
  sidebarClose.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

  /* ============================================================
     EDITOR UTILITIES
     ============================================================ */

  function loadSection(key) {
    try {
      const stored = localStorage.getItem('yalladj_' + key);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {};
  }

  function saveSection(key, data) {
    localStorage.setItem('yalladj_' + key, JSON.stringify(data));
    const ts = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    localStorage.setItem(LAST_SAVED_KEY, ts);
    lastSavedBanner.classList.remove('hidden');
    lastSavedTime.textContent = ts;
    dirtySection = null;
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  }

  function markDirty(section) { dirtySection = section; }

  function watchInputs(sectionId, ids) {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => markDirty(sectionId));
    });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ============================================================
     HERO EDITOR
     ============================================================ */

  function parseWaLink(waLink) {
    try {
      const url = new URL(waLink);
      return {
        number:  url.pathname.replace('/', ''),
        message: url.searchParams.get('text') || ''
      };
    } catch (e) { return { number: '', message: '' }; }
  }

  function buildWaLink(number, message) {
    if (!number.trim()) return '';
    return 'https://wa.me/' + number.trim() + '?text=' + encodeURIComponent(message);
  }

  function initHeroEditor() {
    const d  = loadSection('hero');
    const wa = parseWaLink(d.waLink || '');

    setVal('hero-badge',          d.badge          || "UAE's Nursery Web Specialists");
    setVal('hero-titlePrefix',    d.titlePrefix    || 'Professional Websites for');
    setVal('hero-titleHighlight', d.titleHighlight || 'Nurseries & Kindergartens');
    setVal('hero-subtitle',       d.subtitle       || '');
    setVal('hero-btn1Text',       d.btn1Text       || 'View Packages');
    setVal('hero-btn1Link',       d.btn1Link       || '#packages');
    setVal('hero-btn2Text',       d.btn2Text       || 'WhatsApp Us');
    setVal('hero-waNumber',       wa.number);
    setVal('hero-waMessage',      wa.message);
    setVal('hero-stat1Num',       d.stat1Num       || '7 Days');
    setVal('hero-stat1Label',     d.stat1Label     || 'Delivery');
    setVal('hero-stat2Num',       d.stat2Num       || 'EN + AR');
    setVal('hero-stat2Label',     d.stat2Label     || 'Bilingual');
    setVal('hero-stat3Num',       d.stat3Num       || 'AED 1,800');
    setVal('hero-stat3Label',     d.stat3Label     || 'Starting From');

    watchInputs('hero', [
      'hero-badge','hero-titlePrefix','hero-titleHighlight','hero-subtitle',
      'hero-btn1Text','hero-btn1Link','hero-btn2Text','hero-waNumber','hero-waMessage',
      'hero-stat1Num','hero-stat1Label','hero-stat2Num','hero-stat2Label',
      'hero-stat3Num','hero-stat3Label'
    ]);

    document.getElementById('hero-save-btn').addEventListener('click', saveHeroEditor);
  }

  function saveHeroEditor() {
    saveSection('hero', {
      badge:          getVal('hero-badge'),
      titlePrefix:    getVal('hero-titlePrefix'),
      titleHighlight: getVal('hero-titleHighlight'),
      subtitle:       getVal('hero-subtitle'),
      btn1Text:       getVal('hero-btn1Text'),
      btn1Link:       getVal('hero-btn1Link'),
      btn2Text:       getVal('hero-btn2Text'),
      waLink:         buildWaLink(getVal('hero-waNumber'), getVal('hero-waMessage')),
      stat1Num:       getVal('hero-stat1Num'),
      stat1Label:     getVal('hero-stat1Label'),
      stat2Num:       getVal('hero-stat2Num'),
      stat2Label:     getVal('hero-stat2Label'),
      stat3Num:       getVal('hero-stat3Num'),
      stat3Label:     getVal('hero-stat3Label')
    });
    showToast('Hero saved ✓');
  }

  /* ============================================================
     PAIN POINTS EDITOR
     ============================================================ */

  let painCards = [];

  const PAIN_DEFAULTS = [
    { icon: 'bi bi-x-circle-fill',        title: 'No Website at All',        desc: 'Parents search online first. Without a website, you don\'t exist to 80% of potential families.', show: true },
    { icon: 'bi bi-phone-landscape-fill',  title: 'Not Mobile-Friendly',      desc: 'Parents browse on their phones. An outdated or desktop-only site drives them straight to a competitor.', show: true },
    { icon: 'bi bi-translate',             title: 'English Only',             desc: 'UAE families speak Arabic. No Arabic version means you\'re invisible to half your market.', show: true },
    { icon: 'bi bi-question-circle-fill',  title: 'Hard to Find on Google',   desc: 'Without SEO, families searching "nursery near me in Dubai" will never discover your school.', show: true }
  ];

  function initPainEditor() {
    const d = loadSection('pain');
    setVal('pain-title',    d.title    || '');
    setVal('pain-subtitle', d.subtitle || '');

    painCards = (d.cards && d.cards.length)
      ? d.cards.map(c => Object.assign({}, c))
      : PAIN_DEFAULTS.map(c => Object.assign({}, c));

    renderPainCards();
    watchInputs('pain', ['pain-title', 'pain-subtitle']);
    document.getElementById('pain-save-btn').addEventListener('click', savePainEditor);
    document.getElementById('pain-add-btn').addEventListener('click', addPainCard);
  }

  function renderPainCards() {
    const list = document.getElementById('pain-cards-list');
    list.innerHTML = '';
    painCards.forEach((card, i) => list.appendChild(buildPainCardEl(card, i)));
  }

  function buildPainCardEl(card, index) {
    const total   = painCards.length;
    const isFirst = index === 0;
    const isLast  = index === total - 1;
    const checked = card.show !== false;

    const div = document.createElement('div');
    div.className = 'card-editor-item';

    div.innerHTML =
      '<div class="card-editor-header">' +
        '<span class="card-num">Card ' + (index + 1) + '</span>' +
        '<div class="card-actions">' +
          '<button class="btn-icon btn-up" title="Move up"'    + (isFirst ? ' disabled' : '') + '>&#8593;</button>' +
          '<button class="btn-icon btn-down" title="Move down"' + (isLast  ? ' disabled' : '') + '>&#8595;</button>' +
          '<label class="toggle-label">' +
            '<input type="checkbox" class="card-visible"' + (checked ? ' checked' : '') + '>' +
            '<span class="vis-text">' + (checked ? 'Visible' : 'Hidden') + '</span>' +
          '</label>' +
          '<button class="btn-icon btn-delete" title="Delete">&#10005;</button>' +
        '</div>' +
      '</div>' +
      '<div class="form-row two-col">' +
        '<div class="form-group">' +
          '<label>Icon Class (Bootstrap Icons)</label>' +
          '<input type="text" class="card-icon-inp" value="' + escHtml(card.icon  || '') + '" placeholder="bi bi-x-circle-fill" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Title</label>' +
          '<input type="text" class="card-title-inp" value="' + escHtml(card.title || '') + '" placeholder="Card title" />' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Description</label>' +
        '<textarea class="card-desc-inp" rows="2" placeholder="Card description">' + escHtml(card.desc || '') + '</textarea>' +
      '</div>';

    div.querySelector('.btn-up').addEventListener('click',    () => movePainCard(index, -1));
    div.querySelector('.btn-down').addEventListener('click',  () => movePainCard(index, 1));
    div.querySelector('.btn-delete').addEventListener('click',() => deletePainCard(index));
    div.querySelector('.card-visible').addEventListener('change', function () {
      div.querySelector('.vis-text').textContent = this.checked ? 'Visible' : 'Hidden';
      markDirty('pain');
    });
    div.querySelector('.card-icon-inp').addEventListener('input',  () => markDirty('pain'));
    div.querySelector('.card-title-inp').addEventListener('input', () => markDirty('pain'));
    div.querySelector('.card-desc-inp').addEventListener('input',  () => markDirty('pain'));

    return div;
  }

  function syncPainFromDom() {
    document.querySelectorAll('#pain-cards-list .card-editor-item').forEach((el, i) => {
      painCards[i] = {
        icon:  el.querySelector('.card-icon-inp').value,
        title: el.querySelector('.card-title-inp').value,
        desc:  el.querySelector('.card-desc-inp').value,
        show:  el.querySelector('.card-visible').checked
      };
    });
  }

  function movePainCard(index, dir) {
    syncPainFromDom();
    const target = index + dir;
    if (target < 0 || target >= painCards.length) return;
    [painCards[index], painCards[target]] = [painCards[target], painCards[index]];
    renderPainCards();
    markDirty('pain');
  }

  function deletePainCard(index) {
    if (painCards.length <= 1) { showToast('Need at least 1 card'); return; }
    syncPainFromDom();
    painCards.splice(index, 1);
    renderPainCards();
    markDirty('pain');
  }

  function addPainCard() {
    syncPainFromDom();
    painCards.push({ icon: 'bi bi-star-fill', title: 'New Point', desc: 'Describe the problem here.', show: true });
    renderPainCards();
    markDirty('pain');
    const list = document.getElementById('pain-cards-list');
    if (list.lastElementChild) list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function savePainEditor() {
    syncPainFromDom();
    saveSection('pain', {
      title:    getVal('pain-title'),
      subtitle: getVal('pain-subtitle'),
      cards:    painCards
    });
    showToast('Pain Points saved ✓');
  }

  /* ============================================================
     SERVICES EDITOR
     ============================================================ */

  const SVC_DEFAULTS = [
    {
      icon: 'bi bi-rocket-takeoff-fill',
      title: 'New Nursery Website',
      desc: 'We design and build your nursery\'s website from scratch — fast, beautiful, and built to win enrolments.',
      features: [
        'Custom design matching your brand & colors',
        'English + Arabic bilingual',
        'Mobile-first, responsive on all devices',
        'Enrolment inquiry form',
        'Google Maps integration',
        'WhatsApp click-to-chat button',
        'Fast loading (under 3 seconds)',
        'KHDA license display ready'
      ],
      btnText: 'View Packages', btnLink: '#packages'
    },
    {
      icon: 'bi bi-arrow-repeat',
      title: 'Website Redesign',
      desc: 'Have an old or outdated website? We modernize it — faster, better-looking, and fully optimized for 2025.',
      features: [
        'Complete visual overhaul',
        'Migration of existing content',
        'Speed & performance optimization',
        'Add missing Arabic version',
        'Mobile responsiveness fix',
        'SEO cleanup & improvements',
        'Modern contact & enrolment forms',
        'Social media links & feeds'
      ],
      btnText: 'View Pricing', btnLink: '#packages'
    }
  ];

  function initServicesEditor() {
    const d     = loadSection('services');
    const cards = (d.cards && d.cards.length === 2) ? d.cards : SVC_DEFAULTS;

    setVal('services-title',    d.title    || '');
    setVal('services-subtitle', d.subtitle || '');

    [0, 1].forEach(i => {
      const c = cards[i];
      setVal('svc' + i + '-icon',    c.icon    || '');
      setVal('svc' + i + '-title',   c.title   || '');
      setVal('svc' + i + '-desc',    c.desc    || '');
      setVal('svc' + i + '-btnText', c.btnText || '');
      setVal('svc' + i + '-btnLink', c.btnLink || '');
      renderSvcFeatures(c.features || [], i);
    });

    watchInputs('services', [
      'services-title','services-subtitle',
      'svc0-icon','svc0-title','svc0-desc','svc0-btnText','svc0-btnLink',
      'svc1-icon','svc1-title','svc1-desc','svc1-btnText','svc1-btnLink'
    ]);

    document.querySelectorAll('.btn-add-feature').forEach(btn => {
      btn.addEventListener('click', () => addSvcFeature(Number(btn.dataset.svc)));
    });

    document.getElementById('services-save-btn').addEventListener('click', saveServicesEditor);
  }

  function renderSvcFeatures(features, svcIdx) {
    const list = document.getElementById('svc' + svcIdx + '-features-list');
    list.innerHTML = '';
    features.forEach(f => addFeatureRow(list, f));
  }

  function addFeatureRow(listEl, text) {
    const row = document.createElement('div');
    row.className = 'feature-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = text || '';
    input.placeholder = 'Feature text';
    input.addEventListener('input', () => markDirty('services'));

    const del = document.createElement('button');
    del.className = 'btn-icon btn-delete';
    del.title = 'Remove';
    del.innerHTML = '&#10005;';
    del.addEventListener('click', () => { row.remove(); markDirty('services'); });

    row.appendChild(input);
    row.appendChild(del);
    listEl.appendChild(row);
  }

  function addSvcFeature(svcIdx) {
    const list = document.getElementById('svc' + svcIdx + '-features-list');
    addFeatureRow(list, '');
    markDirty('services');
    if (list.lastElementChild) list.lastElementChild.querySelector('input').focus();
  }

  function getSvcFeatures(svcIdx) {
    return Array.from(
      document.querySelectorAll('#svc' + svcIdx + '-features-list .feature-row input')
    ).map(el => el.value).filter(v => v.trim() !== '');
  }

  function saveServicesEditor() {
    const cards = [0, 1].map(i => ({
      icon:     getVal('svc' + i + '-icon'),
      title:    getVal('svc' + i + '-title'),
      desc:     getVal('svc' + i + '-desc'),
      features: getSvcFeatures(i),
      btnText:  getVal('svc' + i + '-btnText'),
      btnLink:  getVal('svc' + i + '-btnLink')
    }));
    saveSection('services', {
      title:    getVal('services-title'),
      subtitle: getVal('services-subtitle'),
      cards
    });
    showToast('Services saved ✓');
  }

  /* ============================================================
     INIT — check if already logged in
     ============================================================ */
  if (checkSession()) {
    showApp();
  }

})();
