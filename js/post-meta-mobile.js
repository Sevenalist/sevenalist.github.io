(function () {
  const placePostMetaAfterTitle = () => {
    document.querySelectorAll('.sevenalist-post-meta-mobile').forEach((meta) => {
      const article = meta.closest('article');
      const title = article && article.querySelector('h1');

      if (title && title.nextElementSibling !== meta) {
        title.insertAdjacentElement('afterend', meta);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', placePostMetaAfterTitle, { once: true });
  } else {
    placePostMetaAfterTitle();
  }

  if (window.document$ && typeof window.document$.subscribe === 'function') {
    window.document$.subscribe(placePostMetaAfterTitle);
  }
})();
