/* global chrome */

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

function setStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text || '';
}

document.addEventListener('DOMContentLoaded', async () => {
  const overlayEnabled = document.getElementById('overlayEnabled');
  const autoUpdate = document.getElementById('autoUpdate');
  const exportJson = document.getElementById('exportJson');
  const exportCsv = document.getElementById('exportCsv');

  chrome.runtime.sendMessage({ type: 'get-settings' }, (settings) => {
    if (overlayEnabled) overlayEnabled.checked = !!settings.overlayEnabled;
    if (autoUpdate) autoUpdate.checked = !!settings.autoUpdate;
  });

  overlayEnabled?.addEventListener('change', async (e) => {
    const enabled = !!e.target.checked;
    await chrome.runtime.sendMessage({ type: 'set-settings', payload: { overlayEnabled: enabled } });
    const tabId = await getActiveTabId();
    if (tabId) {
      try { await chrome.tabs.sendMessage(tabId, { type: 'overlay-toggled', enabled }); } catch (_) {}
    }
    setStatus(enabled ? 'Overlay enabled' : 'Overlay disabled');
  });

  autoUpdate?.addEventListener('change', async (e) => {
    const enabled = !!e.target.checked;
    await chrome.runtime.sendMessage({ type: 'set-settings', payload: { autoUpdate: enabled } });
    setStatus(enabled ? 'Auto-update on' : 'Auto-update off');
  });

  exportJson?.addEventListener('click', async () => {
    const tabId = await getActiveTabId();
    if (!tabId) return;
    try { await chrome.tabs.sendMessage(tabId, { type: 'request-export', format: 'json' }); setStatus('Exported JSON'); } catch (_) {}
  });
  exportCsv?.addEventListener('click', async () => {
    const tabId = await getActiveTabId();
    if (!tabId) return;
    try { await chrome.tabs.sendMessage(tabId, { type: 'request-export', format: 'csv' }); setStatus('Exported CSV'); } catch (_) {}
  });
});

