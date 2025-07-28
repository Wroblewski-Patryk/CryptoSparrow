import { render, screen } from "@testing-library/react";
import LoginForm from "./LoginForm";
import { describe, expect, it, vi } from "vitest";
import { UseFormRegister } from "react-hook-form";
import { LoginFormData } from "../types/form.types";

const mockRegister: UseFormRegister<LoginFormData> = (name) => ({
  name,
  onChange: async () => {},
  onBlur: async () => {},
  ref: () => {},
});

describe("LoginForm", () => { 
  it("renders email and password fields", () => {
    render(
      <LoginForm
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
