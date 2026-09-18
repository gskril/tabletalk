"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function subscribeInstalled(callback: () => void) {
  const display = window.matchMedia("(display-mode: standalone)");
  display.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);
  return () => {
    display.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}
function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(navigator as Navigator & { standalone?: boolean }).standalone
  );
}

export function PwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Only a static offline screen is cached. Account data and OAuth always use the network.
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(() => {
          // Installation still works when offline support is unavailable.
        });
    }
  }, []);
  return null;
}

export function InstallApp() {
  const installed = useSyncExternalStore(
    subscribeInstalled,
    isInstalled,
    () => true,
  );
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => setAccepted(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  if (installed || accepted) return null;
  return (
    <>
      <button
        className="text-link install-app"
        onClick={async () => {
          if (!prompt) {
            setOpen(true);
            return;
          }
          try {
            await prompt.prompt();
            const choice = await prompt.userChoice;
            if (choice.outcome === "accepted") setAccepted(true);
          } catch {
            setOpen(true);
          } finally {
            setPrompt(null);
          }
        }}
      >
        <Download size={15} /> Install Tabletalk
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="modal">
          <DialogHeader>
            <DialogTitle>Your next meal, one tap away.</DialogTitle>
            <DialogDescription>
              Add Tabletalk to your home screen to open it in its own app
              window.
            </DialogDescription>
          </DialogHeader>
          <div className="install-instructions">
            <h3>On iPhone or iPad</h3>
            <ol>
              <li>Open this website in Safari.</li>
              <li>Tap Share, then Add to Home Screen.</li>
              <li>Keep Open as Web App enabled if shown, then tap Add.</li>
            </ol>
            <h3>On Android or desktop</h3>
            <p>
              Open your browser’s menu and choose Install app or Add to Home
              screen, when available.
            </p>
            <p className="small muted">
              You’ll need an internet connection to browse and save. If asked,
              connect Blackbird again after installing.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
