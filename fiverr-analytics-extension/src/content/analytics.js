/* global window */

(function initAnalytics() {
  if (window.FiverrAnalytics) return;

  const STOP_WORDS = new Set([
    'i','you','we','they','to','the','a','an','and','or','for','of','in','on','with','by','at','from','as','is','are','be','your','my','our','their','this','that','it','will','can','do','make','create','fix','build','best','top','service','services','gig','fiverr','pro'
  ]);

  function tokenize(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter(t => t.length > 2 && !STOP_WORDS.has(t));
  }

  function computeKeywordFrequency(gigs) {
    const keywordToStats = new Map();
    for (const gig of gigs || []) {
      const tokens = new Set([
        ...tokenize(gig.title),
        ...tokenize(gig.description)
      ]);
      for (const token of tokens) {
        const current = keywordToStats.get(token) || { keyword: token, count: 0, totalPrice: 0, totalRating: 0 };
        current.count += 1;
        if (typeof gig.price === 'number') current.totalPrice += gig.price;
        if (typeof gig.rating === 'number') current.totalRating += gig.rating;
        keywordToStats.set(token, current);
      }
    }
    const results = [];
    for (const stat of keywordToStats.values()) {
      results.push({
        keyword: stat.keyword,
        count: stat.count,
        avgPrice: stat.count ? stat.totalPrice / stat.count : 0,
        avgRating: stat.count ? stat.totalRating / stat.count : 0
      });
    }
    results.sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));
    return results;
  }

  window.FiverrAnalytics = { computeKeywordFrequency };
})();

