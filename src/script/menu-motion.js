import gsap from '../vendor/gsap/index.js';
import { CustomEase } from '../vendor/gsap/CustomEase.js';

gsap.registerPlugin(CustomEase);

export const menuSlide = { duration: 0.65, ease: CustomEase.create('catalog-slide', '.22,.65,.22,1') };

export function revealMenuLabels(timeline, labels, start, stagger) {
  return timeline.fromTo(
    labels,
    { yPercent: 25, opacity: 0 },
    { yPercent: 0, opacity: 1, duration: 0.7, stagger, ease: menuSlide.ease },
    start
  );
}

export function revealMenuShade(timeline, shade) {
  return timeline.to(shade, { autoAlpha: 1, backdropFilter: 'blur(0.625rem)', duration: 0.3, ease: 'power1.out' }, 0);
}
