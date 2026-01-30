
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
let creating; // A global promise to avoid concurrency issues

async function setupOffscreenDocument(path) {
    // Check all windows controlled by the service worker to see if one 
    // of them is the offscreen document with the given path
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // create offscreen document
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: ['DOM_SCRAPING', 'BLOBS', 'IFRAME_SCRIPTING', 'AUDIO_PLAYBACK'],
            justification: 'Running legacy background logic including DOM manipulation, LocalStorage and Audio',
        });
        await creating;
        creating = null;
    }
}

async function ensureOffscreen() {
    await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
}

// Proxies for communicating with the offscreen document

chrome.alarms.onAlarm.addListener(async (alarm) => {
    await ensureOffscreen();
    chrome.runtime.sendMessage({
        type: 'ALARM_TRIGGERED',
        alarm: alarm
    });
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
    await ensureOffscreen();
    chrome.runtime.sendMessage({
        type: 'NOTIFICATION_CLICKED',
        notificationId: notificationId
    });
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    await ensureOffscreen();
    chrome.runtime.sendMessage({
        type: 'NOTIFICATION_BUTTON_CLICKED',
        notificationId: notificationId,
        buttonIndex: buttonIndex
    });
});

// Forward other messages if needed, or rely on chrome.runtime.sendMessage broadcasting 
// that touches the offscreen document anyway.

// Initialize on startup
chrome.runtime.onStartup.addListener(ensureOffscreen);
chrome.runtime.onInstalled.addListener(async (details) => {
    await ensureOffscreen();
    if (details.reason === 'install') {
        chrome.tabs.create({ url: "start.html" });
    }
});

// Comprehensive Chrome API proxy for offscreen document
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Context Menu handling
    if (message.type === 'UPDATE_CONTEXT_MENU') {
        if (message.action === 'create') {
            chrome.contextMenus.create(message.menuProperties, () => {
                if (chrome.runtime.lastError) { /* ignore */ }
            });
        } else if (message.action === 'remove') {
            chrome.contextMenus.remove(message.menuId, () => {
                if (chrome.runtime.lastError) { /* ignore */ }
            });
        }
        return false;
    }

    // Chrome Action API proxy
    if (message.type === 'CHROME_ACTION') {
        const { method, args } = message;
        if (method === 'getBadgeText') {
            chrome.action.getBadgeText(args[0], (text) => {
                sendResponse({ result: text });
            });
            return true;
        } else if (method === 'setBadgeText') {
            chrome.action.setBadgeText(args[0]);
        } else if (method === 'setBadgeBackgroundColor') {
            chrome.action.setBadgeBackgroundColor(args[0]);
        } else if (method === 'setTitle') {
            chrome.action.setTitle(args[0]);
        } else if (method === 'setIcon') {
            // Convert relative paths to absolute URLs
            const iconDetails = args[0];
            if (iconDetails.path) {
                if (typeof iconDetails.path === 'string') {
                    iconDetails.path = chrome.runtime.getURL(iconDetails.path);
                } else if (typeof iconDetails.path === 'object') {
                    for (const size in iconDetails.path) {
                        iconDetails.path[size] = chrome.runtime.getURL(iconDetails.path[size]);
                    }
                }
            }
            chrome.action.setIcon(iconDetails);
        }
        return false;
    }

    // Chrome Alarms API proxy
    if (message.type === 'CHROME_ALARMS') {
        const { method, args } = message;
        if (method === 'create') {
            chrome.alarms.create(args[0], args[1]);
        } else if (method === 'get') {
            chrome.alarms.get(args[0], (alarm) => {
                sendResponse({ result: alarm });
            });
            return true;
        } else if (method === 'clearAll') {
            chrome.alarms.clearAll();
        } else if (method === 'clear') {
            chrome.alarms.clear(args[0]);
        }
        return false;
    }

    // Chrome Tabs API proxy
    if (message.type === 'CHROME_TABS') {
        const { method, args } = message;
        if (method === 'create') {
            chrome.tabs.create(args[0], (tab) => {
                sendResponse({ result: tab });
            });
            return true;
        } else if (method === 'get') {
            chrome.tabs.get(args[0], (tab) => {
                sendResponse({ result: tab });
            });
            return true;
        } else if (method === 'remove') {
            chrome.tabs.remove(args[0]);
        } else if (method === 'update') {
            chrome.tabs.update(args[0], args[1], (tab) => {
                sendResponse({ result: tab });
            });
            return true;
        } else if (method === 'query') {
            chrome.tabs.query(args[0], (tabs) => {
                sendResponse({ result: tabs });
            });
            return true;
        } else if (method === 'sendMessage') {
            chrome.tabs.sendMessage(args[0], args[1], args[2], (response) => {
                sendResponse({ result: response });
            });
            return true;
        }
        return false;
    }

    // Chrome Notifications API proxy
    if (message.type === 'CHROME_NOTIFICATIONS') {
        const { method, args } = message;
        if (method === 'create') {
            chrome.notifications.create(args[0], args[1], (notificationId) => {
                sendResponse({ result: notificationId });
            });
            return true;
        }
        return false;
    }

    // Chrome Windows API proxy
    if (message.type === 'CHROME_WINDOWS') {
        const { method, args } = message;
        if (method === 'create') {
            chrome.windows.create(args[0], (win) => {
                sendResponse({ result: win });
            });
            return true;
        } else if (method === 'update') {
            chrome.windows.update(args[0], args[1]);
        }
        return false;
    }

    // Chrome Runtime reload proxy
    if (message.type === 'CHROME_RUNTIME_RELOAD') {
        chrome.runtime.reload();
        return false;
    }

    // Message Proxy for Legacy Actions (handle via Offscreen Document)
    const legacyActions = [
        'saveLoginState', 'getAccount', 'autoLogin', 'getTask', 'getSetting',
        'setVariable', 'priceProtectionNotice', 'checkin_notice', 'goldCoinReceived',
        'beanReceived', 'markCheckinStatus', 'saveAccount', 'runStatus', 'create_tab',
        'couponReceived', 'productPrice', 'promotions', 'getPageSetting',
        'openLogin', 'openPricePro', 'paid', 'getPriceChart', 'getMessages',
        'getOrders', 'clearUnread', 'openUrlAsMoblie', 'getProductPrice',
        'loginFailed', 'option', 'runTask', 'findOrder', 'findGood', 'myTab'
    ];

    // Ignore messages that are already forwarded to offscreen to prevent infinite loops
    if (message.target === 'offscreen') {
        return false;
    }

    // Check if the message is a legacy action or explicitly targeted for offscreen
    // (but not ALARM_TRIGGERED which is internal)
    if (legacyActions.includes(message.action) || (message.target === 'offscreen_proxy')) {
        // We must return true immediately to keep the channel open while we await the offscreen doc
        (async () => {
            try {
                await ensureOffscreen();
                // Forward the message to the offscreen document
                chrome.runtime.sendMessage({
                    ...message,
                    target: 'offscreen', // Mark as forwarded
                    originalSender: sender // Forward the original sender info
                }, (response) => {
                    // Check for lastError to avoid "Unchecked runtime.lastError"
                    if (chrome.runtime.lastError) {
                        console.error("Failed to forward message to offscreen:", chrome.runtime.lastError.message);
                        // Don't call sendResponse if there's an error, or send an error object
                        sendResponse({ error: chrome.runtime.lastError.message });
                    } else {
                        // Return the response from the offscreen document to the original sender
                        sendResponse(response);
                    }
                });
            } catch (error) {
                console.error("Error in legacy action proxy:", error);
                sendResponse({ error: error.toString() });
            }
        })();
        return true; // Keep channel open for async response
    }

    return false;
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "open-popup") {
        chrome.windows.create({
            url: chrome.runtime.getURL("popup.html"),
            width: 800,
            height: 620,
            top: 0,
            type: "popup",
            state: 'normal'
        }, function (win) {
            chrome.windows.update(win.id, { focused: true });
        });
    } else if (info.menuItemId === "login-notice") {
        chrome.tabs.create({
            url: "https://home.jd.com"
        });
    }
});
