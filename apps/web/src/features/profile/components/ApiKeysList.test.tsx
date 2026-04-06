import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ApiKeysList from "./ApiKeysList";
import { I18nProvider } from "../../../i18n/I18nProvider";

const useApiKeysMock = vi.hoisted(() => vi.fn());
const handleDeleteMock = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useApiKeys", () => ({
  useApiKeys: useApiKeysMock,
}));

vi.mock("../../../i18n/useLocaleFormatting", () => ({
  useLocaleFormatting: () => ({
    formatDate: (value?: string | null) => value ?? "-",
  }),
}));

vi.mock("./ApiKeyForm", () => ({
  default: () => <div>API_KEY_FORM_STUB</div>,
}));

describe("ApiKeysList", () => {
  it("requires risk confirmation before deleting API key", async () => {
    handleDeleteMock.mockResolvedValue(undefined);
    useApiKeysMock.mockReturnValue({
      keys: [
        {
          id: "k1",
          label: "Binance main",
          exchange: "BINANCE",
          apiKey: "ab********yz",
          apiSecret: "",
          createdAt: "2026-03-19T10:00:00.000Z",
          lastUsed: "2026-03-19T12:00:00.000Z",
        },
      ],
      loading: false,
      error: null,
      handleAdd: vi.fn(),
      handleEdit: vi.fn(),
      handleDelete: handleDeleteMock,
    });

    render(
      <I18nProvider>
        <ApiKeysList />
      </I18nProvider>
    );

    expect(screen.queryByText("API keys active")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const riskLabel = screen.getByText("I understand the risk and want to continue");
    const riskCheckbox = riskLabel.closest("label")?.querySelector("input[type='checkbox']") as
      | HTMLInputElement
      | null;
    expect(riskCheckbox).toBeTruthy();
    if (!riskCheckbox) return;

    const modalBox = riskLabel.closest(".modal-box");
    const deleteButton = modalBox?.querySelector("button.btn-error") as HTMLButtonElement | null;
    expect(deleteButton).toBeTruthy();
    if (!deleteButton) return;
    expect(deleteButton).toBeDisabled();
    expect(
      screen.getByText("I understand the risk and want to continue")
    ).toBeInTheDocument();

    fireEvent.click(riskCheckbox);
    expect(deleteButton).not.toBeDisabled();

    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(handleDeleteMock).toHaveBeenCalledWith("k1");
    });
  });
});
