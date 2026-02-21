const BLOCKED_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:"
];

function isInjectableUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }
  if (BLOCKED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    return false;
  }
  return url.startsWith("http://") || url.startsWith("https://");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !tab.id) {
    return null;
  }
  return tab;
}

async function getTabById(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab && tab.id ? tab : null;
  } catch (_error) {
    return null;
  }
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return { ok: true };
  } catch (_error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["contentScript.js"]
    });
    return { ok: true };
  }
}

async function sendToTabWithRetry(tabId, payload, allowRetry = false) {
  try {
    return await chrome.tabs.sendMessage(tabId, payload);
  } catch (error) {
    if (!allowRetry) {
      throw error;
    }
    await ensureContentScript(tabId);
    await new Promise((resolve) => setTimeout(resolve, 25));
    return chrome.tabs.sendMessage(tabId, payload);
  }
}

async function relayToTab({
  tabId,
  payload,
  inject = false
}) {
  const targetTab = tabId ? await getTabById(tabId) : await getActiveTab();
  if (!targetTab || !targetTab.id) {
    return { ok: false, error: "No active tab found." };
  }

  if (!isInjectableUrl(targetTab.url)) {
    return {
      ok: false,
      error: "This page does not allow extension overlays."
    };
  }

  if (inject) {
    try {
      await ensureContentScript(targetTab.id);
    } catch (error) {
      return { ok: false, error: error.message || "Failed to inject content script." };
    }
  }

  try {
    const response = await sendToTabWithRetry(targetTab.id, payload, inject);
    return { ok: true, ...(response || {}) };
  } catch (error) {
    if (!inject) {
      return { ok: false, missingReceiver: true };
    }
    return { ok: false, error: error.message || "Failed to send message to tab." };
  }
}

async function runAction(commandType) {
  const tab = await getActiveTab();
  if (!tab || !isInjectableUrl(tab.url)) {
    return;
  }
  await ensureContentScript(tab.id);
  await sendToTabWithRetry(tab.id, commandType, true);
}

chrome.action.onClicked.addListener(async () => {
  await runAction({ type: "TOGGLE_VISIBILITY" });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-ruler") {
    await runAction({ type: "TOGGLE_VISIBILITY" });
    return;
  }

  if (command === "toggle-orientation") {
    await runAction({ type: "TOGGLE_ORIENTATION", forceVisible: true });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "BACKGROUND_RELAY") {
    return false;
  }

  (async () => {
    const result = await relayToTab({
      tabId: message.tabId,
      payload: message.payload,
      inject: Boolean(message.inject)
    });
    sendResponse(result);
  })();

  return true;
});
