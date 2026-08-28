import { create } from "zustand";
import { INITIAL_STATE } from "./constants";
import type { AppState } from "./types";

/**
 * Module-global Zustand store holding the entire app state tree.
 * State only — actions live as stable module-level functions in
 * `src/app/actions/`. Updates go through `patchState` / `updateState`,
 * which use Zustand's native partial merge: callers supply only the keys
 * they change instead of spreading the full state.
 */
export const useAppStore = create<AppState>()(() => ({ ...INITIAL_STATE }));

export const getState = (): AppState => useAppStore.getState();

/** Merge a partial slice into the app state. */
export const patchState = (partial: Partial<AppState>): void => {
  useAppStore.setState(partial);
};

/**
 * Compute a partial update from the current state and merge it.
 * Return `{}` for a no-op.
 */
export const updateState = (
  updater: (current: AppState) => Partial<AppState>,
): void => {
  useAppStore.setState(updater);
};
