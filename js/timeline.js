/* 时间线渲染器：将 hooks/timeline_pages.py 注入的 JSON 渲染为竖直时间线。
 * 单篇文档页渲染一条时间线；lines/index 聚合页叠加全部时间线并提供标签筛选。
 * 兼容 navigation.instant（通过 document$ 订阅重新初始化）。
 */
(() => {
  const PALETTE = [
    '#2563eb', '#dc2626', '#16a34a', '#d97706',
    '#7c3aed', '#0891b2', '#db2777', '#65a30d',
  ];

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const formatYear = (year) => (year < 0 ? `前${-year}` : String(year));

  class TimelineApp {
    constructor(root, payload) {
      this.root = root;
      this.timelines = (payload.timelines || []).map((timeline) => ({
        ...timeline,
        color: PALETTE[(timeline.color || 0) % PALETTE.length],
        visible: true,
      }));
      this.active = null; // { timeline, entry }
      this.hiddenTags = new Set();
      this.tags = [];
      this.timelines.forEach((timeline) => {
        (timeline.tags || []).forEach((tag) => {
          if (!this.tags.includes(tag)) this.tags.push(tag);
        });
      });

      this.build();
      this.render();

      this.onResize = () => {
        if (!this.root.isConnected) {
          window.removeEventListener('resize', this.onResize);
          return;
        }
        this.positionConnector();
      };
      window.addEventListener('resize', this.onResize);
    }

    build() {
      const mode = this.root.dataset.timelineMode;

      if (mode === 'single' && this.timelines[0]) {
        this.root.style.setProperty('--tl-color', this.timelines[0].color);
      }

      if (mode === 'index') {
        if (this.tags.length > 0) this.buildFilters();
        this.buildLegend();
      }

      this.stage = document.createElement('div');
      this.stage.className = 'tl-stage';

      this.connectorSvg = document.createElementNS(SVG_NS, 'svg');
      this.connectorSvg.setAttribute('class', 'tl-connector');
      this.connectorSvg.style.display = 'none';
      this.connectorLine = document.createElementNS(SVG_NS, 'line');
      this.connectorSvg.appendChild(this.connectorLine);

      this.track = document.createElement('div');
      this.track.className = 'tl-track';

      this.stage.append(this.connectorSvg, this.track);
      this.root.appendChild(this.stage);
    }

    /* 顶部标签筛选栏（仅聚合页）：反选 + 每个标签一个开关 */
    buildFilters() {
      const bar = document.createElement('div');
      bar.className = 'tl-filters';

      const invert = document.createElement('button');
      invert.type = 'button';
      invert.className = 'tl-badge tl-badge--invert';
      invert.textContent = '反选';
      invert.addEventListener('click', () => {
        const next = new Set();
        this.tags.forEach((tag) => {
          if (!this.hiddenTags.has(tag)) next.add(tag);
        });
        this.hiddenTags = next;
        this.applyFilters(bar);
      });
      bar.appendChild(invert);

      this.tags.forEach((tag) => {
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'tl-badge';
        badge.textContent = tag;
        badge.dataset.tag = tag;
        badge.addEventListener('click', () => {
          if (this.hiddenTags.has(tag)) this.hiddenTags.delete(tag);
          else this.hiddenTags.add(tag);
          this.applyFilters(bar);
        });
        bar.appendChild(badge);
      });

      this.root.appendChild(bar);
    }

    applyFilters(bar) {
      bar.querySelectorAll('.tl-badge[data-tag]').forEach((badge) => {
        badge.classList.toggle('is-off', this.hiddenTags.has(badge.dataset.tag));
      });
      this.timelines.forEach((timeline) => {
        // 关闭任一标签即隐藏带有该标签的时间线；无标签的时间线始终显示
        timeline.visible = timeline.tags.every(
          (tag) => !this.hiddenTags.has(tag)
        );
        if (timeline.chip) {
          timeline.chip.classList.toggle('is-off', !timeline.visible);
        }
      });
      if (this.active && !this.active.timeline.visible) this.active = null;
      this.render();
    }

    /* 时间线图例：彩色圆点 + 标题，点击跳转到对应文档页 */
    buildLegend() {
      if (this.timelines.length === 0) return;
      const legend = document.createElement('div');
      legend.className = 'tl-legend';
      this.timelines.forEach((timeline) => {
        const chip = document.createElement('a');
        chip.className = 'tl-chip';
        chip.href = timeline.url;
        chip.style.setProperty('--tl-chip-color', timeline.color);

        const dot = document.createElement('span');
        dot.className = 'tl-chip-dot';
        const label = document.createElement('span');
        label.textContent = timeline.title;

        chip.append(dot, label);
        legend.appendChild(chip);
        timeline.chip = chip;
      });
      this.root.appendChild(legend);
    }

    /* 把条目展开为年份节点：时间段条目生成首尾两个节点，终点默认隐藏 */
    collectRows() {
      const rows = new Map();
      const add = (point) => {
        if (!rows.has(point.date)) rows.set(point.date, []);
        rows.get(point.date).push(point);
      };

      this.timelines.forEach((timeline) => {
        if (!timeline.visible) return;
        timeline.entries.forEach((entry) => {
          if (entry.end == null) {
            add({ date: entry.start, timeline, entry, primary: true });
          } else {
            const lo = Math.min(entry.start, entry.end);
            const hi = Math.max(entry.start, entry.end);
            add({ date: lo, timeline, entry, primary: true });
            add({ date: hi, timeline, entry, primary: false });
          }
        });
      });

      return Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);
    }

    isEntryActive(entry) {
      return this.active !== null && this.active.entry === entry;
    }

    render() {
      this.track.replaceChildren();
      this.connectorSvg.style.display = 'none';

      const rows = this.collectRows();
      this.track.classList.toggle('is-empty', rows.length === 0);
      if (rows.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'tl-empty';
        empty.textContent = '没有可显示的时间线条目。';
        this.track.appendChild(empty);
        return;
      }

      rows.forEach(([date, points]) => {
        const visible = points.filter(
          (point) => point.primary || this.isEntryActive(point.entry)
        );
        if (visible.length === 0) return;

        const row = document.createElement('div');
        row.className = 'tl-row';
        row.dataset.date = String(date);

        const left = document.createElement('div');
        left.className = 'tl-side tl-side--left';
        const right = document.createElement('div');
        right.className = 'tl-side tl-side--right';

        visible.forEach((point) => {
          const card = this.buildCard(point);
          (point.entry.era ? left : right).appendChild(card);
        });

        const pointEl = document.createElement('div');
        pointEl.className = 'tl-point';
        const distinct = new Set(visible.map((point) => point.timeline));
        if (distinct.size === 1) {
          pointEl.style.setProperty('--tl-dot-color', visible[0].timeline.color);
        }
        const dot = document.createElement('span');
        dot.className = 'tl-point-dot';
        const year = document.createElement('span');
        year.className = 'tl-point-year';
        year.textContent = formatYear(date);
        pointEl.append(dot, year);

        row.append(left, pointEl, right);
        this.track.appendChild(row);
      });

      // getBoundingClientRect 会强制同步布局，此处直接定位即可
      this.positionConnector();
    }

    buildCard(point) {
      const { timeline, entry } = point;
      const active = this.isEntryActive(entry);

      const card = document.createElement('div');
      card.className = 'tl-card';
      if (active) card.classList.add('is-active');
      card.style.setProperty('--tl-card-color', timeline.color);

      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'tl-card-name';
      name.textContent = entry.name;
      if (active && entry.end != null) {
        const range = document.createElement('span');
        range.className = 'tl-card-range';
        range.textContent =
          `（${formatYear(Math.min(entry.start, entry.end))} ~ ` +
          `${formatYear(Math.max(entry.start, entry.end))}）`;
        name.appendChild(range);
      }
      name.addEventListener('click', () => this.toggle(timeline, entry));
      card.appendChild(name);

      if (entry.content || (entry.href && entry.href.length > 0)) {
        const body = document.createElement('div');
        body.className = 'tl-card-content';
        if (entry.content) {
          body.appendChild(document.createTextNode(entry.content));
        }
        (entry.href || []).forEach((link) => {
          const anchor = document.createElement('a');
          anchor.href = link.link;
          anchor.textContent = link.text;
          body.append(' ', anchor);
        });
        card.appendChild(body);
      }

      return card;
    }

    toggle(timeline, entry) {
      if (this.isEntryActive(entry)) {
        this.active = null;
        this.render();
        return;
      }
      this.active = { timeline, entry };
      this.render();

      const firstDate =
        entry.end == null ? entry.start : Math.min(entry.start, entry.end);
      const row = this.track.querySelector(`[data-date="${firstDate}"]`);
      if (row) {
        try {
          row.scrollIntoView({ behavior: 'instant', block: 'center' });
        } catch (error) {
          row.scrollIntoView({ block: 'center' });
        }
      }
    }

    /* 在起止年份节点之间画一条连接线（类似参考网站的粗斜线） */
    positionConnector() {
      if (!this.active || this.active.entry.end == null) {
        this.connectorSvg.style.display = 'none';
        return;
      }

      const { entry, timeline } = this.active;
      const dates = [
        Math.min(entry.start, entry.end),
        Math.max(entry.start, entry.end),
      ];
      const dots = dates
        .map((date) =>
          this.track.querySelector(`[data-date="${date}"] .tl-point-dot`)
        )
        .filter(Boolean);
      if (dots.length !== 2) {
        this.connectorSvg.style.display = 'none';
        return;
      }

      const stageRect = this.stage.getBoundingClientRect();
      const centers = dots.map((dot) => {
        const rect = dot.getBoundingClientRect();
        return {
          x: rect.left - stageRect.left + rect.width / 2,
          y: rect.top - stageRect.top + rect.height / 2,
        };
      });

      this.connectorSvg.setAttribute('width', String(this.stage.scrollWidth));
      this.connectorSvg.setAttribute('height', String(this.stage.scrollHeight));
      this.connectorLine.setAttribute('x1', String(centers[0].x));
      this.connectorLine.setAttribute('y1', String(centers[0].y));
      this.connectorLine.setAttribute('x2', String(centers[1].x));
      this.connectorLine.setAttribute('y2', String(centers[1].y));
      this.connectorLine.setAttribute('stroke', timeline.color);
      this.connectorSvg.style.display = '';
    }
  }

  const initTimelines = () => {
    document.querySelectorAll('[data-timeline-app]').forEach((root) => {
      if (root.dataset.timelineReady === 'true') return;
      // payload 放在 data 属性中：navigation.instant 换页时会改写 <script>，
      // 属性则可以原样保留（详见 hooks/timeline_pages.py）
      let payload;
      try {
        payload = JSON.parse(root.dataset.timelinePayload || '');
      } catch (error) {
        return;
      }
      if (!payload || !payload.timelines) return;
      root.dataset.timelineReady = 'true';
      new TimelineApp(root, payload);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTimelines, { once: true });
  } else {
    initTimelines();
  }

  if (window.document$ && typeof window.document$.subscribe === 'function') {
    window.document$.subscribe(initTimelines);
  }
})();
