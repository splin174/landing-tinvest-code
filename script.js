// Сколько мест осталось по первой цене — обновляется вручную
const seatsLeft = 47;

// Всего мест в первом тарифе (для полосы прогресса)
const SEATS_TOTAL = 50;

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
      const offset = header ? header.offsetHeight : 0;
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

  /* ---------- Счётчик мест ---------- */
  function plural(n, one, few, many) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }
  const seats = Math.max(0, Math.min(SEATS_TOTAL, seatsLeft));
  document.querySelectorAll('[data-seats]').forEach(function (el) { el.textContent = seats; });
  document.querySelectorAll('[data-seats-word]').forEach(function (el) {
    el.textContent = plural(seats, 'место', 'места', 'мест');
  });
  const bar = document.querySelector('[data-seats-bar]');
  if (bar) bar.style.width = Math.round(((SEATS_TOTAL - seats) / SEATS_TOTAL) * 100) + '%';

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

  /* ---------- Плейсхолдер, если картинка не загрузилась ---------- */
  function markMissing(img) {
    const box = img.closest('.shot');
    if (box) box.classList.add('shot--missing');
  }
  document.querySelectorAll('.shot img').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('loading') !== 'lazy') markMissing(img);
    img.addEventListener('error', function () { markMissing(img); });
  });

  /* ---------- Карусель страниц гайда ---------- */
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
      return Math.round(track.scrollLeft / slides[0].offsetWidth);
    }
    function go(i) {
      const idx = (i + slides.length) % slides.length;
      track.scrollTo({ left: slides[idx].offsetLeft - slides[0].offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    function update() {
      const idx = current();
      dots.forEach(function (d, i) { d.setAttribute('aria-current', i === idx ? 'true' : 'false'); });
    }

    root.querySelector('[data-carousel-prev]').addEventListener('click', function () { go(current() - 1); });
    root.querySelector('[data-carousel-next]').addEventListener('click', function () { go(current() + 1); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current() - 1); }
    });
    update();
  });

  /* ---------- Предпросмотр гайда (видео грузится по клику) ---------- */
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
      video.setAttribute('aria-label', 'Видео: прокрутка страниц гайда');
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
