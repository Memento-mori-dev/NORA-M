for (const point of document.querySelectorAll('.nora-point')) {
  point.addEventListener('click', () => {
    const pressed = point.getAttribute('aria-pressed') === 'true';
    point.setAttribute('aria-pressed', String(!pressed));
  });
}
