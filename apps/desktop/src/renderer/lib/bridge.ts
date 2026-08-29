import { createContext, useContext } from "react";
import type { InsightifyDesktopApi } from "@insightify/desktop-bridge";

// The renderer reaches the desktop through exactly one seam. Every other module
// depends on the InsightifyDesktopApi type instead of on `window`, so a Web
// client or a test harness only has to supply a different object here.
export const BridgeContext = createContext<InsightifyDesktopApi | null>(null);

export function desktopBridge(): InsightifyDesktopApi {
  const api = (globalThis as Partial<{ insightify: InsightifyDesktopApi }>).insightify;
  if (!api) throw new Error("The desktop bridge is unavailable: preload did not run.");
  return api;
}

export function useBridge(): InsightifyDesktopApi {
  return useContext(BridgeContext) ?? desktopBridge();
}
