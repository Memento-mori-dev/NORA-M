import { bindTouchPress } from './touch-press.js';

for (const form of document.querySelectorAll('.header__search-toggle')) {
  const button = form.querySelector('.header__button--search');
  const field = form.querySelector('.header__search-form--popover');
  const input = field.querySelector('input');
  bindTouchPress(field.querySelector('button[type="submit"]'));

  function setExpanded(expanded) {
    field.inert = !expanded;
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', expanded ? 'Закрыть поиск' : 'Открыть поиск');
  }

  form.addEventListener('pointerdown', event => {
    // Keep focus in the form when Safari clicks a button without focusing it.
    if (!field.inert && event.target.closest('button')) event.preventDefault();
  });

  button.addEventListener('click', () => {
    if (field.inert) {
      setExpanded(true);
      input.focus({ preventScroll: true });
    } else {
      closeSearch();
    }
  });

  form.addEventListener('focusout', event => {
    if (!form.contains(event.relatedTarget)) setExpanded(false);
  });

  form.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || field.inert) return;

    event.preventDefault();
    closeSearch();
  });

  function closeSearch() {
    button.focus({ preventScroll: true });
    setExpanded(false);
  }
}

for (const form of document.querySelectorAll('.header__search-form--mobile')) {
  const input = form.querySelector('input');
  const clear = form.querySelector('.header__search-clear');

  form.querySelectorAll('button').forEach(bindTouchPress);

  clear.addEventListener('click', () => {
    input.value = '';
    input.focus({ preventScroll: true });
  });
}
