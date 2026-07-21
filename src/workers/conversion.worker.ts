/// <reference lib="webworker" />
import { convertObjects } from "../lib/converter";
import type { WorkerRequest, WorkerResponse } from "../types";

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    const result = convertObjects(request.objects, request.settings, [], (progress) => {
      const response: WorkerResponse = { id: request.id, type: "progress", progress };
      self.postMessage(response);
    });
    const response: WorkerResponse = { id: request.id, type: "result", result };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = { id: request.id, type: "error", message: error instanceof Error ? error.message : "Die Konvertierung ist fehlgeschlagen." };
    self.postMessage(response);
  }
};

export {};
