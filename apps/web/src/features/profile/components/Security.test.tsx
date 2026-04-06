import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import SecurityPanel from "./Security";

vi.mock("../services/security.service", () => ({
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
}));

describe("SecurityPanel", () => {
  const renderPanel = () =>
    render(
      <I18nProvider>
        <SecurityPanel />
      </I18nProvider>
    );

  it("hides passwords by default and toggles visibility per field", () => {
    renderPanel();

    const currentPasswordInput = screen.getByLabelText("Current password");
    const newPasswordInput = screen.getByLabelText("New password");
    const confirmPasswordInput = screen.getByLabelText("Confirm new password");
    const deletePasswordInput = screen.getByLabelText("Enter password to confirm");

    expect(currentPasswordInput).toHaveAttribute("type", "password");
    expect(newPasswordInput).toHaveAttribute("type", "password");
    expect(confirmPasswordInput).toHaveAttribute("type", "password");
    expect(deletePasswordInput).toHaveAttribute("type", "password");

    const showButtons = screen.getAllByRole("button", { name: /show password/i });
    expect(showButtons).toHaveLength(4);

    fireEvent.click(showButtons[0]);
    fireEvent.click(showButtons[1]);
    fireEvent.click(showButtons[2]);
    fireEvent.click(showButtons[3]);

    expect(currentPasswordInput).toHaveAttribute("type", "text");
    expect(newPasswordInput).toHaveAttribute("type", "text");
    expect(confirmPasswordInput).toHaveAttribute("type", "text");
    expect(deletePasswordInput).toHaveAttribute("type", "text");

    const hideButtons = screen.getAllByRole("button", { name: /hide password/i });
    expect(hideButtons).toHaveLength(4);

    fireEvent.click(hideButtons[0]);
    fireEvent.click(hideButtons[1]);
    fireEvent.click(hideButtons[2]);
    fireEvent.click(hideButtons[3]);

    expect(currentPasswordInput).toHaveAttribute("type", "password");
    expect(newPasswordInput).toHaveAttribute("type", "password");
    expect(confirmPasswordInput).toHaveAttribute("type", "password");
    expect(deletePasswordInput).toHaveAttribute("type", "password");
  });
});

