"use client";
import { useMemo, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const changed = "tabletalk:tab-navigation";
const tabPaths = new Set(["/", "/feed", "/explore", "/lists", "/saved"]);
let subscribers = 0;
let documentKey: string | undefined;
type TabWindow = Window & { __tabletalkTabNavigation?: boolean };

function subscribe(callback: () => void) {
  subscribers++;
  documentKey ||= crypto.randomUUID();
  (window as TabWindow).__tabletalkTabNavigation = true;
  const back = () => {
    callback();
    const title = window.history.state?.tabletalkTitle;
    if (typeof title === "string") document.title = title;
    const y = window.history.state?.tabletalkScrollY;
    if (typeof y === "number")
      requestAnimationFrame(() => window.scrollTo(0, y));
  };
  window.addEventListener(changed, callback);
  window.addEventListener("popstate", back);
  window.addEventListener("tabletalk:tab-popstate", back);
  return () => {
    subscribers--;
    (window as TabWindow).__tabletalkTabNavigation = subscribers > 0;
    window.removeEventListener(changed, callback);
    window.removeEventListener("popstate", back);
    window.removeEventListener("tabletalk:tab-popstate", back);
  };
}
function snapshot() {
  return window.location.pathname + window.location.search;
}

// Only the existing data-backed tabs are handled here. Detail pages, auth,
// external destinations and unknown URLs retain ordinary browser navigation.
export function navigateTab(href: string): boolean {
  if (!subscribers) return false;
  const url = new URL(href, window.location.href);
  if (
    url.origin !== window.location.origin ||
    !tabPaths.has(url.pathname) ||
    url.hash
  )
    return false;
  const next = url.pathname + url.search;
  try {
    if (next !== snapshot()) {
      window.history.replaceState(
        {
          ...window.history.state,
          tabletalkScrollY: window.scrollY,
          tabletalkTitle: document.title,
          tabletalkDocument: documentKey,
        },
        "",
      );
      window.history.pushState(
        { ...window.history.state, tabletalkScrollY: 0 },
        "",
        next,
      );
    }
    window.dispatchEvent(new Event(changed));
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      const heading = document.querySelector<HTMLElement>("#main h1");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    });
    return true;
  } catch {
    return false;
  }
}

export function useTabLocation() {
  const serverPath = usePathname();
  const serverParams = useSearchParams();
  const initial =
    serverPath + (serverParams.toString() ? `?${serverParams}` : "");
  const location = useSyncExternalStore(subscribe, snapshot, () => initial);
  return useMemo(() => {
    const url = new URL(location, "https://tabletalk.invalid");
    return { path: url.pathname, params: url.searchParams };
  }, [location]);
}
