import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../../i18n/I18nProvider";
import LanguageSwitcher from "./LanguageSwitcher";

describe("LanguageSwitcher visual contract", () => {
  it("renders EN option and switches to PL then PT", async () => {
    window.localStorage.removeItem("cryptosparrow-locale");
    window.localStorage.removeItem("cryptosparrow-timezone");

    render(
      <I18nProvider>
        <LanguageSwitcher />
      </I18nProvider>
    );

    expect(screen.getAllByTestId("flag-en").length).toBeGreaterThan(0);
    const toggle = screen.getByLabelText("Language");
    expect(toggle).toHaveTextContent("English");

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: /polski|polish/i }));

    await waitFor(() => {
      expect(screen.getAllByTestId("flag-pl").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Polski").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByLabelText(/language|jezyk/i));
    fireEvent.click(screen.getByRole("button", { name: /portugalski \(pt\)|portuguese \(pt\)|portugues \(pt\)/i }));

    await waitFor(() => {
      expect(screen.getAllByTestId("flag-pt").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Portugues (PT)").length).toBeGreaterThan(0);
    });
  });
});
