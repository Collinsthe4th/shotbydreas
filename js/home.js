// Home page: aperture hero, statement, film index, services, moving stills.

(() => {
  const ui = window.SBDUI;
  const { films, stills } = window.SBD;
  const motionOk = ui.motionOk;

  // ---------- hero: SHOTBY ( iris ) DREAS ----------
  const hero = document.querySelector('.hero');
  const irisHost = hero?.querySelector('[data-iris]');
  const iris = irisHost ? window.SBDIris.createIris() : null;
  if (iris) irisHost.append(iris.svg);

  // ---------- statement: each word is wrapped in .w by the page ----------
  const statement = document.querySelector('[data-words]');

  // ---------- film index with a floating preview ----------
  const list = document.getElementById('film-index');
  const preview = document.querySelector('.float-preview');
  if (list) {
    list.innerHTML = films
      .map(
        (f) => `
        <li>
          <button type="button" class="index-row" data-id="${f.id}" aria-haspopup="dialog">
            <span class="index-title">${f.title}</span>
            <span class="index-meta">${f.type}, ${f.location}</span>
            <span class="index-year">${f.year}</span>
            <img class="index-thumb" src="${f.cover}" alt="" loading="lazy" width="1600" height="900">
          </button>
        </li>`,
      )
      .join('');
    list.addEventListener('click', (e) => {
      const row = e.target.closest('.index-row');
      if (row) ui.openFilm(row.dataset.id);
    });
  }

  // ---------- services: the sticky image follows the item in view ----------
  const coverList = document.querySelector('.cover-list');
  const coverImgs = [...document.querySelectorAll('.cover-media img')];
  if (coverList && coverImgs.length) {
    const items = [...coverList.querySelectorAll('.cover-item')];
    const activate = (i) => {
      items.forEach((it, n) => it.classList.toggle('is-active', n === i));
      coverImgs.forEach((im, n) => im.classList.toggle('is-active', n === i));
    };
    activate(0);
    coverList.classList.add('is-tracking');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && activate(items.indexOf(e.target))),
      { rootMargin: '-45% 0px -45% 0px' },
    );
    items.forEach((it) => io.observe(it));
  }

  // ---------- moving strips of stills (each strip is doubled for a seamless loop) ----------
  document.querySelectorAll('[data-marquee]').forEach((m, row) => {
    const set = stills.filter((_, i) => i % 2 === row);
    const imgs = (hidden) =>
      set
        .map((s) => `<img src="${s.src}" alt="${hidden ? '' : s.caption}" width="${s.w}" height="${s.h}" loading="lazy">`)
        .join('');
    m.innerHTML = `<div class="marquee-track"><div style="display:contents">${imgs(false)}</div><div style="display:contents" aria-hidden="true">${imgs(true)}</div></div>`;
  });

  // ---------- motion ----------
  document.addEventListener('DOMContentLoaded', () => {
    if (!motionOk()) {
      iris?.set(1);
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    if (hero && iris) {
      // 1. On load: the iris opens on the reel and the brand name rises in from both sides.
      iris.set(0);
      const state = { t: 0 };
      gsap
        .timeline({ delay: 0.25 })
        .to(state, { t: 1, duration: 1.9, ease: 'power3.inOut', onUpdate: () => iris.set(state.t) })
        .from('.hero-word > span', { yPercent: 105, duration: 1.2, stagger: 0.12, ease: 'expo.out' }, 0.35)
        .from('.hero-side, .hero-play', { autoAlpha: 0, y: 12, duration: 0.9, stagger: 0.06, ease: 'power2.out' }, 1);

      // 2. On scroll: the aperture widens until the reel fills the screen.
      const media = hero.querySelector('.hero-media');
      const irisWrap = hero.querySelector('.hero-iris');
      const radius = () => irisWrap.offsetWidth / 2;
      const full = () => Math.hypot(window.innerWidth, window.innerHeight) / 2 + 24;
      gsap
        .timeline({
          scrollTrigger: { trigger: hero, start: 'top top', end: '+=110%', pin: true, scrub: 0.6, invalidateOnRefresh: true },
        })
        .fromTo(media, { '--r': () => `${radius()}px` }, { '--r': () => `${full()}px`, ease: 'none', duration: 1 }, 0)
        .to(irisWrap, { scale: () => full() / radius(), autoAlpha: 0, ease: 'power1.in', duration: 0.55 }, 0)
        .to('.hero-word.left > span', { xPercent: -45, autoAlpha: 0, ease: 'none', duration: 0.55 }, 0)
        .to('.hero-word.right > span', { xPercent: 45, autoAlpha: 0, ease: 'none', duration: 0.55 }, 0)
        .to('.hero-side', { autoAlpha: 0, duration: 0.25 }, 0);
    }

    // 3. Statement: words come into focus as you read down.
    if (statement) {
      gsap.fromTo(
        statement.querySelectorAll('.w'),
        { opacity: 0.14 },
        {
          opacity: 1,
          stagger: 0.05,
          ease: 'none',
          scrollTrigger: { trigger: statement, start: 'top 80%', end: 'bottom 45%', scrub: true },
        },
      );
    }

    // 4. Index: the preview image follows the pointer (fine pointers only).
    if (list && preview && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const img = preview.querySelector('img');
      const xTo = gsap.quickTo(preview, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(preview, 'y', { duration: 0.6, ease: 'power3' });
      gsap.set(preview, { xPercent: -50, yPercent: -50 });
      let shown = false;
      const hide = () => {
        if (!shown) return;
        shown = false;
        gsap.to(preview, { autoAlpha: 0, scale: 0.92, duration: 0.3, overwrite: 'auto' });
      };
      list.addEventListener('pointermove', (e) => {
        xTo(e.clientX);
        yTo(e.clientY);
        const row = e.target.closest('.index-row');
        if (!row) return hide();
        const f = films.find((x) => x.id === row.dataset.id);
        if (!img.src.endsWith(f.cover)) img.src = f.cover;
        if (!shown) {
          shown = true;
          gsap.to(preview, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
        }
      });
      list.addEventListener('pointerleave', hide);
      // Scrolling moves the page under a still pointer, so hide until the pointer moves again.
      window.addEventListener('scroll', hide, { passive: true });
    }
  });
})();
