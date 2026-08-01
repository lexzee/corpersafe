export type ToastKind = "info" | "success" | "warning" | "error";

/**
 * Fire-and-forget global toast. Rendered by <Toaster /> (mounted once in
 * the root layout). Event-based so it works from plain helpers (lib/utils)
 * as well as components, with no context plumbing.
 */
export function toast(message: string, kind: ToastKind = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("corpersafe:toast", { detail: { message, kind } }),
  );
}
