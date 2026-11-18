# Ko Thet Digital Copy Editor — Chrome Extension

This is a standalone Chrome Manifest V3 extension for sending selected Myanmar text to the Ko Thet Digital Copy Editor React app.

## Features

- Right-click selected text and choose `Ko Thet ဖြင့် စာသားစစ်ဆေးရန်`.
- Open the extension popup and capture the current page selection.
- Paste or type text in the popup.
- Choose `အပြော` or `အရေး` before opening the editor.
- Pass text through the editor URL; the React app imports it into the existing editor.
- Limit extension handoff text to 50,000 characters.
- Configure and persist the editor URL with Chrome Sync Storage.
- Does not contain provider API keys or duplicate provider logic.

## Install locally

1. Start the React app from the project root:

   ```bash
   pnpm dev
   ```

2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the `extension` folder.
6. Open the extension popup and confirm the App URL. Vite normally uses:
   `http://localhost:5173/editor`.

If Vite starts on another port, update the App URL in the popup.

## Usage

- Select Myanmar text on a web page, right-click, and choose the Ko Thet action.
- Or open the extension, paste text, select a writing style, and click `Editor တွင်ဖွင့်ရန်`.
- The app opens in a new tab with the text imported. Proofreading still requires a configured Gemini or Custom API key in the app Settings page.

## Technical notes

- Manifest V3 service worker: `background.js`.
- Popup UI: `popup.html`, `popup.css`, `popup.js`.
- The extension uses `activeTab` and `scripting` only for the explicit capture button.
- Restricted browser pages may reject selection capture; the context menu or manual paste remains available.
