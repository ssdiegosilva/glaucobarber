"use client";

import { useState, useEffect } from "react";
import { Download, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(iOS);

    // Listen for the install prompt (Chrome/Edge/Samsung)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setIsInstalled(true);
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide((v) => !v);
    }
  };

  // Don't render if already installed
  if (isInstalled) return null;

  // Only show if we can install (Android prompt available) or is iOS
  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="relative">
      <button
        onClick={handleInstall}
        className="group inline-flex items-center gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 px-5 py-3 text-sm font-semibold text-gold-400 hover:bg-gold-500/20 transition-all"
      >
        {isIOS ? (
          <Share className="h-4 w-4" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Instalar App Grátis
      </button>

      {/* iOS instruction tooltip */}
      {showIOSGuide && isIOS && (
        <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 w-72 rounded-xl border border-gold-500/20 bg-[#080810] p-4 shadow-xl z-50">
          <p className="text-sm text-foreground font-semibold mb-2">
            Como instalar no iPhone:
          </p>
          <ol className="text-xs text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-gold-400 font-bold">1.</span>
              Toque no botão{" "}
              <Share className="inline h-3 w-3 text-gold-400" />{" "}
              (Compartilhar) na barra do Safari
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gold-400 font-bold">2.</span>
              Role a lista e toque em{" "}
              <strong className="text-foreground">
                &quot;Adicionar à Tela de Início&quot;
              </strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gold-400 font-bold">3.</span>
              Toque em <strong className="text-foreground">&quot;Adicionar&quot;</strong>
            </li>
          </ol>
          <button
            onClick={() => setShowIOSGuide(false)}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Entendi
          </button>
        </div>
      )}
    </div>
  );
}
