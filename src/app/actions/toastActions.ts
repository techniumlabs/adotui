import { updateState } from "../store";

export type ToastType = "info" | "success" | "error";

const TOAST_DURATION_MS = 3000;

/** Shows a toast for 3 seconds. Stable module-level action. */
export const addToast = (message: string, type: ToastType = "info"): void => {
  const id = crypto.randomUUID();
  updateState((current) => ({ toasts: [...current.toasts, { id, message, type }] }));
  setTimeout(() => {
    updateState((current) => ({ toasts: current.toasts.filter((t) => t.id !== id) }));
  }, TOAST_DURATION_MS);
};
