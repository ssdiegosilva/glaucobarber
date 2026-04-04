"use client";

import { useState, useEffect } from "react";
import { Download, Share, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(iOS);

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

  if (isInstalled) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="mx-3 mb-2">
      <button
        onClick={handleInstall}
        className="flex w-full items-center gap-3 rounded-lg border border-gold-500/20 bg-gold-500/8 px-3 py-2.5 text-xs font-medium text-gold-400 hover:bg-gold-500/15 transition-all"
      >
        <Smartphone className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Instalar App</span>
        {isIOS ? (
          <Share className="h-3 w-3 opacity-60" />
        ) : (
          <Download className="h-3 w-3 opacity-60" />
        )}
      </button>

      {showIOSGuide && isIOS && (
        <div className="mt-2 rounded-lg border border-gold-500/15 bg-surface-900 p-3">
          <p className="text-[11px] text-foreground font-medium mb-1.5">
            Abra no Safari:
          </p>
          <ol className="text-[10px] text-muted-foreground space-y-1">
            <li>1. Toque em <Share className="inline h-2.5 w-2.5 text-gold-400" /> Compartilhar</li>
            <li>2. &quot;Adicionar à Tela de Início&quot;</li>
            <li>3. Toque em &quot;Adicionar&quot;</li>
          </ol>
          <button
            onClick={() => setShowIOSGuide(false)}
            className="mt-2 text-[10px] text-muted-foreground hover:text-foreground"
          >
            Entendi
          </button>
        </div>
      )}
    </div>
  );
}
