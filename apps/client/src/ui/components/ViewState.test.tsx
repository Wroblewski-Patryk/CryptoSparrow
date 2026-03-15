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
});
