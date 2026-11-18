const MENU_ID = "ko-thet-proofread-selection";
const DEFAULT_APP_URL = "http://localhost:5173/editor";

async function getAppUrl() {
  const stored = await chrome.storage.sync.get({ appUrl: DEFAULT_APP_URL });
  return typeof stored.appUrl === "string" && stored.appUrl.trim()
    ? stored.appUrl.trim()
    : DEFAULT_APP_URL;
}

function createEditorUrl(appUrl, text, style = "SPOKEN") {
  const url = new URL(appUrl);
  url.searchParams.set("text", text.slice(0, 50000));
  url.searchParams.set("style", style);
  url.searchParams.set("source", "chrome-extension");
  return url.toString();
}

async function openEditor(text, style = "SPOKEN") {
  const trimmedText = typeof text === "string" ? text.trim() : "";
  if (!trimmedText) return;
  const appUrl = await getAppUrl();
  await chrome.tabs.create({ url: createEditorUrl(appUrl, trimmedText, style) });
}

function registerContextMenu() {
  chrome.contextMenus.removeAll().then(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Ko Thet ဖြင့် စာသားစစ်ဆေးရန်",
      contexts: ["selection"],
    });
  });
}

chrome.runtime.onInstalled.addListener(registerContextMenu);
chrome.runtime.onStartup.addListener(registerContextMenu);

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_ID && info.selectionText) {
    openEditor(info.selectionText).catch(() => undefined);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "open-editor") return undefined;

  openEditor(message.text, message.style)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
