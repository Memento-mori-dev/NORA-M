import gsap from '../vendor/gsap/index.js';
import { menuSlide, revealMenuLabels, revealMenuShade } from './menu-motion.js';
import { bindTouchPress } from './touch-press.js';
import { catalogGroups } from '../data/catalog-menu.js';

const catalogCategories = { ...catalogGroups.main, ...catalogGroups.additional };

const menu = document.querySelector('#catalog-menu');
const trigger = document.querySelector('.header__catalog');

if (menu && trigger) {
  const header = trigger.closest('.header');
  const close = menu.querySelector('.catalog-menu__backdrop');
  const shade = menu.querySelector('.catalog-menu__shade');
  const [primary, secondary] = menu.querySelectorAll('.catalog-menu__column');
  const categories = primary.querySelectorAll('[data-catalog-category]');
  const heading = secondary.querySelector('.catalog-menu__heading .catalog-menu__text');
  const items = secondary.querySelector('.catalog-menu__items');
  const itemsHome = items.parentElement;
  const search = menu.querySelector('.catalog-menu__search');
  const searchInput = search.querySelector('input');
  const empty = primary.querySelector('.catalog-menu__empty');
  const demoLinks = primary.querySelectorAll('.catalog-menu__demo-link');
  const itemTemplate = secondary.querySelector('.catalog-menu__item-template');
  const nestedTemplate = secondary.querySelector('.catalog-menu__nested-template');
  const promoButton = secondary.querySelector('.catalog-menu__promo-button');
  const breakpoint = getComputedStyle(document.documentElement).getPropertyValue('--layout-breakpoint').trim();
  const mobileLayout = window.matchMedia(`(width < ${breakpoint})`);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const { ease, duration } = menuSlide;
  let isOpen = false;
  let activeCategory = null;
  let submenuLabels;
  let promoIntro;
  let scrollTween = null;
  let scrollTarget = 0;

  const primaryLabels = revealMenuLabels(gsap.timeline({ paused: true }), primary.querySelectorAll('.catalog-menu__text'), 0.2, 0.035);
  const primarySlide = revealMenuShade(gsap.timeline({
    paused: true,
    onReverseComplete: finishClose
  }), shade)
    .fromTo(primary, { xPercent: -100 }, { xPercent: 0, duration, ease }, 0)
    .to(menu, { '--catalog-menu-primary-progress': 1, duration, ease }, 0);

  const mobileSlide = gsap.timeline({ paused: true, onReverseComplete: finishClose })
    .fromTo(menu, { xPercent: -100 }, { xPercent: 0, ...menuSlide, immediateRender: false });

  const secondarySlide = gsap.timeline({
    paused: true,
    onReverseComplete: finishDesktopSubmenuClose
  })
    .fromTo(secondary, { xPercent: -100 }, { xPercent: 0, duration, ease }, 0)
    .to(menu, { '--catalog-menu-secondary-progress': 1, duration, ease }, 0);

  function alignMenu() {
    if (menu.hidden) return;
    if (!trigger.getClientRects().length) {
      isOpen = false;
      trigger.setAttribute('aria-expanded', 'false');
      finishClose();
      return;
    }

    menu.style.setProperty('--catalog-menu-top', `${Math.max(0, header.getBoundingClientRect().bottom)}px`);
  }

  function setActiveCategory(category) {
    activeCategory?.setAttribute('aria-expanded', 'false');
    activeCategory = category;
    activeCategory?.setAttribute('aria-expanded', 'true');
  }

  function makeItem(label, href) {
    const link = itemTemplate.content.firstElementChild.cloneNode(true);
    link.querySelector('.catalog-menu__text').textContent = label;
    link.href = href;
    return link;
  }

  function makeNestedItem(label, href) {
    const group = nestedTemplate.content.firstElementChild.cloneNode(true);
    const [button, list] = group.children;
    button.querySelector('.catalog-menu__text').textContent = label;
    const links = [
      makeItem('Все товары раздела', href),
      makeItem('Новинки раздела', href + '&view=new'),
    ];
    links.forEach(bindTouchPress);
    list.firstElementChild.append(...links);
    bindTouchPress(button);
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      setAccordionOpen(list, !expanded);
    });
    return group;
  }

  function setAccordionOpen(list, open, animate = !reducedMotion.matches) {
    gsap.killTweensOf(list);
    list.inert = !open;
    if (open) {
      const wasHidden = list.hidden;
      list.hidden = false;
      if (!animate) {
        gsap.set(list, { clearProps: 'height,opacity' });
      } else {
        if (wasHidden) gsap.set(list, { height: 0, opacity: 0 });
        gsap.to(list, { height: 'auto', opacity: 1, duration: 0.3, ease, clearProps: 'height,opacity' });
      }
    } else if (!animate || list.hidden) {
      list.hidden = true;
    } else {
      gsap.to(list, { height: 0, opacity: 0, duration: 0.3, ease, onComplete: () => { list.hidden = true; } });
    }
  }

  function openSubmenu(category) {
    if (!isOpen) return;
    setActiveCategory(category);

    const key = category.dataset.catalogCategory;
    const { name, heading: title = name, items: links } = catalogCategories[key];
    heading.textContent = title;
    submenuLabels?.kill();
    gsap.killTweensOf(items.querySelectorAll('.catalog-menu__nested-items'));
    items.replaceChildren(...links.map((label, index) => {
      const href = `?${new URLSearchParams({ catalog: key, item: label })}`;
      if (index === 1) return makeNestedItem(label, href);
      const item = makeItem(label, href);
      item.classList.toggle('catalog-menu__link--featured', index === 0);
      return item;
    }));
    if (mobileLayout.matches) {
      gsap.killTweensOf(items);
      category.after(items);
      gsap.set(items, { height: 0, opacity: 0 });
      setAccordionOpen(items, true);
      return;
    }

    const openingPanel = secondary.hidden;
    const labels = [heading, ...items.querySelectorAll('.catalog-menu__text:not(.catalog-menu__nested-items .catalog-menu__text)')];
    const stagger = 0.065;
    const revealDelay = openingPanel ? 0.24 : 0.06;
    submenuLabels = revealMenuLabels(gsap.timeline({ paused: true }), labels, revealDelay, stagger);

    if (openingPanel) {
      promoIntro?.kill();
      gsap.set(promoButton, { xPercent: -100, x: '-1.5rem' });
      const promoLabels = promoButton.closest('.catalog-menu__promo').querySelectorAll('.catalog-menu__text');
      promoIntro = revealMenuLabels(
        gsap.timeline({ paused: true }), promoLabels, revealDelay + labels.length * stagger, stagger
      ).to(promoButton, { xPercent: 0, x: 0, duration: 0.55, ease }, 0.3);
    }

    secondary.scrollTop = 0;
    secondary.hidden = false;
    secondary.inert = false;
    if (reducedMotion.matches) {
      secondarySlide.progress(1).pause();
      submenuLabels.progress(1).pause();
      promoIntro.progress(1).pause();
    } else {
      secondarySlide.play();
      submenuLabels.play();
      promoIntro.play();
    }
  }

  function closeSubmenu() {
    setActiveCategory(null);
    if (mobileLayout.matches) {
      setAccordionOpen(items, false, isOpen && !reducedMotion.matches);
      if (!isOpen) closePrimary();
      return;
    }

    secondary.inert = true;
    submenuLabels?.pause();
    promoIntro?.pause();

    if (!reducedMotion.matches && secondarySlide.progress() > 0) {
      secondarySlide.reverse();
    } else {
      secondarySlide.pause(0, true);
      finishDesktopSubmenuClose();
    }
  }

  function finishDesktopSubmenuClose() {
    secondary.hidden = true;
    submenuLabels?.pause(0);
    promoIntro?.pause(0);
    if (!isOpen) closePrimary();
  }

  function closePrimary() {
    const slide = mobileLayout.matches ? mobileSlide : primarySlide;
    if (slide.progress() > 0 && !reducedMotion.matches) slide.reverse();
    else finishClose();
  }

  function finishClose() {
    stopSmoothScroll();
    menu.hidden = true;
    mobileSlide.pause(0, true);
    gsap.set(menu, { clearProps: 'transform' });
    primarySlide.pause(0, true);
    secondarySlide.pause(0, true);
    primaryLabels.pause(0);
    submenuLabels?.pause(0);
    promoIntro?.pause(0);
    secondary.hidden = true;
    secondary.inert = true;
    setActiveCategory(null);
    gsap.killTweensOf(items);
    gsap.set(items, { clearProps: 'height,opacity' });
    itemsHome.append(items);
    items.hidden = false;
    items.inert = false;
  }

  function setOpen(open) {
    isOpen = open;
    trigger.setAttribute('aria-expanded', String(open));

    if (open) {
      menu.hidden = false;
      menu.inert = false;
      alignMenu();
      const slide = mobileLayout.matches ? mobileSlide : primarySlide;
      if (mobileLayout.matches) {
        gsap.set(primary, { xPercent: 0 });
        if (slide.progress() === 0) gsap.set(menu, { xPercent: -100 });
        primary.scrollTop = 0;
        searchInput.value = '';
        filterCategories();
      }
      close.focus({ preventScroll: true });
      if (reducedMotion.matches) {
        slide.progress(1).pause();
        primaryLabels.progress(1).pause();
      } else {
        slide.play();
        primaryLabels.play();
      }
    } else {
      stopSmoothScroll();
      trigger.focus({ preventScroll: true });
      menu.inert = true;
      primaryLabels.pause();
      closeSubmenu();
    }
  }

  trigger.addEventListener('click', () => setOpen(!isOpen));

  function stopSmoothScroll() {
    scrollTween?.kill();
    scrollTween = null;
  }

  primary.addEventListener('wheel', event => {
    if (!isOpen || mobileLayout.matches || reducedMotion.matches || !event.cancelable || event.ctrlKey || event.shiftKey) return;

    const mode = event.deltaMode;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const limit = primary.scrollHeight - primary.clientHeight;
    if (limit <= 0) return;

    event.preventDefault();
    let delta = event.deltaY;
    if (mode === WheelEvent.DOM_DELTA_LINE) delta *= parseFloat(getComputedStyle(primary).lineHeight);
    if (mode === WheelEvent.DOM_DELTA_PAGE) delta *= primary.clientHeight;

    const from = scrollTween ? scrollTarget : primary.scrollTop;
    const target = Math.max(0, Math.min(limit, from + delta));
    if (target === from) return;

    stopSmoothScroll();
    scrollTarget = target;
    scrollTween = gsap.to(primary, {
      scrollTop: target,
      duration: 0.3,
      ease,
      onComplete: () => { scrollTween = null; },
    });
  }, { passive: false });

  primary.addEventListener('pointerdown', stopSmoothScroll);
  primary.addEventListener('keydown', stopSmoothScroll);
  reducedMotion.addEventListener('change', stopSmoothScroll);

  bindTouchPress(close);

  for (const category of categories) {
    bindTouchPress(category);
    category.addEventListener('click', () => {
      if (category === activeCategory) closeSubmenu();
      else openSubmenu(category);
    });
    category.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight' && category === activeCategory) {
        event.preventDefault();
        items.firstElementChild.focus();
      }
    });
  }

  menu.addEventListener('click', event => {
    if (isOpen && (event.target === menu || event.target === shade || close.contains(event.target))) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen && !event.defaultPrevented) setOpen(false);
  });
  function filterCategories() {
    const query = searchInput.value.trim().toLocaleLowerCase('ru');
    let hasResults = false;
    for (const category of categories) {
      const { name, items: links } = catalogCategories[category.dataset.catalogCategory];
      const labels = [name, ...links];
      category.hidden = !labels.some(label => label.toLocaleLowerCase('ru').includes(query));
      hasResults ||= !category.hidden;
    }
    if (activeCategory?.hidden) closeSubmenu();
    for (const link of demoLinks) link.hidden = Boolean(query);
    empty.hidden = hasResults;
  }

  searchInput.addEventListener('input', filterCategories);
  search.addEventListener('submit', event => {
    event.preventDefault();
    primary.querySelector('[data-catalog-category]:not([hidden])')?.focus();
  });

  function syncLayout() {
    isOpen = false;
    trigger.setAttribute('aria-expanded', 'false');
    finishClose();
    searchInput.value = '';
    filterCategories();
    for (const category of categories) {
      category.setAttribute('aria-controls', mobileLayout.matches ? items.id : secondary.id);
    }
  }

  mobileLayout.addEventListener('change', syncLayout);
  syncLayout();
  new ResizeObserver(alignMenu).observe(header);
  window.addEventListener('scroll', alignMenu, { passive: true });
}
