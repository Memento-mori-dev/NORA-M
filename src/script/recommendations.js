import './nora-card-actions.js';
import { getSliderNavigation } from './nora-slider-navigation.js';
import Swiper from '../vendor/swiper/swiper-bundle.min.js';
import '../vendor/swiper/swiper-bundle.min.css';

const section = document.querySelector('.recommendations');

if (section) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const mobile = window.matchMedia('(width < 48rem)');
  const sliderElement = section.querySelector('.recommendations__slider');
  const paginationElement = section.querySelector('.recommendations__pagination');
  const navigation = getSliderNavigation(section);
  let slider;

  function initSlider() {
    slider?.destroy(true, true);

    const isMobile = mobile.matches;
    slider = new Swiper(sliderElement, {
      a11y: { prevSlideMessage: 'Предыдущие товары', nextSlideMessage: 'Следующие товары', paginationBulletMessage: 'Страница {{index}}' },
      slidesPerView: 2,
      breakpoints: isMobile ? {} : {
        1024: { slidesPerView: 3 },
        1280: { slidesPerView: 4 },
      },
      slidesPerGroup: isMobile ? 2 : 1,
      grid: { rows: isMobile ? 2 : 1, fill: 'row' },
      spaceBetween: 8,
      speed: reduceMotion.matches ? 0 : 400,
      pagination: {
        el: paginationElement,
        clickable: true,
      },
      navigation,
    });
  }

  initSlider();
  mobile.addEventListener('change', initSlider);

  section.querySelectorAll('.recommendation-card').forEach((card) => {
    new Swiper(card.querySelector('.recommendation-card__gallery'), {
      a11y: { paginationBulletMessage: 'Изображение {{index}}' },
      nested: true,
      speed: reduceMotion.matches ? 0 : 300,
      pagination: {
        el: card.querySelector('.recommendation-card__indicators'),
        clickable: true,
      },
    });
  });
}
