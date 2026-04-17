import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/i18n/I18nProvider", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/ui/layout/dashboard/PageTitle", () => ({
  PageTitle: (props: { title: string; addLabel?: string; onAdd?: () => void }) => (
    <div>
      <h1>{props.title}</h1>
      <button type="button" onClick={props.onAdd}>
        {props.addLabel}
      </button>
    </div>
  ),
}));

vi.mock("@/features/bots/components/BotsListTable", () => ({
  default: () => <div data-testid="bots-table">bots-table</div>,
}));

describe("Bots list page", () => {
  it("navigates to /dashboard/bots/create from add action", async () => {
    const { default: BotsPage } = await import("./page");

    render(<BotsPage />);

    expect(screen.getByTestId("bots-table")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "dashboard.backtests.createLabel" }));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/bots/create");
  });
});
