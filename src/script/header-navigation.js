import gsap from '../vendor/gsap/index.js';
import { menuSlide, revealMenuLabels, revealMenuShade } from './menu-motion.js';
import { bindTouchPress } from './touch-press.js';

const toggle = document.querySelector('.header__menu-toggle');

if (toggle) {
  const navigation = document.getElementById(toggle.getAttribute('aria-controls'));
  const drawer = navigation.closest('.header__drawer');
  const shade = drawer.querySelector('.header__drawer-shade');
  const bottom = toggle.closest('.header__bottom');
  const catalog = bottom.querySelector('.header__catalog');
  const firstLink = navigation.querySelector('a');
  const links = navigation.querySelectorAll('.header__links a, .header__button--wholesale, .header__demo-links a');
  const labels = [...links, bottom.querySelector('.header__contact')];
  bindTouchPress(toggle);
  links.forEach(bindTouchPress);
  const breakpoint = getComputedStyle(document.documentElement).getPropertyValue('--layout-breakpoint').trim();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  let motion = null;

  function setExpanded(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    navigation.inert = motion !== null && !open;
  }

  function hideDrawer() {
    drawer.hidden = true;
  }

  const media = gsap.matchMedia();
  media.add(`(width < ${breakpoint})`, () => {
    motion = revealMenuShade(gsap.timeline({
      paused: true,
      onReverseComplete: hideDrawer,
    }), shade)
      .fromTo(navigation, { yPercent: 100 }, { yPercent: 0, ...menuSlide }, 0);
    revealMenuLabels(motion, labels, 0.2, 0.035);
    setExpanded(false);

    return () => {
      motion = null;
      setExpanded(false);
      hideDrawer();
    };
  });

  function setOpen(open, immediate = false) {
    if (!motion) return;
    setExpanded(open);

    if (open) {
      drawer.hidden = false;
      if (reducedMotion.matches) motion.progress(1).pause();
      else motion.play();
      firstLink.focus({ preventScroll: true });
    } else if (immediate || reducedMotion.matches || motion.progress() === 0) {
      motion.pause(0, true);
      hideDrawer();
    } else {
      motion.reverse();
    }
  }

  toggle.addEventListener('click', () => {
    const open = !isOpen();
    if (open && catalog.getAttribute('aria-expanded') === 'true') catalog.click();
    setOpen(open);
  });

  catalog.addEventListener('click', () => {
    if (!drawer.hidden) setOpen(false, true);
  });

  document.addEventListener('click', event => {
    if (!isOpen() || toggle.contains(event.target) || navigation.contains(event.target)) return;
    if (event.target === shade) toggle.focus({ preventScroll: true });
    setOpen(false);
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !isOpen()) return;
    toggle.focus({ preventScroll: true });
    setOpen(false);
  });
}
