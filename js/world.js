const initWorldPage = () => {
  const shell = document.querySelector('.world-shell');
  if (!shell) {
    return;
  }

  if (shell.dataset.worldInitialized === 'true') {
    return;
  }

  shell.dataset.worldInitialized = 'true';

  const grid = shell.querySelector('[data-world-grid]');
  const filterButtons = shell.querySelector('[data-world-filter-buttons]');
  const status = shell.querySelector('[data-world-filter-status]');
  const emptyState = shell.querySelector('[data-world-empty]');
  const filterPanel = shell.querySelector('[data-world-filter-panel]');
  const filterToggle = shell.querySelector('[data-world-filter-toggle]');
  const cards = Array.from(shell.querySelectorAll('.world-card'));
  let filterPanelOpen = false;

  if (!grid || !filterButtons || !status || cards.length === 0) {
    return;
  }

  const tagOrder = [];
  const tagCounts = new Map();
  const cardTags = new Map();

  for (const card of cards) {
    const tags = (card.dataset.tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    cardTags.set(card, tags);

    for (const tag of tags) {
      if (!tagCounts.has(tag)) {
        tagOrder.push(tag);
        tagCounts.set(tag, 0);
      }
      tagCounts.set(tag, tagCounts.get(tag) + 1);
    }
  }

  const buttons = new Map();
  const activeTags = new Set();
  let firstRender = true;

  const animateCardReflow = (beforeRects) => {
    if (!beforeRects) {
      return;
    }

    for (const card of cards) {
      if (card.classList.contains('is-hidden')) {
        continue;
      }

      const before = beforeRects.get(card);
      if (!before) {
        continue;
      }

      const after = card.getBoundingClientRect();
      const deltaX = before.left - after.left;
      const deltaY = before.top - after.top;

      if (deltaX === 0 && deltaY === 0) {
        continue;
      }

      card.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        {
          duration: 360,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        }
      );
    }
  };

  const setStatus = (visibleCount) => {
    if (activeTags.size === 0) {
      status.textContent = `显示全部分类 · ${visibleCount}/${cards.length}`;
      return;
    }

    const selectedTags = Array.from(activeTags).join(' · ');
    status.textContent = `筛选「${selectedTags}」· ${visibleCount}/${cards.length}`;
  };

  const updateToggleLabel = () => {
    if (!filterToggle) {
      return;
    }

    const isOpen = filterPanelOpen;
    const activeCount = activeTags.size;
    const label = isOpen ? '收起筛选' : '展开筛选';
    filterToggle.textContent = activeCount > 0 ? `${label} · ${activeCount}` : label;
    filterToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  const setFilterPanelOpen = (open) => {
    if (!filterPanel) {
      filterPanelOpen = false;
      updateToggleLabel();
      return;
    }

    filterPanelOpen = open;

    if (open) {
      filterPanel.hidden = false;
      requestAnimationFrame(() => {
        filterPanel.classList.add('is-open');
      });
    } else {
      filterPanel.classList.remove('is-open');
    }

    updateToggleLabel();
  };

  const render = () => {
    const beforeRects = firstRender
      ? null
      : new Map(
          cards.map((card) => [card, card.getBoundingClientRect()])
        );
    let visibleCount = 0;

    for (const card of cards) {
      const tags = cardTags.get(card) || [];
      const visible = activeTags.size === 0 || tags.some((tag) => activeTags.has(tag));
      card.classList.toggle('is-hidden', !visible);
      visibleCount += visible ? 1 : 0;
    }

    grid.classList.toggle('is-filtering', activeTags.size > 0);
    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }

    for (const [tag, button] of buttons.entries()) {
      const isActive = tag === 'all' ? activeTags.size === 0 : activeTags.has(tag);
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }

    setStatus(visibleCount);
    updateToggleLabel();

    if (!firstRender) {
      requestAnimationFrame(() => {
        animateCardReflow(beforeRects);
      });
    }

    firstRender = false;
  };

  const createButton = (label, tag, count) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'world-filter-chip';
    button.dataset.tag = tag;
    button.textContent = label;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      if (tag === 'all') {
        activeTags.clear();
      } else if (activeTags.has(tag)) {
        activeTags.delete(tag);
      } else {
        activeTags.add(tag);
      }

      render();
    });

    if (count !== undefined) {
      button.title = `${label} · ${count} 篇`;
    }

    buttons.set(tag, button);
    return button;
  };

  filterButtons.appendChild(createButton('全部', 'all', cards.length));

  for (const tag of tagOrder) {
    filterButtons.appendChild(createButton(`${tag} · ${tagCounts.get(tag)}`, tag, tagCounts.get(tag)));
  }

  if (filterToggle && filterPanel) {
    filterPanel.addEventListener('transitionend', (event) => {
      if (event.target !== filterPanel || event.propertyName !== 'opacity') {
        return;
      }

      if (!filterPanelOpen && !filterPanel.classList.contains('is-open')) {
        filterPanel.hidden = true;
      }
    });

    filterToggle.addEventListener('click', () => {
      const shouldOpen = !filterPanelOpen;
      setFilterPanelOpen(shouldOpen);

      if (shouldOpen) {
        const firstChip = filterPanel.querySelector('.world-filter-chip');
        if (firstChip instanceof HTMLElement) {
          firstChip.focus();
        }
      }
    });
  }

  render();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWorldPage, { once: true });
} else {
  initWorldPage();
}

if (window.document$ && typeof window.document$.subscribe === 'function') {
  window.document$.subscribe(() => {
    initWorldPage();
  });
}
