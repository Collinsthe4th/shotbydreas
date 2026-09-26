// Gallery page (and videos.html): PHOTOSHOOTS / EVENTS tabs. Photoshoots is a masonry
// of stills that open in the lightbox. Events is a grid of films that open in the drawer.

(() => {
  const ui = window.SBDUI;
  const data = window.SBD;
  const page = document.querySelector('[data-gallery]');
  if (!ui || !data || !page) return;

  // Photoshoots
  const stills = page.querySelector('#panel-photos .stills');
  stills.innerHTML = data.stills
    .map(
      (s, i) => `<button type="button" class="still" data-index="${i}" aria-label="Open photograph: ${s.caption}">
        <img src="${s.src}" alt="${s.caption}" width="${s.w}" height="${s.h}" loading="lazy">
      </button>`,
    )
    .join('');
  stills.addEventListener('click', (e) => {
    const b = e.target.closest('.still');
    if (b) ui.openLightbox(data.stills, Number(b.dataset.index));
  });

  // Events (films)
  const events = page.querySelector('#panel-events .events-grid');
  events.innerHTML = data.films
    .map(
      (f) => `<button type="button" class="event-card" data-id="${f.id}" aria-label="Watch ${f.title}">
        <div class="frame">
          <img src="${f.cover}" alt="" loading="lazy">
          <span class="play" aria-hidden="true"><span>${ui.ICONS.play}</span></span>
        </div>
        <h3>${f.title}</h3>
        <p>${f.type} · ${f.location} · ${f.runtime}</p>
      </button>`,
    )
    .join('');
  events.addEventListener('click', (e) => {
    const b = e.target.closest('.event-card');
    if (b) ui.openFilm(b.dataset.id);
  });

  // Tabs: arrow keys move between them, as in the ARIA tabs pattern.
  const tabs = [...page.querySelectorAll('[role="tab"]')];
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    if (ui.motionOk()) {
      gsap.fromTo(
        panel.querySelectorAll('.still, .event-card'),
        { y: 40, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.05, ease: 'power3.out', overwrite: true },
      );
      ScrollTrigger.refresh();
    }
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (step) select(tabs[(i + step + tabs.length) % tabs.length], true);
    });
  });
  const start = tabs.find((t) => t.dataset.tab === page.dataset.gallery) || tabs[0];
  // Set the starting tab without the entrance; the page's own scroll motion covers it.
  tabs.forEach((t) => {
    const on = t === start;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
})();
