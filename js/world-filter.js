const initWorldTagFilter = () => {
  const filters = document.querySelectorAll('[data-world-tag-filter]');
  const filter = filters[filters.length - 1];
  if (!filter) {
    if (window.__worldFilterPopStateHandler) {
      window.removeEventListener('popstate', window.__worldFilterPopStateHandler);
      window.__worldFilterPopStateHandler = null;
    }
    return;
  }
  if (filter.dataset.worldFilterInitialized === 'true') {
    return;
  }

  // Keep the server-rendered filter visible even if enhancement cannot finish.
  filter.hidden = false;
  const status = filter.querySelector('[data-world-filter-status]');
  const toggle = filter.querySelector('[data-world-filter-toggle]');
  const showUnavailable = (message) => {
    filter.dataset.worldFilterInitialized = 'error';
    if (status) status.textContent = message;
    if (toggle) {
      toggle.disabled = true;
      toggle.setAttribute('aria-disabled', 'true');
    }
  };

  if (status) status.textContent = '正在载入标签…';
  if (toggle) toggle.disabled = true;

  try {
  const parent = filter.parentElement;
  const content = parent?.matches('.md-content__inner')
    ? parent
    : filter.closest('.md-content__inner');
  const indexNode = filter.querySelector('[data-world-filter-index]');
  if (!content || !indexNode) {
    showUnavailable('筛选数据暂不可用');
    return;
  }

  let rawPosts;
  try {
    rawPosts = JSON.parse(indexNode.textContent || '[]');
  } catch (error) {
    console.error('Unable to load the World article index.', error);
    showUnavailable('筛选数据载入失败');
    return;
  }
  if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
    showUnavailable('当前页面暂无可筛选文章');
    return;
  }

  const normalizeTag = (value) => String(value)
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('zh-CN');

  const posts = rawPosts.map((post) => ({
    ...post,
    tagKeys: new Set((post.tags || []).map(normalizeTag))
  }));
  const pageSize = Math.max(Number(indexNode.dataset.pageSize) || 10, 1);
  const originalCards = Array.from(content.children).filter((element) =>
    element.matches('[data-world-post]')
  );
  const nativePagination = Array.from(content.children).find((element) =>
    element.matches('.md-pagination:not(.world-filter-pagination)')
  );
  const insertionAnchor = originalCards[0] || nativePagination || indexNode;

  const chips = filter.querySelector('[data-world-filter-chips]');
  const reset = filter.querySelector('[data-world-filter-reset]');
  const panel = filter.querySelector('[data-world-filter-panel]');
  const empty = content.querySelector('[data-world-filter-empty]');
  if (!chips || !status || !reset || !toggle || !panel || !empty) {
    showUnavailable('筛选模块初始化失败');
    return;
  }

  const tagIndex = new Map();
  posts.forEach((post) => {
    const labels = new Map(
      (post.tags || []).map((label) => [normalizeTag(label), String(label).trim()])
    );
    post.tagKeys.forEach((key) => {
      if (!tagIndex.has(key)) {
        tagIndex.set(key, { key, label: labels.get(key), count: 0 });
      }
      tagIndex.get(key).count += 1;
    });
  });

  const collator = new Intl.Collator('zh-CN', {
    numeric: true,
    sensitivity: 'base'
  });
  const tags = Array.from(tagIndex.values()).sort((left, right) =>
    right.count - left.count || collator.compare(left.label, right.label)
  );
  const selected = new Set();
  const buttons = new Map();
  let currentPage = 1;

  const readStateFromUrl = () => {
    const params = new URL(window.location.href).searchParams;
    selected.clear();
    params.getAll('tag').forEach((label) => {
      const key = normalizeTag(label);
      if (tagIndex.has(key)) selected.add(key);
    });

    const requestedPage = Number.parseInt(params.get('filter_page') || '1', 10);
    currentPage = Number.isFinite(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  };

  const urlForState = (page = currentPage) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('tag');
    url.searchParams.delete('filter_page');

    tags.forEach(({ key, label }) => {
      if (selected.has(key)) url.searchParams.append('tag', label);
    });
    if (selected.size > 0 && page > 1) {
      url.searchParams.set('filter_page', String(page));
    }
    return url;
  };

  const updateUrl = (mode = 'replace') => {
    if (mode === 'none') return;
    const url = urlForState();
    const method = mode === 'push' ? 'pushState' : 'replaceState';
    try {
      window.history[method](window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (error) {
      console.warn('Unable to update the World filter URL.', error);
    }
  };

  const formatDate = (value) => {
    const [year, month, day] = String(value).split('-').map(Number);
    return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
      ? `${year}年${month}月${day}日`
      : String(value);
  };

  const createResultCard = (post) => {
    const article = document.createElement('article');
    const header = document.createElement('header');
    const meta = document.createElement('div');
    const metaList = document.createElement('ul');
    const dateItem = document.createElement('li');
    const time = document.createElement('time');
    const body = document.createElement('div');
    const heading = document.createElement('h2');
    const titleLink = document.createElement('a');
    const description = document.createElement('p');

    article.className = 'md-post md-post--excerpt world-filter-result';
    header.className = 'md-post__header';
    meta.className = 'md-post__meta md-meta';
    metaList.className = 'md-meta__list';
    dateItem.className = 'md-meta__item';
    time.dateTime = post.date;
    time.textContent = formatDate(post.date);
    dateItem.append('发布于 ', time);
    metaList.append(dateItem);

    if (Array.isArray(post.categories) && post.categories.length > 0) {
      const categoryItem = document.createElement('li');
      categoryItem.className = 'md-meta__item';
      categoryItem.append('分类于 ');

      post.categories.forEach((category, index) => {
        const link = document.createElement('a');
        link.className = 'md-meta__link';
        link.href = category.url;
        link.textContent = category.title;
        categoryItem.append(link);
        if (index < post.categories.length - 1) categoryItem.append(', ');
      });
      metaList.append(categoryItem);
    }

    if (Number(post.readtime) > 0) {
      const readtimeItem = document.createElement('li');
      readtimeItem.className = 'md-meta__item';
      readtimeItem.textContent = `阅读时长 ${post.readtime} 分钟`;
      metaList.append(readtimeItem);
    }

    meta.append(metaList);
    header.append(meta);
    body.className = 'md-post__content md-typeset';
    titleLink.href = post.url;
    titleLink.textContent = post.title;
    heading.append(titleLink);
    description.textContent = post.description;
    body.append(heading, description);
    article.append(header, body);
    return article;
  };

  const paginationItems = (page, totalPages) => {
    const values = new Set([1, totalPages, page - 1, page, page + 1]);
    const pages = Array.from(values)
      .filter((value) => value >= 1 && value <= totalPages)
      .sort((left, right) => left - right);
    const items = [];

    pages.forEach((value, index) => {
      if (index > 0 && value - pages[index - 1] > 1) items.push(null);
      items.push(value);
    });
    return items;
  };

  const createPagination = (page, totalPages) => {
    if (totalPages <= 1) return null;

    const nav = document.createElement('nav');
    nav.className = 'md-pagination world-filter-pagination';
    nav.setAttribute('aria-label', '筛选结果分页');

    const addLink = (label, targetPage, ariaLabel = '') => {
      const link = document.createElement('a');
      link.className = 'md-pagination__link';
      link.href = urlForState(targetPage);
      link.textContent = label;
      if (ariaLabel) link.setAttribute('aria-label', ariaLabel);
      link.addEventListener('click', (event) => {
        event.preventDefault();
        currentPage = targetPage;
        render('push');
        filter.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
      });
      nav.append(link);
    };

    if (page > 1) addLink('上一页', page - 1, '筛选结果上一页');

    paginationItems(page, totalPages).forEach((value) => {
      if (value === null) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'world-filter-pagination__ellipsis';
        ellipsis.textContent = '…';
        ellipsis.setAttribute('aria-hidden', 'true');
        nav.append(ellipsis);
      } else if (value === page) {
        const current = document.createElement('span');
        current.className = 'md-pagination__current';
        current.textContent = String(value);
        current.setAttribute('aria-current', 'page');
        nav.append(current);
      } else {
        addLink(String(value), value, `筛选结果第 ${value} 页`);
      }
    });

    if (page < totalPages) addLink('下一页', page + 1, '筛选结果下一页');
    return nav;
  };

  const clearDynamicResults = () => {
    content.querySelectorAll(':scope > .world-filter-result, :scope > .world-filter-pagination')
      .forEach((element) => element.remove());
  };

  const render = (historyMode = 'replace') => {
    clearDynamicResults();

    buttons.forEach((button, key) => {
      const active = selected.has(key);
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const hasSelection = selected.size > 0;
    filter.classList.toggle('has-selection', hasSelection);
    reset.hidden = !hasSelection;

    if (!hasSelection) {
      originalCards.forEach((card) => { card.hidden = false; });
      if (nativePagination) nativePagination.hidden = false;
      empty.hidden = true;
      currentPage = 1;
      status.textContent = `共 ${posts.length} 篇文章`;
      updateUrl(historyMode);
      return;
    }

    originalCards.forEach((card) => { card.hidden = true; });
    if (nativePagination) nativePagination.hidden = true;

    const matches = posts.filter((post) =>
      Array.from(selected).every((key) => post.tagKeys.has(key))
    );
    const totalPages = Math.max(Math.ceil(matches.length / pageSize), 1);
    currentPage = Math.min(Math.max(currentPage, 1), totalPages);
    const start = (currentPage - 1) * pageSize;
    const pagePosts = matches.slice(start, start + pageSize);

    pagePosts.forEach((post) => {
      content.insertBefore(createResultCard(post), insertionAnchor);
    });

    const pagination = createPagination(currentPage, totalPages);
    if (pagination) content.insertBefore(pagination, insertionAnchor);

    empty.hidden = matches.length > 0;
    status.textContent = matches.length > 0
      ? `${matches.length} 篇结果 · 第 ${currentPage} / ${totalPages} 页`
      : '没有匹配文章';
    updateUrl(historyMode);
  };

  const fragment = document.createDocumentFragment();
  tags.forEach(({ key, label, count }) => {
    const button = document.createElement('button');
    const name = document.createElement('span');
    const total = document.createElement('span');

    button.type = 'button';
    button.className = 'world-tag-filter__chip';
    button.dataset.tagKey = key;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `${label}，${count} 篇文章`);
    name.className = 'world-tag-filter__chip-name';
    name.textContent = label;
    total.className = 'world-tag-filter__chip-count';
    total.textContent = String(count);
    total.setAttribute('aria-hidden', 'true');
    button.append(name, total);

    button.addEventListener('click', () => {
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
      currentPage = 1;
      render('push');
    });

    buttons.set(key, button);
    fragment.append(button);
  });

  reset.addEventListener('click', () => {
    selected.clear();
    currentPage = 1;
    render('push');
  });

  const setExpanded = (expanded) => {
    filter.classList.toggle('is-expanded', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.textContent = expanded ? '收起标签' : '展开标签';
    panel.setAttribute('aria-hidden', String(!expanded));
    if (expanded) panel.removeAttribute('inert');
    else panel.setAttribute('inert', '');
  };

  toggle.addEventListener('click', () => {
    setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
  });

  chips.append(fragment);
  readStateFromUrl();
  filter.dataset.worldFilterInitialized = 'true';
  toggle.disabled = false;
  toggle.removeAttribute('aria-disabled');
  setExpanded(false);
  render('replace');

  const viewPath = window.location.pathname;
  const handlePopState = () => {
    if (window.location.pathname !== viewPath) return;
    readStateFromUrl();
    render('none');
  };

  if (window.__worldFilterPopStateHandler) {
    window.removeEventListener('popstate', window.__worldFilterPopStateHandler);
  }
  window.__worldFilterPopStateHandler = handlePopState;
  window.addEventListener('popstate', handlePopState);
  } catch (error) {
    console.error('Unable to initialize the World tag filter.', error);
    showUnavailable('筛选模块初始化失败');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWorldTagFilter, { once: true });
} else {
  initWorldTagFilter();
}

if (window.document$ && typeof window.document$.subscribe === 'function') {
  window.document$.subscribe(initWorldTagFilter);
}
