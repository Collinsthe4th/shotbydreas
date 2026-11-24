// Home page: the hero entrance and the reviews carousel.
//
// Hero entrance, like pulling focus on a lens: each letter of SHOTBYDREAS rises out of
// its line blurred and stretched, then snaps sharp, spreading out from the middle of the
// word while the spacing tightens. DREAS arrives in ivory and then "develops" to its
// grey letter by letter. Meanwhile the iris opens on the first photograph, and from then
// on it closes and opens again every few seconds to reveal the next photograph.

(() => {
  const ui = window.SBDUI;
  const hero = document.querySelector('.hero');
  if (!ui || !hero) return;

  // Split the brand name into letters. Screen readers keep the h1's aria-label.
  const title = hero.querySelector('.hero-title');
  title.querySelectorAll('[data-split]').forEach((part) => {
    part.innerHTML = [...part.textContent].map((c) => `<span class="ch" aria-hidden="true">${c}</span>`).join('');
  });
  const letters = title.querySelectorAll('.ch');
  const develop = title.querySelectorAll('.t2 .ch');

  const aperture = hero.querySelector('.hero-aperture');
  const iris = window.SBDIris?.createIris();
  if (iris) aperture.append(iris.svg);

  setUpCarousel();

  if (!ui.motionOk()) return; // the iris rests open and everything is visible

  const small = window.matchMedia('(max-width: 760px)').matches;
  const side = hero.querySelectorAll('.hero-text');
  const cta = hero.querySelector('.hero-cta');
  const photos = [...aperture.querySelectorAll('img')];
  const css = getComputedStyle(document.documentElement);
  const ivory = css.getPropertyValue('--ink').trim();
  const stone = css.getPropertyValue('--stone').trim();
  // c: how far the iris is open in its open/close cycle. s: how far scrolling away has
  // stopped it down. The drawn opening is the two multiplied.
  const state = { c: 0, s: 1 };
  const setIris = () => iris?.set(state.c * state.s);

  title.classList.add('is-entering'); // clips each line while the letters rise
  gsap.set(letters, { yPercent: 105, scaleY: 1.6, filter: 'blur(14px)', autoAlpha: 0, transformOrigin: '50% 100%' });
  gsap.set(develop, { color: ivory });
  gsap.set(title, { letterSpacing: small ? '0.06em' : '0.12em' });
  gsap.set(side, { autoAlpha: 0 });
  gsap.set(cta, { autoAlpha: 0, y: 24 });
  gsap.set(aperture, { autoAlpha: 0, scale: 0.88 });
  gsap.set(photos, { scale: 1.25 });
  setIris();

  ui.introDone.then(() => {
    gsap
      .timeline({ defaults: { ease: 'expo.out' } })
      .to(letters, {
        yPercent: 0,
        scaleY: 1,
        filter: 'blur(0px)',
        autoAlpha: 1,
        duration: 1.4,
        stagger: { each: 0.055, from: 'center' },
      })
      .to(title, { letterSpacing: '-0.02em', duration: 1.8, ease: 'power3.out' }, 0)
      .to(develop, { color: stone, duration: 0.9, stagger: 0.08, ease: 'power1.inOut' }, 1.1)
      .add(() => title.classList.remove('is-entering'), 1.6)
      .add(() => gsap.set(develop, { clearProps: 'color' }), 2.4)
      .to(aperture, { autoAlpha: 1, scale: 1, duration: 1.4 }, 0.35)
      .to(photos[0], { scale: 1, duration: 2.4, ease: 'power3.out' }, 0.35)
      .to(state, { c: 1, duration: 1.8, ease: 'power2.inOut', onUpdate: setIris }, 0.6)
      .fromTo(side, { y: 30 }, { y: 0, autoAlpha: 1, duration: 1.2, stagger: 0.12 }, 1)
      .to(cta, { autoAlpha: 1, y: 0, duration: 1 }, 1.25)
      .add(() => {
        gsap.set(letters, { clearProps: 'filter,transform' });
        // Once open, the iris narrows as the hero scrolls away, like stopping down.
        gsap.to(state, {
          s: 0.42,
          ease: 'none',
          onUpdate: setIris,
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 },
        });
        startCycle();
      });
  });

  // The aperture slideshow: hold, close the iris, swap to the next photograph while it is
  // shut, open again. It only runs while the hero is on screen.
  function startCycle() {
    if (photos.length < 2) return;
    let index = 0;
    const tl = gsap.timeline({ repeat: -1, paused: true });
    tl.to(state, { c: 0, duration: 0.75, ease: 'power3.in', onUpdate: setIris }, '+=3.2')
      .add(() => {
        photos[index].classList.remove('is-current');
        index = (index + 1) % photos.length;
        photos[index].classList.add('is-current');
        gsap.set(photos[index], { scale: 1.18 });
      })
      .to(state, { c: 1, duration: 1.1, ease: 'power3.out', onUpdate: setIris })
      .to(photos, { scale: 1, duration: 2.6, ease: 'power2.out' }, '<');
    new IntersectionObserver(([e]) => (e.isIntersecting ? tl.play() : tl.pause())).observe(aperture);
  }

  // Reviews carousel (phones). The cards scroll natively with snap points; this adds
  // the dots, keeps them in step with swiping, and moves on by itself every few
  // seconds until the visitor touches it.
  function setUpCarousel() {
    const track = document.querySelector('.reviews');
    const dotsBox = document.querySelector('.carousel-dots');
    if (!track || !dotsBox) return;
    const cards = [...track.children];
    let current = 0;
    let timer;
    const stop = () => clearInterval(timer);
    const isCarousel = () => getComputedStyle(track).display === 'flex';
    const go = (i) => {
      const card = cards[i];
      track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.clientWidth) / 2, behavior: ui.reduceMotion.matches ? 'auto' : 'smooth' });
    };
    const dots = cards.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Review ${i + 1} of ${cards.length}`);
      b.addEventListener('click', () => {
        stop();
        go(i);
      });
      dotsBox.append(b);
      return b;
    });
    const centre = (c) => c.offsetLeft + c.clientWidth / 2;
    const mark = () => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      cards.forEach((c, i) => {
        if (Math.abs(centre(c) - mid) < Math.abs(centre(cards[best]) - mid)) best = i;
      });
      current = best;
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === best)));
      cards.forEach((c, i) => c.classList.toggle('is-active', i === best));
    };
    track.addEventListener('scroll', () => requestAnimationFrame(mark), { passive: true });
    mark();

    if (!ui.reduceMotion.matches) {
      // Only advance while the reviews are on screen.
      new IntersectionObserver(([e]) => {
        stop();
        if (e.isIntersecting && isCarousel() && !track.dataset.touched) {
          timer = setInterval(() => go((current + 1) % cards.length), 4500);
        }
      }).observe(track);
    }
    ['pointerdown', 'wheel', 'keydown', 'focusin'].forEach((ev) =>
      track.addEventListener(
        ev,
        () => {
          track.dataset.touched = 'true';
          stop();
        },
        { passive: true },
      ),
    );
  }
})();
