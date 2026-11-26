import gsap from '../vendor/gsap/index.js';
import { getSliderPagination } from './nora-slider-pagination.js';
import Swiper from '../vendor/swiper/swiper-bundle.min.js';
import '../vendor/swiper/swiper-bundle.min.css';

const section = document.querySelector('.brand-lines');

if (section) {
  const layouts = gsap.matchMedia();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const slider = section.querySelector('.brand-lines__slider');

  layouts.add('(width < 48rem)', () => {
    slider.classList.add('swiper');
    const swiper = new Swiper(slider, {
      spaceBetween: 8,
      speed: reducedMotion.matches ? 0 : 400,
      a11y: { paginationBulletMessage: 'Бренд {{index}}' },
      pagination: getSliderPagination(section.querySelector('.brand-lines__pagination')),
    });

    return () => {
      swiper.destroy(true, true);
      slider.classList.remove('swiper');
    };
  });

  layouts.add({
    wide: '(width >= 48rem)',
    hover: '(any-hover: hover)',
    reduce: '(prefers-reduced-motion: reduce)',
  }, ({ conditions }) => {
    if (!conditions.wide) return;

    const events = new AbortController();
    const options = { signal: events.signal };

    section.querySelectorAll('.brand-lines__card').forEach((card) => {
      const cover = card.querySelector('.brand-lines__cover');
      const panel = card.querySelector('.brand-lines__panel');
      const timeline = gsap.timeline({ paused: true })
        .to(cover, { scale: 0.86, yPercent: 18, duration: 0.55, ease: 'power3.out' }, 0)
        .fromTo(panel, { y: 0, yPercent: 100 }, { yPercent: 0, duration: 0.68, ease: 'power3.out' }, 0.06);
      let hovered = conditions.hover && card.matches(':hover');
      let tapped = false;

      function update(focused = card.matches(':focus-within')) {
        const open = focused || hovered || tapped;
        if (conditions.reduce || focused) timeline.progress(Number(open)).pause();
        else if (open) timeline.play();
        else timeline.reverse();
      }

      function updateHover(event) {
        if (!conditions.hover || event.pointerType === 'touch') return;
        hovered = event.type === 'pointerenter';
        update();
      }

      card.addEventListener('pointerenter', updateHover, options);
      card.addEventListener('pointerleave', updateHover, options);
      card.addEventListener('click', (event) => {
        if ((conditions.hover && event.pointerType !== 'touch') || event.target.closest('a')) return;
        tapped = !tapped;
        update();
      }, options);
      card.addEventListener('focusin', () => update(true), options);
      card.addEventListener('focusout', (event) => update(card.contains(event.relatedTarget)), options);
      update();
    });

    return () => events.abort();
  });
}
