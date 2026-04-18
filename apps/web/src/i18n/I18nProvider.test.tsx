import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "./I18nProvider";
import LanguageSwitcher from "../ui/layout/dashboard/LanguageSwitcher";

describe("I18nProvider", () => {
  it("uses EN by default and allows switching to PL and PT", async () => {
    window.localStorage.removeItem("cryptosparrow-locale");
    window.localStorage.removeItem("cryptosparrow-timezone");

    render(
      <I18nProvider>
        <LanguageSwitcher />
      </I18nProvider>
    );

    const toggle = screen.getByLabelText("Language");
    expect(toggle).toHaveTextContent("English");
    expect(document.documentElement.lang).toBe("en");

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: /polski|polish/i }));

    await waitFor(() => {
      expect(document.documentElement.lang).toBe("pl");
      expect(window.localStorage.getItem("cryptosparrow-locale")).toBe("pl");
      expect(screen.getByLabelText(/language|jezyk|idioma/i)).toHaveTextContent("Polski");
    });

    fireEvent.click(screen.getByLabelText(/language|jezyk|idioma/i));
    fireEvent.click(screen.getByRole("button", { name: /portugalski|portuguese|portugues/i }));

    await waitFor(() => {
      expect(document.documentElement.lang).toBe("pt");
      expect(window.localStorage.getItem("cryptosparrow-locale")).toBe("pt");
      expect(screen.getByLabelText(/language|jezyk|idioma/i)).toHaveTextContent("Portugues");
    });
  });
});
