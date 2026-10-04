import { useEffect, useState } from "react";
import { useStdout } from "ink";
import { DEFAULT_TERMINAL_COLUMNS, DEFAULT_TERMINAL_ROWS } from "../constants";

export function useTerminalSize() {
  const { stdout } = useStdout();
  const [size, setSize] = useState({
    columns: stdout.columns ?? DEFAULT_TERMINAL_COLUMNS,
    rows: stdout.rows ?? DEFAULT_TERMINAL_ROWS,
  });

  useEffect(() => {
    const onResize = () => {
      setSize({
        columns: stdout.columns ?? DEFAULT_TERMINAL_COLUMNS,
        rows: stdout.rows ?? DEFAULT_TERMINAL_ROWS,
      });
    };

    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return size;
}
