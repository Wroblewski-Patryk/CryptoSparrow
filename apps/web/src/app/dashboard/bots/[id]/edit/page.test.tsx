import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pageTitleMock = vi.hoisted(() => vi.fn());
const botFormMock = vi.hoisted(() => vi.fn());

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

describe("Bots edit page", () => {
  it("renders edit mode for canonical /dashboard/bots/:id/edit route", async () => {
    const { default: BotsEditPage } = await import("./page");
    const ui = await BotsEditPage({
      params: Promise.resolve({ id: "bot-321" }),
    });

    render(ui);

    expect(screen.getByRole("heading", { name: "Bots" })).toBeInTheDocument();
    expect(screen.getByTestId("bot-form")).toHaveTextContent("bot-321");
    expect(pageTitleMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Bots" }));
    expect(botFormMock).toHaveBeenCalledWith({ editId: "bot-321", formId: "bot-form-edit" });
  });
});
