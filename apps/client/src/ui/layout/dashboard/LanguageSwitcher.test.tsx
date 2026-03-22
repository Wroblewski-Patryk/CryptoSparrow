import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../../i18n/I18nProvider";
import LanguageSwitcher from "./LanguageSwitcher";

describe("LanguageSwitcher visual contract", () => {
  it("renders EN flag icon and switches to PL flag icon", async () => {
    render(
      <I18nProvider>
        <LanguageSwitcher />
      </I18nProvider>
    );

    expect(screen.getAllByTestId("flag-en").length).toBeGreaterThan(0);
    const toggle = screen.getByLabelText("Language");
    expect(toggle).toHaveTextContent("EN");

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "Polski" }));

    await waitFor(() => {
      expect(screen.getAllByTestId("flag-pl").length).toBeGreaterThan(0);
      expect(screen.getAllByText("PL").length).toBeGreaterThan(0);
    });
  });
});
