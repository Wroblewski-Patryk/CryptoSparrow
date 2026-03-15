import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "./I18nProvider";
import LanguageSwitcher from "../ui/layout/dashboard/LanguageSwitcher";

describe("I18nProvider", () => {
  it("uses EN by default and allows switching to PL", async () => {
    window.localStorage.removeItem("cryptosparrow-locale");

    render(
      <I18nProvider>
        <LanguageSwitcher />
      </I18nProvider>
    );

    expect(screen.getByRole("button", { name: "English" })).toHaveClass("btn-primary");
    expect(document.documentElement.lang).toBe("en");

    fireEvent.click(screen.getByRole("button", { name: "Polish" }));

    expect(screen.getByRole("button", { name: "Polski" })).toHaveClass("btn-primary");
    expect(document.documentElement.lang).toBe("pl");
    expect(window.localStorage.getItem("cryptosparrow-locale")).toBe("pl");
  });
});
