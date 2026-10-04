import { useEffect, useRef } from "react";

/** Bracketed-paste markers the terminal wraps pasted text in. */
const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";

/** Paste state carried between stdin chunks (a paste can span several). */
export interface PasteState {
  isPasting: boolean;
  buffer: string;
}

/**
 * Splits one stdin chunk into typed input (`clean`) and completed pastes,
 * carrying an unfinished paste over to the next chunk. Exported for tests.
 */
export const splitPastes = (
  str: string,
  state: PasteState,
): PasteState & { clean: string; pasted: string[] } => {
  let { isPasting, buffer } = state;
  let clean = "";
  const pasted: string[] = [];
  let i = 0;
  while (i < str.length) {
    const marker = isPasting ? PASTE_END : PASTE_START;
    const at = str.indexOf(marker, i);
    if (at === -1) {
      if (isPasting) buffer += str.slice(i);
      else clean += str.slice(i);
      break;
    }
    if (isPasting) {
      pasted.push(buffer + str.slice(i, at));
      buffer = "";
    } else {
      clean += str.slice(i, at);
      buffer = "";
    }
    isPasting = !isPasting;
    i = at + marker.length;
  }
  return { isPasting, buffer, clean, pasted };
};

export function usePasteHandler(onPaste: (text: string) => void) {
  const onPasteRef = useRef(onPaste);
  onPasteRef.current = onPaste;

  useEffect(() => {
    // Enable Bracketed Paste Mode
    process.stdout.write("\x1b[?2004h");

    // We monkey-patch process.stdin.emit to intercept the data before Ink gets it.
    const originalEmit = process.stdin.emit.bind(process.stdin);
    
    let isPasting = false;
    let pasteBuffer = "";

    process.stdin.emit = ((event: string, ...args: unknown[]) => {
      if (event === "data" && args[0] instanceof Buffer) {
        const data = args[0] as Buffer;
        const str = data.toString("utf-8");

        const result = splitPastes(str, { isPasting, buffer: pasteBuffer });
        isPasting = result.isPasting;
        pasteBuffer = result.buffer;
        for (const text of result.pasted) onPasteRef.current?.(text);
        const cleanStr = result.clean;

        // If there's non-paste data, pass it down to Ink
        if (cleanStr.length > 0) {
          return originalEmit("data", Buffer.from(cleanStr, "utf-8"));
        }
        
        // If everything was consumed by the paste buffer, stop propagation
        return true; 
      }

      return originalEmit(event, ...args);
    }) as typeof process.stdin.emit;

    return () => {
      process.stdin.emit = originalEmit;
      // Disable Bracketed Paste Mode
      process.stdout.write("\x1b[?2004l");
    };
  }, []);
}
