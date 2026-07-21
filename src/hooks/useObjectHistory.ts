import { useState } from "react";
import type { EmbroideryObject } from "../types";

type History = { past: EmbroideryObject[][]; present: EmbroideryObject[]; future: EmbroideryObject[][] };

export function useObjectHistory() {
  const [history, setHistory] = useState<History>({ past: [], present: [], future: [] });
  const reset = (objects: EmbroideryObject[]) => setHistory({ past: [], present: objects, future: [] });
  const commit = (update: EmbroideryObject[] | ((objects: EmbroideryObject[]) => EmbroideryObject[])) => {
    setHistory((current) => {
      const next = typeof update === "function" ? update(current.present) : update;
      return { past: [...current.past.slice(-39), current.present], present: next, future: [] };
    });
  };
  const undo = () => setHistory((current) => current.past.length ? { past: current.past.slice(0, -1), present: current.past[current.past.length - 1], future: [current.present, ...current.future] } : current);
  const redo = () => setHistory((current) => current.future.length ? { past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1) } : current);
  return { objects: history.present, reset, commit, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}
