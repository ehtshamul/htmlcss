/* global window, document */

(function initCharts() {
  if (window.FiverrCharts) return;

  function createSvg(width, height) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    return svg;
  }

  function createBarChart(items, options) {
    const width = options?.width || 320;
    const height = options?.height || 180;
    const margin = { top: 12, right: 12, bottom: 28, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const maxValue = Math.max(1, ...items.map(d => d.value || 0));
    const barGap = 6;
    const barHeight = Math.max(8, Math.min(20, Math.floor((chartHeight - barGap * (items.length - 1)) / Math.max(1, items.length))));

    const svg = createSvg(width, height);
    const g = document.createElementNS(svg.namespaceURI, 'g');
    g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
    svg.appendChild(g);

    items.forEach((d, i) => {
      const y = i * (barHeight + barGap);
      const w = Math.round((chartWidth * (d.value || 0)) / maxValue);
      const rect = document.createElementNS(svg.namespaceURI, 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', String(w));
      rect.setAttribute('height', String(barHeight));
      rect.setAttribute('fill', '#60a5fa');
      g.appendChild(rect);

      const label = document.createElementNS(svg.namespaceURI, 'text');
      label.setAttribute('x', '-6');
      label.setAttribute('y', String(y + barHeight / 2));
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('fill', '#9ca3af');
      label.setAttribute('font-size', '10');
      label.textContent = d.label;
      g.appendChild(label);

      const valueText = document.createElementNS(svg.namespaceURI, 'text');
      valueText.setAttribute('x', String(w + 4));
      valueText.setAttribute('y', String(y + barHeight / 2));
      valueText.setAttribute('dominant-baseline', 'middle');
      valueText.setAttribute('text-anchor', 'start');
      valueText.setAttribute('fill', '#cbd5e1');
      valueText.setAttribute('font-size', '10');
      valueText.textContent = String(d.value || 0);
      g.appendChild(valueText);
    });

    // X axis line
    const axis = document.createElementNS(svg.namespaceURI, 'line');
    axis.setAttribute('x1', '0');
    axis.setAttribute('y1', String(chartHeight + 2));
    axis.setAttribute('x2', String(chartWidth));
    axis.setAttribute('y2', String(chartHeight + 2));
    axis.setAttribute('stroke', '#334155');
    svg.appendChild(axis);

    return svg;
  }

  function createDonutChart(items, options) {
    const width = options?.width || 160;
    const height = options?.height || 160;
    const radius = Math.min(width, height) / 2;
    const inner = radius * 0.6;
    const total = Math.max(1, items.reduce((s, d) => s + (d.value || 0), 0));
    const svg = createSvg(width, height);
    const g = document.createElementNS(svg.namespaceURI, 'g');
    g.setAttribute('transform', `translate(${width / 2},${height / 2})`);
    svg.appendChild(g);

    let start = 0;
    const palette = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#f87171', '#22d3ee'];
    items.forEach((d, i) => {
      const value = d.value || 0;
      const angle = (value / total) * Math.PI * 2;
      const end = start + angle;
      const color = palette[i % palette.length];

      const path = describeArc(0, 0, radius, inner, start, end);
      const p = document.createElementNS(svg.namespaceURI, 'path');
      p.setAttribute('d', path);
      p.setAttribute('fill', color);
      g.appendChild(p);

      start = end;
    });

    return svg;
  }

  function polarToCartesian(cx, cy, r, angle) {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function describeArc(cx, cy, r, inner, startAngle, endAngle) {
    const startOuter = polarToCartesian(cx, cy, r, startAngle);
    const endOuter = polarToCartesian(cx, cy, r, endAngle);
    const startInner = polarToCartesian(cx, cy, inner, endAngle);
    const endInner = polarToCartesian(cx, cy, inner, startAngle);
    const largeArc = endAngle - startAngle <= Math.PI ? 0 : 1;
    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${inner} ${inner} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
      'Z'
    ].join(' ');
  }

  window.FiverrCharts = { createBarChart, createDonutChart };
})();

