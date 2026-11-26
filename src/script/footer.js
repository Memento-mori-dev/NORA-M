import gsap from '../vendor/gsap/index.js';
import { menuSlide } from './menu-motion.js';

const footer = document.querySelector('.site-footer');

if (footer) {
  const breakpoint = getComputedStyle(document.documentElement).getPropertyValue('--layout-breakpoint').trim();
  const mobile = window.matchMedia(`(width < ${breakpoint})`);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggles = footer.querySelectorAll('.site-footer__toggle');

  function setExpanded(button, expanded, animate) {
    const list = document.getElementById(button.getAttribute('aria-controls'));
    const clearProps = 'height,opacity';

    gsap.killTweensOf(list);
    button.setAttribute('aria-expanded', String(expanded));
    list.inert = !expanded;

    if (!animate) {
      list.hidden = !expanded;
      gsap.set(list, { clearProps });
      return;
    }

    if (expanded && list.hidden) {
      gsap.set(list, { height: 0, opacity: 0 });
      list.hidden = false;
    }

    gsap.to(list, {
      height: expanded ? 'auto' : 0,
      opacity: expanded ? 1 : 0,
      duration: 0.3,
      ease: menuSlide.ease,
      onComplete: () => {
        list.hidden = !expanded;
        gsap.set(list, { clearProps });
      },
    });
  }

  function syncLayout() {
    for (const button of toggles) {
      button.disabled = !mobile.matches;
      setExpanded(button, !mobile.matches, false);
    }
  }

  for (const button of toggles) {
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      setExpanded(button, expanded, !reducedMotion.matches);
    });
  }

  mobile.addEventListener('change', syncLayout);
  syncLayout();
}
