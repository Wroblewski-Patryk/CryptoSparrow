'use client';

import { useEffect } from "react";

const SW_PATH = "/sw.js";
const SW_SCOPE = "/";
const UPDATE_CHECK_INTERVAL_MS = 60_000;
const SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" } as const;

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    const swEnabledInCurrentEnv =
      process.env.NODE_ENV === "production" ||
      (process.env.NODE_ENV === "test" && process.env.NEXT_PUBLIC_SW_TEST_MODE === "1");
    if (!("serviceWorker" in navigator) || !swEnabledInCurrentEnv) {
      return;
    }

    let isDisposed = false;
    let hasPendingReload = false;
    let activeRegistration: ServiceWorkerRegistration | null = null;
    let updateIntervalId: number | null = null;

    const activateWaitingWorker = (registration: ServiceWorkerRegistration) => {
      const waitingWorker = registration.waiting;
      if (!waitingWorker) return;
      waitingWorker.postMessage(SKIP_WAITING_MESSAGE);
    };

    const bindInstallingWorker = (registration: ServiceWorkerRegistration) => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;
      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state !== "installed") return;
        if (!navigator.serviceWorker.controller) return;
        activateWaitingWorker(registration);
      });
    };

    const requestUpdateCheck = async () => {
      if (!activeRegistration || isDisposed) return;
      try {
        await activeRegistration.update();
        activateWaitingWorker(activeRegistration);
      } catch {
        // Keep update-check failures silent for MVP baseline.
      }
    };

    const handleControllerChange = () => {
      if (hasPendingReload || isDisposed) return;
      hasPendingReload = true;
      window.location.reload();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void requestUpdateCheck();
    };
    const handleWindowFocus = () => {
      void requestUpdateCheck();
    };

    const register = async (): Promise<void> => {
      try {
        const registration = await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
        if (isDisposed) return;

        activeRegistration = registration;
        bindInstallingWorker(registration);
        activateWaitingWorker(registration);

        registration.addEventListener("updatefound", () => bindInstallingWorker(registration));

        navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
        window.addEventListener("focus", handleWindowFocus);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        updateIntervalId = window.setInterval(() => {
          void requestUpdateCheck();
        }, UPDATE_CHECK_INTERVAL_MS);

        void requestUpdateCheck();
      } catch {
        // Keep registration failures silent for MVP baseline.
      }
    };

    void register();

    return () => {
      isDisposed = true;
      if (updateIntervalId != null) {
        window.clearInterval(updateIntervalId);
      }
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  return null;
}
