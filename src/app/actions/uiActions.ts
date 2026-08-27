import { getState, patchState } from "../store";

export const setDiffScrollOffset = (offset: number): void => {
  patchState({ diffScrollOffset: offset });
};

export const setDiffSelectedRow = (row: number): void => {
  patchState({ diffSelectedRow: row });
};

export const setCommentInputActive = (active: boolean): void => {
  if (getState().commentInputActive === active) return;
  patchState({ commentInputActive: active });
};
