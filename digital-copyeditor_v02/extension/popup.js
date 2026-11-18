const DEFAULT_APP_URL = "http://localhost:5173/editor";
const source = document.querySelector("#source");
const style = document.querySelector("#style");
const appUrl = document.querySelector("#app-url");
const status = document.querySelector("#status");

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function getAppUrl() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ appUrl: DEFAULT_APP_URL }, (value) => {
      resolve(
        typeof value.appUrl === "string" && value.appUrl.trim()
          ? value.appUrl.trim()
          : DEFAULT_APP_URL,
      );
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  appUrl.value = await getAppUrl();
});

document.querySelector("#capture").addEventListener("click", async () => {
  setStatus("စာသား ရယူနေသည်...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("လက်ရှိ tab ကို ရယူ၍ မရပါ။");
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() ?? "",
    });
    const selectedText = result?.[0]?.result?.trim() ?? "";
    if (!selectedText) {
      setStatus("စာမျက်နှာပေါ်တွင် စာသားရွေးချယ်ပြီး ထပ်မံကြိုးစားပါ။", true);
      return;
    }
    source.value = selectedText.slice(0, 50000);
    setStatus("စာသား ရယူပြီးပါပြီ။");
  } catch {
    setStatus("ဤစာမျက်နှာမှ စာသားရယူ၍ မရပါ။ Right-click menu ကို အသုံးပြုပါ။", true);
  }
});

document.querySelector("#open").addEventListener("click", async () => {
  const text = source.value.trim();
  if (!text) {
    setStatus("စစ်ဆေးလိုသော စာသား ထည့်ပါ။", true);
    source.focus();
    return;
  }
  const response = await chrome.runtime.sendMessage({
    type: "open-editor",
    text,
    style: style.value,
  });
  if (response?.ok) {
    setStatus("Editor ကို ဖွင့်ပြီးပါပြီ။");
  } else {
    setStatus("Editor ဖွင့်၍ မရပါ။ App URL ကို စစ်ဆေးပါ။", true);
  }
});

document.querySelector("#save-url").addEventListener("click", async () => {
  const value = appUrl.value.trim();
  try {
    const parsed = new URL(value);
    parsed.pathname = parsed.pathname.replace(/\/$/u, "") || "/editor";
    await chrome.storage.sync.set({ appUrl: parsed.toString() });
    appUrl.value = parsed.toString();
    setStatus("App URL သိမ်းပြီးပါပြီ။");
  } catch {
    setStatus("မှန်ကန်သော App URL ထည့်ပါ။", true);
  }
});
