/* global window, document, Blob, URL, FiverrCharts, FiverrExporter */

(function initOverlay() {
  if (window.FiverrOverlay) return;

  const OVERLAY_ID = 'fiverr-analytics-overlay-root';

  function createContainer() {
    let host = document.getElementById(OVERLAY_ID);
    if (host) return host;
    host = document.createElement('div');
    host.id = OVERLAY_ID;
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    host.style.top = '16px';
    host.style.right = '16px';
    host.style.width = '380px';
    host.style.maxHeight = '80vh';
    host.style.boxShadow = '0 8px 24px rgba(0,0,0,0.22)';
    host.style.borderRadius = '8px';
    host.style.overflow = 'hidden';
    host.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    document.documentElement.appendChild(host);
    return host;
  }

  function createShadow(host) {
    if (host.shadowRoot) return host.shadowRoot;
    return host.attachShadow({ mode: 'open' });
  }

  function createStyles() {
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .panel { background: #0f172a; color: #e2e8f0; border: 1px solid #1e293b; }
      .header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #111827; }
      .title { font-size: 14px; font-weight: 600; }
      .buttons { display: flex; gap: 8px; align-items: center; }
      button { background: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 6px; padding: 6px 8px; font-size: 12px; cursor: pointer; }
      button:hover { background: #374151; }
      .body { padding: 12px; overflow: auto; max-height: 70vh; }
      .section { margin-bottom: 12px; }
      .section h4 { margin: 0 0 8px 0; font-size: 13px; color: #93c5fd; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { text-align: left; padding: 6px; border-bottom: 1px solid #1f2937; }
      th { color: #9ca3af; font-weight: 600; }
      .muted { color: #9ca3af; }
      .row { display: flex; gap: 12px; }
      .col { flex: 1; min-width: 0; }
      .drag { cursor: move; }
    `;
    return style;
  }

  function createUI(shadow) {
    const wrapper = document.createElement('div');
    wrapper.className = 'panel';

    const header = document.createElement('div');
    header.className = 'header drag';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'Fiverr Analytics';
    const buttons = document.createElement('div');
    buttons.className = 'buttons';

    const btnRefresh = document.createElement('button');
    btnRefresh.textContent = 'Refresh';
    const btnExportJSON = document.createElement('button');
    btnExportJSON.textContent = 'Export JSON';
    const btnExportCSV = document.createElement('button');
    btnExportCSV.textContent = 'Export CSV';
    const btnCollapse = document.createElement('button');
    btnCollapse.textContent = 'Collapse';
    const btnClose = document.createElement('button');
    btnClose.textContent = 'Close';

    buttons.appendChild(btnRefresh);
    buttons.appendChild(btnExportJSON);
    buttons.appendChild(btnExportCSV);
    buttons.appendChild(btnCollapse);
    buttons.appendChild(btnClose);

    header.appendChild(title);
    header.appendChild(buttons);

    const body = document.createElement('div');
    body.className = 'body';

    const sectionSummary = document.createElement('div');
    sectionSummary.className = 'section';
    const hSummary = document.createElement('h4');
    hSummary.textContent = 'Summary';
    const summaryContent = document.createElement('div');
    summaryContent.className = 'muted';
    summaryContent.textContent = 'Scanning page…';
    sectionSummary.appendChild(hSummary);
    sectionSummary.appendChild(summaryContent);

    const row = document.createElement('div');
    row.className = 'row';
    const colLeft = document.createElement('div');
    colLeft.className = 'col';
    const colRight = document.createElement('div');
    colRight.className = 'col';

    const sectionKeywords = document.createElement('div');
    sectionKeywords.className = 'section';
    const hKeywords = document.createElement('h4');
    hKeywords.textContent = 'Top Keywords';
    const keywordsChart = document.createElement('div');
    sectionKeywords.appendChild(hKeywords);
    sectionKeywords.appendChild(keywordsChart);

    const sectionGigs = document.createElement('div');
    sectionGigs.className = 'section';
    const hGigs = document.createElement('h4');
    hGigs.textContent = 'Gigs';
    const gigsTable = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Title</th><th>Seller</th><th>Rating</th><th>Price</th></tr>';
    const tbody = document.createElement('tbody');
    gigsTable.appendChild(thead);
    gigsTable.appendChild(tbody);
    sectionGigs.appendChild(hGigs);
    sectionGigs.appendChild(gigsTable);

    colLeft.appendChild(sectionKeywords);
    colRight.appendChild(sectionGigs);
    row.appendChild(colLeft);
    row.appendChild(colRight);

    body.appendChild(sectionSummary);
    body.appendChild(row);

    wrapper.appendChild(header);
    wrapper.appendChild(body);

    shadow.appendChild(wrapper);

    const api = {
      update(data) {
        const gigs = data?.gigs || [];
        const keywords = (data?.keywords || []).slice(0, 10);

        // Summary
        const avgPrice = gigs.length ? (gigs.reduce((s, g) => s + (g.price || 0), 0) / gigs.length) : 0;
        const avgRating = gigs.length ? (gigs.reduce((s, g) => s + (g.rating || 0), 0) / gigs.length) : 0;
        summaryContent.textContent = `${gigs.length} gigs | avg price $${avgPrice.toFixed(2)} | avg rating ${avgRating.toFixed(2)}`;

        // Keywords chart
        keywordsChart.innerHTML = '';
        const bar = FiverrCharts.createBarChart(keywords.map(k => ({ label: k.keyword, value: k.count })), { width: 340, height: 180 });
        keywordsChart.appendChild(bar);

        // Gigs table
        tbody.innerHTML = '';
        for (const gig of gigs.slice(0, 50)) {
          const tr = document.createElement('tr');
          const tdTitle = document.createElement('td');
          const link = document.createElement('a');
          link.textContent = gig.title || '(no title)';
          link.href = gig.url || '#';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          tdTitle.appendChild(link);
          const tdSeller = document.createElement('td');
          tdSeller.textContent = gig.seller || '';
          const tdRating = document.createElement('td');
          tdRating.textContent = gig.rating != null ? String(gig.rating) : '';
          const tdPrice = document.createElement('td');
          tdPrice.textContent = gig.price != null ? `$${gig.price}` : '';
          tr.appendChild(tdTitle);
          tr.appendChild(tdSeller);
          tr.appendChild(tdRating);
          tr.appendChild(tdPrice);
          tbody.appendChild(tr);
        }

        // Wire buttons per update context
        btnRefresh.onclick = () => {
          const event = new CustomEvent('fiverr-analytics-refresh');
          window.dispatchEvent(event);
        };
        btnExportJSON.onclick = () => FiverrExporter.exportJSON(gigs, keywords);
        btnExportCSV.onclick = () => FiverrExporter.exportCSV(gigs, keywords);
      },
      exportJSON(gigs, keywords) {
        FiverrExporter.exportJSON(gigs, keywords);
      },
      exportCSV(gigs, keywords) {
        FiverrExporter.exportCSV(gigs, keywords);
      }
    };

    // Collapse/Close behavior
    let collapsed = false;
    btnCollapse.addEventListener('click', () => {
      collapsed = !collapsed;
      body.style.display = collapsed ? 'none' : 'block';
      btnCollapse.textContent = collapsed ? 'Expand' : 'Collapse';
    });
    btnClose.addEventListener('click', () => {
      const host = document.getElementById(OVERLAY_ID);
      if (host) host.remove();
    });

    // Dragging
    let drag = { active: false, startX: 0, startY: 0, startTop: 0, startRight: 0 };
    header.addEventListener('mousedown', (e) => {
      drag.active = true;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      const host = shadow.host;
      drag.startTop = parseInt(host.style.top || '16', 10);
      drag.startRight = parseInt(host.style.right || '16', 10);
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!drag.active) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const host = shadow.host;
      host.style.top = `${Math.max(0, drag.startTop + dy)}px`;
      host.style.right = `${Math.max(0, drag.startRight - dx)}px`;
    });
    window.addEventListener('mouseup', () => { drag.active = false; });

    return api;
  }

  function ensure() {
    const host = createContainer();
    const shadow = createShadow(host);
    if (!shadow.__ui) {
      shadow.appendChild(createStyles());
      shadow.__ui = createUI(shadow);
    }
    return shadow.__ui;
  }

  function update(data) {
    const host = document.getElementById(OVERLAY_ID);
    if (!host) return;
    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    if (!shadow.__ui) return;
    shadow.__ui.update(data);
  }

  function destroy() {
    const host = document.getElementById(OVERLAY_ID);
    if (host) host.remove();
  }

  window.FiverrOverlay = { ensure, update, destroy, exportJSON: (g, k) => FiverrExporter.exportJSON(g, k), exportCSV: (g, k) => FiverrExporter.exportCSV(g, k) };
})();

