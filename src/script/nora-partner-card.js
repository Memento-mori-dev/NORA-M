for (const link of document.querySelectorAll('.nora-partner-card__link')) {
  link.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' && event.isPrimary) {
      link.classList.add('is-pressed');
    }
  });

  link.addEventListener('lostpointercapture', (event) => {
    if (event.pointerType === 'touch' && event.isPrimary) {
      link.classList.remove('is-pressed');
    }
  });
}
