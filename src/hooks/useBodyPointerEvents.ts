import { useEffect } from "react";

/**
 * Safety hook: monitors document.body for stuck pointer-events: none
 * caused by Radix UI Dialog cleanup failures.
 * If pointer-events: none remains for 3s without any active overlay, clears it.
 */
export function useBodyPointerEvents() {
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const check = () => {
      if (document.body.style.pointerEvents === "none") {
        const hasOverlay = document.querySelector("[data-radix-dialog-overlay]");
        if (!hasOverlay) {
          console.warn("[useBodyPointerEvents] Clearing stuck pointer-events: none");
          document.body.style.pointerEvents = "";
        }
      }
    };

    const observer = new MutationObserver(() => {
      if (document.body.style.pointerEvents === "none") {
        if (timerId) clearTimeout(timerId);
        timerId = setTimeout(check, 3000);
      } else {
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      observer.disconnect();
      if (timerId) clearTimeout(timerId);
    };
  }, []);
}
