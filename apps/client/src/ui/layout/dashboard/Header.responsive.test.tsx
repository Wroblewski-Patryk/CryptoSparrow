import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Header from "./Header";
import { I18nProvider } from "../../../i18n/I18nProvider";

vi.mock("../../components/ProfileButton", () => ({
  default: () => <button type="button">Profile</button>,
}));

describe("Header responsive smoke", () => {
  it("renders navigation landmark and horizontal overflow container", () => {
    render(
      <I18nProvider>
        <Header />
      </I18nProvider>
    );

    expect(screen.getByRole("navigation", { name: "Dashboard navigation" })).toBeInTheDocument();
    expect(screen.getByText("Markets")).toBeInTheDocument();

    const scroller = document.querySelector("ul.overflow-x-auto");
    expect(scroller).toBeTruthy();
  });
});
