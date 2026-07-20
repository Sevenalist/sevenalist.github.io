(function () {
  if (window.__sevenalistPostBackBound) {
    return;
  }

  window.__sevenalistPostBackBound = true;

  const storageKey = 'sevenalist:post-source';
  const postLinkSelector = [
    '.md-post--excerpt .md-post__content h2 a[href]',
    '.tag-post-card h2 a[href]'
  ].join(', ');

  const normalizeUrl = (value) => {
    if (typeof value !== 'string' || !value) {
      return null;
    }

    try {
      const url = new URL(value, window.location.href);
      url.hash = '';
      return url;
    } catch {
      return null;
    }
  };

  const rememberPostSource = (event) => {
    const target = event.target instanceof Element
      ? event.target.closest(postLinkSelector)
      : null;

    if (!target || event.defaultPrevented || event.button !== 0) {
      return;
    }

    const destination = normalizeUrl(target.href);
    if (!destination || destination.origin !== window.location.origin) {
      return;
    }

    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify({
        destination: destination.href,
        source: window.location.href
      }));
    } catch {
      // sessionStorage may be unavailable in privacy-restricted browsers.
    }
  };

  const updatePostBackLink = () => {
    const backLink = document.querySelector('.md-sidebar--post .md-post__back a');
    if (!backLink) {
      return;
    }

    const label = backLink.querySelector('.md-ellipsis');
    let source = null;

    try {
      const saved = JSON.parse(window.sessionStorage.getItem(storageKey) || 'null');
      const currentUrl = normalizeUrl(window.location.href);
      const destinationUrl = normalizeUrl(saved && saved.destination);
      const sourceUrl = normalizeUrl(saved && saved.source);

      if (
        currentUrl && destinationUrl && sourceUrl &&
        destinationUrl.href === currentUrl.href &&
        sourceUrl.origin === currentUrl.origin &&
        sourceUrl.href !== currentUrl.href
      ) {
        source = sourceUrl.href;
      }
    } catch {
      // Keep Material's original blog-index link as the safe fallback.
    }

    if (source) {
      backLink.href = source;
      if (label) {
        label.textContent = '返回上一页';
      }
    } else if (label) {
      label.textContent = '返回文章列表';
    }
  };

  document.addEventListener('click', rememberPostSource, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updatePostBackLink, { once: true });
  } else {
    updatePostBackLink();
  }

  if (window.document$ && typeof window.document$.subscribe === 'function') {
    window.document$.subscribe(updatePostBackLink);
  }
})();
