import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import { PageTitle } from "./PageTitle";

const renderWithI18n = (node: ReactNode) => {
  window.localStorage.setItem("cryptosparrow-locale", "en");
  return render(<I18nProvider>{node}</I18nProvider>);
};

describe("PageTitle accessibility contract", () => {
  it("renders breadcrumb trail inside a labeled navigation landmark", () => {
    renderWithI18n(
      <PageTitle
        title="Wallets"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Wallets", href: "/dashboard/wallets/list" },
          { label: "List" },
        ]}
      />
    );

    const breadcrumbsNav = screen.getByRole("navigation", { name: "Breadcrumb navigation" });
    expect(breadcrumbsNav).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Wallets" })).toBeInTheDocument();
  });

  it("keeps module heading linkable when breadcrumb module item has href", () => {
    renderWithI18n(
      <PageTitle
        title="Backtests"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Backtests", href: "/dashboard/backtests/list" },
          { label: "List" },
        ]}
      />
    );

    const heading = screen.getByRole("heading", { level: 1, name: "Backtests" });
    const headingLink = within(heading).getByRole("link", { name: "Backtests" });
    expect(headingLink).toHaveAttribute("href", "/dashboard/backtests/list");
  });

  it("keeps visible create label and exposes contextual SR description", () => {
    renderWithI18n(
      <PageTitle
        title="Bots"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bots" },
        ]}
        onAdd={() => {}}
        addLabel="Create"
      />
    );

    const createButton = screen.getByRole("button", { name: "Create" });
    expect(createButton).toBeInTheDocument();
    expect(createButton).toHaveAttribute("aria-describedby");

    const descriptionId = createButton.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    const description = descriptionId ? document.getElementById(descriptionId) : null;
    expect(description).toBeTruthy();
    expect(description?.textContent ?? "").toContain("Create");
    expect(description?.textContent ?? "").toContain("Bots");
  });
});
