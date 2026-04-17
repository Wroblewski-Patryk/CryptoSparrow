import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApiKeyForm from "./ApiKeyForm";
import { I18nProvider } from "../../../i18n/I18nProvider";
import { EXCHANGE_OPTIONS } from "@/features/exchanges/exchangeCapabilities";

const testApiKeyConnectionMock = vi.hoisted(() => vi.fn());
const testStoredApiKeyConnectionMock = vi.hoisted(() => vi.fn());
const listBotsMock = vi.hoisted(() => vi.fn());
const originalBinanceWhitelist = process.env.NEXT_PUBLIC_BINANCE_IP_WHITELIST;

vi.mock("../services/apiKeys.service", () => ({
  testApiKeyConnection: testApiKeyConnectionMock,
  testStoredApiKeyConnection: testStoredApiKeyConnectionMock,
}));

vi.mock("@/features/bots/services/bots.service", () => ({
  listBots: listBotsMock,
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
    delete process.env.NEXT_PUBLIC_BINANCE_IP_WHITELIST;
    listBotsMock.mockResolvedValue([]);
    testStoredApiKeyConnectionMock.mockResolvedValue({
      ok: true,
      message: "Stored Binance connection OK",
    });
  });

  afterEach(() => {
    if (originalBinanceWhitelist) {
      process.env.NEXT_PUBLIC_BINANCE_IP_WHITELIST = originalBinanceWhitelist;
      return;
    }
    delete process.env.NEXT_PUBLIC_BINANCE_IP_WHITELIST;
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

  it("keeps the requested form step order from identity to requirements blocks", () => {
    renderForm({ onSave: vi.fn(), onCancel: vi.fn() });

    const keyNameInput = screen.getByLabelText("Key name");
    const exchangeSelect = screen.getByLabelText("Exchange");
    const apiKeyInput = screen.getByLabelText("API Key");
    const apiSecretInput = screen.getByLabelText("API Secret");
    const syncToggle = screen.getByLabelText("Sync external exchange positions");
    const manageToggle = screen.getByLabelText("Allow bot to manage external positions");
    const requirementsBlock = screen.getByText("Exchange requirements");

    expect(keyNameInput.compareDocumentPosition(exchangeSelect) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(exchangeSelect.compareDocumentPosition(apiKeyInput) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(apiKeyInput.compareDocumentPosition(apiSecretInput) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(apiSecretInput.compareDocumentPosition(syncToggle) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(syncToggle.compareDocumentPosition(manageToggle) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(manageToggle.compareDocumentPosition(requirementsBlock) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
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

  it("shows eligible live bots when external management is enabled", async () => {
    listBotsMock.mockResolvedValueOnce([
      {
        id: "bot-live-1",
        name: "Live BTC Bot",
        exchange: "BINANCE",
        mode: "LIVE",
        isActive: true,
        liveOptIn: true,
        marketType: "FUTURES",
        apiKeyId: null,
      },
      {
        id: "bot-paper-1",
        name: "Paper Bot",
        exchange: "BINANCE",
        mode: "PAPER",
        isActive: true,
        liveOptIn: false,
        marketType: "FUTURES",
        apiKeyId: null,
      },
    ]);

    renderForm({ onSave: vi.fn(), onCancel: vi.fn() });

    fireEvent.click(screen.getByLabelText("Allow bot to manage external positions"));

    expect(await screen.findByText("Bots ready to take over positions")).toBeInTheDocument();
    expect(screen.getByText("Live BTC Bot")).toBeInTheDocument();
    expect(screen.queryByText("Paper Bot")).not.toBeInTheDocument();
  });

  it("allows saving placeholder exchange key without connection probe", async () => {
    const onSave = vi.fn();
    renderForm({ onSave, onCancel: vi.fn() });

    fireEvent.change(screen.getByLabelText("Key name"), {
      target: { value: "OKX main" },
    });
    fireEvent.change(screen.getByLabelText("Exchange"), {
      target: { value: "OKX" },
    });
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "okx-api-key" },
    });
    fireEvent.change(screen.getByLabelText("API Secret"), {
      target: { value: "okx-api-secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(testApiKeyConnectionMock).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith({
      label: "OKX main",
      exchange: "OKX",
      apiKey: "okx-api-key",
      apiSecret: "okx-api-secret",
      syncExternalPositions: true,
      manageExternalPositions: false,
    });
    expect(
      screen.getByText(
        "API key test is not available for OKX yet (placeholder adapter). Saving is still allowed."
      )
    ).toBeInTheDocument();
  });

  it("renders all exchange options and blocks probe for placeholder exchanges", async () => {
    renderForm({ onSave: vi.fn(), onCancel: vi.fn() });

    const exchangeSelect = screen.getByLabelText("Exchange") as HTMLSelectElement;
    const optionValues = Array.from(exchangeSelect.options).map((option) => option.value);
    expect(optionValues).toEqual([...EXCHANGE_OPTIONS]);

    fireEvent.change(exchangeSelect, {
      target: { value: "BYBIT" },
    });

    expect(
      await screen.findByText(
        "API key test is not available for BYBIT yet (placeholder adapter). Saving is still allowed."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();
  });

  it("renders Binance whitelist IP hint from environment", async () => {
    process.env.NEXT_PUBLIC_BINANCE_IP_WHITELIST = "203.0.113.10, 203.0.113.11";
    renderForm({ onSave: vi.fn(), onCancel: vi.fn() });

    expect(
      screen.getByText("Add backend egress IP(s) to your Binance API key whitelist:")
    ).toBeInTheDocument();
    expect(screen.getByText("203.0.113.10")).toBeInTheDocument();
    expect(screen.getByText("203.0.113.11")).toBeInTheDocument();
    expect(screen.getByText("Required API permissions (Binance)")).toBeInTheDocument();
    expect(screen.getByText("Enable Spot & Margin Trading")).toBeInTheDocument();
    expect(screen.getByText("Enable Futures")).toBeInTheDocument();
  });

  it("shows exchange support status based on selected exchange", async () => {
    renderForm({ onSave: vi.fn(), onCancel: vi.fn() });

    expect(screen.getByText("API key probe:")).toBeInTheDocument();
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Exchange"), {
      target: { value: "KRAKEN" },
    });

    expect(
      await screen.findByText(
        "API key test is not available for KRAKEN yet (placeholder adapter). Saving is still allowed."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  });

  it("allows stored-credentials test in edit mode and keeps secret hidden", async () => {
    renderForm({
      isEdit: true,
      defaultValues: {
        id: "key-1",
        label: "Binance main",
        exchange: "BINANCE",
        maskedApiKey: "AB********YZ",
        syncExternalPositions: true,
        manageExternalPositions: false,
      },
      onSave: vi.fn(),
      onCancel: vi.fn(),
    });

    expect(screen.getByText(/Current API Key/)).toBeInTheDocument();
    expect(screen.getByText("AB********YZ")).toBeInTheDocument();
    expect(
      screen.getByText("API Secret is never shown. Leave both fields empty to test stored connection for this key.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Test stored connection" }));

    await waitFor(() => {
      expect(testStoredApiKeyConnectionMock).toHaveBeenCalledWith("key-1");
    });
    expect(testApiKeyConnectionMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Stored Binance connection OK")).toBeInTheDocument();
  });
});
