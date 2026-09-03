// Stills page: filterable asymmetric grid and a keyboard-friendly lightbox.

(() => {
  const grid = document.getElementById('stills');
  const filters = document.getElementById('still-filters');
  if (!grid || !filters) return;
  const { stills } = window.SBD;
  const ui = window.SBDUI;
  const pad = (n) => String(n).padStart(2, '0');
  const labels = { all: 'All', weddings: 'Weddings', celebrations: 'Celebrations', mobile: 'Mobile & pre-wedding', portraits: 'Portraits' };
  const ratio = { wide: 'wide', land: 'land', port: 'port', square: 'square' };

  grid.innerHTML = stills
    .map(
      (s, i) => `
      <figure class="still" data-shape="${s.shape}" data-category="${s.category}" style="--span: ${s.span || 6}" data-reveal>
        <button type="button" class="still-open" data-index="${i}" data-cursor="View" aria-haspopup="dialog" aria-label="Open ${s.caption}">
          <span class="frame" data-ratio="${ratio[s.shape]}" style="display:block">
            <img src="${s.src}" alt="${s.caption}" width="${s.w}" height="${s.h}" loading="${i < 3 ? 'eager' : 'lazy'}">
          </span>
          <span class="frame-meta"><span class="mono">F/${pad(i + 1)} · ${s.caption}</span><span class="mono">${s.meta}</span></span>
        </button>
      </figure>`,
    )
    .join('');

  filters.innerHTML = Object.entries(labels)
    .map(([k, label]) => {
      const n = k === 'all' ? stills.length : stills.filter((s) => s.category === k).length;
      return n ? `<button type="button" class="chip" data-filter="${k}" aria-pressed="${k === 'all'}">${label} <span class="count">${pad(n)}</span></button>` : '';
    })
    .join('');

  let visible = stills.map((_, i) => i);
  filters.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    const key = chip.dataset.filter;
    filters.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    visible = [];
    grid.querySelectorAll('.still').forEach((el, i) => {
      const show = key === 'all' || el.dataset.category === key;
      el.hidden = !show;
      if (show) visible.push(i);
    });
    if (ui.hasGsap && !ui.reduceMotion.matches) {
      gsap.fromTo(grid.querySelectorAll('.still:not([hidden])'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.04 });
      ScrollTrigger.refresh();
    }
  });

  // ---------- lightbox ----------
  const box = document.createElement('dialog');
  box.className = 'lightbox';
  box.setAttribute('aria-label', 'Still viewer');
  box.innerHTML = `
    <div class="lightbox-inner">
      <div class="lightbox-top">
        <span class="mono" data-lb-count></span>
        <button type="button" class="btn btn-sm" data-lb-close>Close ✕</button>
      </div>
      <div class="lightbox-stage"><img alt="" data-lb-img></div>
      <div class="lightbox-bottom">
        <p class="mono" data-lb-caption></p>
        <div class="lightbox-nav">
          <button type="button" class="btn btn-sm" data-lb-step="-1" aria-label="Previous still">←</button>
          <button type="button" class="btn btn-sm" data-lb-step="1" aria-label="Next still">→</button>
        </div>
      </div>
    </div>`;
  document.body.append(box);
  const img = box.querySelector('[data-lb-img]');
  let pos = 0;

  const show = (p) => {
    pos = (p + visible.length) % visible.length;
    const s = stills[visible[pos]];
    img.src = s.src;
    img.alt = s.caption;
    box.querySelector('[data-lb-count]').textContent = `${pad(pos + 1)} / ${pad(visible.length)}`;
    box.querySelector('[data-lb-caption]').textContent = `${s.caption} · ${s.meta}`;
    if (ui.hasGsap && !ui.reduceMotion.matches) gsap.fromTo(img, { autoAlpha: 0, scale: 0.98 }, { autoAlpha: 1, scale: 1, duration: 0.5 });
  };

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.still-open');
    if (!btn) return;
    show(visible.indexOf(Number(btn.dataset.index)));
    box.showModal();
    document.documentElement.style.overflow = 'hidden';
  });
  box.addEventListener('click', (e) => {
    const step = e.target.closest('[data-lb-step]');
    if (step) show(pos + Number(step.dataset.lbStep));
    if (e.target.closest('[data-lb-close]') || e.target === box) box.close();
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(pos + 1);
    if (e.key === 'ArrowLeft') show(pos - 1);
  });
  box.addEventListener('close', () => (document.documentElement.style.overflow = ''));
})();
