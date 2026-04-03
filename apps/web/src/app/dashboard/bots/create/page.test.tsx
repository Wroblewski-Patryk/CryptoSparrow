import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pageTitleMock = vi.hoisted(() => vi.fn());
const botFormMock = vi.hoisted(() => vi.fn());

vi.mock("@/ui/layout/dashboard/PageTitle", () => ({
  PageTitle: (props: { title: string }) => {
    pageTitleMock(props);
    return <h1>{props.title}</h1>;
  },
}));

vi.mock("@/features/bots/components/BotCreateEditForm", () => ({
  default: (props: { editId?: string | null }) => {
    botFormMock(props);
    return <div data-testid="bot-form">{props.editId ?? "create-mode"}</div>;
  },
}));

describe("Bots create page", () => {
  it("renders create mode when editId is missing", async () => {
    const { default: BotsCreatePage } = await import("./page");
    const ui = await BotsCreatePage({
      searchParams: Promise.resolve({}),
    });

    render(ui);

    expect(screen.getByRole("heading", { name: "Nowy bot" })).toBeInTheDocument();
    expect(screen.getByTestId("bot-form")).toHaveTextContent("create-mode");
    expect(botFormMock).toHaveBeenCalledWith({ editId: null });
  });

  it("renders edit mode when editId is provided", async () => {
    const { default: BotsCreatePage } = await import("./page");
    const ui = await BotsCreatePage({
      searchParams: Promise.resolve({ editId: "bot-123" }),
    });

    render(ui);

    expect(screen.getByRole("heading", { name: "Edytuj bota" })).toBeInTheDocument();
    expect(screen.getByTestId("bot-form")).toHaveTextContent("bot-123");
    expect(pageTitleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Edytuj bota",
      })
    );
    expect(botFormMock).toHaveBeenCalledWith({ editId: "bot-123" });
  });
});
