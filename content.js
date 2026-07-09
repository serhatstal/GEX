(() => {
  'use strict';

  const CONVERSATION_ROW_SELECTORS = [
    'gem-nav-list-item[data-test-id="conversation"]',
    '[data-test-id="conversation"]',
  ];

  const CONVERSATION_LINK_SELECTORS = [
    'a[href^="/app/"]',
    'a[data-test-id="conversation"][href]',
  ];

  class GeminiBulkDeleter {
    constructor() {
      this.selectedConversations = new Map();
      this.isProcessing = false;
      this.shouldCancel = false;
      this.observer = null;
      this.toolbar = null;
      this.injectedItems = new WeakSet();
      this.authToken = null;
      this.init();
    }

    init() {
      this.waitForGemini().then(() => {
        this.extractAuthToken();
        this.injectCheckboxes();
        this.setupObserver();
        this.listenForMessages();
      });
    }

    async waitForGemini() {
      return new Promise((resolve) => {
        const check = () => {
          const rows = this.getConversationRows();
          if (rows.length > 0) {
            resolve();
          } else {
            setTimeout(check, 1000);
          }
        };
        check();
      });
    }

    extractAuthToken() {
      try {
        const html = document.documentElement.innerHTML;
        const match = html.match(/"SNlM0e":"([^"]+)"/);
        if (match) {
          this.authToken = match[1];
        } else {
          console.warn('[GBD] Auth token not found');
        }
      } catch (e) {
        console.warn('[GBD] Auth token extraction error:', e);
      }
    }

    getConversationRows() {
      for (const selector of CONVERSATION_ROW_SELECTORS) {
        try {
          const items = document.querySelectorAll(selector);
          if (items.length > 0) return Array.from(items);
        } catch (e) {
          continue;
        }
      }

      const links = document.querySelectorAll('a[href^="/app/"]');
      const rows = [];
      links.forEach(link => {
        const row = link.closest('gem-nav-list-item') || link.closest('[data-test-id]') || link.parentElement;
        if (row && !rows.includes(row)) {
          rows.push(row);
        }
      });
      return rows;
    }

    getConversationLink(row) {
      for (const selector of CONVERSATION_LINK_SELECTORS) {
        try {
          const link = row.querySelector(selector);
          if (link) return link;
        } catch (e) {
          continue;
        }
      }
      return row.querySelector('a[href]') || null;
    }

    getConversationId(row) {
      const link = this.getConversationLink(row);
      if (link) {
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/app\/(.+?)(?:\?|$)/);
        if (match) return match[1];
      }
      return (row.textContent || '').trim().substring(0, 60) + '_' + Date.now();
    }

    getConversationTitle(row) {
      const link = this.getConversationLink(row);
      const titleEl = row.querySelector('.conversation-title');
      const text = titleEl?.textContent?.trim() || link?.textContent?.trim() || row.textContent?.trim() || 'Unknown';
      return text.length > 50 ? text.substring(0, 50) + '...' : text;
    }

    injectCheckboxes() {
      if (this.isProcessing) return;

      const rows = this.getConversationRows();
      rows.forEach(row => {
        if (this.injectedItems.has(row)) return;
        this.injectedItems.add(row);

        const wrapper = document.createElement('div');
        wrapper.className = 'gbd-checkbox-wrapper';
        wrapper.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
        });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'gbd-checkbox';
        const convId = this.getConversationId(row);
        checkbox.dataset.conversationId = convId;

        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          if (e.target.checked) {
            this.selectedConversations.set(convId, {
              row: row,
              title: this.getConversationTitle(row)
            });
            row.classList.add('gbd-item-selected');
          } else {
            this.selectedConversations.delete(convId);
            row.classList.remove('gbd-item-selected');
          }
          this.updateToolbar();
        });

        checkbox.addEventListener('click', (e) => {
          e.stopPropagation();
        });

        wrapper.appendChild(checkbox);

        row.style.position = 'relative';
        row.style.paddingLeft = '32px';
        wrapper.style.position = 'absolute';
        wrapper.style.left = '4px';
        wrapper.style.top = '50%';
        wrapper.style.transform = 'translateY(-50%)';

        row.insertBefore(wrapper, row.firstChild);
      });

      this.updateToolbar();
    }

    updateToolbar() {
      const count = this.selectedConversations.size;

      if (count === 0 && this.toolbar) {
        this.toolbar.remove();
        this.toolbar = null;
        return;
      }

      if (count === 0) return;

      if (!this.toolbar) {
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'gbd-floating-toolbar';
        document.body.appendChild(this.toolbar);
      }

      this.toolbar.innerHTML = `
        <span class="gbd-count">${count} selected</span>
        <button class="gbd-select-all-btn">Select All</button>
        <button class="gbd-deselect-btn">Deselect All</button>
        <button class="gbd-delete-btn">Delete Selected</button>
      `;

      this.toolbar.querySelector('.gbd-select-all-btn').addEventListener('click', () => this.selectAll());
      this.toolbar.querySelector('.gbd-deselect-btn').addEventListener('click', () => this.deselectAll());
      this.toolbar.querySelector('.gbd-delete-btn').addEventListener('click', () => this.startDelete());
    }

    selectAll() {
      const rows = this.getConversationRows();
      rows.forEach(row => {
        const checkbox = row.querySelector('.gbd-checkbox');
        if (checkbox && !checkbox.checked) {
          checkbox.checked = true;
          const convId = this.getConversationId(row);
          this.selectedConversations.set(convId, {
            row: row,
            title: this.getConversationTitle(row)
          });
          row.classList.add('gbd-item-selected');
        }
      });
      this.updateToolbar();
    }

    deselectAll() {
      document.querySelectorAll('.gbd-checkbox').forEach(cb => {
        cb.checked = false;
      });
      document.querySelectorAll('.gbd-item-selected').forEach(el => {
        el.classList.remove('gbd-item-selected');
      });
      this.selectedConversations.clear();
      this.updateToolbar();
    }

    startDelete() {
      if (this.selectedConversations.size === 0) return;
      this.deleteSelectedConversations();
    }

    showProgressDialog(total) {
      const overlay = document.createElement('div');
      overlay.className = 'gbd-progress-overlay';
      overlay.id = 'gbd-progress-overlay';

      overlay.innerHTML = `
        <div class="gbd-progress-dialog">
          <h3>Deleting Conversations</h3>
          <div class="gbd-progress-text">
            <span class="gbd-current">0</span> / <span class="gbd-total">${total}</span> deleted
          </div>
          <div class="gbd-progress-bar-container">
            <div class="gbd-progress-bar"></div>
          </div>
          <div class="gbd-progress-status">Preparing...</div>
          <div class="gbd-progress-actions">
            <button class="gbd-cancel-btn">Cancel</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.querySelector('.gbd-cancel-btn').addEventListener('click', () => {
        this.shouldCancel = true;
        overlay.querySelector('.gbd-cancel-btn').textContent = 'Stopping...';
        overlay.querySelector('.gbd-cancel-btn').disabled = true;
      });

      return overlay;
    }

    updateProgress(overlay, current, total, status) {
      if (!overlay) return;
      const bar = overlay.querySelector('.gbd-progress-bar');
      const currentEl = overlay.querySelector('.gbd-current');
      const statusEl = overlay.querySelector('.gbd-progress-status');

      if (bar) bar.style.width = `${(current / total) * 100}%`;
      if (currentEl) currentEl.textContent = current;
      if (statusEl) statusEl.textContent = status;
    }

    async deleteSelectedConversations() {
      if (this.isProcessing) return;
      this.isProcessing = true;
      this.shouldCancel = false;

      if (!this.authToken) {
        this.extractAuthToken();
        if (!this.authToken) {
          console.error('[GBD] Auth token not found. Refresh the page and try again.');
          this.isProcessing = false;
          return;
        }
      }

      const selected = Array.from(this.selectedConversations.entries());
      const total = selected.length;
      let successCount = 0;
      let errorCount = 0;

      const progressOverlay = this.showProgressDialog(total);

      for (let i = 0; i < total; i++) {
        if (this.shouldCancel) break;

        const [convId, { row, title }] = selected[i];

        this.updateProgress(progressOverlay, i, total, `Deleting: "${title}"`);

        try {
          await this.deleteSingleConversation(convId);
          successCount++;

          if (document.body.contains(row)) {
            row.style.transition = 'opacity 0.3s, max-height 0.3s';
            row.style.opacity = '0';
            row.style.maxHeight = '0';
            row.style.overflow = 'hidden';
            setTimeout(() => {
              if (document.body.contains(row)) {
                row.remove();
              }
            }, 300);
          }
        } catch (error) {
          errorCount++;
          console.warn(`[GBD] Failed to delete "${title}":`, error.message);
        }

        this.updateProgress(progressOverlay, i + 1, total,
          i < total - 1 ? 'Waiting for next...' : 'Finishing...');

        if (i < total - 1) {
          await this.delay(500);
        }
      }

      progressOverlay.remove();

      this.selectedConversations.clear();
      document.querySelectorAll('.gbd-checkbox').forEach(cb => { cb.checked = false; });
      document.querySelectorAll('.gbd-item-selected').forEach(el => { el.classList.remove('gbd-item-selected'); });

      if (this.toolbar) {
        this.toolbar.remove();
        this.toolbar = null;
      }

      console.log(`[GBD] Done: ${successCount} deleted, ${errorCount} failed`);

      this.isProcessing = false;
      this.shouldCancel = false;
    }

    async deleteSingleConversation(convId) {
      if (!this.authToken) {
        throw new Error('No auth token');
      }

      const fReq = JSON.stringify([
        [['GzXR5e', JSON.stringify([`c_${convId}`]), null, 'generic']]
      ]);

      const response = await fetch('/_/BardChatUi/data/batchexecute?rpcids=GzXR5e&source-path=%2Fapp&rt=c', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: new URLSearchParams({
          'f.req': fReq,
          'at': this.authToken
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await this.delay(200);
    }

    setupObserver() {
      let debounceTimer = null;

      this.observer = new MutationObserver((mutations) => {
        if (this.isProcessing) return;

        const hasRelevantChanges = mutations.some(m =>
          m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)
        );

        if (hasRelevantChanges) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            this.injectCheckboxes();
          }, 300);
        }
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    listenForMessages() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
          case 'selectAll':
            this.selectAll();
            sendResponse({ status: 'done', count: this.selectedConversations.size });
            break;

          case 'deselectAll':
            this.deselectAll();
            sendResponse({ status: 'done', count: 0 });
            break;

          case 'deleteSelected':
            this.startDelete();
            sendResponse({ status: 'started' });
            break;

          case 'cancel':
            this.shouldCancel = true;
            sendResponse({ status: 'cancelling' });
            break;

          case 'getStatus':
            sendResponse({
              total: this.getConversationRows().length,
              selected: this.selectedConversations.size,
              isProcessing: this.isProcessing
            });
            break;

          case 'ping':
            sendResponse({ status: 'alive' });
            break;

          default:
            sendResponse({ error: 'Unknown action' });
        }
        return true;
      });
    }

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  if (!window.__geminibulkdeleter) {
    window.__geminibulkdeleter = new GeminiBulkDeleter();
  }
})();
