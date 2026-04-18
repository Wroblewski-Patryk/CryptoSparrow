import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import DataTable, { type DataTableColumn } from "./DataTable";

type Row = {
  id: string;
  name: string;
};

describe("DataTable", () => {
  beforeEach(() => {
    window.localStorage.setItem("cryptosparrow-locale", "en");
    window.history.pushState({}, "", "/dashboard");
  });

  it("applies horizontal padding for empty-state message", () => {
    const columns: DataTableColumn<Row>[] = [
      {
        key: "name",
        label: "Name",
        accessor: (row) => row.name,
      },
    ];

    render(
      <I18nProvider>
        <DataTable<Row>
          rows={[]}
          columns={columns}
          getRowId={(row) => row.id}
          emptyText="Brak wpisow"
        />
      </I18nProvider>,
    );

    const emptyMessage = screen.getByText("Brak wpisow");
    expect(emptyMessage).toBeInTheDocument();
    expect(emptyMessage).toHaveClass("px-3");
  });

  it("enables advanced controls as opt-in even without explicit pagination", () => {
    const columns: DataTableColumn<Row>[] = [
      {
        key: "name",
        label: "Name",
        accessor: (row) => row.name,
      },
    ];

    render(
      <I18nProvider>
        <DataTable<Row>
          rows={[{ id: "1", name: "Alpha" }]}
          columns={columns}
          getRowId={(row) => row.id}
          advancedMode
        />
      </I18nProvider>
    );

    expect(screen.getByRole("button", { name: "Columns" })).toBeInTheDocument();
    expect(screen.getByText("Rows: 1")).toBeInTheDocument();
  });
});
