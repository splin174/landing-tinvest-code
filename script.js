// Ссылка на оплату. Пока пустая — кнопка в финальном блоке ведёт к #cta.
const PAYMENT_URL = ''; // TODO: вставить ссылку на оплату

(function () {
  'use strict';

  /* ---------- Плавный скролл к якорям ---------- */
  const header = document.querySelector('.header');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      const id = link.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      // Шапка липкая только с 768px — на мобильном отступ под неё не нужен
      const offset = header && getComputedStyle(header).position === 'sticky' ? header.offsetHeight : 0;
      const top = target.getBoundingClientRect().top + window.pageYOffset - offset + 1;
      window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
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

  /* ---------- 4.1: плашки ↔ общая карусель ---------- */
  document.querySelectorAll('[data-gallery]').forEach(function (gallery) {
    const car = gallery.querySelector('[data-carousel]');
    const picks = Array.prototype.slice.call(gallery.querySelectorAll('[data-pick]'));
    function highlight(plate) {
      picks.forEach(function (b, i) { b.setAttribute('aria-current', i === plate ? 'true' : 'false'); });
    }
    picks.forEach(function (btn) {
      btn.addEventListener('click', function () { car.carouselGo(Number(btn.getAttribute('data-pick'))); });
    });
    car.addEventListener('carousel:change', function (e) {
      highlight(Number(e.detail.slide.getAttribute('data-plate')));
    });
    highlight(0);
  });

  /* ---------- Лайтбокс: клик по скриншоту в карусели 4.1 ---------- */
  const zoomImgs = document.querySelectorAll('[data-zoom]');
  if (zoomImgs.length) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Скриншот крупно');
    box.innerHTML = '<button class="lightbox__close" type="button" aria-label="Закрыть">×</button><img class="lightbox__img" alt="">';
    document.body.appendChild(box);
    const boxImg = box.querySelector('.lightbox__img');
    const closeBtn = box.querySelector('.lightbox__close');
    let opener = null;
    function close() {
      box.hidden = true;
      document.documentElement.style.overflow = '';
      if (opener) opener.focus();
    }
    zoomImgs.forEach(function (img) {
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      function open() {
        opener = img;
        boxImg.src = img.currentSrc || img.src;
        boxImg.alt = img.alt;
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
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) close(); });
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
