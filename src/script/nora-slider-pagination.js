export function getSliderPagination(element) {
  return {
    el: element,
    clickable: true,
    bulletElement: 'button',
    bulletClass: 'nora-slider-pagination__dot',
    bulletActiveClass: 'nora-slider-pagination__dot--active',
  };
}
