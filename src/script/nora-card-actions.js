document.querySelectorAll('.nora-card-action, .nora-cart-button').forEach((button) => {
  button.addEventListener('click', () => {
    const pressed = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!pressed));
    if (button.classList.contains('nora-cart-button')) {
      button.setAttribute('aria-label', pressed ? 'Добавить товар в корзину' : 'Убрать товар из корзины');
      button.classList.add('is-just-toggled');
    }
  });
  if (button.classList.contains('nora-cart-button')) {
    button.addEventListener('pointerleave', () => button.classList.remove('is-just-toggled'));
    button.addEventListener('blur', () => button.classList.remove('is-just-toggled'));
  }
});
