import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";

describe("ServiceWorkerRegistration", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSwTestMode = process.env.NEXT_PUBLIC_SW_TEST_MODE;

  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
    env.NEXT_PUBLIC_SW_TEST_MODE = originalSwTestMode;
    vi.restoreAllMocks();
  });

  it("registers service worker and performs update checks with activation handoff", async () => {
    env.NEXT_PUBLIC_SW_TEST_MODE = "1";

    const postMessage = vi.fn();
    const update = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn();
    const addServiceWorkerListener = vi.fn();
    const removeServiceWorkerListener = vi.fn();
    let intervalCallback: (() => void) | null = null;

    vi.spyOn(window, "setInterval").mockImplementation(((callback: TimerHandler) => {
      intervalCallback = callback as () => void;
      return 1 as unknown as number;
    }) as typeof window.setInterval);
    vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);

    const waitingWorker = {
      postMessage,
    } as unknown as ServiceWorker;

    const registration = {
      waiting: waitingWorker,
      installing: null,
      update,
      addEventListener: vi.fn(),
    } as unknown as ServiceWorkerRegistration;

    const serviceWorkerContainer = {
      register,
      addEventListener: addServiceWorkerListener,
      removeEventListener: removeServiceWorkerListener,
      controller: {} as ServiceWorker,
    } as unknown as ServiceWorkerContainer;
    register.mockResolvedValue(registration);

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorkerContainer,
    });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    render(<ServiceWorkerRegistration />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });

    await waitFor(() => {
      expect(update).toHaveBeenCalled();
    });

    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      intervalCallback?.();
      await Promise.resolve();
    });

    expect(update.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("does not register service worker outside production mode", async () => {
    env.NODE_ENV = "test";
    env.NEXT_PUBLIC_SW_TEST_MODE = "0";

    const register = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register,
      },
    });

    render(<ServiceWorkerRegistration />);

    await act(async () => Promise.resolve());

    expect(register).not.toHaveBeenCalled();
  });
});
