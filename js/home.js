// Home page: the hero entrance (brand letters rise, the aperture opens on the reel)
// and the reel dialog behind the aperture button.

(() => {
  const ui = window.SBDUI;
  const hero = document.querySelector('.hero');
  if (!ui || !hero) return;

  // Split the brand name into letters for the entrance. Screen readers keep the
  // h1's aria-label, so they still hear one word.
  const title = hero.querySelector('.hero-title');
  title.querySelectorAll('[data-split]').forEach((part) => {
    part.innerHTML = [...part.textContent].map((c) => `<span class="ch" aria-hidden="true">${c}</span>`).join('');
  });
  const letters = title.querySelectorAll('.ch');

  // The aperture: an SVG iris over the looping reel.
  const aperture = hero.querySelector('.hero-aperture');
  const iris = window.SBDIris?.createIris();
  if (iris) aperture.append(iris.svg);

  // The reel opens in a dialog with sound and controls.
  let reel;
  aperture.addEventListener('click', () => {
    if (!reel) {
      reel = document.createElement('dialog');
      reel.className = 'lightbox';
      reel.setAttribute('aria-label', 'Showreel');
      reel.innerHTML = `<div class="lightbox-inner">
          <div class="lightbox-top"><span class="eyebrow">Showreel</span>
            <button type="button" class="btn btn-sm" data-close>Close</button></div>
          <div class="reel-stage">${ui.playerHTML({ src: '/media/films/reel.mp4', poster: '/media/films/reel.jpg', label: 'showreel' })}</div>
          <span></span>
        </div>`;
      document.body.append(reel);
      reel.addEventListener('click', (e) => e.target.closest('[data-close]') && ui.closeDialog(reel));
      reel.addEventListener('cancel', (e) => {
        e.preventDefault();
        ui.closeDialog(reel);
      });
      reel.player = ui.mountPlayer(reel.querySelector('.player'));
    }
    ui.openDialog(reel);
    reel.player.setMuted(false);
    reel.player.video.currentTime = 0;
    reel.player.play();
    reel.querySelector('[data-close]').focus();
  });

  if (!ui.motionOk()) return; // the iris rests fully open and everything is visible

  const orbit = hero.querySelector('.hero-orbit');
  const side = hero.querySelectorAll('.hero-text');
  const cta = hero.querySelector('.hero-cta');
  const state = { t: 0 };
  const setIris = () => iris?.set(state.t);
  gsap.set(letters, { yPercent: 70, autoAlpha: 0, rotateX: -60 });
  gsap.set(side, { autoAlpha: 0 });
  gsap.set(cta, { autoAlpha: 0, y: 24 });
  gsap.set(aperture, { autoAlpha: 0 });
  setIris();

  ui.introDone.then(() => {
    gsap
      .timeline({ defaults: { ease: 'expo.out' } })
      .to(letters, { yPercent: 0, autoAlpha: 1, rotateX: 0, duration: 1.3, stagger: 0.045 })
      .fromTo(aperture, { scale: 0.86, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.4 }, 0.2)
      .to(state, { t: 1, duration: 1.8, ease: 'power2.inOut', onUpdate: setIris }, 0.45)
      .fromTo(side[0], { x: -50 }, { x: 0, autoAlpha: 1, duration: 1.2 }, 0.9)
      .fromTo(side[1] || [], { x: 50 }, { x: 0, autoAlpha: 1, duration: 1.2 }, 0.9)
      .to(cta, { autoAlpha: 1, y: 0, duration: 1 }, 1.2)
      .add(() => {
        // Once open, the iris narrows as the hero scrolls away, like stopping down.
        gsap.to(state, {
          t: 0.42,
          ease: 'none',
          onUpdate: setIris,
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 },
        });
      });
    gsap.to(orbit, { rotation: 360, duration: 60, repeat: -1, ease: 'none' });
  });
})();
