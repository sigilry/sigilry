import "./window.js";
import type { SpliceAnnounceDetail } from "./types.js";

export function announceProvider(detail: SpliceAnnounceDetail): () => void {
  const event = new CustomEvent<SpliceAnnounceDetail>("canton:announceProvider", {
    detail: Object.freeze(detail),
  });

  window.dispatchEvent(event);

  const handler = () => {
    window.dispatchEvent(event);
  };
  window.addEventListener("canton:requestProvider", handler);
  return () => {
    window.removeEventListener("canton:requestProvider", handler);
  };
}

export function requestProviders(
  onDetail: (detail: SpliceAnnounceDetail) => void,
): (() => void) | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const handler = (event: CustomEvent<SpliceAnnounceDetail>) => {
    onDetail(event.detail);
  };
  window.addEventListener("canton:announceProvider", handler);

  window.dispatchEvent(new CustomEvent("canton:requestProvider"));

  return () => {
    window.removeEventListener("canton:announceProvider", handler);
  };
}
