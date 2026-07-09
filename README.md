# GEX (Gemini Bulk Delete) - Chrome Extension

A Google Chrome extension to bulk delete your Gemini (gemini.google.com) conversations.

## Features

- Checkbox next to each conversation in the Gemini sidebar
- Select multiple conversations at once
- "Select All" and "Deselect All" options
- One-click bulk delete via background API (no clicking through menus)
- Progress bar with cancel option during deletion
- Dark theme UI matching Gemini's design
- MutationObserver for dynamic content support

## Installation

### Load as Unpacked Extension

1. Download or clone this repository:
   ```bash
   git clone <repo-url>
   ```

2. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```

3. Enable **Developer mode** (toggle in the top-right corner).

4. Click **"Load unpacked"** (top-left) and select the project folder (the one containing `manifest.json`).

5. The extension will appear in your toolbar.

### Pin the Extension (Recommended)

1. Click the puzzle icon (Extensions) in the Chrome toolbar.
2. Click the pin icon next to "Gemini Bulk Delete".

## Usage

1. Go to [gemini.google.com](https://gemini.google.com).
2. Checkboxes will appear next to each conversation in the sidebar.
3. Select the conversations you want to delete.
4. Use the floating toolbar at the bottom:
   - **Select All** - Select all visible conversations
   - **Deselect All** - Clear all selections
   - **Delete Selected** - Instantly delete selected conversations
5. A progress bar shows deletion status. You can cancel anytime.

### Alternative: Popup

1. Click the extension icon in the Chrome toolbar.
2. Use "Select All", "Deselect All", or "Delete Selected" buttons.

## Known Limitations

- **DOM Dependency**: The extension interacts with Gemini's web UI DOM. If Google updates the interface, the extension may temporarily break.
- **gemini.google.com only**: Only works on Gemini's web version.
- **No Undo**: Deleted conversations cannot be recovered.
- **Rate Limiting**: A short delay between deletions prevents hitting Gemini's rate limits.
- **Active Conversation**: Trying to delete the currently open conversation may cause issues.

## Technical Details

- **Manifest V3** (Chrome's latest extension standard)
- **Vanilla JavaScript** (ES6+), HTML5, CSS3
- **MutationObserver** for dynamic DOM tracking
- **Content Script** integration with Gemini
- **Background RPC API** for silent deletion (no menu clicking)
- Minimal permissions: `activeTab` and `scripting` only

## File Structure

```
gex/
├── manifest.json       # Chrome extension config
├── background.js       # Service worker (message routing)
├── content.js          # Main script injected into Gemini
├── content.css         # Styles injected into Gemini
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── popup.css           # Popup styles
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Troubleshooting

### Checkboxes not showing
- Refresh the page (F5)
- Make sure the extension is enabled (chrome://extensions/)
- Verify you're on gemini.google.com

### Deletion not working
- Gemini's interface may have been updated
- Open browser console (F12) and check for errors
- Refresh the page and try again

### Extension won't load
- Make sure Developer mode is enabled
- Select the correct folder (the one containing manifest.json)

## License

MIT License

Donate: https://buymeacoffee.com/serhatstal
