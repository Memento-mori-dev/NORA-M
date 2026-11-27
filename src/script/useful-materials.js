import gsap from '../vendor/gsap/index.js';
import Swiper from '../vendor/swiper/swiper-bundle.min.js';
import { getSliderPagination } from './nora-slider-pagination.js';

const section = document.querySelector('.useful-materials');

if (section) {
  const layouts = gsap.matchMedia();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const slider = section.querySelector('.useful-materials__slider');
  const cards = section.querySelector('.useful-materials__cards');
  const slides = cards.querySelectorAll('.useful-materials__card--with-preview');
  const pagination = section.querySelector('.useful-materials__pagination');

  layouts.add('(width < 48rem)', () => {
    slider.classList.add('swiper');
    cards.classList.add('swiper-wrapper');
    slides.forEach(slide => slide.classList.add('swiper-slide'));

    const swiper = new Swiper(slider, {
      spaceBetween: 8,
      speed: reducedMotion.matches ? 0 : 400,
      a11y: {
        slideRole: 'article',
        paginationBulletMessage: 'Материал {{index}}',
      },
      pagination: getSliderPagination(pagination),
    });

    return () => {
      swiper.destroy(true, true);
      slider.classList.remove('swiper');
      cards.classList.remove('swiper-wrapper');
      slides.forEach(slide => slide.classList.remove('swiper-slide'));
    };
  });
}
