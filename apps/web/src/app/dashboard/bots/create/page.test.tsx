import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pageTitleMock = vi.hoisted(() => vi.fn());
const botFormMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/ui/layout/dashboard/PageTitle", () => ({
  PAGE_TITLE_ACTION_SAVE_CLASS: "btn-save",
  PageTitle: (props: { title: string }) => {
    pageTitleMock(props);
    return <h1>{props.title}</h1>;
  },
}));

vi.mock("@/features/bots/components/BotCreateEditForm", () => ({
  default: (props: { editId?: string | null; formId?: string }) => {
    botFormMock(props);
    return <div data-testid="bot-form">{props.editId ?? "create-mode"}</div>;
  },
}));

describe("Bots create page", () => {
  it("redirects legacy editId query to canonical edit route", async () => {
    const { default: BotsCreatePage } = await import("./page");

    await BotsCreatePage({
      searchParams: Promise.resolve({ editId: "bot-123" }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/dashboard/bots/bot-123/edit");
  });

  it("renders create mode when editId is missing", async () => {
    const { default: BotsCreatePage } = await import("./page");
    const ui = await BotsCreatePage({
      searchParams: Promise.resolve({}),
    });

    render(ui);

    expect(screen.getByRole("heading", { name: "Bots" })).toBeInTheDocument();
    expect(screen.getByTestId("bot-form")).toHaveTextContent("create-mode");
    expect(botFormMock).toHaveBeenCalledWith({ formId: "bot-form-create" });
  });

  it("renders create mode when search params are omitted", async () => {
    const { default: BotsCreatePage } = await import("./page");
    const ui = await BotsCreatePage({});

    render(ui);

    expect(screen.getByRole("heading", { name: "Bots" })).toBeInTheDocument();
    expect(screen.getByTestId("bot-form")).toHaveTextContent("create-mode");
    expect(pageTitleMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Bots" }));
    expect(botFormMock).toHaveBeenCalledWith({ formId: "bot-form-create" });
  });
});
