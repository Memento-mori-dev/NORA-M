import gsap from '../vendor/gsap/index.js';
import { CustomEase } from '../vendor/gsap/CustomEase.js';
import { menuSlide } from './menu-motion.js';
import Swiper from '../vendor/swiper/swiper-bundle.min.js';

const hero = document.querySelector('.hero');

if (hero) {
  const panels = hero.querySelector('.hero__panels');
  const info = [...panels.querySelectorAll('.hero__info')];
  const slides = panels.querySelectorAll('.hero__slide');
  const arrows = hero.querySelectorAll('.hero__controls--arrows button');
  const dots = hero.querySelectorAll('.hero__controls--dots button');
  const product = hero.querySelector('#hero-product');
  const gallery = hero.querySelector('.hero__door-slide');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const swiper = new Swiper(gallery, {
    init: false,
    nested: true,
    speed: reducedMotion.matches ? 0 : 300,
    breakpoints: {
      1024: { slidesPerView: 2, spaceBetween: 8, allowTouchMove: false },
    },
    pagination: { el: gallery.querySelector('.hero__door-pagination'), clickable: true },
  });

  // Match the tablet breakpoint in styles/helpers/_media.scss.
  const desktop = window.matchMedia('(width > 63.99875rem)');
  const progress = hero.querySelector('.hero__timeline-progress');
  const diagram = hero.querySelector('.hero__diagram');
  const drawings = hero.querySelectorAll('.hero__drawing-layer');
  const drawingEnter = CustomEase.create('hero-drawing-enter', '.24,.62,.24,1');
  const drawingExit = CustomEase.create('hero-drawing-exit', '.32,.12,.24,1');
  const caption = diagram.querySelector('figcaption');
  const labels = [...caption.children];
  diagram.remove();
  const illustrations = info.map((panel, index) => {
    const illustration = diagram.cloneNode(true);
    illustration.querySelectorAll('.hero__drawing-layer').forEach((layer, layerIndex) => {
      if (layerIndex === index) layer.hidden = false;
      else layer.remove();
    });
    [...illustration.querySelector('figcaption').children].forEach((label, labelIndex) => {
      if (labelIndex === index) label.hidden = false;
      else label.remove();
    });
    panel.append(illustration);
    return illustration;
  });
  const reveal = { y: 0, opacity: 1, duration: 0.7, ease: menuSlide.ease };

  function animateCopy(timeline) {
    const panel = info[activeIndex];
    const copy = panel.querySelectorAll('.hero__copy h1, .hero__copy h2, .hero__copy p');
    const features = panel.querySelectorAll('.hero__features > div');
    const details = panel.querySelector('.hero__cta');
    const restore = [];

    function revealLines(block, position) {
      const words = [];
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const fragment = document.createDocumentFragment();
        const replacements = node.data.split(/(\s+)/).filter(Boolean).map((part) => {
          if (/^\s+$/.test(part)) return document.createTextNode(part);
          const word = document.createElement('span');
          word.style.display = 'inline-block';
          word.textContent = part;
          words.push(word);
          return word;
        });
        fragment.append(...replacements);
        node.replaceWith(fragment);
        restore.push(() => {
          replacements[0]?.replaceWith(node);
          replacements.slice(1).forEach((part) => part.remove());
        });
      }

      const lines = new Map();
      for (const word of words) {
        const top = Math.round(word.getBoundingClientRect().top);
        if (!lines.has(top)) lines.set(top, []);
        lines.get(top).push(word);
      }
      for (const line of lines.values()) {
        timeline
          .fromTo(line, { y: 16 }, { y: 0, duration: 0.7, ease: menuSlide.ease }, position)
          .fromTo(line, { opacity: 0 }, { opacity: 1, duration: 0.52, ease: 'none' }, position);
        position += 0.08;
      }
      return position;
    }

    let position = 0.08;
    for (const block of copy) position = revealLines(block, position) + 0.08;

    const icons = [];
    features.forEach((feature, index) => {
      const [icon, label, value] = feature.children;
      const start = 0.24 + index * 0.14;
      icons.push(icon);
      timeline.fromTo(icon, { y: 16, opacity: 0 }, reveal, start);
      revealLines(value, revealLines(label, start + 0.18));
    });
    timeline
      .fromTo(details, { y: 22, opacity: 0 }, reveal, position)
      .fromTo(caption, { y: 12, opacity: 0 }, reveal, Math.max(position + 0.14, 0.85));

    if (activeIndex === 0) {
      timeline.fromTo(product, { y: 32, opacity: 0 }, { ...reveal, duration: 0.55 }, 0.3);
    }

    return () => {
      restore.forEach((reset) => reset());
      gsap.set([details, caption, product, ...icons], { clearProps: 'transform,opacity' });
    };
  }
  const slideDelay = 6;
  let activeIndex = 0;
  let transition;
  let timer;
  let mobileSlider;
  let mobileTrack;

  function hasHeroMotion() {
    return desktop.matches && !reducedMotion.matches;
  }

  function shouldPauseTimer() {
    return document.hidden || hero.matches(':has(:focus-visible)');
  }

  function restartTimer() {
    gsap.set(progress, { attr: { 'stroke-dashoffset': 1 } });
    startTimer();
  }

  function startTimer() {
    timer?.kill();
    if (!hasHeroMotion()) return;

    timer = gsap.to(progress, {
      attr: { 'stroke-dashoffset': 0 },
      duration: slideDelay,
      ease: 'none',
      paused: shouldPauseTimer(),
      onComplete: () => showSlide((activeIndex + 1) % slides.length),
    });
  }

  function animateProgress(timeline) {
    const duration = timeline.duration();
    timeline.fromTo(progress, { attr: { 'stroke-dashoffset': 1 } }, {
      attr: { 'stroke-dashoffset': slideDelay / (duration + slideDelay) },
      duration,
      ease: 'none',
    }, 0);
  }

  function syncDrawing() {
    drawings.forEach((layer, index) => {
      layer.hidden = index !== activeIndex;
    });
    syncCaption();
    gsap.set(drawings, { clearProps: 'transform,opacity,clipPath,zIndex' });
  }

  function syncCaption() {
    labels.forEach((label, index) => { label.hidden = index !== activeIndex; });
  }

  function animateDrawing(timeline, previousIndex) {
    const incoming = drawings[activeIndex];
    incoming.hidden = false;
    gsap.set(incoming, { zIndex: 1 });
    if (previousIndex !== undefined) {
      timeline.to(drawings[previousIndex], {
        y: -6, scale: 0.86, opacity: 0, duration: 0.52, ease: drawingExit,
      }, 0);
    }
    timeline.fromTo(incoming, {
      yPercent: 100,
      clipPath: 'inset(0% 0% 100% 0% round 20px)',
    }, {
      yPercent: 0,
      clipPath: 'inset(0% 0% 0% 0% round 20px)',
      duration: 0.62,
      ease: drawingEnter,
    }, 0.14);
    timeline.call(syncCaption, [], 0.24);
  }

  function prepareGallery() {
    if (swiper.initialized) swiper.update();
    else swiper.init();
  }

  function photoLayers(slide) {
    return slide === gallery ? gallery.querySelectorAll('.hero__door-frame') : [slide];
  }

  function restoreIllustration() {
    const index = info.indexOf(diagram.parentElement);
    if (index !== -1) diagram.replaceWith(illustrations[index]);
  }

  function syncDesktopInfo() {
    if (diagram.parentElement !== info[activeIndex]) {
      restoreIllustration();
      illustrations[activeIndex].replaceWith(diagram);
    }
    info.forEach((panel, index) => { panel.hidden = index !== activeIndex; });
  }

  function showSlide(index) {
    transition?.progress(1);
    timer?.kill();
    if (index === activeIndex) {
      restartTimer();
      return;
    }

    const previousIndex = activeIndex;
    const outgoing = slides[previousIndex];
    const incoming = slides[index];
    const animate = hasHeroMotion();
    activeIndex = index;

    slides.forEach((slide, slideIndex) => {
      slide.inert = slideIndex !== index;
      slide.hidden = slideIndex !== index && !(animate && slide === outgoing);
      dots[slideIndex].setAttribute('aria-pressed', String(slideIndex === index));
    });
    syncDesktopInfo();
    if (incoming === gallery) prepareGallery();

    if (!animate) {
      syncDrawing();
      restartTimer();
      return;
    }

    animateSlide(previousIndex);
  }

  function animateSlide(previousIndex) {
    const outgoing = slides[previousIndex];
    const incoming = slides[activeIndex];
    const leaving = outgoing ? photoLayers(outgoing) : [];
    const entering = photoLayers(incoming);

    if (outgoing) gsap.set(incoming, { zIndex: 1 });
    transition = gsap.timeline({
      onComplete() {
        if (outgoing) {
          outgoing.hidden = true;
          gsap.set(incoming, { clearProps: 'zIndex' });
        }
        gsap.set([...leaving, ...entering], { clearProps: 'transform,opacity,clipPath' });
        resetCopy();
        syncDrawing();
        transition = null;
        startTimer();
      },
    });
    if (outgoing) {
      transition.to(leaving, { scale: 0.9, y: -8, opacity: 0, duration: 0.45, ease: menuSlide.ease }, 0);
    }
    transition.fromTo(entering, {
      yPercent: 100,
      opacity: 0,
      clipPath: 'inset(0% 0% 100% 0% round 20px)',
    }, {
      yPercent: 0,
      opacity: 1,
      clipPath: 'inset(0% 0% 0% 0% round 20px)',
      ...menuSlide,
      stagger: outgoing ? 0.06 : 0,
    }, outgoing ? 0.1 : 0);
    const resetCopy = animateCopy(transition);
    animateDrawing(transition, previousIndex);
    animateProgress(transition);
  }

  function selectMobilePage(index) {
    activeIndex = index;
    Array.from(mobileTrack.children).forEach((page, pageIndex) => {
      page.inert = pageIndex !== index;
      dots[pageIndex].setAttribute('aria-pressed', String(pageIndex === index));
    });
  }

  function syncLayout() {
    if (desktop.matches) {
      if (!mobileSlider) {
        syncDesktopInfo();
        return;
      }
      mobileSlider.destroy();
      mobileSlider = null;
      panels.classList.remove('swiper');
      slides.forEach((slide, index) => panels.insertBefore(info[index], mobileTrack).after(slide));
      mobileTrack.remove();
      slides.forEach((slide, index) => {
        slide.hidden = index !== activeIndex;
        slide.inert = index !== activeIndex;
      });
      syncDesktopInfo();
      if (slides[activeIndex] === gallery) prepareGallery();
    } else if (!mobileSlider) {
      slides.forEach((slide) => {
        slide.hidden = false;
        slide.inert = false;
      });
      restoreIllustration();
      mobileTrack = document.createElement('div');
      mobileTrack.className = 'hero__track swiper-wrapper';
      slides.forEach((slide, index) => {
        const page = document.createElement('div');
        page.className = 'hero__page swiper-slide';
        info[index].hidden = false;
        page.append(info[index], slide);
        mobileTrack.append(page);
      });
      panels.append(mobileTrack);
      panels.classList.add('swiper');
      mobileSlider = new Swiper(panels, {
        initialSlide: activeIndex,
        spaceBetween: 8,
        speed: reducedMotion.matches ? 0 : 620,
        noSwipingSelector: '.hero__door-slide',
        a11y: false,
        on: { slideChange: (slider) => selectMobilePage(slider.activeIndex) },
      });
      selectMobilePage(activeIndex);
      prepareGallery();
    }
  }

  function syncMotion() {
    transition?.progress(1);
    syncLayout();
    syncDrawing();
    const speed = reducedMotion.matches ? 0 : 300;
    swiper.params.speed = speed;
    if (mobileSlider) mobileSlider.params.speed = reducedMotion.matches ? 0 : 620;
    restartTimer();
  }

  function syncTimerPause() {
    timer?.paused(shouldPauseTimer());
  }

  desktop.addEventListener('change', syncMotion);
  reducedMotion.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncTimerPause);
  hero.addEventListener('focusin', syncTimerPause);
  hero.addEventListener('focusout', () => queueMicrotask(syncTimerPause));

  arrows.forEach((button, index) => {
    button.addEventListener('click', () => {
      showSlide((activeIndex + (index === 0 ? -1 : 1) + slides.length) % slides.length);
    });
  });

  dots.forEach((button, index) => {
    button.addEventListener('click', () => mobileSlider?.slideTo(index));
  });

  syncMotion();

  if (hasHeroMotion()) {
    timer?.kill();
    animateSlide();
  }
}
