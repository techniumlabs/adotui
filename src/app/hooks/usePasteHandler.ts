import { useEffect, useRef } from "react";

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

    // @ts-ignore
    process.stdin.emit = (event: string, ...args: any[]) => {
      if (event === "data" && args[0] instanceof Buffer) {
        const data = args[0] as Buffer;
        const str = data.toString("utf-8");

        let i = 0;
        let cleanStr = "";

        while (i < str.length) {
          if (!isPasting) {
            const startIdx = str.indexOf("\x1b[200~", i);
            if (startIdx !== -1) {
              cleanStr += str.slice(i, startIdx);
              isPasting = true;
              pasteBuffer = "";
              i = startIdx + 6;
            } else {
              cleanStr += str.slice(i);
              break;
            }
          } else {
            const endIdx = str.indexOf("\x1b[201~", i);
            if (endIdx !== -1) {
              pasteBuffer += str.slice(i, endIdx);
              isPasting = false;
              if (onPasteRef.current) {
                onPasteRef.current(pasteBuffer);
              }
              pasteBuffer = "";
              i = endIdx + 6;
            } else {
              pasteBuffer += str.slice(i);
              break;
            }
          }
        }

        // If there's non-paste data, pass it down to Ink
        if (cleanStr.length > 0) {
          return originalEmit("data", Buffer.from(cleanStr, "utf-8"));
        }
        
        // If everything was consumed by the paste buffer, stop propagation
        return true; 
      }

      return originalEmit(event, ...args);
    };

    return () => {
      process.stdin.emit = originalEmit;
      // Disable Bracketed Paste Mode
      process.stdout.write("\x1b[?2004l");
    };
  }, []);
}
