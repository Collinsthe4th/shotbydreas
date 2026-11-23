// Films page: filter tabs and an offset grid. Each film opens the drawer (site.js).

(() => {
  const grid = document.getElementById('films');
  const tabs = document.getElementById('film-tabs');
  const count = document.getElementById('film-count');
  if (!grid || !tabs) return;
  const { films, categories } = window.SBD;
  const ui = window.SBDUI;

  // Frame shape follows the position in the layout (see .film:nth-child in site.css).
  const ratios = ['wide', 'port', 'land', 'land', 'port', 'film'];
  grid.innerHTML = films
    .map(
      (f, i) => `
      <article class="film" data-category="${f.category}">
        <button type="button" class="film-open" data-id="${f.id}" aria-haspopup="dialog">
          <span class="frame ratio-${ratios[i % 6]}" style="display:block" data-shutter>
            <img src="${f.cover}" alt="" loading="${i < 2 ? 'eager' : 'lazy'}" width="1600" height="1000">
          </span>
          <span class="film-cap">
            <span class="h3">${f.title}</span>
            <span class="small dim num">${f.runtime}</span>
          </span>
          <span class="small dim" style="display:block;margin-top:.3rem">${f.type}, ${f.location} · ${f.year}</span>
        </button>
      </article>`,
    )
    .join('');

  const keys = ['all', ...Object.keys(categories)];
  tabs.innerHTML = keys
    .map((k) => {
      const n = k === 'all' ? films.length : films.filter((f) => f.category === k).length;
      return n ? `<button type="button" class="tab" data-filter="${k}" aria-pressed="${k === 'all'}">${k === 'all' ? 'All' : categories[k]}<sup class="num">${n}</sup></button>` : '';
    })
    .join('');

  const setCount = (n) => (count.textContent = `${n} film${n === 1 ? '' : 's'}`);
  setCount(films.length);

  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-filter]');
    if (!tab) return;
    const key = tab.dataset.filter;
    tabs.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-pressed', String(t === tab)));
    const cards = [...grid.querySelectorAll('.film')];
    const shown = cards.filter((c) => key === 'all' || c.dataset.category === key);
    cards.forEach((c) => (c.hidden = !shown.includes(c)));
    setCount(shown.length);
    if (ui.motionOk()) {
      gsap.fromTo(shown, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out' });
      shown.forEach((c) => gsap.set(c.querySelector('[data-shutter]'), { clipPath: 'inset(0% 0% 0% 0%)' }));
      ScrollTrigger.refresh();
    }
  });

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.film-open');
    if (card) ui.openFilm(card.dataset.id);
  });

  // Deep link: /html/videos.html#blue-hour opens that film.
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash && films.some((f) => f.id === hash)) ui.openFilm(hash);
})();
