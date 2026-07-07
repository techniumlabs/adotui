import type { Dispatch, SetStateAction } from "react";
import type { AppState } from "../types";

export function useToast(setState: Dispatch<SetStateAction<AppState>>) {
  const addToast = (message: string, type: "info" | "success" | "error" = "info") => {
    const id = crypto.randomUUID();
    setState((current) => ({
      ...current,
      toasts: [...current.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      setState((c) => ({ ...c, toasts: c.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  };

  return { addToast };
}
