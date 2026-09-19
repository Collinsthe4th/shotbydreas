// Stills page: filter tabs, a masonry of photos and a keyboard-friendly lightbox.

(() => {
  const grid = document.getElementById('stills');
  const tabs = document.getElementById('still-tabs');
  if (!grid || !tabs) return;
  const { stills } = window.SBD;
  const ui = window.SBDUI;
  const labels = { all: 'All', weddings: 'Weddings', celebrations: 'Celebrations', mobile: 'Mobile & pre-wedding', portraits: 'Portraits' };

  grid.innerHTML = stills
    .map(
      (s, i) => `
      <figure class="still" data-category="${s.category}">
        <button type="button" class="still-open" data-index="${i}" aria-haspopup="dialog" aria-label="Open photo: ${s.caption}">
          <span class="frame" data-shutter>
            <img src="${s.src}" alt="${s.caption}" width="${s.w}" height="${s.h}" loading="${i < 3 ? 'eager' : 'lazy'}">
          </span>
          <span class="still-cap">${s.caption}</span>
        </button>
      </figure>`,
    )
    .join('');

  tabs.innerHTML = Object.entries(labels)
    .map(([k, label]) => {
      const n = k === 'all' ? stills.length : stills.filter((s) => s.category === k).length;
      return n ? `<button type="button" class="tab" data-filter="${k}" aria-pressed="${k === 'all'}">${label}<sup class="num">${n}</sup></button>` : '';
    })
    .join('');

  let visible = stills.map((_, i) => i);
  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-filter]');
    if (!tab) return;
    const key = tab.dataset.filter;
    tabs.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-pressed', String(t === tab)));
    visible = [];
    grid.querySelectorAll('.still').forEach((el, i) => {
      const show = key === 'all' || el.dataset.category === key;
      el.hidden = !show;
      if (show) visible.push(i);
    });
    if (ui.motionOk()) {
      const shown = grid.querySelectorAll('.still:not([hidden])');
      gsap.fromTo(shown, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.04 });
      shown.forEach((el) => gsap.set(el.querySelector('[data-shutter]'), { clipPath: 'inset(0% 0% 0% 0%)' }));
      ScrollTrigger.refresh();
    }
  });

  // ---------- lightbox ----------
  const box = document.createElement('dialog');
  box.className = 'lightbox';
  box.setAttribute('aria-label', 'Photo viewer');
  box.innerHTML = `
    <div class="lightbox-inner">
      <div class="lightbox-top">
        <span class="small dim num" data-lb-count></span>
        <button type="button" class="btn btn-line btn-sm" data-lb-close>Close</button>
      </div>
      <div class="lightbox-stage"><img alt="" data-lb-img></div>
      <div class="lightbox-bottom">
        <p class="small" data-lb-caption></p>
        <div class="lightbox-nav">
          <button type="button" class="icon-btn" data-lb-step="-1" aria-label="Previous photo">${ui.ICONS.prev}</button>
          <button type="button" class="icon-btn" data-lb-step="1" aria-label="Next photo">${ui.ICONS.next}</button>
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
    box.querySelector('[data-lb-count]').textContent = `${pos + 1} of ${visible.length}`;
    box.querySelector('[data-lb-caption]').textContent = s.caption;
    if (ui.motionOk()) gsap.fromTo(img, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45 });
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
    if (e.target.closest('[data-lb-close]')) box.close();
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(pos + 1);
    if (e.key === 'ArrowLeft') show(pos - 1);
  });
  box.addEventListener('close', () => (document.documentElement.style.overflow = ''));
})();
