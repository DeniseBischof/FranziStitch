import type { ConversionResult, ConversionSettings, EmbroideryObject, WorkerRequest, WorkerResponse } from "../types";

let activeWorker: Worker | null = null;
let rejectActive: ((reason: Error) => void) | null = null;
let requestNumber = 0;

export function cancelConversion() {
  if (activeWorker) {
    activeWorker.terminate();
    rejectActive?.(new DOMException("Die Konvertierung wurde abgebrochen.", "AbortError"));
  }
  activeWorker = null;
  rejectActive = null;
}

export function convertObjectsInWorker(
  objects: EmbroideryObject[],
  settings: ConversionSettings,
  onProgress?: (progress: number) => void,
): Promise<ConversionResult> {
  cancelConversion();
  const worker = new Worker(new URL("../workers/conversion.worker.ts", import.meta.url), { type: "module" });
  activeWorker = worker;
  const id = `conversion-${Date.now()}-${requestNumber++}`;
  const request: WorkerRequest = { id, objects, settings };
  return new Promise((resolve, reject) => {
    rejectActive = reject;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return;
      if (event.data.type === "progress") onProgress?.(event.data.progress);
      if (event.data.type === "result") { worker.terminate(); if (activeWorker === worker) { activeWorker = null; rejectActive = null; } resolve(event.data.result); }
      if (event.data.type === "error") { worker.terminate(); if (activeWorker === worker) { activeWorker = null; rejectActive = null; } reject(new Error(event.data.message)); }
    };
    worker.onerror = (event) => { worker.terminate(); if (activeWorker === worker) { activeWorker = null; rejectActive = null; } reject(new Error(event.message || "Der Konvertierungs-Worker ist fehlgeschlagen.")); };
    worker.postMessage(request);
  });
}
