'use client';

import { useEffect } from "react";

const SW_PATH = "/sw.js";
const SW_SCOPE = "/";
const UPDATE_CHECK_INTERVAL_MS = 60_000;
const SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" } as const;
const BUILD_INFO_PATH = "/api/build-info";
const PWA_CACHE_PREFIX = "cryptosparrow-pwa-";

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
    let knownBuildId: string | null = null;
    let buildCheckInFlight = false;

    const reloadPage = () => {
      if (hasPendingReload || isDisposed) return;
      hasPendingReload = true;
      if (process.env.NODE_ENV === "test") return;
      try {
        window.location.reload();
      } catch {
        // Keep reload failures silent (for example non-browser test environments).
      }
    };

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

    const readLatestBuildId = async (): Promise<string | null> => {
      try {
        const response = await fetch(`${BUILD_INFO_PATH}?t=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            "cache-control": "no-cache",
          },
        });
        if (!response.ok) return null;

        const payload = (await response.json()) as { buildId?: unknown };
        if (typeof payload?.buildId !== "string") return null;
        const parsedBuildId = payload.buildId.trim();
        return parsedBuildId.length > 0 ? parsedBuildId : null;
      } catch {
        return null;
      }
    };

    const purgePwaCaches = async () => {
      if (!("caches" in window)) return;
      try {
        const cacheKeys = await window.caches.keys();
        await Promise.all(
          cacheKeys
            .filter((cacheKey) => cacheKey.startsWith(PWA_CACHE_PREFIX))
            .map((cacheKey) => window.caches.delete(cacheKey))
        );
      } catch {
        // Keep cache purge failures silent for MVP baseline.
      }
    };

    const checkBuildVersion = async () => {
      if (isDisposed || buildCheckInFlight) return;
      buildCheckInFlight = true;
      try {
        const latestBuildId = await readLatestBuildId();
        if (!latestBuildId) return;

        if (!knownBuildId) {
          knownBuildId = latestBuildId;
          return;
        }

        if (knownBuildId === latestBuildId) {
          return;
        }

        knownBuildId = latestBuildId;
        await purgePwaCaches();
        await requestUpdateCheck();
        reloadPage();
      } finally {
        buildCheckInFlight = false;
      }
    };

    const handleControllerChange = () => {
      if (isDisposed) return;
      reloadPage();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void requestUpdateCheck();
      void checkBuildVersion();
    };
    const handleWindowFocus = () => {
      void requestUpdateCheck();
      void checkBuildVersion();
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
          void checkBuildVersion();
        }, UPDATE_CHECK_INTERVAL_MS);

        void requestUpdateCheck();
        void checkBuildVersion();
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
