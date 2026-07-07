import { create } from "zustand";
import { produce } from "immer";
import { INITIAL_STATE } from "./constants";
import type { AppState } from "./types";

/**
 * We provide a setState signature compatible with React's useState
 * so we can migrate custom hooks without rewriting them all at once.
 */
export type SetState = (updater: AppState | ((current: AppState) => AppState)) => void;

interface AppStore extends AppState {
  setState: SetState;
}

export const useAppStore = create<AppStore>((set) => ({
  ...INITIAL_STATE,
  setState: (updater) => set((state) => {
    // If updater is a function (like produce or (c) => ({...})), call it.
    if (typeof updater === "function") {
      return updater(state);
    }
    // Otherwise, just merge the object (which might be the full state tree).
    return updater;
  }),
}));
