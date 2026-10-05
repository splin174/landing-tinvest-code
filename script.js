// Ссылка на оплату. Подставляется во все кнопки покупки с атрибутом data-pay (после hero, «Что получаю?»,
// гарантии и в финальном блоке) и открывается в новой вкладке. Пока пустая — кнопки ведут к финальному блоку #cta.
const PAYMENT_URL = ''; // TODO: вставить ссылку на оплату

// Номер счётчика Яндекс Метрики. Если сделать пустым — счётчик не загружается даже после «Принять».
const METRIKA_ID = '113395885';

(function () {
  'use strict';

  /* ---------- Плавный скролл к якорям ---------- */
  const header = document.querySelector('.header');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Положение элемента на странице без учёта transform. Элементы с .reveal до появления сдвинуты
  // анимацией вниз; getBoundingClientRect учёл бы этот сдвиг, и после анимации цель уехала бы вверх
  function layoutTop(el) {
    let top = 0;
    for (let node = el; node; node = node.offsetParent) top += node.offsetTop;
    return top;
  }

  // Куда прокрутить, чтобы цель встала под шапкой. Шапка липкая только с 768px — на мобильном
  // отступ под неё не нужен. Секции — вплотную к шапке, остальное (сноски) — с зазором 16px
  function scrollTarget(target) {
    const offset = header && getComputedStyle(header).position === 'sticky' ? header.offsetHeight : 0;
    const gap = target.tagName === 'SECTION' ? -1 : 16;
    window.scrollTo({ top: layoutTop(target) - offset - gap, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      const id = link.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      scrollTarget(target);
      history.replaceState(null, '', id);
    });
  });

  /* ---------- Ссылка на оплату ---------- */
  if (PAYMENT_URL) {
    document.querySelectorAll('[data-pay]').forEach(function (btn) {
      btn.setAttribute('href', PAYMENT_URL);
      btn.setAttribute('target', '_blank');
      btn.setAttribute('rel', 'noopener');
    });
  }

  /* ---------- Тень у sticky-шапки ---------- */
  function onScroll() {
    if (header) header.classList.toggle('header--scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- FAQ-аккордеон: открыт только один ---------- */
  const faq = document.querySelector('[data-faq]');
  if (faq) {
    const buttons = faq.querySelectorAll('.faq__q');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        buttons.forEach(function (other) {
          other.setAttribute('aria-expanded', 'false');
          document.getElementById(other.getAttribute('aria-controls')).hidden = true;
        });
        if (!isOpen) {
          btn.setAttribute('aria-expanded', 'true');
          document.getElementById(btn.getAttribute('aria-controls')).hidden = false;
          reachGoal('faq_open');
        }
      });
    });
  }

  /* ---------- Аккордеоны: картинки внутри грузятся только при первом раскрытии ---------- */
  document.querySelectorAll('details.acc').forEach(function (details) {
    details.addEventListener('toggle', function () {
      if (!details.open) return;
      details.querySelectorAll('img[data-src]').forEach(function (img) {
        img.setAttribute('src', img.getAttribute('data-src'));
        img.removeAttribute('data-src');
      });
    });
  });

  /* ---------- Плейсхолдер, если картинка не загрузилась ---------- */
  function markMissing(img) {
    const box = img.closest('.shot');
    if (box) box.classList.add('shot--missing');
  }
  document.querySelectorAll('.shot img').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('loading') !== 'lazy') markMissing(img);
    img.addEventListener('error', function () { markMissing(img); });
  });

  /* ---------- Карусель страниц инструкции ---------- */
  document.querySelectorAll('[data-carousel]').forEach(function (root) {
    const track = root.querySelector('[data-carousel-track]');
    const slides = Array.prototype.slice.call(track.children);
    const dotsBox = root.querySelector('[data-carousel-dots]');
    const dots = slides.map(function (_, i) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel__dot';
      dot.setAttribute('aria-label', 'Страница ' + (i + 1));
      dot.addEventListener('click', function () { go(i); });
      dotsBox.appendChild(dot);
      return dot;
    });

    function current() {
      // Шаг слайда с учётом зазора между слайдами
      const step = slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : slides[0].offsetWidth;
      if (!step) return 0;
      return Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / step)));
    }
    let last = -1;
    let pending = null; // слайд, к которому идёт программная прокрутка
    function setActive(idx) {
      dots.forEach(function (d, i) { d.setAttribute('aria-current', i === idx ? 'true' : 'false'); });
      if (idx !== last) {
        last = idx;
        root.dispatchEvent(new CustomEvent('carousel:change', { detail: { index: idx, slide: slides[idx] } }));
      }
    }
    function go(i) {
      const idx = (i + slides.length) % slides.length;
      pending = idx;
      setActive(idx);
      track.scrollTo({ left: slides[idx].offsetLeft - slides[0].offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    function update() {
      const idx = current();
      // Пока идёт плавная прокрутка к выбранному слайду, промежуточные позиции не подсвечиваем
      if (pending !== null) {
        if (idx !== pending) return;
        pending = null;
      }
      setActive(idx);
    }
    root.carouselGo = go;

    function base() { return pending !== null ? pending : current(); }
    root.querySelector('[data-carousel-prev]').addEventListener('click', function () { go(base() - 1); });
    root.querySelector('[data-carousel-next]').addEventListener('click', function () { go(base() + 1); });
    // Свайп пальцем прерывает программную прокрутку
    track.addEventListener('pointerdown', function () { pending = null; }, { passive: true });
    track.addEventListener('touchstart', function () { pending = null; }, { passive: true });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(base() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(base() - 1); }
    });
    update();
    // Карусель внутри свёрнутого аккордеона: пересчитать точки после раскрытия
    const details = root.closest('details');
    if (details) details.addEventListener('toggle', function () { if (details.open) update(); });
  });

  /* ---------- Звёздочка-сноска внутри кнопки-плашки ----------
     Ссылку внутрь <button> вкладывать нельзя, поэтому звёздочка — <span data-fn="id сноски">.
     Клик по ней прокручивает к сноске и не переключает слайд (обработчик на фазе перехвата) */
  document.addEventListener('click', function (e) {
    const star = e.target.closest('[data-fn]');
    if (!star) return;
    e.preventDefault();
    e.stopPropagation();
    const note = document.getElementById(star.getAttribute('data-fn'));
    if (note) scrollTarget(note);
  }, true);

  /* ---------- Блок 2 «Что получаю?»: плашки ↔ общая карусель ---------- */
  document.querySelectorAll('[data-gallery]').forEach(function (gallery) {
    const car = gallery.querySelector('[data-carousel]');
    const picks = Array.prototype.slice.call(gallery.querySelectorAll('[data-pick]'));
    const slides = Array.prototype.slice.call(car.querySelectorAll('.carousel__slide'));
    function highlight(plate) {
      picks.forEach(function (b, i) { b.setAttribute('aria-current', i === plate ? 'true' : 'false'); });
    }
    // Плашка открывает первый слайд со своим data-plate: у плашки может быть несколько слайдов,
    // поэтому номер плашки и номер слайда не обязаны совпадать
    picks.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const plate = btn.getAttribute('data-pick');
        const index = slides.findIndex(function (s) { return s.getAttribute('data-plate') === plate; });
        car.carouselGo(index < 0 ? 0 : index);
      });
    });
    car.addEventListener('carousel:change', function (e) {
      highlight(Number(e.detail.slide.getAttribute('data-plate')));
    });
    highlight(0);
  });

  /* ---------- Лайтбокс: клик по скриншоту (блок 1, карусели блока 2 и скрытой секции «Как запустить автоматизацию?») ---------- */
  const zoomImgs = document.querySelectorAll('[data-zoom]');
  if (zoomImgs.length) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Скриншот крупно');
    box.innerHTML = '<button class="lightbox__close" type="button" aria-label="Закрыть">×</button>' +
      '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Предыдущий скриншот">←</button>' +
      '<img class="lightbox__img" alt="">' +
      '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Следующий скриншот">→</button>';
    document.body.appendChild(box);
    const boxImg = box.querySelector('.lightbox__img');
    const closeBtn = box.querySelector('.lightbox__close');
    const prevBtn = box.querySelector('.lightbox__nav--prev');
    const nextBtn = box.querySelector('.lightbox__nav--next');
    let opener = null;
    let group = []; // скриншоты той же карусели, которые листаются стрелками
    let pos = 0;
    function show(i) {
      pos = (i + group.length) % group.length;
      const img = group[pos];
      opener = img;
      boxImg.src = img.currentSrc || img.src || img.getAttribute('data-src');
      boxImg.alt = img.alt;
      // Карусель на странице идёт следом — после закрытия виден тот же скриншот
      const car = img.closest('[data-carousel]');
      const slide = img.closest('.carousel__slide');
      if (car && car.carouselGo && slide) car.carouselGo(Array.prototype.indexOf.call(slide.parentNode.children, slide));
    }
    function close() {
      box.hidden = true;
      document.documentElement.style.overflow = '';
      if (opener) opener.focus({ preventScroll: true });
    }
    zoomImgs.forEach(function (img) {
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      function open() {
        const track = img.closest('[data-carousel-track]');
        group = track ? Array.prototype.slice.call(track.querySelectorAll('[data-zoom]')) : [img];
        prevBtn.hidden = nextBtn.hidden = group.length < 2;
        show(group.indexOf(img));
        box.hidden = false;
        document.documentElement.style.overflow = 'hidden';
        closeBtn.focus();
      }
      img.addEventListener('click', open);
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function () { show(pos - 1); });
    nextBtn.addEventListener('click', function () { show(pos + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      if (group.length > 1 && e.key === 'ArrowLeft') { e.preventDefault(); show(pos - 1); }
      if (group.length > 1 && e.key === 'ArrowRight') { e.preventDefault(); show(pos + 1); }
    });
  }

  /* ---------- Оферта и политика: открываются во всплывающем окне ---------- */
  // Текст берётся из oferta.html / privacy.html — документы остаются в одном месте
  // и доступны по прямой ссылке. Кнопка «Назад» в браузере закрывает окно.
  if (document.querySelector('a[data-doc]')) {
    const modal = document.createElement('div');
    modal.className = 'doc-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="doc-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="doc-modal-title" tabindex="-1">' +
        '<div class="doc-modal__head">' +
          '<h2 class="doc-modal__title" id="doc-modal-title"></h2>' +
          '<button class="doc-modal__close" type="button" aria-label="Закрыть">×</button>' +
        '</div>' +
        '<div class="doc-modal__body" tabindex="0"></div>' +
      '</div>';
    document.body.appendChild(modal);
    const dialog = modal.querySelector('.doc-modal__dialog');
    const titleEl = modal.querySelector('.doc-modal__title');
    const bodyEl = modal.querySelector('.doc-modal__body');
    const closeBtn = modal.querySelector('.doc-modal__close');
    const cache = {};
    let opener = null;

    function load(href) {
      if (!cache[href]) {
        cache[href] = fetch(href).then(function (r) {
          if (!r.ok) throw new Error(r.status);
          return r.text();
        }).then(function (html) {
          const page = new DOMParser().parseFromString(html, 'text/html');
          const inner = page.querySelector('.doc__inner');
          if (!inner) throw new Error('no content');
          inner.querySelectorAll('.doc__back').forEach(function (a) { a.remove(); });
          const h1 = inner.querySelector('.doc__title');
          const title = h1 ? h1.textContent : page.title;
          if (h1) h1.remove();
          return { title: title, html: inner.innerHTML };
        });
        cache[href].catch(function () { delete cache[href]; });
      }
      return cache[href];
    }

    function render(title, html) {
      titleEl.textContent = title;
      bodyEl.innerHTML = html;
      if (modal.hidden) {
        modal.hidden = false;
        document.documentElement.style.overflow = 'hidden';
      }
      // Прокрутку сбрасываем после показа окна: у скрытого окна она не меняется,
      // и документ открывался бы на месте, где его закрыли в прошлый раз
      bodyEl.scrollTop = 0;
      dialog.focus();
    }

    // Ссылка вида oferta.html#p-9-2 открывает документ сразу на нужном пункте и подсвечивает его
    function scrollToItem(hash) {
      const target = hash && bodyEl.querySelector('#' + CSS.escape(hash));
      if (!target) return;
      bodyEl.scrollTop += target.getBoundingClientRect().top - bodyEl.getBoundingClientRect().top - 16;
      target.classList.add('doc__item--hl');
      setTimeout(function () { target.classList.remove('doc__item--hl'); }, 2500);
    }

    function show(href) {
      const parts = href.split('#');
      return load(parts[0]).then(function (doc) {
        reachGoal('doc_open');
        render(doc.title, doc.html);
        scrollToItem(parts[1]);
      }, function () {
        // Текст не загрузился (нет сети, страница открыта как файл) — сообщение в окне, без перехода
        render('Не удалось загрузить документ',
          '<p class="doc-modal__error">Возможно, нет подключения к&nbsp;интернету.</p>' +
          '<p class="doc-modal__error"><a href="' + href + '">Открыть документ на&nbsp;отдельной странице</a></p>');
      });
    }

    function hide() {
      if (modal.hidden) return;
      modal.hidden = true;
      document.documentElement.style.overflow = '';
      if (opener) opener.focus({ preventScroll: true });
    }

    // Крестик, фон и Esc закрывают через history.back(): так снимается запись истории окна
    function requestClose() {
      if (history.state && history.state.docModal) history.back();
      else hide();
    }

    document.addEventListener('click', function (e) {
      const link = e.target.closest('a[data-doc]');
      if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      const href = link.getAttribute('href');
      const wasOpen = !modal.hidden;
      if (!wasOpen) opener = link;
      show(href).then(function () {
        const state = { docModal: href };
        if (wasOpen) history.replaceState(state, '');
        else history.pushState(state, '');
      });
    });

    window.addEventListener('popstate', hide);
    closeBtn.addEventListener('click', requestClose);
    modal.addEventListener('click', function (e) { if (e.target === modal) requestClose(); });

    modal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); requestClose(); return; }
      if (e.key !== 'Tab') return;
      // Фокус не уходит за пределы окна
      const items = Array.prototype.filter.call(
        dialog.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])'),
        function (el) { return el.offsetParent !== null; }
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
  }

  /* ---------- Cookie и Яндекс Метрика: счётчик грузится только после «Принять» ---------- */
  const CONSENT_KEY = 'cookieConsent'; // 'accepted' или 'declined'

  function readConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  }
  function saveConsent(value) {
    try { localStorage.setItem(CONSENT_KEY, value); } catch (e) { /* без хранилища плашка покажется снова */ }
  }

  let metrikaLoaded = false;
  function loadMetrika() {
    if (metrikaLoaded || !METRIKA_ID) return;
    metrikaLoaded = true;
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = Date.now();
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://mc.yandex.ru/metrika/tag.js?id=' + METRIKA_ID; // с ssr:true номер нужен в адресе скрипта
    document.head.appendChild(s);
    window.ym(Number(METRIKA_ID), 'init', {
      ssr: true,
      webvisor: true,
      clickmap: true,
      referrer: document.referrer,
      url: location.href,
      accurateTrackBounce: true,
      trackLinks: true
    });
  }

  // Цели отправляются, только если Метрика загружена после согласия
  function reachGoal(name, params) {
    if (metrikaLoaded && window.ym) window.ym(Number(METRIKA_ID), 'reachGoal', name, params);
  }

  // buy_click — клик по кнопке покупки; параметр button — какая кнопка нажата (значение data-pay):
  // hero, what_you_get, guarantee или final
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-pay]');
    if (btn) reachGoal('buy_click', { button: btn.getAttribute('data-pay') || 'unknown' });
  });

  // cta_view — финальный CTA показался на экране, один раз за визит
  const ctaBlock = document.getElementById('cta');
  if (ctaBlock && 'IntersectionObserver' in window) {
    const CTA_SEEN = 'ctaViewSent';
    const ctaSeen = function () { try { return sessionStorage.getItem(CTA_SEEN) === '1'; } catch (e) { return false; } };
    const ctaIo = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || !metrikaLoaded || ctaSeen()) return;
      reachGoal('cta_view');
      try { sessionStorage.setItem(CTA_SEEN, '1'); } catch (e) { /* без хранилища — один раз до перезагрузки */ }
      ctaIo.disconnect();
    }, { threshold: 0.3 });
    ctaIo.observe(ctaBlock);
  }

  const consent = readConsent();
  if (consent === 'accepted') {
    loadMetrika();
  } else if (consent !== 'declined') {
    const bar = document.createElement('div');
    bar.className = 'cookie';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Уведомление о cookie');
    bar.innerHTML =
      '<p class="cookie__text">На&nbsp;сайте используются файлы cookie и&nbsp;Яндекс Метрика, в&nbsp;том числе Вебвизор, который записывает действия на&nbsp;сайте: прокрутку, движения мыши и&nbsp;клики. Подробнее&nbsp;— в&nbsp;<a href="privacy.html" data-doc>политике&nbsp;конфиденциальности</a>.</p>' +
      '<div class="cookie__actions">' +
        '<button class="cookie__btn" type="button" data-consent="accepted">Принять</button>' +
        '<button class="cookie__btn" type="button" data-consent="declined">Отказаться</button>' +
      '</div>';
    document.body.appendChild(bar);
    // Отступ снизу на высоту плашки: под ней не прячется ни кнопка покупки, ни подвал
    function reserve() { document.body.style.paddingBottom = bar.offsetHeight + 'px'; }
    reserve();
    window.addEventListener('resize', reserve);
    bar.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-consent]');
      if (!btn) return;
      const value = btn.getAttribute('data-consent');
      saveConsent(value);
      window.removeEventListener('resize', reserve);
      document.body.style.paddingBottom = '';
      bar.remove();
      if (value === 'accepted') loadMetrika();
    });
  }

  /* ---------- Предпросмотр инструкции (видео грузится по клику) ---------- */
  const previewBtn = document.querySelector('[data-preview-btn]');
  if (previewBtn) {
    previewBtn.addEventListener('click', function () {
      const frame = document.querySelector('[data-preview]');
      const video = document.createElement('video');
      video.src = 'images/7guide_scroll.mp4';
      video.poster = 'images/7guide_scroll-poster.jpg';
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.controls = true;
      video.className = 'preview__video';
      video.setAttribute('aria-label', 'Видео: прокрутка страниц инструкции');
      frame.replaceChildren(video);
      const p = video.play();
      if (p && p.catch) p.catch(function () {});
    });
  }

  /* ---------- Плавное появление блоков ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }
})();
