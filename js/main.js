/* =====================================================
   YallaDJ Media — Nursery Landing Page
   main.js
   ===================================================== */

/* =====================================================
   CONTENT SCHEMA — Default values for all 12 sections
   ===================================================== */

const DEFAULTS = {
  hero: {
    badge: "UAE's Nursery Web Specialists",
    titlePrefix: "Professional Websites for",
    titleHighlight: "Nurseries & Kindergartens",
    subtitle: "Stand out, attract more enrolments, and build trust with parents — with a beautiful, fast, bilingual website built specifically for UAE nurseries.",
    btn1Text: "View Packages",
    btn1Link: "#packages",
    btn2Text: "WhatsApp Us",
    waLink: "https://wa.me/971544503515?text=Hi%20YallaDJ%20Media!%20I'm%20interested%20in%20a%20nursery%20website.",
    stat1Num: "7 Days",
    stat1Label: "Delivery",
    stat2Num: "EN + AR",
    stat2Label: "Bilingual",
    stat3Num: "AED 1,800",
    stat3Label: "Starting From"
  },
  pain: {
    title: 'Is Your Nursery <span class="lime-text">Missing Out?</span>',
    subtitle: "Most nurseries are losing enrolments daily because their online presence doesn't reflect the quality of care they provide.",
    cards: [
      { icon: "bi bi-x-circle-fill", title: "No Website at All", desc: "Parents search online first. Without a website, you don't exist to 80% of potential families.", show: true },
      { icon: "bi bi-phone-landscape-fill", title: "Not Mobile-Friendly", desc: "Parents browse on their phones. An outdated or desktop-only site drives them straight to a competitor.", show: true },
      { icon: "bi bi-translate", title: "English Only", desc: "UAE families speak Arabic. No Arabic version means you're invisible to half your market.", show: true },
      { icon: "bi bi-question-circle-fill", title: "Hard to Find on Google", desc: 'Without SEO, families searching "nursery near me in Dubai" will never discover your school.', show: true }
    ]
  },
  services: {
    title: 'What We <span class="lime-text">Build for You</span>',
    subtitle: "Two focused service tracks — whether you're starting from zero or upgrading what you have.",
    cards: [
      {
        icon: "bi bi-rocket-takeoff-fill",
        title: "New Nursery Website",
        desc: "We design and build your nursery's website from scratch — fast, beautiful, and built to win enrolments.",
        features: [
          "Custom design matching your brand & colors",
          "English + Arabic bilingual",
          "Mobile-first, responsive on all devices",
          "Enrolment inquiry form",
          "Google Maps integration",
          "WhatsApp click-to-chat button",
          "Fast loading (under 3 seconds)",
          "KHDA license display ready"
        ],
        btnText: "View Packages",
        btnLink: "#packages"
      },
      {
        icon: "bi bi-arrow-repeat",
        title: "Website Redesign",
        desc: "Have an old or outdated website? We modernize it — faster, better-looking, and fully optimized for 2025.",
        features: [
          "Complete visual overhaul",
          "Migration of existing content",
          "Speed & performance optimization",
          "Add missing Arabic version",
          "Mobile responsiveness fix",
          "SEO cleanup & improvements",
          "Modern contact & enrolment forms",
          "Social media links & feeds"
        ],
        btnText: "View Pricing",
        btnLink: "#packages"
      }
    ]
  },
  packages: {
    title: 'Simple, <span class="lime-text">Transparent Pricing</span>',
    subtitle: "All packages include a professional website delivered within 7 days. No hidden fees, no surprises.",
    cards: [
      {
        name: "Starter", price: "AED 2,500", priceSuffix: "one-time",
        desc: "Perfect for new nurseries getting their online presence off the ground quickly.",
        featured: false, ribbon: "",
        features: [
          { text: "Up to 5 pages", check: true },
          { text: "Mobile responsive", check: true },
          { text: "English + Arabic", check: true },
          { text: "Contact & inquiry form", check: true },
          { text: "Google Maps integration", check: true },
          { text: "WhatsApp button", check: true },
          { text: "Basic SEO setup", check: true },
          { text: "7-day delivery", check: true },
          { text: "30-day support", check: true },
          { text: "Photo/video section", check: false },
          { text: "Blog / news section", check: false },
          { text: "Online enrolment form", check: false }
        ],
        btnText: "Get Started", btnLink: "#contact", btnStyle: "outline", show: true
      },
      {
        name: "Growth", price: "AED 4,500", priceSuffix: "one-time",
        desc: "The full package — everything a growing nursery needs to attract and convert parents online.",
        featured: true, ribbon: "Most Popular",
        features: [
          { text: "Up to 10 pages", check: true },
          { text: "Mobile responsive", check: true },
          { text: "English + Arabic", check: true },
          { text: "Online enrolment form", check: true },
          { text: "Photo & video gallery", check: true },
          { text: "Blog / news section", check: true },
          { text: "WhatsApp + social links", check: true },
          { text: "Advanced SEO setup", check: true },
          { text: "Google Analytics connected", check: true },
          { text: "Speed optimization", check: true },
          { text: "7-day delivery", check: true },
          { text: "60-day support", check: true }
        ],
        btnText: "Get Started", btnLink: "#contact", btnStyle: "lime", show: true
      },
      {
        name: "Redesign", price: "from AED 1,800", priceSuffix: "",
        desc: "Have an existing website? We modernize it completely — faster, more beautiful, and conversion-optimized.",
        featured: false, ribbon: "",
        features: [
          { text: "Full visual overhaul", check: true },
          { text: "All existing content migrated", check: true },
          { text: "Mobile responsiveness", check: true },
          { text: "Add missing Arabic version", check: true },
          { text: "Speed & SEO improvements", check: true },
          { text: "Modern forms & WhatsApp", check: true },
          { text: "Price based on scope", check: true },
          { text: "Free consultation call", check: true },
          { text: "45-day support", check: true },
          { text: "Starting price — final quote after review", check: false },
          { text: "—", check: false },
          { text: "—", check: false }
        ],
        btnText: "Get a Quote",
        btnLink: "https://wa.me/971544503515?text=Hi%20YallaDJ%20Media!%20I%27d%20like%20a%20quote%20to%20redesign%20my%20nursery%20website.",
        btnStyle: "outline-wa", show: true
      }
    ]
  },
  process: {
    title: 'How It <span class="lime-text">Works</span>',
    subtitle: "From first message to live website — a simple, transparent process, designed around your busy schedule.",
    steps: [
      { title: "Discovery Call", desc: "We chat on WhatsApp or a call to understand your nursery, brand, and goals. Takes 20 minutes." },
      { title: "Design & Content", desc: "You send us your logo, photos, and text. We design a custom layout you'll love." },
      { title: "Review & Revisions", desc: "We show you a preview, collect your feedback, and make any final tweaks." },
      { title: "Go Live!", desc: "We launch your website, hand over full access, and stay available for 30–60 days of support." }
    ]
  },
  trust: {
    title: 'Why Nurseries <span class="lime-text">Choose Us</span>',
    subtitle: "We're not a generic web agency — we specialize in the UAE education sector.",
    cards: [
      { icon: "bi bi-flag-fill", title: "UAE-Based Team", desc: "We understand UAE parents, KHDA requirements, and local culture — built into every design.", show: true },
      { icon: "bi bi-translate", title: "True Bilingual", desc: "Not just Google Translate. Proper Arabic with RTL layout, written by native speakers.", show: true },
      { icon: "bi bi-lightning-charge-fill", title: "7-Day Delivery", desc: "Most projects go live in one week. No months of waiting, no excuses.", show: true },
      { icon: "bi bi-phone-fill", title: "Mobile-First Design", desc: "Every site looks stunning and loads fast on iPhones, Android, tablets, and desktops.", show: true },
      { icon: "bi bi-shield-check-fill", title: "Transparent Pricing", desc: "Fixed prices, no hidden fees. You know exactly what you're getting before you commit.", show: true },
      { icon: "bi bi-headset", title: "Ongoing Support", desc: "We don't disappear after launch. WhatsApp support available for updates, changes, and questions.", show: true }
    ]
  },
  portfolio: {
    title: 'Our <span class="lime-text">Portfolio</span>',
    subtitle: "See real nursery websites we've designed and launched across the UAE.",
    cards: [
      { name: "Little Stars Nursery", desc: "Sample website — live demo coming soon", show: true },
      { name: "Sunny Days Kindergarten", desc: "Sample website — live demo coming soon", show: true },
      { name: "Future Stars Academy", desc: "Sample website — live demo coming soon", show: true }
    ],
    demoBtn: "Request Live Demo",
    demoWaLink: "https://wa.me/971544503515?text=Hi%20YallaDJ%20Media!%20Can%20you%20show%20me%20some%20sample%20nursery%20websites?"
  },
  app: {
    show: false,
    badge: "Included with Growth Package",
    title: 'Manage Your <span class="lime-text">Nursery App</span>',
    subtitle: "A dedicated admin app included with the Growth package.",
    features: ["Real-time content updates", "Bilingual content control", "Push notifications", "Enrolment management"],
    infoText: "Included with Growth Package"
  },
  upsell: {
    title: 'Grow Even <span class="lime-text">More After Launch</span>',
    subtitle: "Supercharge your nursery's digital presence with our optional add-on services.",
    addons: [
      { icon: "bi bi-tools", title: "Monthly Website Maintenance", show: true },
      { icon: "bi bi-search", title: "SEO & Google Ranking", show: true },
      { icon: "bi bi-camera-fill", title: "Nursery Photography", show: true },
      { icon: "bi bi-camera-video-fill", title: "Promo Videos & Reels", show: true },
      { icon: "bi bi-google", title: "Google Business Setup", show: true },
      { icon: "bi bi-instagram", title: "Social Media Management", show: true },
      { icon: "bi bi-megaphone-fill", title: "Paid Ads (Google + Meta)", show: true }
    ],
    btnText: "Ask About Monthly Plans",
    btnWaLink: "https://wa.me/971544503515?text=Hi%20YallaDJ%20Media!%20I%27d%20like%20to%20know%20more%20about%20your%20monthly%20plans%20and%20add-ons."
  },
  contact: {
    title: 'Get a <span class="lime-text">Free Consultation</span>',
    subtitle: "Tell us about your nursery and we'll come back to you within 2 hours.",
    phone: "+971 54 450 3515",
    waHref: "https://wa.me/971544503515",
    email: "Support@yalladj.com",
    emailHref: "mailto:Support@yalladj.com",
    location: "UAE — Serving nurseries across all Emirates",
    responseTime: "Within 2 hours (Sat–Thu, 9am–9pm)",
    formBtnText: "Send Inquiry"
  },
  footer: {
    tagline: "Professional websites for UAE nurseries & kindergartens. Fast, bilingual, beautiful.",
    company: "A division of Yalladj FZE • UAE",
    copyright: "© 2025 YallaDJ Media — A division of Yalladj FZE. All rights reserved.",
    supportEmail: "Support@yalladj.com",
    supportEmailHref: "mailto:Support@yalladj.com",
    quickLinks: [
      { label: "Services", anchor: "#services" },
      { label: "Packages", anchor: "#packages" },
      { label: "How It Works", anchor: "#process" },
      { label: "Portfolio", anchor: "#portfolio" },
      { label: "Contact Us", anchor: "#contact" }
    ],
    serviceLinks: [
      { label: "New Nursery Website", anchor: "#services" },
      { label: "Website Redesign", anchor: "#services" },
      { label: "Monthly Maintenance", anchor: "#upsell" },
      { label: "SEO & Google Ranking", anchor: "#upsell" },
      { label: "Social Media Management", anchor: "#upsell" }
    ],
    contactPhone: "+971 54 450 3515",
    contactWaHref: "https://wa.me/971544503515",
    contactEmail: "Support@yalladj.com",
    contactEmailHref: "mailto:Support@yalladj.com",
    contactLocation: "UAE — All Emirates"
  },
  settings: {
    siteTitle: "YallaDJ Media — Professional Websites for Nurseries & Kindergartens",
    floatingWaShow: true,
    floatingWaLink: "https://wa.me/971544503515?text=Hi%20YallaDJ%20Media!%20I'm%20interested%20in%20a%20website%20for%20my%20nursery.",
    backToTop: true,
    aos: true,
    adminPassword: "yalladj2026"
  }
};

/* =====================================================
   CONTENT LOADER — reads localStorage → applies to DOM
   Call BEFORE AOS.init so animations work on new elements
   ===================================================== */

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getVal(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function loadContent() {
  const keys = ['hero', 'pain', 'services', 'packages', 'process', 'trust', 'portfolio', 'app', 'upsell', 'contact', 'footer', 'settings'];
  const D = {};
  keys.forEach(k => {
    try {
      const s = localStorage.getItem('yalladj_' + k);
      D[k] = s ? JSON.parse(s) : DEFAULTS[k];
    } catch (e) {
      D[k] = DEFAULTS[k];
    }
  });

  // Plain text content
  document.querySelectorAll('[data-key]').forEach(el => {
    const val = getVal(D, el.getAttribute('data-key'));
    if (typeof val === 'string') el.textContent = val;
  });

  // HTML content (for titles with <span> highlights)
  document.querySelectorAll('[data-html-key]').forEach(el => {
    const val = getVal(D, el.getAttribute('data-html-key'));
    if (typeof val === 'string') el.innerHTML = val;
  });

  // Href attributes
  document.querySelectorAll('[data-href-key]').forEach(el => {
    const val = getVal(D, el.getAttribute('data-href-key'));
    if (typeof val === 'string') el.setAttribute('href', val);
  });

  // Dynamic list sections
  renderPainCards(D.pain);
  renderServiceCards(D.services);
  renderPackageCards(D.packages);
  renderProcessSteps(D.process);
  renderTrustCards(D.trust);
  renderPortfolioCards(D.portfolio);
  renderAppShowcase(D.app);
  renderUpsellAddons(D.upsell);
  renderFooterLinks(D.footer);

  // Page title
  if (D.settings && D.settings.siteTitle) {
    document.title = D.settings.siteTitle;
  }

  // Floating WA button
  const fab = document.querySelector('.whatsapp-fab');
  if (fab && D.settings) {
    fab.style.display = D.settings.floatingWaShow === false ? 'none' : '';
    if (D.settings.floatingWaLink) fab.setAttribute('href', D.settings.floatingWaLink);
  }

  // Back to top button
  const btt = document.querySelector('.back-to-top');
  if (btt && D.settings) {
    btt.style.display = D.settings.backToTop === false ? 'none' : '';
  }
}

function renderPainCards(data) {
  const c = document.getElementById('pain-cards');
  if (!c || !data || !data.cards) return;
  const visible = data.cards.filter(x => x.show !== false);
  const delays = [0, 80, 160, 240];
  c.innerHTML = visible.map((x, i) => `
    <div class="col-sm-6 col-lg-3" data-aos="fade-up" data-aos-delay="${delays[i] !== undefined ? delays[i] : i * 80}">
      <div class="pain-card">
        <div class="pain-icon"><i class="${escHtml(x.icon)}"></i></div>
        <h4>${escHtml(x.title)}</h4>
        <p>${escHtml(x.desc)}</p>
      </div>
    </div>`).join('');
}

function renderServiceCards(data) {
  const c = document.getElementById('services-cards');
  if (!c || !data || !data.cards) return;
  const delays = [0, 100];
  c.innerHTML = data.cards.map((x, i) => `
    <div class="col-md-6 col-lg-5" data-aos="fade-up" data-aos-delay="${delays[i] || 0}">
      <div class="service-card">
        <div class="service-icon"><i class="${escHtml(x.icon)}"></i></div>
        <h3>${escHtml(x.title)}</h3>
        <p>${escHtml(x.desc)}</p>
        <ul class="service-features">
          ${(x.features || []).map(f => `<li><i class="bi bi-check-circle-fill"></i> ${escHtml(f)}</li>`).join('')}
        </ul>
        <a href="${escHtml(x.btnLink)}" class="btn-lime mt-auto">${escHtml(x.btnText)}</a>
      </div>
    </div>`).join('');
}

function renderPackageCards(data) {
  const c = document.getElementById('packages-cards');
  if (!c || !data || !data.cards) return;
  const delays = [0, 100, 200];
  const visible = data.cards.filter(x => x.show !== false);
  c.innerHTML = visible.map((x, i) => {
    let btn = '';
    if (x.btnStyle === 'lime') {
      btn = `<a href="${escHtml(x.btnLink)}" class="btn-lime w-100 justify-content-center">${escHtml(x.btnText)}</a>`;
    } else if (x.btnStyle === 'outline-wa') {
      btn = `<a href="${escHtml(x.btnLink)}" target="_blank" rel="noopener" class="btn-outline w-100 justify-content-center"><i class="bi bi-whatsapp"></i> ${escHtml(x.btnText)}</a>`;
    } else {
      btn = `<a href="${escHtml(x.btnLink)}" class="btn-outline w-100 justify-content-center">${escHtml(x.btnText)}</a>`;
    }
    return `
      <div class="col-md-4" data-aos="fade-up" data-aos-delay="${delays[i] || 0}">
        <div class="pricing-card${x.featured ? ' featured' : ''}">
          ${x.ribbon ? `<div class="popular-ribbon">${escHtml(x.ribbon)}</div>` : ''}
          <div class="plan-name">${escHtml(x.name)}</div>
          <div class="plan-price">${escHtml(x.price)} <span>${escHtml(x.priceSuffix)}</span></div>
          <p class="plan-desc">${escHtml(x.desc)}</p>
          <ul class="plan-features">
            ${(x.features || []).map(f => `<li><i class="${f.check ? 'bi bi-check-circle-fill' : 'bi bi-x-lg'}"></i> ${escHtml(f.text)}</li>`).join('')}
          </ul>
          ${btn}
        </div>
      </div>`;
  }).join('');
}

function renderProcessSteps(data) {
  const c = document.getElementById('process-steps');
  if (!c || !data || !data.steps) return;
  const delays = [0, 100, 200, 300];
  c.innerHTML = '<div class="process-line d-none d-lg-block"></div>' +
    data.steps.map((x, i) => `
      <div class="col-6 col-lg-3" data-aos="fade-up" data-aos-delay="${delays[i] || 0}">
        <div class="process-step">
          <div class="step-num">${i + 1}</div>
          <h4>${escHtml(x.title)}</h4>
          <p style="color:var(--gray); font-size:0.88rem;">${escHtml(x.desc)}</p>
        </div>
      </div>`).join('');
}

function renderTrustCards(data) {
  const c = document.getElementById('trust-cards');
  if (!c || !data || !data.cards) return;
  const visible = data.cards.filter(x => x.show !== false);
  const delays = [0, 60, 120, 180, 240, 300];
  c.innerHTML = visible.map((x, i) => `
    <div class="col-sm-6 col-lg-4" data-aos="fade-up" data-aos-delay="${delays[i] || 0}">
      <div class="trust-card">
        <div class="trust-icon"><i class="${escHtml(x.icon)}"></i></div>
        <h5>${escHtml(x.title)}</h5>
        <p>${escHtml(x.desc)}</p>
      </div>
    </div>`).join('');
}

function renderPortfolioCards(data) {
  const c = document.getElementById('portfolio-cards');
  if (!c || !data || !data.cards) return;
  const visible = data.cards.filter(x => x.show !== false);
  c.innerHTML = visible.map(x => `
    <div class="col-md-4">
      <div class="portfolio-placeholder">
        <i class="bi bi-image"></i>
        <p style="font-size:1rem; font-weight:600; margin-bottom:6px;">${escHtml(x.name)}</p>
        <p style="font-size:0.85rem; color:rgba(255,255,255,0.4);">${escHtml(x.desc)}</p>
      </div>
    </div>`).join('');

  // Demo button
  const demoWrap = document.getElementById('portfolio-demo-btn');
  if (demoWrap && data.demoBtn) {
    const a = demoWrap.querySelector('a');
    if (a) {
      a.innerHTML = `<i class="bi bi-whatsapp"></i> ${escHtml(data.demoBtn)}`;
      if (data.demoWaLink) a.setAttribute('href', data.demoWaLink);
    }
  }
}

function renderAppShowcase(data) {
  const section = document.getElementById('app-showcase');
  if (!section || !data) return;

  // Show/hide the whole section
  section.style.display = data.show === true ? '' : 'none';

  // Render features list
  const featList = document.getElementById('app-features');
  if (featList && Array.isArray(data.features)) {
    featList.innerHTML = data.features.map(f => `<li>${escHtml(f)}</li>`).join('');
  }
}

function renderUpsellAddons(data) {
  const c = document.getElementById('upsell-addons');
  if (!c || !data || !data.addons) return;
  const visible = data.addons.filter(x => x.show !== false);
  c.innerHTML = visible.map(x => `
    <div class="addon-item">
      <i class="${escHtml(x.icon)}"></i>
      <p>${escHtml(x.title)}</p>
    </div>`).join('');

  // Upsell CTA button
  const btn = document.getElementById('upsell-btn');
  if (btn && data.btnText) {
    btn.innerHTML = `<i class="bi bi-whatsapp"></i> ${escHtml(data.btnText)}`;
    if (data.btnWaLink) btn.setAttribute('href', data.btnWaLink);
  }
}

function renderFooterLinks(data) {
  const ql = document.getElementById('footer-quick-links');
  if (ql && data && data.quickLinks) {
    ql.innerHTML = data.quickLinks.map(l => `<li><a href="${escHtml(l.anchor)}">${escHtml(l.label)}</a></li>`).join('');
  }
  const sl = document.getElementById('footer-service-links');
  if (sl && data && data.serviceLinks) {
    sl.innerHTML = data.serviceLinks.map(l => `<li><a href="${escHtml(l.anchor)}">${escHtml(l.label)}</a></li>`).join('');
  }
}

/* =====================================================
   MAIN — DOMContentLoaded
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* --- Load dynamic content FIRST (before AOS) --- */
  loadContent();

  /* --- Sticky Navbar --- */
  const navbar = document.getElementById('navbar');
  const scrollThreshold = 50;

  window.addEventListener('scroll', () => {
    if (window.scrollY > scrollThreshold) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    // Back to top visibility
    const backToTop = document.querySelector('.back-to-top');
    if (backToTop) {
      if (window.scrollY > 400) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }
  });

  /* --- Smooth Scroll for Nav Links --- */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();

      const navbarHeight = navbar.offsetHeight;
      const targetPos = target.getBoundingClientRect().top + window.scrollY - navbarHeight - 10;

      window.scrollTo({ top: targetPos, behavior: 'smooth' });

      // Close mobile menu if open
      const navCollapse = document.getElementById('navbarNav');
      if (navCollapse && navCollapse.classList.contains('show')) {
        const toggler = document.querySelector('.navbar-toggler');
        if (toggler) toggler.click();
      }
    });
  });

  /* --- Active Nav Link on Scroll --- */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.navbar-nav .nav-link');

  const observerOptions = {
    rootMargin: '-40% 0px -55% 0px'
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${entry.target.id}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach(section => sectionObserver.observe(section));

  /* --- Back to Top --- */
  const backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* --- AOS Init --- */
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 700,
      easing: 'ease-out-quad',
      once: true,
      offset: 60
    });
  }

  /* --- Contact Form Validation --- */
  const contactForm = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');

  if (contactForm) {
    contactForm.addEventListener('submit', e => {
      e.preventDefault();
      let valid = true;

      // Clear previous errors
      contactForm.querySelectorAll('.form-control, .form-select').forEach(el => {
        el.classList.remove('is-invalid');
      });

      // Required fields
      const required = contactForm.querySelectorAll('[required]');
      required.forEach(field => {
        if (!field.value.trim()) {
          field.classList.add('is-invalid');
          valid = false;
        }
      });

      // Email validation
      const emailField = contactForm.querySelector('#email');
      if (emailField && emailField.value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailField.value.trim())) {
          emailField.classList.add('is-invalid');
          valid = false;
        }
      }

      // UAE Phone validation (optional but if filled, validate)
      const phoneField = contactForm.querySelector('#phone');
      if (phoneField && phoneField.value.trim()) {
        const phoneRegex = /^(\+971|00971|0)?[0-9\s\-]{7,12}$/;
        if (!phoneRegex.test(phoneField.value.replace(/\s/g, ''))) {
          phoneField.classList.add('is-invalid');
          valid = false;
        }
      }

      if (!valid) return;

      // Build payload
      const payload = {
        name: contactForm.querySelector('#name').value.trim(),
        nursery: contactForm.querySelector('#nursery').value.trim(),
        phone: phoneField ? phoneField.value.trim() : '',
        email: emailField ? emailField.value.trim() : '',
        package: contactForm.querySelector('#package').value,
        message: contactForm.querySelector('#message').value.trim(),
        timestamp: new Date().toISOString()
      };

      console.log('Inquiry submitted:', payload);

      // Show success state
      contactForm.style.display = 'none';
      if (formSuccess) {
        formSuccess.style.display = 'block';
      }

      // Also trigger mailto as fallback
      const subject = encodeURIComponent(`Website Inquiry — ${payload.name} (${payload.nursery})`);
      const body = encodeURIComponent(
        `Name: ${payload.name}\nNursery: ${payload.nursery}\nPhone: ${payload.phone}\nEmail: ${payload.email}\nPackage: ${payload.package}\n\nMessage:\n${payload.message}`
      );
      setTimeout(() => {
        window.location.href = `mailto:Support@yalladj.com?subject=${subject}&body=${body}`;
      }, 800);
    });
  }

  /* --- WhatsApp Links --- */
  const waBase = 'https://wa.me/971544503515?text=';
  const waDefaultMsg = encodeURIComponent('Hi YallaDJ Media! I\'m interested in a website for my nursery. Can you share more details?');

  document.querySelectorAll('[data-wa]').forEach(el => {
    const msg = el.getAttribute('data-wa') || waDefaultMsg;
    el.href = waBase + (msg === 'default' ? waDefaultMsg : encodeURIComponent(msg));
  });

});
