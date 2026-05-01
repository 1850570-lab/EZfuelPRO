// EZ FUEL — global UI behaviors

(function () {
  // ----- Theme (dark default, persisted) -----
  const root = document.documentElement;
  const THEME_KEY = 'ezfuel-theme';
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light') root.classList.add('light');

  function bindThemeToggle() {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        root.classList.toggle('light');
        const mode = root.classList.contains('light') ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, mode);
        updateThemeIcons();
      });
    });
    updateThemeIcons();
  }
  function updateThemeIcons() {
    const isLight = root.classList.contains('light');
    document.querySelectorAll('[data-theme-icon-dark]').forEach(el => el.classList.toggle('hidden', isLight));
    document.querySelectorAll('[data-theme-icon-light]').forEach(el => el.classList.toggle('hidden', !isLight));
  }

  // ----- Resources dropdown (desktop nav) -----
  function bindNavDropdown() {
    const dropdowns = document.querySelectorAll('[data-nav-dropdown]');
    if (!dropdowns.length) return;

    function closeAll() {
      document.querySelectorAll('[data-nav-dropdown-menu]').forEach(m => m.classList.add('hidden'));
      document.querySelectorAll('[data-nav-dropdown-chevron]').forEach(c => c.style.transform = '');
      document.querySelectorAll('[data-nav-dropdown-toggle]').forEach(t => t.setAttribute('aria-expanded', 'false'));
    }

    dropdowns.forEach(dropdown => {
      const toggle = dropdown.querySelector('[data-nav-dropdown-toggle]');
      const menu = dropdown.querySelector('[data-nav-dropdown-menu]');
      const chevron = dropdown.querySelector('[data-nav-dropdown-chevron]');
      if (!toggle || !menu) return;

      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = !menu.classList.contains('hidden');
        closeAll();
        if (!isOpen) {
          menu.classList.remove('hidden');
          if (chevron) chevron.style.transform = 'rotate(180deg)';
          toggle.setAttribute('aria-expanded', 'true');
        }
      });
    });

    // Click outside closes all
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-nav-dropdown]')) closeAll();
    });

    // Escape closes all
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });
  }

  // ----- Mobile nav -----
  function bindMobileNav() {
    const btn = document.querySelector('[data-mobile-nav-toggle]');
    const panel = document.querySelector('[data-mobile-nav]');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      panel.classList.toggle('hidden');
    });
  }

  // ----- Reveal on scroll -----
  function bindReveal() {
    const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-rotate, .reveal-pop, .reveal-up-big');
    if (!('IntersectionObserver' in window) || !els.length) {
      els.forEach(e => e.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(e => io.observe(e));
  }

  // ----- Scroll progress bar + parallax -----
  function bindScrollFX() {
    const bar = document.querySelector('[data-scroll-progress]');
    const sphere = document.querySelector('[data-parallax-sphere]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!bar && (!sphere || reduced)) return;

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (bar) {
          const h = document.documentElement.scrollHeight - window.innerHeight;
          const p = h > 0 ? Math.min(100, (y / h) * 100) : 0;
          bar.style.width = p + '%';
        }
        if (sphere && !reduced) {
          // subtle parallax: sphere drifts up and rotates slowly as we scroll
          sphere.style.transform = `translateY(${(-y * 0.15).toFixed(1)}px) rotate(${(y * 0.04).toFixed(2)}deg)`;
        }
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ----- Animated number counters -----
  function bindCounters() {
    const els = document.querySelectorAll('[data-counter]');
    if (!els.length) return;

    function format(val, el) {
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const suffix = el.dataset.suffix || '';
      const fmt = el.dataset.format;
      let num = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString();
      if (fmt === 'comma') {
        num = Math.round(val).toLocaleString('en-US');
      }
      return num + suffix;
    }

    function animate(el) {
      const to = parseFloat(el.dataset.to);
      const duration = parseInt(el.dataset.duration || '1600', 10);
      const start = performance.now();
      function step(now) {
        const t = Math.min(1, (now - start) / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = format(to * eased, el);
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = format(to, el);
      }
      requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
      els.forEach(animate);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          animate(en.target);
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.4 });
    els.forEach(el => { el.textContent = format(0, el); io.observe(el); });
  }

  // ----- Interactive card tilt (follows the mouse) -----
  function bindCardTilt() {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    document.querySelectorAll('[data-tilt]').forEach(card => {
      const wrap = card.closest('.card-tilt-wrap') || card.parentElement;
      // max tilt angles in degrees
      const MAX_X = 14;
      const MAX_Y = 18;
      let rafId = null;
      let targetRX = 0, targetRY = 0, targetLift = 0;
      let curRX = 0, curRY = 0, curLift = 0;
      let active = false;

      function render() {
        // ease current values toward targets for a silky follow
        curRX += (targetRX - curRX) * 0.18;
        curRY += (targetRY - curRY) * 0.18;
        curLift += (targetLift - curLift) * 0.18;
        card.style.transform = `perspective(900px) rotateX(${curRX.toFixed(2)}deg) rotateY(${curRY.toFixed(2)}deg) translateY(${curLift.toFixed(2)}px) scale(${active ? 1.03 : 1})`;
        const still =
          Math.abs(curRX - targetRX) < 0.05 &&
          Math.abs(curRY - targetRY) < 0.05 &&
          Math.abs(curLift - targetLift) < 0.1;
        if (!still || active) {
          rafId = requestAnimationFrame(render);
        } else {
          rafId = null;
          if (!active) {
            // fully settled — clear inline so the idle float animation resumes cleanly
            card.style.transform = '';
          }
        }
      }
      function kick() { if (rafId == null) rafId = requestAnimationFrame(render); }

      function onMove(e) {
        const r = wrap.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;   // 0..1
        const py = (e.clientY - r.top) / r.height;   // 0..1
        // invert Y for natural feel: mouse up -> card tilts back
        targetRY = (px - 0.5) * 2 * MAX_Y;
        targetRX = -(py - 0.5) * 2 * MAX_X;
        targetLift = -8;
        kick();
      }
      function onEnter() {
        active = true;
        wrap.classList.add('is-tilting');
        kick();
      }
      function onLeave() {
        active = false;
        targetRX = 0; targetRY = 0; targetLift = 0;
        // after settle, remove the tilting class so idle float animation resumes
        setTimeout(() => {
          if (!active) wrap.classList.remove('is-tilting');
        }, 500);
        kick();
      }

      wrap.addEventListener('mouseenter', onEnter);
      wrap.addEventListener('mousemove', onMove);
      wrap.addEventListener('mouseleave', onLeave);
    });
  }

  // ----- Click-to-flip card -----
  function bindCardFlip() {
    document.querySelectorAll('[data-card-flip]').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't flip when clicking links/buttons inside the card.
        if (e.target.closest('a, button')) return;
        card.classList.toggle('is-flipped');
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.classList.toggle('is-flipped');
        }
      });
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Flip fuel card to see the back');
    });
  }

  // ----- Magnetic button hover -----
  function bindMagnetic() {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    document.querySelectorAll('.btn-primary').forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px) translateY(-2px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  // ----- Testimonial carousel -----
  function bindCarousel() {
    const root = document.querySelector('[data-carousel]');
    if (!root) return;
    const track = root.querySelector('.carousel-track');
    const slides = track.children.length;
    let idx = 0;
    function go(i) {
      idx = (i + slides) % slides;
      track.style.transform = `translateX(-${idx * 100}%)`;
      root.querySelectorAll('[data-carousel-dot]').forEach((d, di) => {
        d.classList.toggle('bg-pink-500', di === idx);
        d.classList.toggle('bg-white/20', di !== idx);
      });
    }
    root.querySelector('[data-carousel-prev]')?.addEventListener('click', () => go(idx - 1));
    root.querySelector('[data-carousel-next]')?.addEventListener('click', () => go(idx + 1));
    root.querySelectorAll('[data-carousel-dot]').forEach((d, di) =>
      d.addEventListener('click', () => go(di))
    );
    setInterval(() => go(idx + 1), 7000);
    go(0);
  }

  // ----- Form stub -----
  function bindApplyForm() {
    document.querySelectorAll('[data-apply-form]').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const status = form.querySelector('[data-form-status]');
        if (status) {
          status.textContent = "Thanks — we received your application. An EZ FUEL account specialist will reach out within one business day.";
          status.classList.remove('hidden');
        }
        form.reset();
      });
    });
  }

  // ----- Year stamp -----
  function stampYear() {
    document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  }

  // ----- Mark active nav link -----
  function markActiveNav() {
    const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('[data-nav-link]').forEach(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      if (href === path || (path === '' && href === 'index.html')) {
        a.classList.add('text-pink-500');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Always-on (needed on every page)
    bindThemeToggle();
    bindMobileNav();
    bindNavDropdown();
    bindCarousel();
    bindApplyForm();
    stampYear();
    markActiveNav();
    // Card tilt is opt-in per [data-tilt] element, so we bind it everywhere
    // — any page that has a fuel-card hero gets the mouse-follow 3D effect.
    bindCardTilt();
    bindCardFlip();

    // Broader animation layer — homepage only. Static pages opt out via body.static-page.
    const isStatic = document.body.classList.contains('static-page');
    if (!isStatic) {
      bindReveal();
      bindCounters();
      bindMagnetic();
      bindScrollFX();
    }

    if (window.lucide) window.lucide.createIcons();
  });
})();
