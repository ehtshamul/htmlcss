// Background service worker for MV3

const DEFAULT_SETTINGS = {
  overlayEnabled: true,
  autoUpdate: true
};

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const toSet = {};
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (existing[key] === undefined) toSet[key] = value;
  }
  if (Object.keys(toSet).length) {
    await chrome.storage.sync.set(toSet);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Relay or handle settings updates
  if (message?.type === 'get-settings') {
    chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS)).then(sendResponse);
    return true;
  }
  if (message?.type === 'set-settings') {
    chrome.storage.sync.set(message.payload || {}).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === 'toggle-overlay') {
    chrome.storage.sync.set({ overlayEnabled: message.enabled === true }).then(async () => {
      if (sender.tab?.id) {
        try {
          await chrome.tabs.sendMessage(sender.tab.id, { type: 'overlay-toggled', enabled: message.enabled });
        } catch (e) {
          // content script may not be ready
        }
      }
      sendResponse({ ok: true });
    });
    return true;
  }
});

