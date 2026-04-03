import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApiKeyForm from "./ApiKeyForm";
import { I18nProvider } from "../../../i18n/I18nProvider";

const testApiKeyConnectionMock = vi.hoisted(() => vi.fn());

vi.mock("../services/apiKeys.service", () => ({
  testApiKeyConnection: testApiKeyConnectionMock,
}));

describe("ApiKeyForm", () => {
  const renderForm = (props: ComponentProps<typeof ApiKeyForm>) =>
    render(
      <I18nProvider>
        <ApiKeyForm {...props} />
      </I18nProvider>
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows validation error when test is started without credentials", async () => {
    renderForm({ onSave: vi.fn(), onCancel: vi.fn() });

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByText("Error")).toBeInTheDocument();
    expect(
      screen.getByText("Fill in API Key and API Secret before testing.")
    ).toBeInTheDocument();
    expect(testApiKeyConnectionMock).not.toHaveBeenCalled();
  });

  it("shows success status for successful connection test", async () => {
    testApiKeyConnectionMock.mockResolvedValueOnce({
      ok: true,
      message: "Binance connection OK",
    });

    renderForm({ onSave: vi.fn(), onCancel: vi.fn() });

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "test-api-key" },
    });
    fireEvent.change(screen.getByLabelText("API Secret"), {
      target: { value: "test-api-secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() => {
      expect(testApiKeyConnectionMock).toHaveBeenCalledWith({
        exchange: "BINANCE",
        apiKey: "test-api-key",
        apiSecret: "test-api-secret",
      });
    });

    expect(await screen.findByText("OK")).toBeInTheDocument();
    expect(screen.getByText("Binance connection OK")).toBeInTheDocument();
  });

  it("shows error status for failed connection test", async () => {
    testApiKeyConnectionMock.mockRejectedValueOnce(new Error("Invalid API credentials"));

    renderForm({ onSave: vi.fn(), onCancel: vi.fn() });

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "bad-key" },
    });
    fireEvent.change(screen.getByLabelText("API Secret"), {
      target: { value: "bad-secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByText("Error")).toBeInTheDocument();
    expect(
      screen.getByText("Could not verify connection.")
    ).toBeInTheDocument();
  });

  it("blocks save when connection test has not succeeded in current session", async () => {
    const onSave = vi.fn();
    renderForm({ onSave, onCancel: vi.fn() });

    fireEvent.change(screen.getByLabelText("Key name"), {
      target: { value: "Binance main" },
    });
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "test-api-key" },
    });
    fireEvent.change(screen.getByLabelText("API Secret"), {
      target: { value: "test-api-secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(testApiKeyConnectionMock).not.toHaveBeenCalled();
  });

  it("allows save after successful test for current credentials", async () => {
    const onSave = vi.fn();
    testApiKeyConnectionMock.mockResolvedValueOnce({
      ok: true,
      message: "Binance connection OK",
    });
    renderForm({ onSave, onCancel: vi.fn() });

    fireEvent.change(screen.getByLabelText("Key name"), {
      target: { value: "Binance main" },
    });
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "test-api-key" },
    });
    fireEvent.change(screen.getByLabelText("API Secret"), {
      target: { value: "test-api-secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await screen.findByText("OK");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({
      label: "Binance main",
      exchange: "BINANCE",
      apiKey: "test-api-key",
      apiSecret: "test-api-secret",
      syncExternalPositions: true,
      manageExternalPositions: false,
    });
  });

  it("includes onboarding toggles in save payload", async () => {
    const onSave = vi.fn();
    testApiKeyConnectionMock.mockResolvedValueOnce({
      ok: true,
      message: "Binance connection OK",
    });
    renderForm({ onSave, onCancel: vi.fn() });

    fireEvent.change(screen.getByLabelText("Key name"), {
      target: { value: "Binance managed" },
    });
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "toggle-api-key" },
    });
    fireEvent.change(screen.getByLabelText("API Secret"), {
      target: { value: "toggle-api-secret" },
    });

    fireEvent.click(screen.getByLabelText("Sync external exchange positions"));
    fireEvent.click(screen.getByLabelText("Allow bot to manage external positions"));

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await screen.findByText("OK");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({
      label: "Binance managed",
      exchange: "BINANCE",
      apiKey: "toggle-api-key",
      apiSecret: "toggle-api-secret",
      syncExternalPositions: false,
      manageExternalPositions: true,
    });
  });
});
