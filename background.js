chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getActiveTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({ tabId: tabs[0].id, url: tabs[0].url });
      } else {
        sendResponse({ error: 'No active tab found' });
      }
    });
    return true;
  }

  if (message.action === 'forwardToContent') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message.payload, (response) => {
          sendResponse(response || { status: 'no_response' });
        });
      } else {
        sendResponse({ error: 'No active tab' });
      }
    });
    return true;
  }
});
