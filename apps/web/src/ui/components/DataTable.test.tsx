import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DataTable, { type DataTableColumn } from "./DataTable";

type Row = {
  id: string;
  name: string;
};

describe("DataTable", () => {
  it("applies horizontal padding for empty-state message", () => {
    const columns: DataTableColumn<Row>[] = [
      {
        key: "name",
        label: "Name",
        accessor: (row) => row.name,
      },
    ];

    render(
      <DataTable<Row>
        rows={[]}
        columns={columns}
        getRowId={(row) => row.id}
        emptyText="Brak wpisow"
      />,
    );

    const emptyMessage = screen.getByText("Brak wpisow");
    expect(emptyMessage).toBeInTheDocument();
    expect(emptyMessage).toHaveClass("px-3");
  });
});
