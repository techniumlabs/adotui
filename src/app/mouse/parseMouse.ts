/**
 * Terminal mouse reports in SGR form: ESC [ < button ; col ; row M (press) / m (release),
 * 1-based. Enabled with ESC[?1000h (clicks + wheel) and ESC[?1006h (this encoding).
 */
// eslint-disable-next-line no-control-regex -- the report starts with ESC by definition
const SGR_REPORT = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

const BUTTON_BITS = 0b11;
const LEFT_BUTTON = 0;
const MOTION_FLAG = 32;
const WHEEL_FLAG = 64;
const WHEEL_DOWN_BIT = 1;

/** The wheel scrolls the focused pane exactly like the arrow keys do. */
export const WHEEL_UP_INPUT = "\x1b[A";
export const WHEEL_DOWN_INPUT = "\x1b[B";

/** A left-button press, 0-based screen cell. */
export interface Click {
  col: number;
  row: number;
}

/**
 * Splits a chunk of terminal input into what Ink should see (typed keys, with
 * wheel turns rewritten as arrow keys) and left clicks. Releases, motion and
 * other buttons are dropped.
 * ponytail: a report split across two reads is not reassembled; terminals send each report in one write.
 */
export const parseMouse = (text: string): { rest: string; clicks: Click[] } => {
  const clicks: Click[] = [];
  const rest = text.replace(SGR_REPORT, (_report, buttonText: string, colText: string, rowText: string, kind: string) => {
    const button = Number(buttonText);
    const pressed = kind === "M";
    if (button & WHEEL_FLAG) {
      if (!pressed) return "";
      return button & WHEEL_DOWN_BIT ? WHEEL_DOWN_INPUT : WHEEL_UP_INPUT;
    }
    if (pressed && !(button & MOTION_FLAG) && (button & BUTTON_BITS) === LEFT_BUTTON) {
      clicks.push({ col: Number(colText) - 1, row: Number(rowText) - 1 });
    }
    return "";
  });
  return { rest, clicks };
};
