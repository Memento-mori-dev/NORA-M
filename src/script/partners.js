import './nora-partner-card.js';
import Swiper from '../vendor/swiper/swiper-bundle.min.js';

const transitionSpeed = 900;
const slider = document.querySelector('.partners__slider');

if (slider) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const getTransitionSpeed = () => reducedMotion.matches ? 0 : transitionSpeed;

  const swiper = new Swiper(slider, {
    slidesPerView: 'auto',
    breakpoints: {
      768: { slidesPerView: 3 },
      832: { slidesPerView: 4 },
    },
    spaceBetween: 8,
    loop: true,
    speed: getTransitionSpeed(),
    autoplay: {
      enabled: !reducedMotion.matches,
      delay: 6000,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
    },
    a11y: { slideRole: 'listitem' },
  });

  reducedMotion.addEventListener('change', ({ matches }) => {
    swiper.params.speed = getTransitionSpeed();
    if (matches) swiper.autoplay.stop();
    else swiper.autoplay.start();
  });
}
