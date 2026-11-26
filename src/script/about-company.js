const section = document.querySelector('.about-company');

if (section) {
  const toggle = section.querySelector('.nora-disclosure-toggle');
  const details = document.getElementById(toggle.getAttribute('aria-controls'));

  details.inert = true;
  toggle.hidden = false;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'false';
    details.classList.add('is-animated');
    details.inert = !expanded;
    toggle.setAttribute('aria-expanded', String(expanded));
  });
}
