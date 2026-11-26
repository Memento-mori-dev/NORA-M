export function getSliderNavigation(section) {
  return {
    prevEl: section.querySelector('.nora-slider-arrow'),
    nextEl: section.querySelector('.nora-slider-arrow--next'),
    addIcons: false,
  };
}
