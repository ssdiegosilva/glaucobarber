import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.glaucobarber.app",
  appName: "GlaucoBarber",
  // Points to the minimal web shell that redirects to the live site
  webDir: "mobile-shell",

  server: {
    // Load the live site inside the native WebView
    url: "https://glaucobarber.com",
    // Allow navigation within the app domain
    allowNavigation: ["glaucobarber.com", "*.supabase.co"],
    // Clear cookies/cache on app update to avoid stale sessions
    cleartext: false,
  },

  plugins: {
    SplashScreen: {
      // Auto-hide after the web content loads
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#000000",
      showSpinner: false,
    },
    StatusBar: {
      // Dark content on dark background (matches GlaucoBarber theme)
      style: "DARK",
      backgroundColor: "#000000",
    },
    PushNotifications: {
      // Will be configured when implementing push
      presentationOptions: ["badge", "sound", "alert"],
    },
  },

  // Android-specific
  android: {
    // Allow mixed content for development
    allowMixedContent: false,
    // Enable back button navigation within WebView
    backgroundColor: "#000000",
  },
};

export default config;
