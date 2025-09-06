/* global window, document */

// Resilient Fiverr parser with fallbacks and heuristics
// Exposes: window.FiverrParser

(function initFiverrParser() {
  if (window.FiverrParser) return;

  /**
   * Query first element by trying a list of selectors in order.
   */
  function queryFirst(root, selectors) {
    for (const selector of selectors) {
      try {
        const el = root.querySelector(selector);
        if (el) return el;
      } catch (_) {
        // ignore invalid selector
      }
    }
    return null;
  }

  function queryAll(root, selectors) {
    for (const selector of selectors) {
      try {
        const nodeList = root.querySelectorAll(selector);
        if (nodeList && nodeList.length) return Array.from(nodeList);
      } catch (_) {}
    }
    return [];
  }

  function textContent(el) {
    return (el?.textContent || '').trim().replace(/\s+/g, ' ');
  }

  function parsePrice(text) {
    // e.g., "$5", "Starting at $25"
    const match = (text || '').replace(/,/g, '').match(/\$\s*(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  }

  function safeAttr(el, name) {
    if (!el) return null;
    try { return el.getAttribute(name); } catch (_) { return null; }
  }

  function parseGigCard(card) {
    const titleEl = queryFirst(card, [
      'h3 a[href*="/gig/"]',
      'h4 a[href*="/gig/"]',
      'a[href*="/gig/"] h3',
      'a[href*="/gig/"] h4',
      'a[href*="/gig/"]'
    ]);
    const title = textContent(titleEl) || textContent(card.querySelector('[data-qa="gig-title"], [data-qa="gig-card-title"]'));

    const sellerEl = queryFirst(card, [
      '[data-qa="seller-name"]',
      'a[href*="/profiles/"]',
      'a[href*="/levels/"], a[href*="/seller/"]',
      '[aria-label*="Seller" i]'
    ]);
    const seller = textContent(sellerEl);

    const ratingEl = queryFirst(card, [
      '[data-qa="gig-rating"]',
      '[aria-label*="rating" i]',
      '.rating',
      '.gig-rating'
    ]);
    const ratingText = textContent(ratingEl);
    const rating = (ratingText.match(/\d+(?:\.\d+)?/) || [null])[0];

    const priceEl = queryFirst(card, [
      '[data-qa="gig-price"]',
      '[aria-label*="price" i]',
      '.price',
      '.gig-price',
      'span:has(> bdi)'
    ]);
    const priceText = textContent(priceEl);
    const price = parsePrice(priceText);

    const linkEl = queryFirst(card, [
      'a[href*="/gig/"]',
      'a[href*="/share/"]'
    ]);
    const url = linkEl ? linkEl.href : null;

    return { title, seller, rating: rating ? Number(rating) : null, price, url };
  }

  function parseSearchResults(doc) {
    const containers = queryAll(doc, [
      '[data-qa="search-results"]',
      'ol, ul'
    ]);
    let cards = [];
    for (const container of containers) {
      const found = queryAll(container, [
        'li:has(a[href*="/gig/"])',
        'div:has(a[href*="/gig/"])'
      ]);
      if (found.length) cards = cards.concat(found);
    }
    // De-duplicate
    const unique = Array.from(new Set(cards));
    const gigs = unique.map(parseGigCard).filter(g => g.title || g.url);
    return { type: 'search', gigs };
  }

  function parseGigPage(doc) {
    const title = textContent(queryFirst(doc, [
      'h1[data-qa="gig-title"]',
      'h1:has(span)',
      'h1'
    ]));
    const seller = textContent(queryFirst(doc, [
      'a[href*="/seller/"]',
      '[data-qa="seller-name"]'
    ]));
    const ratingText = textContent(queryFirst(doc, [
      '[data-qa="gig-rating"]',
      '[aria-label*="rating" i]'
    ]));
    const rating = (ratingText.match(/\d+(?:\.\d+)?/) || [null])[0];

    const priceText = textContent(queryFirst(doc, [
      '[data-qa="package-price"]',
      '[data-qa="gig-price"]',
      '[aria-label*="price" i]'
    ]));
    const price = parsePrice(priceText);

    const description = textContent(queryFirst(doc, [
      '[data-qa="gig-description"]',
      'section[aria-label*="About this gig" i]'
    ]));

    const url = window.location.href;
    return { type: 'gig', gigs: [{ title, seller, rating: rating ? Number(rating) : null, price, url, description }] };
  }

  function detectPageType(doc) {
    const url = (doc?.location?.href || '').toLowerCase();
    if (url.includes('/search/')) return 'search';
    if (url.includes('/categories/') || url.includes('/subcategories/')) return 'search';
    if (url.match(/\/gig\//)) return 'gig';
    // Fallback: infer by presence of multiple gig cards
    const cards = doc.querySelectorAll('a[href*="/gig/"]');
    if (cards.length > 2) return 'search';
    return 'gig';
  }

  function parse(doc = document) {
    const type = detectPageType(doc);
    if (type === 'search') return parseSearchResults(doc);
    return parseGigPage(doc);
  }

  window.FiverrParser = { parse };
})();

