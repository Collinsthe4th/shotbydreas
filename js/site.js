// Shared behaviour for every page: intro loader, header, menu, video player,
// the film drawer, the reel dialog and the general scroll motion.
// Page scripts (home.js, gallery.js) use the helpers on window.SBDUI.

(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasGsap = typeof window.gsap !== 'undefined';
  const motionOk = () => hasGsap && !reduceMotion.matches;

  // ---------- icons (arrows are thick and only used where they point somewhere) ----------
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

  // ---------- intro loader (first page of the session only) ----------
  // The <head> script adds .is-intro when it should play. Pages wait on introDone
  // before their own entrance so the two never overlap.
  let introResolve;
  const introDone = new Promise((r) => (introResolve = r));
  function runIntro() {
    const loader = document.querySelector('.loader');
    const finish = () => {
      root.classList.remove('is-intro');
      introResolve();
    };
    if (!root.classList.contains('is-intro') || !loader || !motionOk()) return finish();
    try {
      sessionStorage.setItem('sbd-intro', '1');
    } catch {
      /* storage blocked: the intro may play again next page */
    }
    gsap
      .timeline({ onComplete: finish })
      .from(loader.querySelector('img'), { autoAlpha: 0, scale: 0.85, duration: 0.8, ease: 'power3.out' })
      .to(loader.querySelector('.loader-line'), { scaleX: 1, duration: 0.9, ease: 'power2.inOut' }, '-=0.3')
      .to(loader, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, '+=0.1')
      .add(() => introResolve(), '-=0.45'); // let the page start while the curtain lifts
  }

  // ---------- header: gold rule appears after scrolling ----------
  const header = document.querySelector('.site-header');
  if (header) {
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > 30);
    window.addEventListener('scroll', update, { passive: true });
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
    window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => e.matches && setOpen(false));
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

  function playerHTML({ src, poster, label }) {
    return `<figure class="player" data-label="${label}">
      <div class="frame">
        <video playsinline muted loop preload="metadata" poster="${poster}"><source src="${src}" type="video/mp4"></video>
      </div>
    </figure>`;
  }

  // Muted background loops play only while on screen. With reduced motion they stay
  // on their poster frame.
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

  // ---------- film drawer (also used for the reel) ----------
  let drawer;
  let drawerIndex = 0;

  function renderFilm(index) {
    const films = window.SBD.films;
    drawerIndex = (index + films.length) % films.length;
    const f = films[drawerIndex];
    drawer.innerHTML = `
      <div class="screening-head">
        <span class="eyebrow">${drawerIndex + 1} of ${films.length}</span>
        <button type="button" class="btn btn-sm" data-close>Close</button>
      </div>
      <div class="screening-body">
        ${playerHTML({ src: f.video, poster: f.poster, label: f.title })}
        <div>
          <p class="small dim">${f.type} · ${f.location} · ${f.year}</p>
          <h2 class="screening-title" id="screening-title">${f.title}</h2>
        </div>
        <p class="lede">${f.logline}</p>
        <dl class="facts">
          <div><dt class="eyebrow">Our role</dt><dd>${f.role}</dd></div>
          <div><dt class="eyebrow">Running time</dt><dd>${f.runtime}</dd></div>
        </dl>
        <div>
          <h3 class="eyebrow" style="margin-bottom:.75rem">What the client received</h3>
          <ul class="delivered">${f.deliverables.map((d) => `<li>${d}</li>`).join('')}</ul>
        </div>
        <div class="mini-strip">${f.stills.map((s) => `<div class="frame"><img src="${s}" alt="" loading="lazy"></div>`).join('')}</div>
        <div class="actions">
          <a class="btn btn-gold" href="/html/book.html">Book Us Today</a>
          <button type="button" class="text-btn" data-step="-1">Previous film</button>
          <button type="button" class="text-btn" data-step="1">Next film</button>
        </div>
      </div>`;
    drawer.scrollTop = 0;
    return mountPlayer(drawer.querySelector('.player'));
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
    const player = renderFilm(Math.max(0, window.SBD.films.findIndex((f) => f.id === id)));
    openDialog(drawer, { xPercent: 100, autoAlpha: 1 });
    drawer.querySelector('[data-close]').focus();
    return player;
  }
  document.querySelectorAll('[data-film]').forEach((b) => b.addEventListener('click', () => openFilm(b.dataset.film)));

  // ---------- lightbox for photographs (album on home, photoshoots on gallery) ----------
  let box;
  let boxList = [];
  let boxIndex = 0;
  function showStill(i) {
    boxIndex = (i + boxList.length) % boxList.length;
    const s = boxList[boxIndex];
    const img = box.querySelector('.lightbox-stage img');
    img.src = s.src;
    img.alt = s.caption;
    box.querySelector('.lightbox-caption').textContent = s.caption;
    box.querySelector('.lightbox-count').textContent = `${boxIndex + 1} / ${boxList.length}`;
    if (motionOk()) gsap.fromTo(img, { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
  }
  function openLightbox(list, index) {
    if (!box) {
      box = document.createElement('dialog');
      box.className = 'lightbox';
      box.setAttribute('aria-label', 'Photograph viewer');
      box.innerHTML = `<div class="lightbox-inner">
          <div class="lightbox-top"><span class="eyebrow lightbox-count"></span>
            <button type="button" class="btn btn-sm" data-close>Close</button></div>
          <div class="lightbox-stage"><img alt=""></div>
          <div class="lightbox-bottom"><p class="small dim lightbox-caption"></p>
            <div class="lightbox-nav">
              <button type="button" class="icon-btn" data-step="-1" aria-label="Previous photograph">${ICONS.prev}</button>
              <button type="button" class="icon-btn" data-step="1" aria-label="Next photograph">${ICONS.next}</button>
            </div></div>
        </div>`;
      document.body.append(box);
      box.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) return closeDialog(box);
        const step = e.target.closest('[data-step]');
        if (step) showStill(boxIndex + Number(step.dataset.step));
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') showStill(boxIndex + 1);
        if (e.key === 'ArrowLeft') showStill(boxIndex - 1);
      });
      box.addEventListener('cancel', (e) => {
        e.preventDefault();
        closeDialog(box);
      });
    }
    boxList = list;
    openDialog(box);
    showStill(index);
    box.querySelector('[data-close]').focus();
  }
  // Static album items: data-still is the index into SBD.stills.
  document.querySelectorAll('[data-still]').forEach((b) =>
    b.addEventListener('click', () => window.SBD && openLightbox(window.SBD.stills, Number(b.dataset.still))),
  );

  // ---------- magnetic buttons (pointer devices only) ----------
  function magnetic(el) {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.25);
      yTo((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  }

  // ---------- scroll motion ----------
  // data-reveal: fade up. data-slide="left|right": slide in from that side.
  // data-line: a rule that draws from the centre. data-stagger: children arrive in turn.
  // data-parallax="n": drifts n% against the scroll.
  function initMotion() {
    if (!hasGsap) {
      root.classList.remove('js-motion', 'is-intro');
      introResolve();
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    const once = (el, start = 'top 88%') => ({ trigger: el, start, once: true });

    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.utils.toArray('[data-reveal]').forEach((el) => {
        gsap.from(el, { y: 50, autoAlpha: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: once(el) });
      });

      gsap.utils.toArray('[data-slide]').forEach((el) => {
        const dir = el.dataset.slide === 'right' ? 1 : -1;
        gsap.from(el, { x: 80 * dir, autoAlpha: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: once(el, 'top 85%') });
      });

      gsap.utils.toArray('[data-line]').forEach((el) => {
        gsap.from(el, { scaleX: 0, duration: 1.4, ease: 'expo.inOut', scrollTrigger: once(el, 'top 92%') });
      });

      gsap.utils.toArray('[data-stagger]').forEach((el) => {
        gsap.from(el.children, {
          y: 50,
          autoAlpha: 0,
          duration: 1,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: once(el),
        });
      });

      gsap.utils.toArray('[data-parallax]').forEach((el) => {
        const amount = Number(el.dataset.parallax) || 10;
        gsap.fromTo(
          el,
          { yPercent: -amount },
          {
            yPercent: amount,
            ease: 'none',
            scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        );
      });

      // Gold headline text catches the light once as it arrives.
      gsap.utils.toArray('[data-shine]').forEach((el) => {
        gsap.fromTo(
          el,
          { backgroundPosition: '100% 0' },
          { backgroundPosition: '0% 0', duration: 2.2, ease: 'power2.out', scrollTrigger: once(el) },
        );
      });

      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        document.querySelectorAll('[data-magnetic]').forEach(magnetic);
      }
    });

    root.classList.add('motion-ready');
    root.classList.remove('js-motion');
    runIntro();
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  window.SBDUI = { ICONS, mountPlayer, playerHTML, openFilm, openLightbox, openDialog, closeDialog, motionOk, reduceMotion, hasGsap, introDone };
  // Deferred page scripts run after this file and build their content straight away,
  // which is before DOMContentLoaded, so motion is set up over the finished page.
  document.addEventListener('DOMContentLoaded', initMotion);
})();
