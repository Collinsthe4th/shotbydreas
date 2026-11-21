// Films: the numbered index on the home page and the filterable grid on the Films page.
// Both open the screening drawer from site.js.

(() => {
  const { films, categories } = window.SBD;
  const ui = window.SBDUI;
  const pad = (n) => String(n).padStart(2, '0');
  const motionOk = () => ui.hasGsap && !ui.reduceMotion.matches;

  // ---------- Home: numbered editorial index + swapping preview ----------
  const list = document.getElementById('work-list');
  const preview = document.getElementById('work-preview');
  if (list) {
    list.innerHTML = films
      .map(
        (f, i) => `
        <li>
          <button type="button" class="work-row" data-id="${f.id}" data-cursor="View" aria-haspopup="dialog">
            <span class="num">${pad(i + 1)}</span>
            <span class="title">${f.title}</span>
            <span class="year">${f.year}</span>
            <span class="meta mono">${f.type} · ${f.location} · ${f.runtime}</span>
            <img class="thumb" src="${f.cover}" alt="" loading="lazy" width="1600" height="900">
          </button>
        </li>`,
      )
      .join('');

    let active = null;
    const frame = preview?.querySelector('.frame');
    const caption = preview?.querySelector('.work-preview-caption');

    const show = (row) => {
      if (!frame || row === active) return;
      active?.classList.remove('is-active');
      active = row;
      row.classList.add('is-active');
      const f = films.find((x) => x.id === row.dataset.id);
      caption.textContent = `${f.format} · ${f.runtime}`;

      const img = new Image();
      img.src = f.cover;
      img.alt = '';
      frame.append(img);
      const old = [...frame.querySelectorAll('img')].slice(0, -1);
      if (motionOk()) {
        gsap.fromTo(
          img,
          { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.08 },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            scale: 1,
            duration: 0.9,
            ease: 'expo.out',
            onComplete: () => old.forEach((o) => o.remove()),
          },
        );
      } else {
        old.forEach((o) => o.remove());
      }
    };

    list.addEventListener('pointerover', (e) => {
      const row = e.target.closest('.work-row');
      if (row) show(row);
    });
    list.addEventListener('focusin', (e) => {
      const row = e.target.closest('.work-row');
      if (row) show(row);
    });
    list.addEventListener('click', (e) => {
      const row = e.target.closest('.work-row');
      if (row) ui.openScreening(row.dataset.id);
    });
    const first = list.querySelector('.work-row');
    if (first) show(first);
  }

  // ---------- Films page: filter chips + staggered grid ----------
  const grid = document.getElementById('film-grid');
  const filters = document.getElementById('film-filters');
  const count = document.getElementById('film-count');
  if (grid && filters) {
    grid.innerHTML = films
      .map(
        (f, i) => `
        <article class="film-card" data-category="${f.category}" data-reveal>
          <button type="button" class="film-open" data-id="${f.id}" data-cursor="Play" aria-haspopup="dialog">
            <span class="frame" data-ratio="${i % 4 === 1 || i % 4 === 2 ? 'port' : 'edit'}" style="display:block">
              <img src="${f.cover}" alt="" loading="${i < 2 ? 'eager' : 'lazy'}" width="1600" height="1000">
            </span>
            <span class="frame-meta"><span class="mono">${pad(i + 1)} · ${categories[f.category]}</span><span class="mono">${f.runtime}</span></span>
            <span class="h3" style="display:block">${f.title}</span>
            <span class="mono" style="display:block;margin-top:.35rem">${f.type} · ${f.location} · ${f.year}</span>
          </button>
        </article>`,
      )
      .join('');

    const keys = ['all', ...Object.keys(categories)];
    filters.innerHTML = keys
      .map((k) => {
        const n = k === 'all' ? films.length : films.filter((f) => f.category === k).length;
        if (!n) return '';
        return `<button type="button" class="chip" data-filter="${k}" aria-pressed="${k === 'all'}">${
          k === 'all' ? 'All' : categories[k]
        } <span class="count">${pad(n)}</span></button>`;
      })
      .join('');

    const apply = (key) => {
      filters.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === key)));
      const cards = [...grid.querySelectorAll('.film-card')];
      const shown = cards.filter((c) => key === 'all' || c.dataset.category === key);
      cards.forEach((c) => (c.hidden = !shown.includes(c)));
      count.textContent = `${pad(shown.length)} film${shown.length === 1 ? '' : 's'}`;
      if (motionOk()) {
        gsap.fromTo(shown, { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.06, ease: 'power3.out' });
        ScrollTrigger.refresh();
      }
    };
    filters.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter]');
      if (chip) apply(chip.dataset.filter);
    });
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.film-open');
      if (card) ui.openScreening(card.dataset.id);
    });
    count.textContent = `${pad(films.length)} films`;

    // Deep link: /html/videos.html#blue-hour opens that film.
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash && films.some((f) => f.id === hash)) ui.openScreening(hash);
  }
})();
