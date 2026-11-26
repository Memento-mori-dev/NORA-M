import { bindTouchPress } from './touch-press.js';
import closersPhoto from '../assets/hero/closers.jpg';
import hingesPhoto from '../assets/hero/hinges.jpg';
import locksPhoto from '../assets/popular-categories/locks-preview.jpg';

const photoByCategory = {
  'door-accessories': hingesPhoto,
  'door-closers': closersPhoto,
  locks: locksPhoto,
  'furniture-hardware': closersPhoto,
  hinges: hingesPhoto,
  'door-cylinders': locksPhoto,
};

const categories = document.querySelector('.popular-categories');

if (categories) {
  const preview = categories.querySelector('.popular-categories__preview');
  const wideLayout = window.matchMedia('(min-width: 48rem)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let currentLayer = preview.firstElementChild;
  let currentTile = categories.querySelector('[data-category="door-closers"]');
  let requestedTile = currentTile;
  let hoverTimer;
  let updating = false;

  function cancelHover() {
    window.clearTimeout(hoverTimer);
    hoverTimer = undefined;
  }

  function selectTile(tile) {
    cancelHover();
    requestedTile = tile;
    updatePreview();
  }

  async function updatePreview() {
    const tile = requestedTile;
    if (!wideLayout.matches || updating || hoverTimer !== undefined || tile === currentTile) return;

    updating = true;

    try {
      const image = new Image();
      image.className = 'popular-categories__photo';
      image.alt = tile.querySelector('.popular-categories__name').textContent;
      image.src = photoByCategory[tile.dataset.category];

      try {
        await image.decode();
      } catch {
        return;
      }

      if (tile !== requestedTile || hoverTimer !== undefined || !wideLayout.matches) return;

      const incomingLayer = document.createElement('div');
      incomingLayer.className = 'popular-categories__photo-layer';
      incomingLayer.append(image);

      const animate = !reducedMotion.matches;
      if (animate) {
        incomingLayer.setAttribute('aria-hidden', 'true');
        incomingLayer.classList.add('is-entering');
        currentLayer.classList.add('is-leaving');
      }

      preview.append(incomingLayer);

      if (animate) {
        // A breakpoint change can cancel the animation or prevent it from starting.
        const animations = incomingLayer.getAnimations();
        await Promise.allSettled(animations.map((animation) => animation.finished));
        incomingLayer.classList.remove('is-entering');
        incomingLayer.removeAttribute('aria-hidden');
      }

      currentLayer.remove();
      currentLayer = incomingLayer;
      currentTile = tile;
    } finally {
      updating = false;
      if (requestedTile !== tile) updatePreview();
    }
  }

  categories.querySelectorAll('.popular-categories__tile').forEach((tile) => {
    bindTouchPress(tile);

    tile.addEventListener('pointerenter', (event) => {
      if (!wideLayout.matches || event.pointerType === 'touch') return;
      cancelHover();
      hoverTimer = window.setTimeout(() => selectTile(tile), 90);
    });

    tile.addEventListener('pointerleave', (event) => {
      if (!wideLayout.matches || event.pointerType === 'touch') return;
      cancelHover();
      window.requestAnimationFrame(updatePreview);
    });

    tile.addEventListener('focusin', (event) => {
      if (event.target.matches(':focus-visible')) selectTile(tile);
    });

    tile.addEventListener('click', (event) => {
      if (wideLayout.matches && !event.target.closest('a')) {
        if (window.matchMedia('(any-hover: none)').matches) {
          categories.querySelector('.popular-categories__tile.is-selected')?.classList.remove('is-selected');
          tile.classList.add('is-selected');
        }
        selectTile(tile);
      }
    });
  });

  wideLayout.addEventListener('change', cancelHover);
}
