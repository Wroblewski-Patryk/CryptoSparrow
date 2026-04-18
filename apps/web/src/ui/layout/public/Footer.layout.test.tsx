import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import Footer from "./Footer";

describe("Public footer mobile layout", () => {
  it("keeps both rows centered on mobile and split on desktop", () => {
    window.localStorage.setItem("cryptosparrow-locale", "en");

    render(
      <I18nProvider>
        <Footer />
      </I18nProvider>
    );

    const copyright = screen.getByText(/Soar\./i);
    const wrapper = copyright.closest("footer")?.querySelector("div.mx-auto");
    expect(wrapper).toBeTruthy();
    expect(wrapper).toHaveClass(
      "flex-col",
      "items-center",
      "justify-center",
      "text-center",
      "md:flex-row",
      "md:justify-between",
      "md:text-left"
    );
  });
});
