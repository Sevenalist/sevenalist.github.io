(function () {
  if (window.__sevenalistPageTransitionsBound) {
    return;
  }

  window.__sevenalistPageTransitionsBound = true;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const transitionDuration = 500;
  const transitionClassEntering = 'page-transition-entering';
  const transitionClassLeaving = 'page-transition-leaving';
  const overlayId = 'page-transition-overlay';

  let overlay = null;
  let leaveTimer = null;
  let enterTimer = null;

  const getBody = () => document.body;

  const ensureOverlay = () => {
    if (overlay) {
      return overlay;
    }

    overlay = document.getElementById(overlayId);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = overlayId;
      overlay.className = 'page-transition-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      getBody().appendChild(overlay);
    }

    return overlay;
  };

  const clearTimers = () => {
    if (leaveTimer) {
      window.clearTimeout(leaveTimer);
      leaveTimer = null;
    }

    if (enterTimer) {
      window.clearTimeout(enterTimer);
      enterTimer = null;
    }
  };

  const resetState = () => {
    clearTimers();
    const body = getBody();
    body.classList.remove(transitionClassEntering, transitionClassLeaving);
    const activeOverlay = ensureOverlay();
    activeOverlay.style.opacity = '0';
  };

  const playEnter = () => {
    if (prefersReducedMotion.matches) {
      resetState();
      return;
    }

    const body = getBody();
    ensureOverlay();
    clearTimers();
    body.classList.remove(transitionClassLeaving);
    body.classList.add(transitionClassEntering);

    enterTimer = window.setTimeout(() => {
      body.classList.remove(transitionClassEntering);
      enterTimer = null;
    }, transitionDuration + 90);
  };

  const playLeave = () => {
    if (prefersReducedMotion.matches) {
      return;
    }

    const body = getBody();
    ensureOverlay();
    clearTimers();
    body.classList.remove(transitionClassEntering);
    body.classList.add(transitionClassLeaving);

    leaveTimer = window.setTimeout(() => {
      body.classList.remove(transitionClassLeaving);
      leaveTimer = null;
    }, transitionDuration + 180);
  };

  const shouldAnimateLink = (anchor) => {
    if (!(anchor instanceof HTMLAnchorElement)) {
      return false;
    }

    if (anchor.target && anchor.target !== '_self') {
      return false;
    }

    if (anchor.hasAttribute('download')) {
      return false;
    }

    const rawHref = anchor.getAttribute('href');
    if (!rawHref || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:')) {
      return false;
    }

    let url;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch {
      return false;
    }

    if (url.origin !== window.location.origin) {
      return false;
    }

    const samePageAnchor =
      url.pathname === window.location.pathname &&
      url.search === window.location.search &&
      url.hash.length > 0;

    return !samePageAnchor;
  };

  const onDocumentClick = (event) => {
    if (prefersReducedMotion.matches) {
      return;
    }

    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!shouldAnimateLink(target)) {
      return;
    }

    playLeave();
  };

  document.addEventListener('click', onDocumentClick, true);

  if (window.document$ && typeof window.document$.subscribe === 'function') {
    window.document$.subscribe(() => {
      playEnter();
    });
  } else {
    window.addEventListener('pageshow', playEnter);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', playEnter, { once: true });
  } else {
    window.requestAnimationFrame(playEnter);
  }
})();