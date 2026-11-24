# Практический гайд по сборщику

Соберём мини-сайт из главной и каталога. На нём можно попробовать общий HTML-фрагмент, отдельный JavaScript страниц, адаптивный SCSS, перенос элементов, картинки, SVG-спрайт и локальный шрифт. В конце проверим готовую сборку и специально сломаем одну ссылку, чтобы увидеть сообщение валидатора.

## 1. Подготовь учебную копию

Открой PowerShell в папке `layout`, рядом с `package.json`. Команды создадут копию с исходниками во временной папке и установят зависимости.

```powershell
$layoutDemo = Join-Path ([IO.Path]::GetTempPath()) ("layout-guide-" + [guid]::NewGuid().ToString("N"))
robocopy . $layoutDemo /E /XD node_modules dist dist-ssr .venv .git generated /R:1 /W:1 /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw "Не удалось скопировать проект" }
Set-Location -LiteralPath $layoutDemo
npm ci
if ($LASTEXITCODE -ne 0) { throw "Не удалось установить зависимости" }
$layoutDemo
```

Открой выведенную папку в редакторе. Дальше пути отсчитываются от неё. Для сборки нужны Node.js и npm. Для шага со шрифтами понадобится Python 3.11 или новее. Проверку в браузере можно пройти в Chrome или Chromium.

## 2. Сделай две страницы с общим HTML и JS

Создай `src/partials/guide-card.hbs`. Один фрагмент получит разные значения `title` и `text` на каждой странице.

```handlebars
<article class="guide-card">
  <h2>{{title}}</h2>
  <p>{{text}}</p>
</article>
```

Замени содержимое `index.html` в учебной копии.

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Главная</title>
    <link rel="stylesheet" href="/src/styles/main.scss">
  </head>
  <body>
    <main class="container" id="home">
      <h1>Главная</h1>
      <a href="./catalog.html#catalog">В каталог</a>
      <p data-page-status></p>
      {{> guide-card title="Общий шаблон" text="Эта карточка показана на главной."}}

      <div class="guide-layout">
        <div class="guide-desktop">
          <button type="button" data-da=".guide-mobile, 600, first">Перенеси меня</button>
        </div>
        <div class="guide-mobile"></div>
      </div>
    </main>
    <script type="module" src="/src/pages/index.js"></script>
  </body>
</html>
```

Создай `catalog.html` рядом с `index.html`.

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Каталог</title>
    <link rel="stylesheet" href="/src/styles/main.scss">
  </head>
  <body>
    <main class="container" id="catalog">
      <h1>Каталог</h1>
      <a href="./index.html#home">На главную</a>
      <p data-page-status></p>
      {{> guide-card title="Та же карточка" text="Параметры переданы со страницы каталога."}}
    </main>
    <script type="module" src="/src/pages/catalog.js"></script>
  </body>
</html>
```

В конец `src/main.js` добавь строку. Общая инициализация Dynamic Adapt уже находится в этом файле.

```js
console.info('Общий JS запущен');
```

В `src/pages/index.js` оставь импорт общего модуля и добавь код главной.

```js
import '../main.js';

document.querySelector('[data-page-status]').textContent = 'Работает JS главной';
```

В `src/pages/catalog.js` импортируй тот же модуль и задай текст каталога.

```js
import '../main.js';

document.querySelector('[data-page-status]').textContent = 'Работает JS каталога';
```

В `vite.config.js` добавь `input` внутрь существующего `build.rolldownOptions` перед блоком `output`.

```js
input: {
  index: fileURLToPath(new URL('./index.html', import.meta.url)),
  catalog: fileURLToPath(new URL('./catalog.html', import.meta.url)),
},
```

Запусти `npm run dev`. Для остальных команд открой второе окно PowerShell в той же учебной папке. Перейди по адресу из терминала и открой каталог по ссылке. На обеих страницах появится карточка из одного шаблона, а текст под заголовком будет установлен модулем этой страницы. В консоли на каждой загрузке появится сообщение общего JS. Измени разметку `guide-card.hbs` и посмотри, как обновится открытая страница.

## 3. Проверь SCSS и перенос элемента

Создай `src/styles/_guide.scss`.

```scss
@use 'helpers';

.guide-card {
  padding: helpers.phone-vw(20);
  border: 1px solid #9aa4b5;

  @include helpers.mobile-above {
    padding: helpers.desktop-vw(20);
  }
}

.guide-layout {
  display: grid;
  gap: 12px;
  margin-block: 20px;

  @include helpers.mobile-above {
    grid-template-columns: 1fr 1fr;
  }
}

.guide-desktop,
.guide-mobile {
  min-block-size: 48px;
  padding: 8px;
  border: 1px dashed #72809b;
}
```

Подключи его в конце `src/styles/main.scss`.

```scss
@use 'guide';
```

Включи режим адаптивного экрана в DevTools и меняй ширину окна.

| Ширина | Что должно произойти |
| --- | --- |
| 320 и 390 px | Отступ карточки растёт вместе с окном и доходит до 20 px при 390 px. |
| 600 и 601 px | При 600 px кнопка находится в `.guide-mobile`, при 601 px она возвращается в `.guide-desktop`. Это её явно заданный порог. |
| 767 и 768 px | Сетка переходит с одной колонки на две на границе 768 px. |
| 1600 и 1920 px | Отступ карточки достигает предела около 41,7 px, ширина контейнера ограничена 1600 px. |

Порог для SCSS меняется в `src/styles/helpers/_adaptive.scss`. Чтобы попробовать общий порог и для переноса, замени атрибут кнопки на `data-da=".guide-mobile"` и обнови страницу. Кнопка будет переноситься при ширине ниже 768 px. Проверить `scrollbar-gutter` можно в **Elements → Computed** у `body`. Значение должно быть `stable`.

## 4. Попробуй картинки в HTML и WebP-фон в SCSS

Для учебного проекта создай два растровых исходника через установленный Sharp. Команды выполняются из папки проекта.

```powershell
New-Item -ItemType Directory -Force -Path src/images,public/assets/other | Out-Null
@'
import sharp from 'sharp';

await sharp({
  create: { width: 1600, height: 900, channels: 3, background: '#315da8' },
}).jpeg().toFile('src/images/guide-photo.jpg');

await sharp({
  create: { width: 640, height: 360, channels: 4, background: { r: 222, g: 109, b: 51, alpha: 0.65 } },
}).png().toFile('src/images/guide-tile.png');
'@ | node --input-type=module

'Файл скопирован из public' | Set-Content -LiteralPath public/assets/other/guide-note.txt -Encoding utf8
```

В `index.html` вставь разметку перед `</main>`.

```html
<img
  id="guide-photo"
  class="guide-image"
  src="/src/images/guide-photo.jpg"
  width="800"
  height="450"
  sizes="(max-width: 800px) 100vw, 800px"
  data-responsive
  alt="Тестовая JPEG-картинка"
>
<img
  class="guide-image"
  src="/src/images/guide-tile.png"
  width="320"
  height="180"
  data-responsive
  alt="Тестовая PNG-картинка"
>
<div class="guide-background" aria-hidden="true"></div>
<a href="./assets/other/guide-note.txt">Файл из public</a>
```

Добавь в `_guide.scss`.

```scss
.guide-image {
  display: block;
  max-inline-size: 100%;
  block-size: auto;
}

.guide-background {
  --guide-photo: url('/src/images/guide-photo.jpg?webp');
  min-block-size: 140px;
  background-image: var(--guide-photo);
  background-size: cover;
  background-position: center;
}
```

- В **Elements** проверь, что каждый `<img data-responsive>` стал `<picture>` с источниками AVIF и WebP и исходным изображением в `<img>`. У JPEG ожидаются ширины 400, 800, 1200 и 1600 px, у PNG — 160, 320, 480 и 640 px.
- В консоли выполни `document.querySelector('#guide-photo').currentSrc`, чтобы увидеть реально выбранный файл. Браузер учитывает `sizes` и DPR экрана. Для сравнения переключи ширину и DPR в DevTools и обнови страницу с отключённым кешем в **Network**.
- У `.guide-background` в **Computed** появится URL одного WebP, подготовленного в исходных размерах 1600 × 900. Для сравнения убери `?webp` из правила и проверь загрузку JPEG. Верни метку перед финальной сборкой.
- Открой ссылку на текстовый файл. Vite копирует его из `public/assets/other/` в `dist/assets/other/` под тем же именем.

## 5. Проверь SVG-спрайт

Создай `src/icons/guide-dot.svg`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <circle cx="12" cy="12" r="9"/>
</svg>
```

Создай `src/icons/guide-gradient.svg` с градиентом из `<defs>`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="url(#paint)">
  <defs>
    <linearGradient id="paint">
      <stop stop-color="#e53b6d"/>
      <stop offset="1" stop-color="#6040ff"/>
    </linearGradient>
  </defs>
  <circle cx="12" cy="12" r="9"/>
</svg>
```

Сделай копию градиентного SVG вне `src/icons/` для сравнения с обычной вставкой.

```powershell
Copy-Item -LiteralPath src/icons/guide-gradient.svg -Destination src/images/guide-gradient.svg
```

Вставь в `index.html` перед `</main>`.

```html
<img class="guide-icon" src="/src/icons/guide-dot.svg" width="32" height="32" alt="Одноцветная иконка">
<img class="guide-icon" src="/src/icons/guide-gradient.svg" width="32" height="32" alt="Иконка с градиентом">
<img src="/src/images/guide-gradient.svg" width="32" height="32" alt="Отдельная SVG-картинка">
```

Добавь в `_guide.scss` стили для проверки `currentColor`.

```scss
.guide-icon {
  color: #315da8;
}

.guide-icon:hover {
  color: #e53b6d;
}
```

В **Elements** у двух иконок из `src/icons/` появится `<svg><use>` со ссылкой на общий SVG-файл, а у отдельной иллюстрации останется `<img>`. При наведении одноцветный круг меняет цвет, градиентная иконка сохраняет заливку. Подпись из `alt` становится доступным именем иконки.

## 6. Подключи локальный шрифт

В Windows для локального примера можно взять системный Arial. Вместо него можно положить свой TTF или OTF и использовать соответствующее имя файла в миксине.

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-fonts.txt
Copy-Item -LiteralPath (Join-Path $env:WINDIR 'Fonts/arial.ttf') -Destination src/fonts/Guide-Regular.ttf
npm run fonts
```

Проверь `src/fonts/generated/`. Там должны появиться `Guide-Regular.woff` и `Guide-Regular.woff2`. В `src/styles/_fonts.scss` добавь регистрацию начертания после существующего `@use 'helpers';`.

```scss
@include helpers.font-face('Guide Local', 'Guide-Regular', 400);
```

Примени семейство к тестовому абзацу через `_guide.scss`.

```scss
[data-page-status] {
  font-family: 'Guide Local', sans-serif;
}
```

После обновления страницы в **Network → Font** появится запрос к WOFF2. При итоговой сборке оба формата будут в `dist/assets/fonts/`. Запуски `dev` и `build` сами вызывают подготовку шрифтов. Если положил исходник при уже работающем сервере, запусти `npm run fonts` отдельно, как в примере.

## 7. Собери сайт и открой результат

Останови dev-сервер через `Ctrl+C` и запусти сборку.

```powershell
npm run build
Get-ChildItem -LiteralPath dist -Recurse -File
npm run preview
```

Открой адрес preview из терминала. Перейди с главной в каталог и обратно. Сверь выходные файлы.

| Где | Что должно быть |
| --- | --- |
| `dist/` | `index.html` и `catalog.html`. |
| `dist/assets/css/` | Один минифицированный CSS со стилями обеих страниц и медиавыражениями. |
| `dist/assets/js/` | `common-<хеш>.js`, `index-<хеш>.js` и `catalog-<хеш>.js`. |
| `dist/assets/images/` | Исходные растровые файлы, варианты AVIF и WebP разных размеров, WebP-фон. |
| `dist/assets/svg/` | Спрайт `icons-<хеш>.svg` и отдельная SVG-иллюстрация. |
| `dist/assets/fonts/` | WOFF и WOFF2, если прошёл шаг со шрифтом. |
| `dist/assets/other/` | `guide-note.txt` под исходным именем. |

## 8. Проверь отказ сборки и автоматические проверки

Останови preview через `Ctrl+C`. Добавь временную ссылку в `index.html` и запусти `npm run build`.

```html
<a href="#guide-missing">Проверка битой ссылки</a>
```

В сообщении должен появиться `index.html`, адрес `#guide-missing` и причина «якорь отсутствует». Удали эту строку. Затем добавь в `_guide.scss` временное правило с битым адресом внутри CSS-переменной.

```scss
.guide-background {
  --guide-photo: url('/src/images/guide-missing.png');
}
```

Снова запусти сборку. В ошибке должен быть адрес отсутствующей картинки и строка собранного CSS. Удали временное правило.

Для дополнительной проверки `@supports` добавь условие в `_guide.scss`. Сборка должна пройти, потому что адрес в условии служит образцом синтаксиса.

```scss
@supports (background-image: url('/guide-feature-probe.png')) {
  .guide-card { border-color: #315da8; }
}
```

Для проверки якорей шаблона вставь этот блок в `index.html`. Ссылка внутри шаблона проходит проверку. Перенеси только `<a>` за пределы `<template>` и запусти `npm run build`. Сборка должна сообщить, что якорь отсутствует на странице. Затем удали тестовый блок и ссылку.

```html
<template>
  <a href="#guide-later">Якорь внутри шаблона</a>
  <section id="guide-later">Блок для вставки через JS</section>
</template>
```

Выполни финальные проверки.

```powershell
npm run build
node --test
npm run check:svg
```

`node --test` проверяет валидатор ссылок. `npm run check:svg` сравнивает исходные SVG и спрайт в Chrome в режимах `dev` и production.
