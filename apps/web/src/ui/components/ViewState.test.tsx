import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DegradedState,
  EmptyState,
  ErrorState,
  LoadingState,
  SuccessState,
} from "./ViewState";

describe("ViewState components", () => {
  it("renders loading, degraded and success states", () => {
    render(
      <div>
        <LoadingState title="Ladowanie testowe" />
        <DegradedState title="Tryb ograniczony" />
        <SuccessState title="Gotowe" />
      </div>
    );

    expect(screen.getByText("Ladowanie testowe")).toBeInTheDocument();
    expect(screen.getByText("Tryb ograniczony")).toBeInTheDocument();
    expect(screen.getByText("Gotowe")).toBeInTheDocument();
  });

  it("fires action buttons for empty and error states", () => {
    const onAction = vi.fn();
    const onRetry = vi.fn();

    render(
      <div>
        <EmptyState title="Brak danych" actionLabel="Dodaj" onAction={onAction} />
        <ErrorState title="Blad" retryLabel="Ponow" onRetry={onRetry} />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Dodaj" }));
    fireEvent.click(screen.getByRole("button", { name: "Ponow" }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders title and description consistently across all state variants", () => {
    render(
      <div>
        <LoadingState title="Loading title" description="Loading desc" />
        <EmptyState title="Empty title" description="Empty desc" />
        <ErrorState title="Error title" description="Error desc" />
        <DegradedState title="Degraded title" description="Degraded desc" />
        <SuccessState title="Success title" description="Success desc" />
      </div>
    );

    expect(screen.getByText("Loading title")).toBeInTheDocument();
    expect(screen.getByText("Loading desc")).toBeInTheDocument();
    expect(screen.getByText("Empty title")).toBeInTheDocument();
    expect(screen.getByText("Empty desc")).toBeInTheDocument();
    expect(screen.getByText("Error title")).toBeInTheDocument();
    expect(screen.getByText("Error desc")).toBeInTheDocument();
    expect(screen.getByText("Degraded title")).toBeInTheDocument();
    expect(screen.getByText("Degraded desc")).toBeInTheDocument();
    expect(screen.getByText("Success title")).toBeInTheDocument();
    expect(screen.getByText("Success desc")).toBeInTheDocument();
  });

  it("shows action buttons only when both label and handler are provided", () => {
    render(
      <div>
        <EmptyState title="No action" actionLabel="Dodaj" />
        <ErrorState title="No retry" retryLabel="Ponow" />
      </div>
    );

    expect(screen.queryByRole("button", { name: "Dodaj" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ponow" })).not.toBeInTheDocument();
  });
});
