import type { Key } from "ink";

/**
 * True for a Ctrl/Alt chord on a printable key (Ctrl+A, Alt+x). Ink reports
 * Ctrl+A as input "a" with `key.ctrl` set, so a handler that only compares
 * `input` treats the chord as the bare letter. Shortcuts are plain keys, so
 * every handler drops chords first: Ctrl+B is tmux's prefix, Ctrl+A screen's,
 * and Ctrl+Y must not confirm an irreversible action. (Ctrl+C, the one chord
 * adotui uses, is handled before this check.)
 */
export const isChord = (input: string, key: Pick<Key, "ctrl" | "meta">): boolean =>
  (key.ctrl || key.meta) && input.length === 1 && input >= "!" && input <= "~";
