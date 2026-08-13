const initTagCards = () => {
  const shell = document.querySelector('[data-tags-page]');
  if (!shell || shell.dataset.tagsInitialized === 'true') {
    return;
  }

  const content = shell.closest('.md-content__inner');
  if (!content) {
    return;
  }

  const headings = Array.from(content.querySelectorAll('h2[id^="tag:"]'));
  shell.dataset.tagsInitialized = 'true';

  if (headings.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'tags-empty';
    empty.textContent = '还没有标签。写下第一篇带标签的文章后，它会自动出现在这里。';
    shell.appendChild(empty);
    return;
  }

  const items = headings.map((heading) => {
    const list = heading.nextElementSibling;
    const links = list instanceof HTMLUListElement
      ? Array.from(list.querySelectorAll(':scope > li > a'))
      : [];

    return { heading, list, links };
  });

  const maxCount = Math.max(...items.map((item) => item.links.length), 1);
  const uniquePosts = new Set(
    items.flatMap((item) => item.links.map((link) => link.href))
  );
  const grid = document.createElement('section');
  grid.className = 'tag-card-grid';
  grid.setAttribute('aria-label', '标签索引');

  const labelsBySlug = new Map();
  items.forEach(({ heading }) => {
    const label = heading.querySelector('.md-tag')?.textContent?.trim()
      || heading.textContent.replace('¶', '').trim();
    const slug = heading.id.replace(/^tag:/, '') || 'tag';
    if (!labelsBySlug.has(slug)) labelsBySlug.set(slug, new Set());
    labelsBySlug.get(slug).add(label);
  });

  const tagPageSlug = (label, fallback) => {
    const base = fallback || 'tag';
    if ((labelsBySlug.get(base)?.size || 0) <= 1) return base;
    const token = Array.from(new TextEncoder().encode(label), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
    return `${base}--${token}`;
  };

  items.forEach(({ heading, list, links }) => {
    const card = document.createElement('article');
    const count = links.length;
    const tagName = heading.querySelector('.md-tag')?.textContent?.trim()
      || heading.textContent.replace('¶', '').trim();
    const tagSlug = tagPageSlug(tagName, heading.id.replace(/^tag:/, ''));
    const tagLink = document.createElement('a');
    const tagLabel = document.createElement('span');
    const tagArrow = document.createElement('span');
    const progress = document.createElement('div');
    const meta = document.createElement('div');
    const countLabel = document.createElement('span');

    card.className = 'tag-card is-visible';
    card.style.setProperty('--tag-weight', `${Math.max((count / maxCount) * 100, 8)}%`);

    heading.classList.add('tag-card-title');
    heading.id = `tag:${tagSlug}`;
    tagLink.className = 'tag-card-link';
    tagLink.href = `${encodeURIComponent(tagSlug)}/`;
    tagLink.setAttribute('aria-label', `查看标签 ${tagName} 下的全部文章`);
    tagLabel.className = 'md-tag';
    tagLabel.textContent = tagName;
    tagArrow.className = 'tag-card-arrow';
    tagArrow.setAttribute('aria-hidden', 'true');
    tagArrow.textContent = '↗';
    tagLink.append(tagLabel, tagArrow);
    heading.replaceChildren(tagLink);

    meta.className = 'tag-card-meta';
    countLabel.textContent = `${count} 篇文章`;
    meta.append(countLabel);

    progress.className = 'tag-card-progress';
    progress.setAttribute('aria-hidden', 'true');
    progress.innerHTML = '<span></span>';

    card.append(heading, meta, progress);
    if (list instanceof HTMLUListElement) {
      list.remove();
    }
    grid.append(card);

    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--tag-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--tag-y', `${event.clientY - rect.top}px`);
    });
  });

  shell.append(grid);
  shell.querySelector('[data-tags-count]').textContent = String(items.length);
  shell.querySelector('[data-tag-posts-count]').textContent = String(uniquePosts.size);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTagCards, { once: true });
} else {
  initTagCards();
}

if (window.document$ && typeof window.document$.subscribe === 'function') {
  window.document$.subscribe(initTagCards);
}
