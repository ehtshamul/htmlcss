/* global window, document, Blob, URL */

(function initExporter() {
  if (window.FiverrExporter) return;

  function downloadBlob(filename, blob) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 0);
  }

  function exportJSON(gigs, keywords) {
    const payload = { exportedAt: new Date().toISOString(), page: location.href, gigs, keywords };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob('fiverr-analytics.json', blob);
  }

  function toCsvRow(values) {
    return values.map(v => {
      if (v == null) return '';
      const s = String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }).join(',');
  }

  function exportCSV(gigs, keywords) {
    const lines = [];
    lines.push('# Fiverr Analytics Export');
    lines.push(`# URL,${location.href}`);
    lines.push(`# Date,${new Date().toISOString()}`);
    lines.push('');
    lines.push('Gigs');
    lines.push(toCsvRow(['Title','Seller','Rating','Price','URL']));
    for (const g of gigs || []) {
      lines.push(toCsvRow([g.title, g.seller, g.rating, g.price, g.url]));
    }
    lines.push('');
    lines.push('Keywords');
    lines.push(toCsvRow(['Keyword','Count','AvgPrice','AvgRating']));
    for (const k of keywords || []) {
      lines.push(toCsvRow([k.keyword, k.count, k.avgPrice?.toFixed?.(2) ?? '', k.avgRating?.toFixed?.(2) ?? '']));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    downloadBlob('fiverr-analytics.csv', blob);
  }

  window.FiverrExporter = { exportJSON, exportCSV };
})();

