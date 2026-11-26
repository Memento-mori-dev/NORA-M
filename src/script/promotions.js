import { getSliderNavigation } from './nora-slider-navigation.js';
import { getSliderPagination } from './nora-slider-pagination.js';
import Swiper from '../vendor/swiper/swiper-bundle.min.js';
import '../vendor/swiper/swiper-bundle.min.css';

const section = document.querySelector('.promotions');

if (section) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  new Swiper(section.querySelector('.promotions__slider'), {
    // The slide widths follow the same rem breakpoint as the section layout.
    slidesPerView: 'auto',
    spaceBetween: 8,
    speed: reduceMotion.matches ? 0 : 400,
    watchOverflow: true,
    a11y: {
      prevSlideMessage: 'Предыдущая акция',
      nextSlideMessage: 'Следующая акция',
      paginationBulletMessage: 'Акция {{index}}',
    },
    navigation: {
      ...getSliderNavigation(section),
      lockClass: 'promotions__arrow--locked',
    },
    pagination: getSliderPagination(section.querySelector('.promotions__pagination')),
  });
}
