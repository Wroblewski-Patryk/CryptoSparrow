import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

import Tabs from "./Tabs";

type TabKey = "basic" | "api" | "subscription";

const ITEMS: { key: TabKey; label: string; hash: string }[] = [
  { key: "basic", label: "Basic", hash: "basic" },
  { key: "api", label: "API", hash: "api" },
  { key: "subscription", label: "Subscription", hash: "subscription" },
];

function TabsHarness({ syncWithHash = false }: { syncWithHash?: boolean }) {
  const [value, setValue] = useState<TabKey>("basic");
  return (
    <Tabs
      items={ITEMS}
      value={value}
      onChange={setValue}
      syncWithHash={syncWithHash}
    />
  );
}

describe("Tabs", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("switches active tab on click", async () => {
    render(<TabsHarness />);

    const apiTab = screen.getByRole("tab", { name: "API" });
    fireEvent.click(apiTab);

    await waitFor(() => {
      expect(apiTab).toHaveAttribute("aria-selected", "true");
    });
  });

  it("hydrates active tab from URL hash and reacts to hash changes", async () => {
    window.location.hash = "#subscription";
    render(<TabsHarness syncWithHash />);

    const subscriptionTab = screen.getByRole("tab", { name: "Subscription" });
    await waitFor(() => {
      expect(subscriptionTab).toHaveAttribute("aria-selected", "true");
    });

    await act(async () => {
      window.location.hash = "#api";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    const apiTab = screen.getByRole("tab", { name: "API" });
    await waitFor(() => {
      expect(apiTab).toHaveAttribute("aria-selected", "true");
    });
  });

  it("updates URL hash on click when syncWithHash is enabled", async () => {
    window.location.hash = "#basic";
    render(<TabsHarness syncWithHash />);

    fireEvent.click(screen.getByRole("tab", { name: "API" }));

    await waitFor(() => {
      expect(window.location.hash).toBe("#api");
    });
  });
});
