export function bindTouchPress(element) {
  element.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') element.classList.add('is-pressed');
  });

  for (const event of ['pointerup', 'pointercancel', 'pointerleave']) {
    element.addEventListener(event, () => element.classList.remove('is-pressed'));
  }
}
