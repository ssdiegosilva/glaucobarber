// ============================================================
// Capacitor Native Bridge
// ============================================================
// Initializes native plugins when running inside the Capacitor
// WebView. Safe to import on web — all calls are no-ops when
// Capacitor is not available.
// ============================================================

import { Capacitor } from "@capacitor/core";

/** Returns true when the app is running inside the native shell */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Returns the platform: "android", "ios", or "web" */
export function getPlatform(): string {
  return Capacitor.getPlatform();
}

/**
 * Initialize native plugins. Call this once in the root layout
 * or in a top-level client component.
 */
export async function initNativePlugins(): Promise<void> {
  if (!isNativeApp()) return;

  // ── Status Bar ──────────────────────────────────────────
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#000000" });
  } catch (e) {
    console.warn("[Mobile] StatusBar plugin not available:", e);
  }

  // ── Splash Screen ──────────────────────────────────────
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    // Hide after a short delay — the web content is already loading
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (e) {
    console.warn("[Mobile] SplashScreen plugin not available:", e);
  }

  // ── Push Notifications ─────────────────────────────────
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive === "granted") {
      await PushNotifications.register();

      PushNotifications.addListener("registration", (token) => {
        console.log("[Mobile] Push token:", token.value);
        // TODO: send token to server for this barbershop
        // POST /api/push/register { token: token.value, platform: getPlatform() }
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.error("[Mobile] Push registration error:", err.error);
      });

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("[Mobile] Push received:", notification);
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        // Handle notification tap — navigate to a specific page
        const data = action.notification.data;
        if (data?.url) {
          window.location.href = data.url;
        }
      });
    }
  } catch (e) {
    console.warn("[Mobile] PushNotifications plugin not available:", e);
  }

  // ── App (back button / deep links) ────────────────────
  try {
    const { App } = await import("@capacitor/app");

    // Handle Android back button
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // Handle deep links (e.g. glaucobarber://agenda)
    App.addListener("appUrlOpen", (event) => {
      const url = new URL(event.url);
      if (url.pathname) {
        window.location.href = url.pathname;
      }
    });
  } catch (e) {
    console.warn("[Mobile] App plugin not available:", e);
  }
}
