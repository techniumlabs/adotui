import { useEffect, useRef, type RefObject } from "react";
import { useStdin, useStdout, type DOMElement } from "ink";
import { parseMouse, type Click } from "./parseMouse";

const ENABLE_MOUSE = "\x1b[?1000h\x1b[?1006h";
const DISABLE_MOUSE = "\x1b[?1000l\x1b[?1006l";

type ClickListener = (click: Click) => void;
const listeners = new Set<ClickListener>();

/**
 * Turns on mouse reporting and routes clicks to useClick regions. Ink 7 pulls
 * input with stdin.read() from a 'readable' handler, so mouse reports are cut
 * out by wrapping read(): patching emit('data') would let them through, and
 * their digits would reach the key handlers as tab switches. The coordinates
 * only match the frame in Ink's alternate screen (see main.tsx).
 */
export function useMouseInput(enabled: boolean): void {
  const { stdin } = useStdin();
  const { stdout } = useStdout();

  useEffect(() => {
    if (!enabled) return;
    const originalRead = stdin.read.bind(stdin);
    const read = (size?: number): string | Buffer | null => {
      const chunk = originalRead(size) as string | Buffer | null;
      if (chunk === null) return chunk;
      const text = Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : chunk;
      const { rest, clicks } = parseMouse(text);
      for (const click of clicks) for (const listener of listeners) listener(click);
      if (rest === text) return chunk;
      // A chunk that was only mouse reports: hand Ink the next one (or null).
      if (rest.length === 0) return read(size);
      return Buffer.isBuffer(chunk) ? Buffer.from(rest, "utf-8") : rest;
    };
    stdin.read = read as typeof stdin.read;
    stdout.write(ENABLE_MOUSE);
    // Never leave the terminal reporting clicks: q and Ctrl+C exit the process directly.
    const disable = () => stdout.write(DISABLE_MOUSE);
    process.once("exit", disable);
    return () => {
      stdin.read = originalRead;
      disable();
      process.off("exit", disable);
    };
  }, [enabled, stdin, stdout]);
}

/** An Ink element's absolute cell rectangle: yoga offsets are parent-relative, so sum them up the tree. */
const screenRect = (node: DOMElement) => {
  let left = 0;
  let top = 0;
  for (let current: DOMElement | undefined = node; current?.yogaNode; current = current.parentNode) {
    left += current.yogaNode.getComputedLeft();
    top += current.yogaNode.getComputedTop();
  }
  return { left, top, width: node.yogaNode!.getComputedWidth(), height: node.yogaNode!.getComputedHeight() };
};

/** Calls `onClick(row, col)`, relative to the element, for left clicks inside it. */
export function useClick(ref: RefObject<DOMElement | null>, onClick: (row: number, col: number) => void): void {
  const handler = useRef(onClick);
  handler.current = onClick;
  useEffect(() => {
    const listener: ClickListener = ({ col, row }) => {
      const node = ref.current;
      if (!node?.yogaNode) return;
      const rect = screenRect(node);
      const inside = col >= rect.left && col < rect.left + rect.width && row >= rect.top && row < rect.top + rect.height;
      if (inside) handler.current(row - rect.top, col - rect.left);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [ref]);
}
