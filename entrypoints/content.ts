import { browser } from "wxt/browser";
import { debounce } from "@/lib/debounce";
import { safeSet, safeGet, safeRemove } from "@/lib/storageHelper";
import { record } from "rrweb";
import { ContentToInjectEvents, Events, InjectToContentEvents } from "@/lib/events";

async function main(ctx) {
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
      await safeSet('recordingInProgress', true);
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
    const stored: any = await safeGet('partialRecording');
    if (stored) {
      events = stored.events || [];
      responseDataMap = stored.responseDataMap || {};
      // clear stored after loading
      await safeRemove('partialRecording');
    }
  }

const schedulePersist = debounce(() => persistPartialRecording().catch(console.error), 2000);
// On script initialization, check if a recording was previously in progress.
  // If so, automatically resume it so the user doesn't lose their session.
  (async () => {
    const flag = await safeGet('recordingInProgress');
    if (flag) {
      // Remove flag now – startRecording will set it again on unload if needed.
      await safeRemove('recordingInProgress');
      await startRecording();
    }
  })();

  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === Events.startRecording) {
      startRecording();
      (sendResponse as any)({ success: true, message: "Recording started" });
    } else if (message.action === Events.stopRecording) {
      const recording = stopAndGetRecording();
      (sendResponse as any)({ success: true, recording });
    } else if (message.action === Events.getRecordingStatus) {
      (sendResponse as any)({ isRecording: stopRecording !== null });
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
      return [];
    }

    console.log("Stopping recording...");
    stopRecording();
    stopRecording = null;
    sendMessage(ContentToInjectEvents.stopCdp);
    const recordedEvents = [...events];
    const recordedResponseBody = {...responseDataMap}
events = [];
      responseDataMap = {};

      // recording is no longer in progress – clear persisted flag
      await safeRemove('recordingInProgress');

      console.log(`Recording stopped. Captured ${recordedEvents.length} events`);
      return {events: recordedEvents, responseDataMap: recordedResponseBody};
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  main,
});