"use client";

import { useEffect } from "react";
import { initNativePlugins } from "@/lib/mobile/capacitor";

/**
 * Initializes Capacitor native plugins when running inside the
 * mobile app. Renders nothing — just runs the init on mount.
 *
 * Usage in root layout:
 *   <NativeInit />
 */
export function NativeInit() {
  useEffect(() => {
    initNativePlugins();
  }, []);

  return null;
}
