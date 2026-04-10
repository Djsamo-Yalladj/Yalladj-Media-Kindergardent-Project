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
      else if (sectionId === 'packages') initPackagesEditor();
      else if (sectionId === 'process')  initProcessEditor();
      else if (sectionId === 'trust')    initTrustEditor();
      else if (sectionId === 'app')       initAppEditor();
      else if (sectionId === 'portfolio') initPortfolioEditor();
      else if (sectionId === 'upsell')    initUpsellEditor();
      else if (sectionId === 'contact')   initContactEditor();
      else if (sectionId === 'footer')    initFooterEditor();
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

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

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
     PACKAGES EDITOR
     ============================================================ */

  let pkgCards = [];

  const PKG_DEFAULTS = [
    {
      name: 'Starter', price: 'AED 2,500', priceSuffix: 'one-time',
      desc: 'Perfect for new nurseries getting their online presence off the ground quickly.',
      featured: false, ribbon: '',
      features: [
        { text: 'Up to 5 pages', check: true },
        { text: 'Mobile responsive', check: true },
        { text: 'English + Arabic', check: true },
        { text: 'Contact & inquiry form', check: true },
        { text: 'Google Maps integration', check: true },
        { text: 'WhatsApp button', check: true },
        { text: 'Basic SEO setup', check: true },
        { text: '7-day delivery', check: true },
        { text: '30-day support', check: true },
        { text: 'Photo/video section', check: false },
        { text: 'Blog / news section', check: false },
        { text: 'Online enrolment form', check: false }
      ],
      btnText: 'Get Started', btnLink: '#contact', btnStyle: 'outline', show: true
    },
    {
      name: 'Growth', price: 'AED 4,500', priceSuffix: 'one-time',
      desc: 'The full package — everything a growing nursery needs to attract and convert parents online.',
      featured: true, ribbon: 'Most Popular',
      features: [
        { text: 'Up to 10 pages', check: true },
        { text: 'Mobile responsive', check: true },
        { text: 'English + Arabic', check: true },
        { text: 'Online enrolment form', check: true },
        { text: 'Photo & video gallery', check: true },
        { text: 'Blog / news section', check: true },
        { text: 'WhatsApp + social links', check: true },
        { text: 'Advanced SEO setup', check: true },
        { text: 'Google Analytics connected', check: true },
        { text: 'Speed optimization', check: true },
        { text: '7-day delivery', check: true },
        { text: '60-day support', check: true }
      ],
      btnText: 'Get Started', btnLink: '#contact', btnStyle: 'lime', show: true
    },
    {
      name: 'Redesign', price: 'from AED 1,800', priceSuffix: '',
      desc: 'Have an existing website? We modernize it completely — faster, more beautiful, and conversion-optimized.',
      featured: false, ribbon: '',
      features: [
        { text: 'Full visual overhaul', check: true },
        { text: 'All existing content migrated', check: true },
        { text: 'Mobile responsiveness', check: true },
        { text: 'Add missing Arabic version', check: true },
        { text: 'Speed & SEO improvements', check: true },
        { text: 'Modern forms & WhatsApp', check: true },
        { text: 'Price based on scope', check: true },
        { text: 'Free consultation call', check: true },
        { text: '45-day support', check: true }
      ],
      btnText: 'Get a Quote',
      btnLink: 'https://wa.me/971544503515?text=Hi%20YallaDJ%20Media!%20I%27d%20like%20a%20quote%20to%20redesign%20my%20nursery%20website.',
      btnStyle: 'outline-wa', show: true
    }
  ];

  function initPackagesEditor() {
    const d = loadSection('packages');
    setVal('packages-title',    d.title    || '');
    setVal('packages-subtitle', d.subtitle || '');

    pkgCards = (d.cards && d.cards.length)
      ? d.cards.map(c => JSON.parse(JSON.stringify(c)))
      : PKG_DEFAULTS.map(c => JSON.parse(JSON.stringify(c)));

    renderPkgCards();
    watchInputs('packages', ['packages-title', 'packages-subtitle']);
    document.getElementById('packages-save-btn').addEventListener('click', savePkgEditor);
    document.getElementById('packages-add-btn').addEventListener('click', addPkgCard);
  }

  function renderPkgCards() {
    const list = document.getElementById('packages-cards-list');
    list.innerHTML = '';
    pkgCards.forEach((card, i) => list.appendChild(buildPkgCardEl(card, i)));
  }

  function buildPkgCardEl(card, index) {
    const total   = pkgCards.length;
    const isFirst = index === 0;
    const isLast  = index === total - 1;
    const visible  = card.show !== false;
    const featured = card.featured === true;

    const div = document.createElement('div');
    div.className = 'card-editor-item';

    div.innerHTML =
      '<div class="card-editor-header">' +
        '<span class="card-num">Package ' + (index + 1) + ' — <strong>' + escHtml(card.name || '') + '</strong></span>' +
        '<div class="card-actions">' +
          '<button class="btn-icon btn-up" title="Move up"'    + (isFirst ? ' disabled' : '') + '>&#8593;</button>' +
          '<button class="btn-icon btn-down" title="Move down"' + (isLast  ? ' disabled' : '') + '>&#8595;</button>' +
          '<label class="toggle-label">' +
            '<input type="checkbox" class="pkg-featured"' + (featured ? ' checked' : '') + '>' +
            '<span class="vis-text" style="color:#ffc136">' + (featured ? '★ Featured' : '☆ Normal') + '</span>' +
          '</label>' +
          '<label class="toggle-label">' +
            '<input type="checkbox" class="pkg-visible"' + (visible ? ' checked' : '') + '>' +
            '<span class="vis-text">' + (visible ? 'Visible' : 'Hidden') + '</span>' +
          '</label>' +
          '<button class="btn-icon btn-delete" title="Delete">&#10005;</button>' +
        '</div>' +
      '</div>' +

      '<div class="form-row two-col">' +
        '<div class="form-group">' +
          '<label>Package Name</label>' +
          '<input type="text" class="pkg-name-inp" value="' + escHtml(card.name || '') + '" placeholder="Starter" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Price</label>' +
          '<input type="text" class="pkg-price-inp" value="' + escHtml(card.price || '') + '" placeholder="AED 2,500" />' +
        '</div>' +
      '</div>' +

      '<div class="form-row two-col">' +
        '<div class="form-group">' +
          '<label>Price Suffix <small>(e.g. "one-time", leave blank to hide)</small></label>' +
          '<input type="text" class="pkg-suffix-inp" value="' + escHtml(card.priceSuffix || '') + '" placeholder="one-time" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Ribbon Badge <small>(e.g. "Most Popular", leave blank to hide)</small></label>' +
          '<input type="text" class="pkg-ribbon-inp" value="' + escHtml(card.ribbon || '') + '" placeholder="Most Popular" />' +
        '</div>' +
      '</div>' +

      '<div class="form-group">' +
        '<label>Description</label>' +
        '<textarea class="pkg-desc-inp" rows="2" placeholder="Short description of this package">' + escHtml(card.desc || '') + '</textarea>' +
      '</div>' +

      '<div class="form-row two-col">' +
        '<div class="form-group">' +
          '<label>Button Text</label>' +
          '<input type="text" class="pkg-btn-text-inp" value="' + escHtml(card.btnText || '') + '" placeholder="Get Started" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Button Link</label>' +
          '<input type="text" class="pkg-btn-link-inp" value="' + escHtml(card.btnLink || '') + '" placeholder="#contact" />' +
        '</div>' +
      '</div>' +

      '<div class="form-group">' +
        '<label>Button Style</label>' +
        '<select class="pkg-btn-style-inp">' +
          '<option value="outline"'    + (card.btnStyle === 'outline'    ? ' selected' : '') + '>Outline (default)</option>' +
          '<option value="lime"'       + (card.btnStyle === 'lime'       ? ' selected' : '') + '>Lime (green fill)</option>' +
          '<option value="outline-wa"' + (card.btnStyle === 'outline-wa' ? ' selected' : '') + '>WhatsApp Outline</option>' +
        '</select>' +
      '</div>' +

      '<div class="form-group">' +
        '<label>Features List <small>(check = included, uncheck = not included/greyed)</small></label>' +
        '<div class="pkg-features-list"></div>' +
        '<button type="button" class="btn-add-feature pkg-add-feat-btn">+ Add Feature</button>' +
      '</div>';

    // Render features
    const featuresList = div.querySelector('.pkg-features-list');
    (card.features || []).forEach(f => addPkgFeatureRow(featuresList, f.text, f.check));

    // Events
    div.querySelector('.btn-up').addEventListener('click',    () => movePkgCard(index, -1));
    div.querySelector('.btn-down').addEventListener('click',  () => movePkgCard(index, 1));
    div.querySelector('.btn-delete').addEventListener('click',() => deletePkgCard(index));

    div.querySelector('.pkg-featured').addEventListener('change', function () {
      div.querySelector('.pkg-featured').closest('.card-actions')
        .querySelector('[style*="ffc136"]').textContent = this.checked ? '★ Featured' : '☆ Normal';
      markDirty('packages');
    });
    div.querySelector('.pkg-visible').addEventListener('change', function () {
      const vt = this.closest('.card-actions').querySelectorAll('.vis-text');
      vt[vt.length - 1].textContent = this.checked ? 'Visible' : 'Hidden';
      markDirty('packages');
    });

    ['pkg-name-inp','pkg-price-inp','pkg-suffix-inp','pkg-ribbon-inp','pkg-desc-inp',
     'pkg-btn-text-inp','pkg-btn-link-inp','pkg-btn-style-inp'].forEach(cls => {
      const el = div.querySelector('.' + cls);
      if (el) el.addEventListener('input', () => markDirty('packages'));
      if (el) el.addEventListener('change', () => markDirty('packages'));
    });

    div.querySelector('.pkg-add-feat-btn').addEventListener('click', () => {
      addPkgFeatureRow(div.querySelector('.pkg-features-list'), '', true);
      markDirty('packages');
    });

    return div;
  }

  function addPkgFeatureRow(listEl, text, checked) {
    const row = document.createElement('div');
    row.className = 'feature-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked !== false;
    cb.title = 'Included?';
    cb.style.cssText = 'width:16px;height:16px;flex-shrink:0;cursor:pointer;accent-color:#AFFF00';
    cb.addEventListener('change', () => markDirty('packages'));

    const input = document.createElement('input');
    input.type = 'text';
    input.value = text || '';
    input.placeholder = 'Feature text';
    input.addEventListener('input', () => markDirty('packages'));

    const del = document.createElement('button');
    del.className = 'btn-icon btn-delete';
    del.title = 'Remove';
    del.innerHTML = '&#10005;';
    del.addEventListener('click', () => { row.remove(); markDirty('packages'); });

    row.appendChild(cb);
    row.appendChild(input);
    row.appendChild(del);
    listEl.appendChild(row);
  }

  function syncPkgFromDom() {
    document.querySelectorAll('#packages-cards-list .card-editor-item').forEach((el, i) => {
      const featureRows = el.querySelectorAll('.pkg-features-list .feature-row');
      pkgCards[i] = {
        name:       el.querySelector('.pkg-name-inp').value,
        price:      el.querySelector('.pkg-price-inp').value,
        priceSuffix:el.querySelector('.pkg-suffix-inp').value,
        ribbon:     el.querySelector('.pkg-ribbon-inp').value,
        desc:       el.querySelector('.pkg-desc-inp').value,
        btnText:    el.querySelector('.pkg-btn-text-inp').value,
        btnLink:    el.querySelector('.pkg-btn-link-inp').value,
        btnStyle:   el.querySelector('.pkg-btn-style-inp').value,
        featured:   el.querySelector('.pkg-featured').checked,
        show:       el.querySelector('.pkg-visible').checked,
        features:   Array.from(featureRows).map(r => ({
          text:  r.querySelector('input[type="text"]').value,
          check: r.querySelector('input[type="checkbox"]').checked
        })).filter(f => f.text.trim() !== '')
      };
    });
  }

  function movePkgCard(index, dir) {
    syncPkgFromDom();
    const target = index + dir;
    if (target < 0 || target >= pkgCards.length) return;
    [pkgCards[index], pkgCards[target]] = [pkgCards[target], pkgCards[index]];
    renderPkgCards();
    markDirty('packages');
  }

  function deletePkgCard(index) {
    if (pkgCards.length <= 1) { showToast('Need at least 1 package'); return; }
    syncPkgFromDom();
    pkgCards.splice(index, 1);
    renderPkgCards();
    markDirty('packages');
  }

  function addPkgCard() {
    syncPkgFromDom();
    pkgCards.push({
      name: 'New Package', price: 'AED 0', priceSuffix: 'one-time',
      desc: 'Describe this package.', featured: false, ribbon: '',
      features: [{ text: 'Feature 1', check: true }],
      btnText: 'Get Started', btnLink: '#contact', btnStyle: 'outline', show: true
    });
    renderPkgCards();
    markDirty('packages');
    const list = document.getElementById('packages-cards-list');
    if (list.lastElementChild) list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function savePkgEditor() {
    syncPkgFromDom();
    saveSection('packages', {
      title:    getVal('packages-title'),
      subtitle: getVal('packages-subtitle'),
      cards:    pkgCards
    });
    showToast('Packages saved ✓');
  }

  /* ============================================================
     PROCESS EDITOR
     ============================================================ */

  let processSteps = [];

  const PROCESS_DEFAULTS = [
    { title: 'Discovery Call',      desc: 'We chat on WhatsApp or a call to understand your nursery, brand, and goals. Takes 20 minutes.' },
    { title: 'Design & Content',    desc: 'You send us your logo, photos, and text. We design a custom layout you\'ll love.' },
    { title: 'Review & Revisions',  desc: 'We show you a preview, collect your feedback, and make any final tweaks.' },
    { title: 'Go Live!',            desc: 'We launch your website, hand over full access, and stay available for 30–60 days of support.' }
  ];

  function initProcessEditor() {
    const d = loadSection('process');
    setVal('process-title',    d.title    || '');
    setVal('process-subtitle', d.subtitle || '');

    processSteps = (d.steps && d.steps.length)
      ? d.steps.map(s => Object.assign({}, s))
      : PROCESS_DEFAULTS.map(s => Object.assign({}, s));

    renderProcessSteps();
    watchInputs('process', ['process-title', 'process-subtitle']);
    document.getElementById('process-save-btn').addEventListener('click', saveProcessEditor);
    document.getElementById('process-add-btn').addEventListener('click', addProcessStep);
  }

  function renderProcessSteps() {
    const list = document.getElementById('process-steps-list');
    list.innerHTML = '';
    processSteps.forEach((step, i) => list.appendChild(buildProcessStepEl(step, i)));
  }

  function buildProcessStepEl(step, index) {
    const total   = processSteps.length;
    const isFirst = index === 0;
    const isLast  = index === total - 1;

    const div = document.createElement('div');
    div.className = 'card-editor-item';

    div.innerHTML =
      '<div class="card-editor-header">' +
        '<span class="card-num">Step ' + (index + 1) + '</span>' +
        '<div class="card-actions">' +
          '<button class="btn-icon btn-up" title="Move up"'    + (isFirst ? ' disabled' : '') + '>&#8593;</button>' +
          '<button class="btn-icon btn-down" title="Move down"' + (isLast  ? ' disabled' : '') + '>&#8595;</button>' +
          '<button class="btn-icon btn-delete" title="Delete">&#10005;</button>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Step Title</label>' +
        '<input type="text" class="step-title-inp" value="' + escHtml(step.title || '') + '" placeholder="Step title" />' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Description</label>' +
        '<textarea class="step-desc-inp" rows="2" placeholder="Short description">' + escHtml(step.desc || '') + '</textarea>' +
      '</div>';

    div.querySelector('.btn-up').addEventListener('click',    () => moveProcessStep(index, -1));
    div.querySelector('.btn-down').addEventListener('click',  () => moveProcessStep(index, 1));
    div.querySelector('.btn-delete').addEventListener('click',() => deleteProcessStep(index));
    div.querySelector('.step-title-inp').addEventListener('input', () => markDirty('process'));
    div.querySelector('.step-desc-inp').addEventListener('input',  () => markDirty('process'));

    return div;
  }

  function syncProcessFromDom() {
    document.querySelectorAll('#process-steps-list .card-editor-item').forEach((el, i) => {
      processSteps[i] = {
        title: el.querySelector('.step-title-inp').value,
        desc:  el.querySelector('.step-desc-inp').value
      };
    });
  }

  function moveProcessStep(index, dir) {
    syncProcessFromDom();
    const target = index + dir;
    if (target < 0 || target >= processSteps.length) return;
    [processSteps[index], processSteps[target]] = [processSteps[target], processSteps[index]];
    renderProcessSteps();
    markDirty('process');
  }

  function deleteProcessStep(index) {
    if (processSteps.length <= 1) { showToast('Need at least 1 step'); return; }
    syncProcessFromDom();
    processSteps.splice(index, 1);
    renderProcessSteps();
    markDirty('process');
  }

  function addProcessStep() {
    syncProcessFromDom();
    processSteps.push({ title: 'New Step', desc: 'Describe this step.' });
    renderProcessSteps();
    markDirty('process');
    const list = document.getElementById('process-steps-list');
    if (list.lastElementChild) list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function saveProcessEditor() {
    syncProcessFromDom();
    saveSection('process', {
      title:    getVal('process-title'),
      subtitle: getVal('process-subtitle'),
      steps:    processSteps
    });
    showToast('Process saved ✓');
  }

  /* ============================================================
     WHY CHOOSE US EDITOR
     ============================================================ */

  let trustCards = [];

  const TRUST_DEFAULTS = [
    { icon: 'bi bi-flag-fill',             title: 'UAE-Based Team',        desc: 'We understand UAE parents, KHDA requirements, and local culture — built into every design.', show: true },
    { icon: 'bi bi-translate',             title: 'True Bilingual',        desc: 'Not just Google Translate. Proper Arabic with RTL layout, written by native speakers.', show: true },
    { icon: 'bi bi-lightning-charge-fill', title: '7-Day Delivery',        desc: 'Most projects go live in one week. No months of waiting, no excuses.', show: true },
    { icon: 'bi bi-phone-fill',            title: 'Mobile-First Design',   desc: 'Every site looks stunning and loads fast on iPhones, Android, tablets, and desktops.', show: true },
    { icon: 'bi bi-shield-check-fill',     title: 'Transparent Pricing',   desc: 'Fixed prices, no hidden fees. You know exactly what you\'re getting before you commit.', show: true },
    { icon: 'bi bi-headset',               title: 'Ongoing Support',       desc: 'We don\'t disappear after launch. WhatsApp support available for updates, changes, and questions.', show: true }
  ];

  function initTrustEditor() {
    const d = loadSection('trust');
    setVal('trust-title',    d.title    || '');
    setVal('trust-subtitle', d.subtitle || '');

    trustCards = (d.cards && d.cards.length)
      ? d.cards.map(c => Object.assign({}, c))
      : TRUST_DEFAULTS.map(c => Object.assign({}, c));

    renderTrustCards();
    watchInputs('trust', ['trust-title', 'trust-subtitle']);
    document.getElementById('trust-save-btn').addEventListener('click', saveTrustEditor);
    document.getElementById('trust-add-btn').addEventListener('click', addTrustCard);
  }

  function renderTrustCards() {
    const list = document.getElementById('trust-cards-list');
    list.innerHTML = '';
    trustCards.forEach((card, i) => list.appendChild(buildTrustCardEl(card, i)));
  }

  function buildTrustCardEl(card, index) {
    const total   = trustCards.length;
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
          '<input type="text" class="card-icon-inp" value="' + escHtml(card.icon  || '') + '" placeholder="bi bi-flag-fill" />' +
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

    div.querySelector('.btn-up').addEventListener('click',    () => moveTrustCard(index, -1));
    div.querySelector('.btn-down').addEventListener('click',  () => moveTrustCard(index, 1));
    div.querySelector('.btn-delete').addEventListener('click',() => deleteTrustCard(index));
    div.querySelector('.card-visible').addEventListener('change', function () {
      div.querySelector('.vis-text').textContent = this.checked ? 'Visible' : 'Hidden';
      markDirty('trust');
    });
    div.querySelector('.card-icon-inp').addEventListener('input',  () => markDirty('trust'));
    div.querySelector('.card-title-inp').addEventListener('input', () => markDirty('trust'));
    div.querySelector('.card-desc-inp').addEventListener('input',  () => markDirty('trust'));

    return div;
  }

  function syncTrustFromDom() {
    document.querySelectorAll('#trust-cards-list .card-editor-item').forEach((el, i) => {
      trustCards[i] = {
        icon:  el.querySelector('.card-icon-inp').value,
        title: el.querySelector('.card-title-inp').value,
        desc:  el.querySelector('.card-desc-inp').value,
        show:  el.querySelector('.card-visible').checked
      };
    });
  }

  function moveTrustCard(index, dir) {
    syncTrustFromDom();
    const target = index + dir;
    if (target < 0 || target >= trustCards.length) return;
    [trustCards[index], trustCards[target]] = [trustCards[target], trustCards[index]];
    renderTrustCards();
    markDirty('trust');
  }

  function deleteTrustCard(index) {
    if (trustCards.length <= 1) { showToast('Need at least 1 card'); return; }
    syncTrustFromDom();
    trustCards.splice(index, 1);
    renderTrustCards();
    markDirty('trust');
  }

  function addTrustCard() {
    syncTrustFromDom();
    trustCards.push({ icon: 'bi bi-star-fill', title: 'New Feature', desc: 'Describe why clients choose you.', show: true });
    renderTrustCards();
    markDirty('trust');
    const list = document.getElementById('trust-cards-list');
    if (list.lastElementChild) list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function saveTrustEditor() {
    syncTrustFromDom();
    saveSection('trust', {
      title:    getVal('trust-title'),
      subtitle: getVal('trust-subtitle'),
      cards:    trustCards
    });
    showToast('Why Choose Us saved ✓');
  }

  /* ============================================================
     APP SHOWCASE EDITOR
     ============================================================ */

  function initAppEditor() {
    const d = loadSection('app');

    const showChk = document.getElementById('app-show');
    showChk.checked = d.show === true;
    showChk.addEventListener('change', () => markDirty('app'));

    setVal('app-badge',    d.badge    || 'Included with Growth Package');
    setVal('app-title',    d.title    || '');
    setVal('app-subtitle', d.subtitle || '');
    setVal('app-infoText', d.infoText || 'Included with Growth Package');

    // Render features
    const featList = document.getElementById('app-features-list');
    featList.innerHTML = '';
    (d.features || []).forEach(f => addAppFeatureRow(featList, f));

    watchInputs('app', ['app-badge', 'app-title', 'app-subtitle', 'app-infoText']);
    document.getElementById('app-save-btn').addEventListener('click', saveAppEditor);
    document.getElementById('app-add-feat-btn').addEventListener('click', () => {
      addAppFeatureRow(document.getElementById('app-features-list'), '');
      markDirty('app');
    });
  }

  function addAppFeatureRow(listEl, text) {
    const row = document.createElement('div');
    row.className = 'feature-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = text || '';
    input.placeholder = 'Feature bullet point';
    input.addEventListener('input', () => markDirty('app'));

    const del = document.createElement('button');
    del.className = 'btn-icon btn-delete';
    del.title = 'Remove';
    del.innerHTML = '&#10005;';
    del.addEventListener('click', () => { row.remove(); markDirty('app'); });

    row.appendChild(input);
    row.appendChild(del);
    listEl.appendChild(row);
  }

  function saveAppEditor() {
    const features = Array.from(
      document.querySelectorAll('#app-features-list .feature-row input')
    ).map(el => el.value).filter(v => v.trim() !== '');

    saveSection('app', {
      show:     document.getElementById('app-show').checked,
      badge:    getVal('app-badge'),
      title:    getVal('app-title'),
      subtitle: getVal('app-subtitle'),
      infoText: getVal('app-infoText'),
      features
    });
    showToast('App Showcase saved ✓');
  }

  /* ============================================================
     PORTFOLIO EDITOR
     ============================================================ */

  let portfolioCards = [];

  function renderPortfolioCardItem(list, card, idx) {
    const item = document.createElement('div');
    item.className = 'card-editor-item';
    item.dataset.idx = idx;
    item.innerHTML =
      '<div class="card-editor-header">' +
        '<span class="card-num">Card ' + (idx + 1) + '</span>' +
        '<div class="card-actions">' +
          '<label class="toggle-label" title="Show/Hide" style="margin-right:4px;">' +
            '<input type="checkbox" class="pc-show"' + (card.show !== false ? ' checked' : '') + ' />' +
            '<span style="font-size:12px;color:var(--muted);">Visible</span>' +
          '</label>' +
          '<button class="btn-icon btn-move-up" title="Move up">&#8593;</button>' +
          '<button class="btn-icon btn-move-down" title="Move down">&#8595;</button>' +
          '<button class="btn-icon btn-delete" title="Delete">&#10005;</button>' +
        '</div>' +
      '</div>' +
      '<div class="form-row two-col">' +
        '<div class="form-group">' +
          '<label>Nursery Name</label>' +
          '<input type="text" class="pc-name" value="' + escHtml(card.name || '') + '" placeholder="Nursery name" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Short Description</label>' +
          '<input type="text" class="pc-desc" value="' + escHtml(card.desc || '') + '" placeholder="Sample website — live demo coming soon" />' +
        '</div>' +
      '</div>';

    item.querySelector('.pc-name').addEventListener('input', () => markDirty('portfolio'));
    item.querySelector('.pc-desc').addEventListener('input', () => markDirty('portfolio'));
    item.querySelector('.pc-show').addEventListener('change', () => markDirty('portfolio'));
    item.querySelector('.btn-move-up').addEventListener('click', () => {
      if (idx > 0) { syncPortfolioFromDom(); [portfolioCards[idx-1], portfolioCards[idx]] = [portfolioCards[idx], portfolioCards[idx-1]]; renderPortfolioList(); markDirty('portfolio'); }
    });
    item.querySelector('.btn-move-down').addEventListener('click', () => {
      if (idx < portfolioCards.length - 1) { syncPortfolioFromDom(); [portfolioCards[idx], portfolioCards[idx+1]] = [portfolioCards[idx+1], portfolioCards[idx]]; renderPortfolioList(); markDirty('portfolio'); }
    });
    item.querySelector('.btn-delete').addEventListener('click', () => {
      syncPortfolioFromDom(); portfolioCards.splice(idx, 1); renderPortfolioList(); markDirty('portfolio');
    });
    list.appendChild(item);
  }

  function renderPortfolioList() {
    const list = document.getElementById('portfolio-cards-list');
    list.innerHTML = '';
    portfolioCards.forEach((c, i) => renderPortfolioCardItem(list, c, i));
  }

  function syncPortfolioFromDom() {
    const items = document.querySelectorAll('#portfolio-cards-list .card-editor-item');
    portfolioCards = Array.from(items).map(item => ({
      name: item.querySelector('.pc-name').value,
      desc: item.querySelector('.pc-desc').value,
      show: item.querySelector('.pc-show').checked
    }));
  }

  function initPortfolioEditor() {
    const d = loadSection('portfolio');
    portfolioCards = (d.cards || []).map(c => ({ ...c }));
    setVal('portfolio-title',     d.title    || '');
    setVal('portfolio-subtitle',  d.subtitle || '');
    setVal('portfolio-demoBtn',   d.demoBtn  || '');
    setVal('portfolio-demoWaLink',d.demoWaLink || '');
    renderPortfolioList();
    watchInputs('portfolio', ['portfolio-title','portfolio-subtitle','portfolio-demoBtn','portfolio-demoWaLink']);
    document.getElementById('portfolio-save-btn').addEventListener('click', savePortfolioEditor);
    document.getElementById('portfolio-add-btn').addEventListener('click', () => {
      syncPortfolioFromDom();
      portfolioCards.push({ name: '', desc: '', show: true });
      renderPortfolioList();
      markDirty('portfolio');
      document.getElementById('portfolio-cards-list').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function savePortfolioEditor() {
    syncPortfolioFromDom();
    saveSection('portfolio', {
      title:       getVal('portfolio-title'),
      subtitle:    getVal('portfolio-subtitle'),
      cards:       portfolioCards,
      demoBtn:     getVal('portfolio-demoBtn'),
      demoWaLink:  getVal('portfolio-demoWaLink')
    });
    showToast('Portfolio saved ✓');
  }

  /* ============================================================
     UPSELLS EDITOR
     ============================================================ */

  let upsellAddons = [];

  function renderUpsellAddonItem(list, addon, idx) {
    const item = document.createElement('div');
    item.className = 'card-editor-item';
    item.dataset.idx = idx;
    item.innerHTML =
      '<div class="card-editor-header">' +
        '<span class="card-num">Addon ' + (idx + 1) + '</span>' +
        '<div class="card-actions">' +
          '<label class="toggle-label" title="Show/Hide" style="margin-right:4px;">' +
            '<input type="checkbox" class="ua-show"' + (addon.show !== false ? ' checked' : '') + ' />' +
            '<span style="font-size:12px;color:var(--muted);">Visible</span>' +
          '</label>' +
          '<button class="btn-icon btn-move-up" title="Move up">&#8593;</button>' +
          '<button class="btn-icon btn-move-down" title="Move down">&#8595;</button>' +
          '<button class="btn-icon btn-delete" title="Delete">&#10005;</button>' +
        '</div>' +
      '</div>' +
      '<div class="form-row two-col">' +
        '<div class="form-group">' +
          '<label>Icon Class <small>(e.g. bi bi-tools)</small></label>' +
          '<input type="text" class="ua-icon" value="' + escHtml(addon.icon || '') + '" placeholder="bi bi-tools" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Service Title</label>' +
          '<input type="text" class="ua-title" value="' + escHtml(addon.title || '') + '" placeholder="Service name" />' +
        '</div>' +
      '</div>';

    item.querySelector('.ua-icon').addEventListener('input', () => markDirty('upsell'));
    item.querySelector('.ua-title').addEventListener('input', () => markDirty('upsell'));
    item.querySelector('.ua-show').addEventListener('change', () => markDirty('upsell'));
    item.querySelector('.btn-move-up').addEventListener('click', () => {
      if (idx > 0) { syncUpsellFromDom(); [upsellAddons[idx-1], upsellAddons[idx]] = [upsellAddons[idx], upsellAddons[idx-1]]; renderUpsellList(); markDirty('upsell'); }
    });
    item.querySelector('.btn-move-down').addEventListener('click', () => {
      if (idx < upsellAddons.length - 1) { syncUpsellFromDom(); [upsellAddons[idx], upsellAddons[idx+1]] = [upsellAddons[idx+1], upsellAddons[idx]]; renderUpsellList(); markDirty('upsell'); }
    });
    item.querySelector('.btn-delete').addEventListener('click', () => {
      syncUpsellFromDom(); upsellAddons.splice(idx, 1); renderUpsellList(); markDirty('upsell');
    });
    list.appendChild(item);
  }

  function renderUpsellList() {
    const list = document.getElementById('upsell-addons-list');
    list.innerHTML = '';
    upsellAddons.forEach((a, i) => renderUpsellAddonItem(list, a, i));
  }

  function syncUpsellFromDom() {
    const items = document.querySelectorAll('#upsell-addons-list .card-editor-item');
    upsellAddons = Array.from(items).map(item => ({
      icon:  item.querySelector('.ua-icon').value,
      title: item.querySelector('.ua-title').value,
      show:  item.querySelector('.ua-show').checked
    }));
  }

  function initUpsellEditor() {
    const d = loadSection('upsell');
    upsellAddons = (d.addons || []).map(a => ({ ...a }));
    setVal('upsell-title',     d.title    || '');
    setVal('upsell-subtitle',  d.subtitle || '');
    setVal('upsell-btnText',   d.btnText  || '');
    setVal('upsell-btnWaLink', d.btnWaLink || '');
    renderUpsellList();
    watchInputs('upsell', ['upsell-title','upsell-subtitle','upsell-btnText','upsell-btnWaLink']);
    document.getElementById('upsell-save-btn').addEventListener('click', saveUpsellEditor);
    document.getElementById('upsell-add-btn').addEventListener('click', () => {
      syncUpsellFromDom();
      upsellAddons.push({ icon: 'bi bi-star', title: '', show: true });
      renderUpsellList();
      markDirty('upsell');
      document.getElementById('upsell-addons-list').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function saveUpsellEditor() {
    syncUpsellFromDom();
    saveSection('upsell', {
      title:      getVal('upsell-title'),
      subtitle:   getVal('upsell-subtitle'),
      addons:     upsellAddons,
      btnText:    getVal('upsell-btnText'),
      btnWaLink:  getVal('upsell-btnWaLink')
    });
    showToast('Upsells saved ✓');
  }

  /* ============================================================
     CONTACT EDITOR
     ============================================================ */

  function initContactEditor() {
    const d = loadSection('contact');
    setVal('contact-title',        d.title        || '');
    setVal('contact-subtitle',     d.subtitle     || '');
    setVal('contact-phone',        d.phone        || '');
    setVal('contact-waHref',       d.waHref       || '');
    setVal('contact-email',        d.email        || '');
    setVal('contact-location',     d.location     || '');
    setVal('contact-responseTime', d.responseTime || '');
    setVal('contact-formBtnText',  d.formBtnText  || '');
    watchInputs('contact', [
      'contact-title','contact-subtitle','contact-phone','contact-waHref',
      'contact-email','contact-location','contact-responseTime','contact-formBtnText'
    ]);
    document.getElementById('contact-save-btn').addEventListener('click', saveContactEditor);
  }

  function saveContactEditor() {
    saveSection('contact', {
      title:        getVal('contact-title'),
      subtitle:     getVal('contact-subtitle'),
      phone:        getVal('contact-phone'),
      waHref:       getVal('contact-waHref'),
      email:        getVal('contact-email'),
      emailHref:    'mailto:' + getVal('contact-email'),
      location:     getVal('contact-location'),
      responseTime: getVal('contact-responseTime'),
      formBtnText:  getVal('contact-formBtnText')
    });
    showToast('Contact saved ✓');
  }

  /* ============================================================
     FOOTER EDITOR
     ============================================================ */

  let footerQuickLinks   = [];
  let footerServiceLinks = [];

  function renderLinkRow(listEl, link, idx, type) {
    const row = document.createElement('div');
    row.className = 'feature-row';
    row.innerHTML = `
      <input type="text" class="fl-label" value="${escHtml(link.label)}" placeholder="Link label" style="flex:1.2;" />
      <input type="text" class="fl-anchor" value="${escHtml(link.anchor)}" placeholder="#section" style="flex:1;" />
      <button class="btn-icon btn-move-up" title="Move up">↑</button>
      <button class="btn-icon btn-move-down" title="Move down">↓</button>
      <button class="btn-icon btn-delete" title="Delete">✕</button>`;

    row.querySelector('.fl-label').addEventListener('input',  () => markDirty('footer'));
    row.querySelector('.fl-anchor').addEventListener('input', () => markDirty('footer'));
    row.querySelector('.btn-move-up').addEventListener('click', () => {
      if (idx > 0) {
        syncFooterFromDom();
        const arr = type === 'quick' ? footerQuickLinks : footerServiceLinks;
        [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
        renderFooterLists();
        markDirty('footer');
      }
    });
    row.querySelector('.btn-move-down').addEventListener('click', () => {
      const arr = type === 'quick' ? footerQuickLinks : footerServiceLinks;
      if (idx < arr.length - 1) {
        syncFooterFromDom();
        [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
        renderFooterLists();
        markDirty('footer');
      }
    });
    row.querySelector('.btn-delete').addEventListener('click', () => {
      syncFooterFromDom();
      const arr = type === 'quick' ? footerQuickLinks : footerServiceLinks;
      arr.splice(idx, 1);
      renderFooterLists();
      markDirty('footer');
    });
    listEl.appendChild(row);
  }

  function renderFooterLists() {
    const ql = document.getElementById('footer-quicklinks-list');
    const sl = document.getElementById('footer-servicelinks-list');
    ql.innerHTML = '';
    sl.innerHTML = '';
    footerQuickLinks.forEach((l, i)   => renderLinkRow(ql, l, i, 'quick'));
    footerServiceLinks.forEach((l, i) => renderLinkRow(sl, l, i, 'service'));
  }

  function syncFooterFromDom() {
    footerQuickLinks = Array.from(document.querySelectorAll('#footer-quicklinks-list .feature-row')).map(row => ({
      label:  row.querySelector('.fl-label').value,
      anchor: row.querySelector('.fl-anchor').value
    }));
    footerServiceLinks = Array.from(document.querySelectorAll('#footer-servicelinks-list .feature-row')).map(row => ({
      label:  row.querySelector('.fl-label').value,
      anchor: row.querySelector('.fl-anchor').value
    }));
  }

  function initFooterEditor() {
    const d = loadSection('footer');
    footerQuickLinks   = (d.quickLinks   || []).map(l => ({ ...l }));
    footerServiceLinks = (d.serviceLinks || []).map(l => ({ ...l }));

    setVal('footer-tagline',       d.tagline       || '');
    setVal('footer-company',       d.company       || '');
    setVal('footer-copyright',     d.copyright     || '');
    setVal('footer-supportEmail',  d.supportEmail  || '');
    setVal('footer-contactPhone',  d.contactPhone  || '');
    setVal('footer-contactEmail',  d.contactEmail  || '');
    setVal('footer-contactLocation', d.contactLocation || '');
    renderFooterLists();

    watchInputs('footer', [
      'footer-tagline','footer-company','footer-copyright','footer-supportEmail',
      'footer-contactPhone','footer-contactEmail','footer-contactLocation'
    ]);
    document.getElementById('footer-save-btn').addEventListener('click', saveFooterEditor);
    document.getElementById('footer-add-quick-btn').addEventListener('click', () => {
      syncFooterFromDom();
      footerQuickLinks.push({ label: '', anchor: '#' });
      renderFooterLists();
      markDirty('footer');
    });
    document.getElementById('footer-add-service-btn').addEventListener('click', () => {
      syncFooterFromDom();
      footerServiceLinks.push({ label: '', anchor: '#' });
      renderFooterLists();
      markDirty('footer');
    });
  }

  function saveFooterEditor() {
    syncFooterFromDom();
    const email = getVal('footer-supportEmail');
    saveSection('footer', {
      tagline:          getVal('footer-tagline'),
      company:          getVal('footer-company'),
      copyright:        getVal('footer-copyright'),
      supportEmail:     email,
      supportEmailHref: 'mailto:' + email,
      quickLinks:       footerQuickLinks,
      serviceLinks:     footerServiceLinks,
      contactPhone:     getVal('footer-contactPhone'),
      contactWaHref:    'https://wa.me/' + getVal('footer-contactPhone').replace(/\D/g,''),
      contactEmail:     getVal('footer-contactEmail'),
      contactEmailHref: 'mailto:' + getVal('footer-contactEmail'),
      contactLocation:  getVal('footer-contactLocation')
    });
    showToast('Footer saved ✓');
  }

  /* ============================================================
     INIT — check if already logged in
     ============================================================ */
  if (checkSession()) {
    showApp();
  }

})();
