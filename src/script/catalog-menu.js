import gsap from '../vendor/gsap/index.js';
import { menuSlide, revealMenuLabels, revealMenuShade } from './menu-motion.js';
import { bindTouchPress } from './touch-press.js';

const demoItems = {
  all: ['Дверная фурнитура', 'Замки и цилиндры', 'Мебельная фурнитура', 'Монтажные принадлежности'],
  closers: ['Доводчики дверные Нора', 'Доводчики дверные URBO', 'Доводчики дверные Isparus', 'Доводчики дверные LONEX', 'Доводчики дверные SONEX', 'Комплектующие'],
  handles: ['Нажимные ручки', 'Ручки-скобы', 'Ручки для раздвижных дверей', 'Комплекты с защёлкой'],
  locks: ['Врезные замки', 'Навесные замки', 'Накладные замки', 'Ответные планки', 'Комплекты ключей'],
  hinges: ['Карточные петли', 'Скрытые петли', 'Петли-бабочки', 'Петли с подшипником'],
  cylinders: ['Цилиндры ключ — ключ', 'Цилиндры с вертушкой', 'Цилиндры для узких дверей', 'Комплекты с общим ключом'],
  accessories: ['Дверные упоры', 'Ограничители открывания', 'Дверные глазки', 'Декоративные накладки'],
  furniture: ['Мебельные ручки', 'Петли для шкафов', 'Направляющие для ящиков', 'Мебельные защёлки'],
  collections: ['Для входной двери', 'Для межкомнатных дверей', 'Для офиса', 'Для загородного дома'],
  measuring: ['Рулетки', 'Уровни', 'Угольники', 'Разметочные инструменты'],
  pvc: ['Оконные ручки', 'Балконные защёлки', 'Петли для ПВХ-профиля', 'Ручки для алюминиевых дверей'],
  fire: ['Ручки для противопожарных дверей', 'Замки для эвакуационных выходов', 'Планки «Антипаника»', 'Терморасширяющиеся уплотнители'],
  offers: ['Комплекты для ремонта', 'Подборка навесных замков', 'Фурнитура для нескольких дверей'],
  new: ['Ручки в матовом графите', 'Компактные дверные доводчики', 'Регулируемые скрытые петли', 'Мебельные ручки с насечкой'],
  'hardware-kits': ['Комплект для входной двери', 'Комплект для межкомнатной двери'],
  'latches': ['Магнитные защёлки', 'Механические защёлки'],
  'strike-plates': ['Плоские планки', 'Угловые планки'],
  'deadbolts': ['Врезные шпингалеты', 'Накладные шпингалеты'],
  'stops': ['Напольные упоры', 'Настенные упоры'],
  'door-viewers': ['Глазки для тонких дверей', 'Глазки для толстых дверей'],
  'escutcheons': ['Круглые накладки', 'Квадратные накладки'],
  'fasteners': ['Монтажные винты', 'Саморезы для фурнитуры'],
  'sliding': ['Направляющие', 'Роликовые комплекты'],
  'seals': ['Щёточные уплотнители', 'Уплотнители для притвора'],
  'window-fittings': ['Ручки для окон', 'Ограничители открывания'],
  'gates': ['Петли для ворот', 'Задвижки для калиток'],
  'mounting': ['Монтажные пластины', 'Шаблоны для установки'],
  'replacement': ['Пружины для ручек', 'Квадратные стержни'],
};

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
  const promoButton = secondary.querySelector('.catalog-menu__promo-button');
  const breakpoint = getComputedStyle(document.documentElement).getPropertyValue('--layout-breakpoint').trim();
  const mobileLayout = window.matchMedia(`(width < ${breakpoint})`);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const { ease, duration } = menuSlide;
  let isOpen = false;
  let activeCategory = null;
  const openedCategories = new Set();
  let secondaryIntro;
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
    onReverseComplete: () => {
      secondary.hidden = true;
      secondaryIntro?.pause(0);
      if (!isOpen) closePrimary();
    }
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

  function openSubmenu(category) {
    if (!isOpen) return;
    activeCategory?.setAttribute('aria-expanded', 'false');
    activeCategory = category;
    category.setAttribute('aria-expanded', 'true');

    const key = category.dataset.catalogCategory;
    heading.textContent = key === 'closers' ? 'Дверные доводчики' : category.textContent.trim();
    secondaryIntro?.kill();
    items.replaceChildren(...demoItems[key].map((name, index) => {
      const item = itemTemplate.content.firstElementChild.cloneNode(true);
      item.querySelector('.catalog-menu__text').textContent = name;
      item.href = `?${new URLSearchParams({ catalog: key, item: name })}`;
      item.classList.toggle('catalog-menu__link--featured', index === 0);
      return item;
    }));
    if (mobileLayout.matches) {
      gsap.killTweensOf(items);
      category.after(items);
      items.hidden = false;
      items.inert = false;
      if (reducedMotion.matches) {
        gsap.set(items, { clearProps: 'height,opacity' });
      } else {
        gsap.fromTo(items, { height: 0, opacity: 0 }, {
          height: 'auto',
          opacity: 1,
          duration: 0.3,
          ease,
          clearProps: 'height,opacity',
        });
      }
      return;
    }

    secondary.scrollTop = 0;
    gsap.set(promoButton, { xPercent: -100, x: '-1.5rem' });
    secondaryIntro = revealMenuLabels(gsap.timeline({ paused: true }), secondary.querySelectorAll('.catalog-menu__text'), 0.24, 0.065)
      .to(promoButton, { xPercent: 0, x: 0, duration: 0.55, ease }, 0.3);

    secondary.hidden = false;
    secondary.inert = false;
    if (reducedMotion.matches) secondarySlide.progress(1).pause();
    else secondarySlide.play(0);

    if (reducedMotion.matches || openedCategories.has(key)) secondaryIntro.progress(1).pause();
    else secondaryIntro.play();
    openedCategories.add(key);
  }

  function closeSubmenu() {
    activeCategory?.setAttribute('aria-expanded', 'false');
    activeCategory = null;
    if (mobileLayout.matches) {
      gsap.killTweensOf(items);
      items.inert = true;
      if (reducedMotion.matches || !isOpen) {
        items.hidden = true;
      } else {
        gsap.to(items, {
          height: 0,
          opacity: 0,
          duration: 0.3,
          ease,
          onComplete: () => { items.hidden = true; },
        });
      }
      if (!isOpen) closePrimary();
      return;
    }

    secondary.inert = true;
    secondaryIntro?.pause();

    if (!reducedMotion.matches && secondarySlide.progress() > 0) {
      secondarySlide.reverse();
    } else {
      secondarySlide.pause(0, true);
      secondaryIntro?.pause(0);
      secondary.hidden = true;
      if (!isOpen) closePrimary();
    }
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
    secondaryIntro?.pause(0);
    secondary.hidden = true;
    secondary.inert = true;
    activeCategory?.setAttribute('aria-expanded', 'false');
    activeCategory = null;
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

  trigger.setAttribute('role', 'button');
  trigger.setAttribute('aria-controls', menu.id);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', event => {
    event.preventDefault();
    setOpen(!isOpen);
  });
  trigger.addEventListener('keydown', event => {
    if (event.key !== ' ') return;
    event.preventDefault();
    trigger.click();
  });

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
      const labels = [category.textContent.trim(), ...demoItems[category.dataset.catalogCategory]];
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
