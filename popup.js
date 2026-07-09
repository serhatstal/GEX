(() => {
  'use strict';

  const GEMINI_URL = 'https://gemini.google.com';

  const elements = {
    notGemini: document.getElementById('not-gemini'),
    contentNotReady: document.getElementById('content-not-ready'),
    mainPanel: document.getElementById('main-panel'),
    totalCount: document.getElementById('total-count'),
    selectedCount: document.getElementById('selected-count'),
    selectAllBtn: document.getElementById('select-all-btn'),
    deselectAllBtn: document.getElementById('deselect-all-btn'),
    deleteBtn: document.getElementById('delete-btn'),
    processingPanel: document.getElementById('processing-panel'),
    progressText: document.getElementById('progress-text'),
    progressCount: document.getElementById('progress-count'),
    progressBar: document.getElementById('progress-bar'),
    cancelBtn: document.getElementById('cancel-btn'),
    reloadBtn: document.getElementById('reload-btn'),
  };

  let currentTabId = null;
  let isProcessing = false;
  let statusInterval = null;

  function showPanel(panelName) {
    elements.notGemini.classList.add('hidden');
    elements.contentNotReady.classList.add('hidden');
    elements.mainPanel.classList.add('hidden');

    switch (panelName) {
      case 'not-gemini':
        elements.notGemini.classList.remove('hidden');
        break;
      case 'content-not-ready':
        elements.contentNotReady.classList.remove('hidden');
        break;
      case 'main':
        elements.mainPanel.classList.remove('hidden');
        break;
    }
  }

  async function getCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0] || null);
      });
    });
  }

  async function sendToContent(action, data = {}) {
    return new Promise((resolve) => {
      if (!currentTabId) {
        resolve({ error: 'No tab' });
        return;
      }
      chrome.tabs.sendMessage(currentTabId, { action, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { error: 'No response' });
        }
      });
    });
  }

  async function checkConnection() {
    const tab = await getCurrentTab();

    if (!tab || !tab.url || !tab.url.startsWith(GEMINI_URL)) {
      showPanel('not-gemini');
      return;
    }

    currentTabId = tab.id;

    const response = await sendToContent('ping');

    if (response.error || response.status !== 'alive') {
      showPanel('content-not-ready');
      return;
    }

    showPanel('main');
    await refreshStatus();
    startStatusPolling();
  }

  async function refreshStatus() {
    if (isProcessing) return;

    const response = await sendToContent('getStatus');

    if (response.error) return;

    elements.totalCount.textContent = response.total || 0;
    elements.selectedCount.textContent = response.selected || 0;
    elements.deleteBtn.disabled = (response.selected || 0) === 0;
  }

  function startStatusPolling() {
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = setInterval(refreshStatus, 1500);
  }

  function stopStatusPolling() {
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
  }

  elements.selectAllBtn.addEventListener('click', async () => {
    await sendToContent('selectAll');
    setTimeout(refreshStatus, 200);
  });

  elements.deselectAllBtn.addEventListener('click', async () => {
    await sendToContent('deselectAll');
    setTimeout(refreshStatus, 200);
  });

  elements.deleteBtn.addEventListener('click', async () => {
    isProcessing = true;
    stopStatusPolling();

    elements.deleteBtn.disabled = true;
    elements.processingPanel.classList.remove('hidden');
    elements.progressBar.style.width = '0%';
    elements.progressText.textContent = 'Starting...';
    elements.progressCount.textContent = '0/0';

    await sendToContent('deleteSelected');
  });

  elements.cancelBtn.addEventListener('click', async () => {
    elements.cancelBtn.textContent = 'Stopping...';
    elements.cancelBtn.disabled = true;
    await sendToContent('cancel');
  });

  elements.reloadBtn.addEventListener('click', async () => {
    const tab = await getCurrentTab();
    if (tab) {
      chrome.tabs.reload(tab.id);
      setTimeout(() => {
        window.close();
      }, 500);
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'progress') {
      const { current, total, successCount, errorCount } = message;
      const percent = total > 0 ? (current / total) * 100 : 0;

      elements.progressBar.style.width = `${percent}%`;
      elements.progressCount.textContent = `${current}/${total}`;
      elements.progressText.textContent = `Deleting... (${successCount} ok, ${errorCount} err)`;
    }

    if (message.action === 'complete') {
      isProcessing = false;
      elements.processingPanel.classList.add('hidden');
      elements.cancelBtn.textContent = 'Cancel';
      elements.cancelBtn.disabled = false;

      startStatusPolling();
      refreshStatus();
    }
  });

  window.addEventListener('beforeunload', () => {
    stopStatusPolling();
  });

  checkConnection();
})();
