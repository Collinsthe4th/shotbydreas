// Shared behaviour for every page: header, menu, clock, video players, the screening
// drawer, the cursor badge and all GSAP motion. Page scripts (work.js, gallery.js, ...)
// use the helpers exposed on window.SBDUI.

(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const hasGsap = typeof window.gsap !== 'undefined';

  // ---------- icons ----------
  const ICONS = {
    aperture:
      '<svg class="icon-aperture" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path d="M12 7.8 4.83 3.66M15.64 9.9V1.62M15.64 14.1l7.17-4.14M12 16.2l7.17 4.14M8.36 14.1v8.28M8.36 9.9l-7.17 4.14"/></svg>',
    play: '<svg class="icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause: '<svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
    muted:
      '<svg class="icon-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="m16 9.5 5 5m0-5-5 5"/></svg>',
    sound:
      '<svg class="icon-sound" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>',
  };

  // ---------- timecode (HH:MM:SS:FF at 24fps) ----------
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  function timecode(seconds) {
    const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}:${pad((s % 1) * 24)}`;
  }

  // ---------- header: solid background after scrolling, hide while scrolling down ----------
  const header = document.querySelector('.site-header');
  if (header) {
    let lastY = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      header.classList.toggle('is-solid', y > 40);
      const menuOpen = document.body.classList.contains('menu-open');
      header.classList.toggle('is-hidden', !menuOpen && y > 400 && y > lastY + 2);
      if (y < lastY - 2 || y < 400) header.classList.remove('is-hidden');
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
        if (hasGsap && !reduceMotion.matches) {
          gsap.from(menu.querySelectorAll('.menu-links li'), {
            yPercent: 60,
            autoAlpha: 0,
            duration: 0.7,
            stagger: 0.05,
            ease: 'expo.out',
          });
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
    // Close when switching to the desktop layout.
    window.matchMedia('(min-width: 1081px)').addEventListener('change', (e) => e.matches && setOpen(false));
  }

  // ---------- local clock (Awka) ----------
  const clocks = document.querySelectorAll('[data-clock]');
  if (clocks.length) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const tick = () => clocks.forEach((c) => (c.textContent = `Awka ${fmt.format(new Date())} WAT`));
    tick();
    setInterval(tick, 1000);
  }

  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

  // ---------- video player ----------
  // Markup: <figure class="player" data-player data-autoplay?> <div class="frame"><video ...></div> </figure>
  // The controls are added here so every player behaves the same.
  function mountPlayer(fig) {
    if (fig.dataset.mounted) return;
    fig.dataset.mounted = 'true';
    const video = fig.querySelector('video');
    const frame = fig.querySelector('.frame');
    const label = fig.dataset.label || 'film';

    const ui = document.createElement('div');
    ui.className = 'player-ui';
    ui.innerHTML = `
      <button type="button" class="player-btn player-toggle" aria-label="Play ${label}">${ICONS.play}${ICONS.pause}</button>
      <span class="player-time mono"><span class="player-current">00:00:00:00</span><span class="player-total"></span></span>
      <input type="range" class="player-scrub" min="0" max="1000" value="0" step="1" aria-label="Seek ${label}">
      <button type="button" class="player-btn player-mute" aria-label="Unmute">${ICONS.muted}${ICONS.sound}</button>`;
    const err = document.createElement('div');
    err.className = 'player-error mono';
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
      current.textContent = timecode(video.currentTime);
      if (!seeking) scrub.value = String(Math.round((video.currentTime / video.duration) * 1000));
      scrub.style.setProperty('--p', `${(video.currentTime / video.duration) * 100}%`);
    };
    const play = () => video.play().catch(() => sync());
    const togglePlay = () => (video.paused ? play() : video.pause());

    btn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    video.addEventListener('ended', sync);
    video.addEventListener('timeupdate', progress);
    video.addEventListener('loadedmetadata', () => {
      total.textContent = ` / ${timecode(video.duration)}`;
      progress();
    });
    if (video.readyState >= 1) total.textContent = ` / ${timecode(video.duration)}`;
    const fail = () => fig.classList.add('is-error');
    video.addEventListener('error', fail);
    video.querySelectorAll('source').forEach((s) => s.addEventListener('error', fail));

    mute.addEventListener('click', () => {
      video.muted = !video.muted;
      fig.classList.toggle('is-unmuted', !video.muted);
      mute.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
    });
    scrub.addEventListener('input', () => {
      seeking = true;
      if (video.duration) video.currentTime = (Number(scrub.value) / 1000) * video.duration;
      progress();
    });
    scrub.addEventListener('change', () => (seeking = false));

    // Autoplay (muted, looping) only when motion is welcome and the player is on screen.
    if (fig.hasAttribute('data-autoplay') && !reduceMotion.matches) {
      video.muted = true;
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !fig.dataset.userPaused) play();
          else if (!entry.isIntersecting) video.pause();
        },
        { threshold: 0.25 },
      );
      io.observe(fig);
      btn.addEventListener('click', () => (fig.dataset.userPaused = video.paused ? 'true' : ''));
    }
    sync();
  }

  function playerHTML({ src, poster, label, ratio = 'film', autoplay = false }) {
    return `<figure class="player" data-player data-label="${label}"${autoplay ? ' data-autoplay' : ''}>
      <div class="frame" data-ratio="${ratio}">
        <video playsinline muted loop preload="metadata" poster="${poster}"><source src="${src}" type="video/mp4"></video>
      </div>
    </figure>`;
  }

  // Ambient videos (headline frame, previews): muted loops that pause off screen.
  function mountAmbient(video) {
    if (reduceMotion.matches) return;
    video.muted = true;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? video.play().catch(() => {}) : video.pause()));
    io.observe(video);
  }

  document.querySelectorAll('[data-player]').forEach(mountPlayer);
  document.querySelectorAll('video[data-ambient]').forEach(mountAmbient);

  // ---------- screening drawer (film breakdown) ----------
  let drawer;
  let drawerIndex = 0;

  function buildDrawer() {
    drawer = document.createElement('dialog');
    drawer.className = 'screening';
    drawer.setAttribute('aria-labelledby', 'screening-title');
    document.body.append(drawer);
    drawer.addEventListener('click', (e) => e.target === drawer && closeScreening());
    drawer.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeScreening();
    });
    drawer.addEventListener('click', (e) => {
      const step = e.target.closest('[data-step]');
      if (step) {
        renderScreening(drawerIndex + Number(step.dataset.step));
        drawer.querySelector('.screening-close').focus();
      }
      if (e.target.closest('.screening-close')) closeScreening();
    });
  }

  function renderScreening(index) {
    const films = window.SBD.films;
    drawerIndex = (index + films.length) % films.length;
    const f = films[drawerIndex];
    const cats = window.SBD.categories;
    drawer.innerHTML = `
      <div class="screening-head">
        <span class="mono">Screening ${pad(drawerIndex + 1)} / ${pad(films.length)}</span>
        <button type="button" class="screening-close">Close <span aria-hidden="true">✕</span></button>
      </div>
      <div class="screening-body">
        ${playerHTML({ src: f.video, poster: f.poster, label: f.title })}
        <div>
          <p class="mono">${cats[f.category]} · ${f.type} · ${f.location} · ${f.year}</p>
          <h2 class="display screening-title" id="screening-title">${f.title}</h2>
        </div>
        <p class="screening-log">${f.logline}</p>
        <dl class="spec">
          <div><dt class="label">Role</dt><dd>${f.role}</dd></div>
          <div><dt class="label">Runtime</dt><dd class="mono" style="color:var(--ink)">${f.runtime}</dd></div>
          <div><dt class="label">Format</dt><dd>${f.format}</dd></div>
          <div><dt class="label">Camera</dt><dd>${f.camera}</dd></div>
          <div><dt class="label">Colour</dt><dd>${f.color}</dd></div>
          <div><dt class="label">Location</dt><dd>${f.location}, ${f.year}</dd></div>
        </dl>
        <div>
          <h3 class="label" style="margin-bottom:.75rem">Delivered</h3>
          <ul class="deliverables">${f.deliverables.map((d) => `<li>${d}</li>`).join('')}</ul>
        </div>
        <div class="strip">${f.stills
          .map((s) => `<div class="frame" data-ratio="port"><img src="${s}" alt="" loading="lazy"></div>`)
          .join('')}</div>
        <div class="actions">
          <a class="btn btn-gold" href="/html/book.html">Book a date like this</a>
          <button type="button" class="btn" data-step="-1">← Previous</button>
          <button type="button" class="btn" data-step="1">Next film →</button>
        </div>
      </div>`;
    drawer.scrollTop = 0;
    mountPlayer(drawer.querySelector('[data-player]'));
  }

  function openScreening(id) {
    if (!window.SBD) return;
    if (!drawer) buildDrawer();
    const index = window.SBD.films.findIndex((f) => f.id === id);
    renderScreening(Math.max(0, index));
    drawer.showModal();
    root.style.overflow = 'hidden';
    drawer.querySelector('.screening-close').focus();
    if (hasGsap && !reduceMotion.matches) {
      gsap.fromTo(drawer, { xPercent: 100 }, { xPercent: 0, duration: 0.8, ease: 'expo.out' });
      gsap.from(drawer.querySelectorAll('.screening-body > *'), {
        y: 24,
        autoAlpha: 0,
        duration: 0.7,
        stagger: 0.05,
        delay: 0.15,
        ease: 'power3.out',
      });
    }
  }

  function closeScreening() {
    if (!drawer?.open) return;
    drawer.querySelectorAll('video').forEach((v) => v.pause());
    const done = () => {
      drawer.close();
      root.style.overflow = '';
      window.gsap?.set(drawer, { clearProps: 'transform' });
    };
    if (hasGsap && !reduceMotion.matches) {
      gsap.to(drawer, { xPercent: 100, duration: 0.5, ease: 'power3.in', onComplete: done });
    } else {
      done();
    }
  }

  // ---------- cursor badge (fine pointers, motion allowed) ----------
  if (hasGsap && finePointer.matches && !reduceMotion.matches) {
    const cursor = document.createElement('div');
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = `${ICONS.aperture}<span></span>`;
    document.body.append(cursor);
    const label = cursor.querySelector('span');
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3' });
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3' });
    gsap.set(cursor, { xPercent: -50, yPercent: -50 });
    window.addEventListener('pointermove', (e) => {
      xTo(e.clientX + 28);
      yTo(e.clientY + 28);
    });
    document.addEventListener('pointerover', (e) => {
      const target = e.target.closest('[data-cursor]');
      if (target) {
        label.textContent = target.dataset.cursor;
        gsap.to(cursor, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'power3.out' });
      }
    });
    document.addEventListener('pointerout', (e) => {
      const from = e.target.closest('[data-cursor]');
      if (from && !from.contains(e.relatedTarget)) gsap.to(cursor, { autoAlpha: 0, scale: 0.6, duration: 0.25 });
    });
  }

  // ---------- GSAP motion ----------
  function initMotion() {
    if (!hasGsap) {
      root.classList.remove('js-motion');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add(
      { motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 900px)' },
      (ctx) => {
        const { motion, desktop } = ctx.conditions;
        if (!motion) return;

        // 1. Entrance: headline lines rise out of their masks, then the supporting text.
        const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
        intro
          .from('.hero-meta > *, .page-hero .mono', { y: 12, autoAlpha: 0, duration: 0.8, stagger: 0.06 })
          .from('.line-inner', { yPercent: 110, duration: 1.2, stagger: 0.09 }, '<0.1')
          .from('.frame-inline', { scale: 0.4, autoAlpha: 0, duration: 1, ease: 'back.out(1.4)' }, '-=0.8')
          .from('.hero-foot > *, .page-hero .lede', { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.08 }, '-=0.7');

        // 2. The reel "opens" like an aperture as it scrolls into view.
        gsap.utils.toArray('[data-aperture]').forEach((el) => {
          gsap.fromTo(
            el,
            { clipPath: 'inset(14% 10% 14% 10%)' },
            {
              clipPath: 'inset(0% 0% 0% 0%)',
              ease: 'none',
              scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 25%', scrub: 0.6 },
            },
          );
        });

        // 3. Reveals as sections enter.
        gsap.utils.toArray('[data-reveal]').forEach((el) => {
          gsap.from(el, {
            y: 36,
            autoAlpha: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          });
        });

        // 4. Images drift slower than their frames.
        gsap.utils.toArray('[data-parallax]').forEach((img) => {
          gsap.fromTo(
            img,
            { yPercent: -6 },
            {
              yPercent: 6,
              ease: 'none',
              scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
            },
          );
        });

        // 5. Contact sheet: pinned, scrolls sideways on desktop. Native swipe on small screens.
        const sheet = document.querySelector('[data-sheet]');
        if (sheet && desktop) {
          const track = sheet.querySelector('.sheet-track');
          const bar = sheet.querySelector('.sheet-progress span');
          const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
          sheet.classList.add('is-pinned');
          gsap.to(track, {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
              trigger: sheet,
              start: 'top top',
              end: () => `+=${distance()}`,
              pin: true,
              scrub: 0.6,
              invalidateOnRefresh: true,
              onUpdate: (self) => bar && gsap.set(bar, { scaleX: self.progress }),
            },
          });
          return () => sheet.classList.remove('is-pinned');
        }
        return undefined;
      },
    );

    root.classList.add('motion-ready');
    root.classList.remove('js-motion');
    // Images loading late change heights, so recalculate trigger positions once everything is in.
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  window.SBDUI = { ICONS, timecode, mountPlayer, playerHTML, openScreening, closeScreening, reduceMotion, hasGsap };
  // Page scripts render their content first, then motion is set up over the final DOM.
  document.addEventListener('DOMContentLoaded', initMotion);
})();
