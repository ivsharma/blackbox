import { browser } from "wxt/browser";
import { debounce } from "@/lib/debounce";
import { safeSet, safeGet, safeRemove } from "@/lib/storageHelper";
import { record } from "rrweb";
import { ContentToInjectEvents, Events, InjectToContentEvents } from "@/lib/events";
import { showToast } from "@/lib/toast";

// Unique identifier for this tab's recording session (persisted across reloads via sessionStorage)
const SESSION_KEY = 'recordingSessionId';
let recordingSessionId: string | null = null;
if (typeof window !== 'undefined' && window.sessionStorage) {
  recordingSessionId = window.sessionStorage.getItem(SESSION_KEY);
  if (!recordingSessionId) {
    recordingSessionId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
    window.sessionStorage.setItem(SESSION_KEY, recordingSessionId);
  }
}


async function main(ctx: any) {
  if (ctx.isInvalid) {
    return;
  }

  await injectScript("/inject.js", {
    keepInDom: true,
  });

  function sendMessage(event: any) {
    window.postMessage(
      {
        source: event,
      },
      "*"
    );
  }
  window.addEventListener("message", (event) => {
    if (event.source === window && event.data.source === InjectToContentEvents.onCdp) {
      //@ts-ignore
      const message = event.data.message;
      record.addCustomEvent("cdp", message);
    }

    if(event.source === window && event.data.source === InjectToContentEvents.onResponseData) {
      const message = event.data.message;
      responseDataMap[message.requestId] = {
        ...message,
        requestId: undefined
      }
    }
  });

  // Persist recording data when the page is about to unload (e.g., reload or navigation)
  window.addEventListener('beforeunload', async () => {
    if (stopRecording) {
      // Save current events and response data to storage so they can be resumed after reload
      await persistPartialRecording();
      // Remember that a recording was in progress so we can auto‑resume
      await safeSet('recordingInProgress', recordingSessionId!);
      // --- Beacon / synchronous fallback using localStorage (best‑effort) ---
      try {
        const payload = JSON.stringify({ events, responseDataMap });
        // localStorage is synchronous and survives page reloads
        window.localStorage.setItem('partialRecordingFallback', payload);
        window.localStorage.setItem('recordingInProgressFallback', recordingSessionId!);
      } catch (e) {
        console.error('Fallback storage error:', e);
      }
    }
  });

  type RecordHandler = () => void;

  let stopRecording: RecordHandler | null = null;
  // Initialize with any persisted events from previous page reloads
  let events: any[] = [];
  let responseDataMap: Record<string, any> = {};
  // Helper to persist partial recording across reloads
  async function persistPartialRecording() {
    if (events.length > 0 || Object.keys(responseDataMap).length > 0) {
      await safeSet('partialRecording', { events, responseDataMap });
    }
  }
  // Load persisted partial recording if exists
  async function loadPartialRecording() {
    let stored: any = await safeGet('partialRecording');
    if (!stored) {
      // Try synchronous fallback from localStorage (best‑effort)
      try {
        const payload = window.localStorage.getItem('partialRecordingFallback');
        if (payload) {
          stored = JSON.parse(payload);
        }
      } catch (e) {
        console.error('Fallback load error:', e);
      }
    }
    if (stored) {
      events = stored.events || [];
      responseDataMap = stored.responseDataMap || {};
      // clear stored after loading
      await safeRemove('partialRecording');
      // also clear fallback entries
      window.localStorage.removeItem('partialRecordingFallback');
      window.localStorage.removeItem('recordingInProgressFallback');
    }
  }

const schedulePersist = debounce(() => persistPartialRecording().catch(console.error), 2000);
// On script initialization, check if a recording was previously in progress.
  // If so, automatically resume it so the user doesn't lose their session.
    (async () => {
      let flag: any = await safeGet('recordingInProgress');
      if (!flag) {
        // Try synchronous fallback from localStorage
        try {
          const fallback = window.localStorage.getItem('recordingInProgressFallback');
          if (fallback) {
            flag = fallback;
          }
        } catch (e) {
          console.error('Fallback flag load error:', e);
        }
      }
      if (flag === recordingSessionId) {
        // Remove flag now – startRecording will set it again on unload if needed.
        await safeRemove('recordingInProgress');
        // also clear fallback flag
        window.localStorage.removeItem('recordingInProgressFallback');
        await startRecording();
        showToast('Recording resumed after page reload');
      }
    })();

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === Events.startRecording) {
      startRecording();
      sendResponse({ success: true, message: "Recording started" });
    } else if (message.action === Events.stopRecording) {
      stopAndGetRecording().then(recording => {
        sendResponse({ success: true, recording });
      });
    } else if (message.action === Events.getRecordingStatus) {
      sendResponse({ isRecording: stopRecording !== null });
    }

    return true;
  });

  async function startRecording() {
    if (stopRecording) {
      console.log("Recording is already in progress");
      return;
    }

    // Load any previously saved partial recording data before starting a new one
    await loadPartialRecording();

    console.log("Starting recording...");

    const recordHandler = record({
emit(event) {
          events.push(event);
          schedulePersist();
        },
      recordCanvas: true,
      collectFonts: true,
      sampling: {
        scroll: 150,
        media: 800,
      },
    });

    if (recordHandler) {
      stopRecording = recordHandler;
      console.log("Recording started successfully");
      sendMessage(ContentToInjectEvents.startCdp);
    } else {
      console.error("Failed to start recording");
    }
  }

  async function stopAndGetRecording() {
    if (!stopRecording) {
      console.log("No recording in progress");
      return { events: [], responseDataMap: {} };
    }

    console.log("Stopping recording...");
    stopRecording();
    stopRecording = null;
    sendMessage(ContentToInjectEvents.stopCdp);
    const recordedEvents = [...events];
    const recordedResponseBody = { ...responseDataMap };
    events = [];
    responseDataMap = {};

    await safeRemove('recordingInProgress');
    window.localStorage.removeItem('recordingInProgressFallback');
    window.localStorage.removeItem('partialRecordingFallback');

    console.log(`Recording stopped. Captured ${recordedEvents.length} events`);
    return { events: recordedEvents, responseDataMap: recordedResponseBody };
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  main,
});