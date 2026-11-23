// Camera iris drawn in SVG. setIris(t) opens it: t = 0 closed, t = 1 fully open.
// The opening is a hexagon whose corners send a blade seam out to the rim,
// the same shape as the aperture in the SHOTBYDREAS logo.

(() => {
  const R = 100; // rim radius in SVG units (viewBox is -100..100)
  const BLADES = 6;
  const fmt = (n) => n.toFixed(2);

  function geometry(t) {
    // Past t = 1 the hexagon is larger than the rim, so the whole circle is clear.
    const r = R * 1.18 * t;
    const turn = (1 - t) * 34; // the blades rotate a little as they open, like a real lens
    const pts = Array.from({ length: BLADES }, (_, i) => {
      const a = ((360 / BLADES) * i - 90 + turn) * (Math.PI / 180);
      return [r * Math.cos(a), r * Math.sin(a)];
    });

    const rim = `M${R} 0A${R} ${R} 0 1 0 ${-R} 0A${R} ${R} 0 1 0 ${R} 0Z`;
    const hole = r > 0.01 ? `M${pts.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join('L')}Z` : '';

    // Each seam starts at a hexagon corner and runs backwards along the next edge to the rim.
    const seams = pts
      .map((p, i) => {
        const q = pts[(i + 1) % BLADES];
        let dx = p[0] - q[0];
        let dy = p[1] - q[1];
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        if (r <= 0.01) {
          // Closed: seams radiate from the centre.
          const a = ((360 / BLADES) * i - 90 + turn + 60) * (Math.PI / 180);
          dx = Math.cos(a);
          dy = Math.sin(a);
        }
        const b = p[0] * dx + p[1] * dy;
        const c = p[0] * p[0] + p[1] * p[1] - R * R;
        const s = -b + Math.sqrt(Math.max(0, b * b - c));
        return `M${fmt(p[0])} ${fmt(p[1])}L${fmt(p[0] + dx * s)} ${fmt(p[1] + dy * s)}`;
      })
      .join('');
    return { blades: rim + hole, seams };
  }

  let uid = 0;
  function createIris() {
    const id = `iris-clip-${(uid += 1)}`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-104 -104 208 208');
    svg.setAttribute('class', 'iris');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <defs>
        <clipPath id="${id}"><circle r="${R}"/></clipPath>
        <linearGradient id="${id}-g" x1="0" y1="-1" x2="0" y2="1">
          <stop offset="0" stop-color="var(--blade-hi)"/><stop offset="1" stop-color="var(--blade-lo)"/>
        </linearGradient>
      </defs>
      <g clip-path="url(#${id})">
        <path class="iris-blades" fill="url(#${id}-g)" fill-rule="evenodd"/>
        <path class="iris-seams" fill="none"/>
      </g>
      <circle class="iris-rim" r="${R + 1.5}" fill="none"/>`;
    const blades = svg.querySelector('.iris-blades');
    const seams = svg.querySelector('.iris-seams');
    const set = (t) => {
      const g = geometry(Math.min(1, Math.max(0, t)));
      blades.setAttribute('d', g.blades);
      seams.setAttribute('d', g.seams);
      svg.dataset.open = String(t);
    };
    set(1);
    return { svg, set };
  }

  window.SBDIris = { createIris };
})();
