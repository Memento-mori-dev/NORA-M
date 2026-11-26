const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

document.querySelectorAll('.nora-card-action, .nora-cart-button').forEach((button) => {
  button.addEventListener('click', () => {
    const pressed = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!pressed));
    if (button.classList.contains('nora-cart-button')) {
      button.setAttribute('aria-label', pressed ? 'Добавить товар в корзину' : 'Убрать товар из корзины');
      button.classList.toggle('is-removing', pressed && !reduceMotion.matches);
      button.classList.add('is-just-toggled');
      button.classList.remove('is-animating');
      void button.offsetWidth;
      button.classList.add('is-animating');
    }
  });
  if (button.classList.contains('nora-cart-button')) {
    button.addEventListener('pointerleave', () => button.classList.remove('is-just-toggled'));
    button.addEventListener('blur', () => button.classList.remove('is-just-toggled'));
    button.addEventListener('animationend', () => button.classList.remove('is-animating', 'is-removing'));
  }
});
