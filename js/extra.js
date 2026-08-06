/* 文章摘录横向卡片（quote-carousel）：
 * 为页面中的 .quote-carousel 初始化上一张 / 下一张按钮。
 * 每次滚动一张卡片（卡片宽度 + 间距）的距离，并在边界禁用对应按钮。
 * 不监听滚轮事件，因此不会拦截页面纵向滚动。
 * 兼容 Material for MkDocs / MaterialX 的 navigation.instant（document$）。
 */
(() => {
  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const initQuoteCarousels = () => {
    document.querySelectorAll('.quote-carousel').forEach((carousel) => {
      if (carousel.dataset.quoteCarouselReady === 'true') {
        return;
      }

      const track = carousel.querySelector('.quote-carousel__track');
      const prev = carousel.querySelector('.quote-carousel__button--prev');
      const next = carousel.querySelector('.quote-carousel__button--next');
      if (!track) {
        return;
      }

      carousel.dataset.quoteCarouselReady = 'true';

      const card = track.querySelector('.quote-card');
      const gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;

      const step = () => {
        if (!card) {
          return 0;
        }
        return card.getBoundingClientRect().width + gap;
      };

      const updateButtons = () => {
        if (!track.isConnected) {
          window.removeEventListener('resize', updateButtons);
          window.removeEventListener('load', updateButtons);
          return;
        }

        if (!prev || !next) {
          return;
        }

        const maxScroll = track.scrollWidth - track.clientWidth;
        prev.disabled = track.scrollLeft <= 1;
        next.disabled = track.scrollLeft >= maxScroll - 1;
      };

      const scrollByCard = (direction) => {
        track.scrollBy({
          left: step() * direction,
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
      };

      prev?.addEventListener('click', () => scrollByCard(-1));
      next?.addEventListener('click', () => scrollByCard(1));
      track.addEventListener('scroll', updateButtons, { passive: true });
      window.addEventListener('resize', updateButtons);
      window.addEventListener('load', updateButtons);
      updateButtons();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuoteCarousels, { once: true });
  } else {
    initQuoteCarousels();
  }

  if (window.document$ && typeof window.document$.subscribe === 'function') {
    window.document$.subscribe(initQuoteCarousels);
  }
})();
