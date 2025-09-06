/* global window, document, MutationObserver, chrome, FiverrParser, FiverrOverlay, FiverrAnalytics */

(function main() {
  if (window.__fiverrAnalyticsInitialized) return;
  window.__fiverrAnalyticsInitialized = true;

  const state = {
    enabled: true,
    autoUpdate: true,
    gigs: [],
    keywords: []
  };

  function debounce(fn, delay) {
    let t = null;
    return function debounced(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function updateData() {
    try {
      const result = FiverrParser.parse(document);
      const gigs = result.gigs || [];
      state.gigs = gigs;
      const keywordStats = FiverrAnalytics.computeKeywordFrequency(gigs);
      state.keywords = keywordStats;
      FiverrOverlay.update({ gigs, keywords: keywordStats });
    } catch (e) {
      // no-op
    }
  }

  const observer = new MutationObserver(debounce(() => {
    if (!state.enabled || !state.autoUpdate) return;
    updateData();
  }, 500));

  function start() {
    FiverrOverlay.ensure();
    updateData();
    observer.observe(document.documentElement || document.body, { subtree: true, childList: true });
  }

  function stop() {
    observer.disconnect();
    FiverrOverlay.destroy();
  }

  // Init settings
  chrome.runtime.sendMessage({ type: 'get-settings' }, (settings) => {
    if (settings && typeof settings.overlayEnabled === 'boolean') state.enabled = settings.overlayEnabled;
    if (settings && typeof settings.autoUpdate === 'boolean') state.autoUpdate = settings.autoUpdate;
    if (state.enabled) start();
  });

  // Messages from popup/background
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'overlay-toggled') {
      state.enabled = !!message.enabled;
      if (state.enabled) start();
      else stop();
    }
    if (message?.type === 'request-export') {
      if (message.format === 'json') {
        FiverrOverlay.exportJSON(state.gigs, state.keywords);
      } else if (message.format === 'csv') {
        FiverrOverlay.exportCSV(state.gigs, state.keywords);
      }
    }
  });

  // Refresh event from overlay
  window.addEventListener('fiverr-analytics-refresh', () => {
    updateData();
  });
})();

