// Shared behaviour for every page: theme toggle, header, menu, video player,
// the film drawer, the showreel dialog and the general scroll motion.
// Page scripts (home.js, films.js, gallery.js, ...) use the helpers on window.SBDUI.

(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasGsap = typeof window.gsap !== 'undefined';
  const motionOk = () => hasGsap && !reduceMotion.matches;

  // ---------- icons (arrows are thick and only used for prev/next) ----------
  const ICONS = {
    play: '<svg class="icon i-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause: '<svg class="icon i-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
    muted:
      '<svg class="icon i-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="m16 9.5 5 5m0-5-5 5"/></svg>',
    sound:
      '<svg class="icon i-sound" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>',
    next: '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    prev: '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  };

  // ---------- theme (light / dark, remembered on this device) ----------
  const toggles = document.querySelectorAll('[data-theme-toggle]');
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    toggles.forEach((t) => {
      t.setAttribute('aria-pressed', String(theme === 'dark'));
      t.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  };
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
  toggles.forEach((t) =>
    t.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem('sbd-theme', next);
      } catch {
        /* storage blocked: the choice lasts for this page only */
      }
    }),
  );

  // ---------- header: solid after scrolling, hides while scrolling down ----------
  const header = document.querySelector('.site-header');
  if (header) {
    let lastY = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      header.classList.toggle('is-solid', y > 40);
      const hide = !document.body.classList.contains('menu-open') && y > 500 && y > lastY + 2;
      if (hide) header.classList.add('is-hidden');
      else if (y < lastY - 2 || y < 500) header.classList.remove('is-hidden');
      lastY = y;
      ticking = false;
    };
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true },
    );
    header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
    update();
  }

  // ---------- mobile menu ----------
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('menu');
  if (toggle && menu) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('.menu-label').textContent = open ? 'Close' : 'Menu';
      menu.hidden = !open;
      document.body.classList.toggle('menu-open', open);
      if (open) {
        menu.querySelector('a')?.focus();
        if (motionOk()) {
          gsap.from(menu.querySelectorAll('.menu-links li'), { y: 40, autoAlpha: 0, duration: 0.7, stagger: 0.05, ease: 'expo.out' });
        }
      }
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 1001px)').addEventListener('change', (e) => e.matches && setOpen(false));
  }

  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

  // ---------- video player ----------
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  const clock = (s) => (Number.isFinite(s) ? `${pad(s / 60)}:${pad(s % 60)}` : '00:00');

  function mountPlayer(fig) {
    if (!fig || fig.dataset.mounted) return null;
    fig.dataset.mounted = 'true';
    const video = fig.querySelector('video');
    const frame = fig.querySelector('.frame');
    const label = fig.dataset.label || 'film';

    const ui = document.createElement('div');
    ui.className = 'player-ui';
    ui.innerHTML = `
      <button type="button" class="icon-btn player-toggle" aria-label="Play ${label}">${ICONS.play}${ICONS.pause}</button>
      <span class="player-time"><span class="player-current">00:00</span><span class="player-total"></span></span>
      <input type="range" class="player-scrub" min="0" max="1000" value="0" step="1" aria-label="Seek ${label}">
      <button type="button" class="icon-btn player-mute" aria-label="Turn sound on">${ICONS.muted}${ICONS.sound}</button>`;
    const err = document.createElement('div');
    err.className = 'player-error';
    err.textContent = 'This clip could not load. Check your connection and refresh.';
    frame.append(err);
    fig.append(ui);

    const btn = ui.querySelector('.player-toggle');
    const mute = ui.querySelector('.player-mute');
    const scrub = ui.querySelector('.player-scrub');
    const current = ui.querySelector('.player-current');
    const total = ui.querySelector('.player-total');
    let seeking = false;

    const sync = () => {
      const playing = !video.paused && !video.ended;
      fig.classList.toggle('is-playing', playing);
      btn.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${label}`);
    };
    const progress = () => {
      if (!video.duration) return;
      current.textContent = clock(video.currentTime);
      if (!seeking) scrub.value = String(Math.round((video.currentTime / video.duration) * 1000));
      scrub.style.setProperty('--p', `${(video.currentTime / video.duration) * 100}%`);
    };
    const play = () => video.play().catch(() => sync());
    const togglePlay = () => (video.paused ? play() : video.pause());

    btn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);
    ['play', 'pause', 'ended'].forEach((ev) => video.addEventListener(ev, sync));
    video.addEventListener('timeupdate', progress);
    const showTotal = () => (total.textContent = ` / ${clock(video.duration)}`);
    video.addEventListener('loadedmetadata', showTotal);
    if (video.readyState >= 1) showTotal();
    const fail = () => fig.classList.add('is-error');
    video.addEventListener('error', fail);
    video.querySelectorAll('source').forEach((s) => s.addEventListener('error', fail));

    const setMuted = (m) => {
      video.muted = m;
      fig.classList.toggle('is-unmuted', !m);
      mute.setAttribute('aria-label', m ? 'Turn sound on' : 'Turn sound off');
    };
    mute.addEventListener('click', () => setMuted(!video.muted));
    scrub.addEventListener('input', () => {
      seeking = true;
      if (video.duration) video.currentTime = (Number(scrub.value) / 1000) * video.duration;
      progress();
    });
    scrub.addEventListener('change', () => (seeking = false));
    sync();
    return { video, play, setMuted };
  }

  function playerHTML({ src, poster, label, ratio = 'film' }) {
    return `<figure class="player" data-label="${label}">
      <div class="frame ratio-${ratio}">
        <video playsinline muted loop preload="metadata" poster="${poster}"><source src="${src}" type="video/mp4"></video>
      </div>
    </figure>`;
  }

  // Muted background loops (hero, previews) play only while on screen.
  function ambient(video) {
    if (reduceMotion.matches) return;
    video.muted = true;
    new IntersectionObserver(([e]) => (e.isIntersecting ? video.play().catch(() => {}) : video.pause())).observe(video);
  }
  document.querySelectorAll('video[data-ambient]').forEach(ambient);

  // ---------- dialogs: shared open/close with a short transition ----------
  function openDialog(dialog, from = { autoAlpha: 0 }) {
    dialog.showModal();
    root.style.overflow = 'hidden';
    if (motionOk()) gsap.fromTo(dialog, from, { autoAlpha: 1, xPercent: 0, duration: 0.6, ease: 'expo.out' });
  }
  function closeDialog(dialog, to = { autoAlpha: 0 }) {
    if (!dialog?.open) return;
    dialog.querySelectorAll('video').forEach((v) => v.pause());
    const done = () => {
      dialog.close();
      root.style.overflow = '';
      window.gsap?.set(dialog, { clearProps: 'all' });
    };
    if (motionOk()) gsap.to(dialog, { ...to, duration: 0.4, ease: 'power3.in', onComplete: done });
    else done();
  }

  // ---------- showreel dialog ("Play reel") ----------
  let reel;
  function openReel() {
    if (!reel) {
      reel = document.createElement('dialog');
      reel.className = 'reel-dialog';
      reel.setAttribute('aria-label', 'Showreel');
      reel.innerHTML = `<div class="reel-inner">
          <div class="reel-top"><span class="label" style="color:inherit">Showreel</span>
          <button type="button" class="btn btn-line btn-sm" data-close>Close</button></div>
          <div class="reel-stage">${playerHTML({ src: '/media/films/reel.mp4', poster: '/media/films/reel.jpg', label: 'showreel' })}</div>
        </div>`;
      document.body.append(reel);
      reel.addEventListener('click', (e) => e.target.closest('[data-close]') && closeDialog(reel));
      reel.addEventListener('cancel', (e) => {
        e.preventDefault();
        closeDialog(reel);
      });
      reel.player = mountPlayer(reel.querySelector('.player'));
    }
    openDialog(reel);
    reel.player.setMuted(false);
    reel.player.video.currentTime = 0;
    reel.player.play();
    reel.querySelector('[data-close]').focus();
  }
  document.querySelectorAll('[data-play-reel]').forEach((b) => b.addEventListener('click', openReel));

  // ---------- film drawer ----------
  let drawer;
  let drawerIndex = 0;

  function renderFilm(index) {
    const films = window.SBD.films;
    drawerIndex = (index + films.length) % films.length;
    const f = films[drawerIndex];
    drawer.innerHTML = `
      <div class="screening-head">
        <span class="small dim num">${drawerIndex + 1} of ${films.length}</span>
        <button type="button" class="btn btn-line btn-sm" data-close>Close</button>
      </div>
      <div class="screening-body">
        ${playerHTML({ src: f.video, poster: f.poster, label: f.title })}
        <div>
          <p class="small dim">${f.type} · ${f.location} · ${f.year}</p>
          <h2 class="h1 screening-title" id="screening-title">${f.title}</h2>
        </div>
        <p class="lede" style="max-width:none">${f.logline}</p>
        <dl class="facts">
          <div><dt class="label">Our role</dt><dd>${f.role}</dd></div>
          <div><dt class="label">Running time</dt><dd class="num">${f.runtime}</dd></div>
        </dl>
        <div>
          <h3 class="label" style="margin-bottom:.75rem">What the client received</h3>
          <ul class="delivered">${f.deliverables.map((d) => `<li>${d}</li>`).join('')}</ul>
        </div>
        <div class="mini-strip">${f.stills
          .map((s) => `<div class="frame ratio-port"><img src="${s}" alt="" loading="lazy"></div>`)
          .join('')}</div>
        <div class="actions">
          <a class="btn" href="/html/book.html">Book a date</a>
          <button type="button" class="text-btn" data-step="-1">Previous film</button>
          <button type="button" class="text-btn" data-step="1">Next film</button>
        </div>
      </div>`;
    drawer.scrollTop = 0;
    mountPlayer(drawer.querySelector('.player'));
  }

  function openFilm(id) {
    if (!window.SBD) return;
    if (!drawer) {
      drawer = document.createElement('dialog');
      drawer.className = 'screening';
      drawer.setAttribute('aria-labelledby', 'screening-title');
      document.body.append(drawer);
      drawer.addEventListener('click', (e) => {
        if (e.target === drawer || e.target.closest('[data-close]')) {
          closeDialog(drawer, { xPercent: 100 });
          return;
        }
        const step = e.target.closest('[data-step]');
        if (step) {
          renderFilm(drawerIndex + Number(step.dataset.step));
          drawer.querySelector('[data-close]').focus();
        }
      });
      drawer.addEventListener('cancel', (e) => {
        e.preventDefault();
        closeDialog(drawer, { xPercent: 100 });
      });
    }
    renderFilm(Math.max(0, window.SBD.films.findIndex((f) => f.id === id)));
    openDialog(drawer, { xPercent: 100, autoAlpha: 1 });
    drawer.querySelector('[data-close]').focus();
  }

  // ---------- scroll motion ----------
  function initMotion() {
    if (!hasGsap) {
      root.classList.remove('js-motion');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      // Page titles rise out of their line masks.
      if (document.querySelector('.page-head .line-inner, .book-aside .line-inner')) {
        gsap.from('.page-head .line-inner, .book-aside .line-inner', { yPercent: 110, duration: 1.2, stagger: 0.08, ease: 'expo.out', delay: 0.1 });
      }

      // Sections fade up once as they arrive.
      gsap.utils.toArray('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          y: 40,
          autoAlpha: 0,
          duration: 1.1,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      });

      // Images open from the bottom edge, like a shutter.
      gsap.utils.toArray('[data-shutter]').forEach((el) => {
        gsap.fromTo(
          el,
          { clipPath: 'inset(100% 0% 0% 0%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            duration: 1.3,
            ease: 'expo.out',
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          },
        );
      });
    });
    root.classList.add('motion-ready');
    root.classList.remove('js-motion');
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  window.SBDUI = { ICONS, mountPlayer, playerHTML, openFilm, openReel, motionOk, reduceMotion, hasGsap };
  // Page scripts render first (they also listen for DOMContentLoaded, registered later),
  // so motion is set up over the finished page.
  document.addEventListener('DOMContentLoaded', initMotion);
})();
