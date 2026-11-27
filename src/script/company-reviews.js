import Swiper from '../vendor/swiper/swiper-bundle.min.js';
import { getSliderNavigation } from './nora-slider-navigation.js';
import { getSliderPagination } from './nora-slider-pagination.js';

const section = document.querySelector('.company-reviews');

if (section) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  new Swiper(section.querySelector('.company-reviews__slider'), {
    slidesPerView: 'auto',
    spaceBetween: 8,
    speed: reducedMotion.matches ? 0 : 400,
    watchSlidesProgress: true,
    a11y: {
      slideLabelMessage: '{{index}} из {{slidesLength}}',
      prevSlideMessage: 'Предыдущий отзыв',
      nextSlideMessage: 'Следующий отзыв',
      paginationBulletMessage: 'Отзыв {{index}}',
    },
    navigation: getSliderNavigation(section),
    pagination: getSliderPagination(section.querySelector('.company-reviews__pagination')),
  });
}
