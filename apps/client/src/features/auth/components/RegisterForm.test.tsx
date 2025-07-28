import { render, screen } from "@testing-library/react";
import RegisterForm from "./RegisterForm";
import { describe, expect, it, vi } from "vitest";
import { UseFormRegister } from "react-hook-form";
import { RegisterFormData } from "../types/form.types";

const mockRegister: UseFormRegister<RegisterFormData> = (name) => ({
  name,
  onChange: async () => {},
  onBlur: async () => {},
  ref: () => {},
});

describe("RegisterForm", () => {
  it("renders email and password fields", () => {
    render(
      <RegisterForm
        onSubmit={vi.fn()}
        register={mockRegister}
        errors={{} as any}
        isSubmitting={false}
        status=""
        message=""
      />
    );

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });
});
