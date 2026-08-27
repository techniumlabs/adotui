import type { Key } from "ink";

/**
 * Applies one keystroke to a text field value.
 * Returns the next value, or null when the key isn't a text edit.
 */
export const applyTextEdit = (value: string, input: string, key: Key): string | null => {
  if (key.backspace || key.delete) return value.slice(0, -1);
  if (!key.ctrl && !key.meta && input) return value + input;
  return null;
};
