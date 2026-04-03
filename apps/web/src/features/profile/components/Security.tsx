"use client";

import { FormEvent, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { changePassword, deleteAccount } from "../services/security.service";

const mapApiError = (error: unknown, fallback: string) => {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback;
  }
  return fallback;
};

export default function SecurityPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const canSubmitPasswordChange = useMemo(() => {
    return (
      currentPassword.trim().length >= 6 &&
      newPassword.trim().length >= 6 &&
      confirmPassword.trim().length >= 6 &&
      !isChangingPassword
    );
  }, [confirmPassword, currentPassword, isChangingPassword, newPassword]);

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Nowe haslo i potwierdzenie musza byc identyczne.");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("Nowe haslo musi byc inne niz obecne.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword({
        currentPassword,
        newPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Haslo zostalo zmienione.");
    } catch (error) {
      toast.error(mapApiError(error, "Nie udalo sie zmienic hasla."));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!deletePassword.trim()) {
      toast.error("Podaj haslo, aby potwierdzic usuniecie konta.");
      return;
    }

    const accepted =
      typeof window === "undefined"
        ? false
        : window.confirm("Ta operacja usunie konto i wszystkie dane. Czy na pewno kontynuowac?");

    if (!accepted) return;

    setIsDeletingAccount(true);
    try {
      await deleteAccount({ password: deletePassword });
      toast.success("Konto zostalo usuniete. Przekierowanie do logowania...");
      if (typeof window !== "undefined") {
        window.location.href = "/auth/login";
      }
    } catch (error) {
      toast.error(mapApiError(error, "Nie udalo sie usunac konta."));
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-box border border-base-300 bg-base-100 p-4">
        <h2 className="text-lg font-semibold">Zmiana hasla</h2>
        <p className="mt-1 text-sm opacity-70">Zmien haslo dostepu do panelu. Minimalna dlugosc: 6 znakow.</p>

        <form className="mt-4 grid gap-3 md:max-w-xl" onSubmit={handlePasswordChange}>
          <label className="form-control w-full">
            <span className="label-text mb-1 block">Obecne haslo</span>
            <input
              className="input input-bordered w-full"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-1 block">Nowe haslo</span>
            <input
              className="input input-bordered w-full"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-1 block">Potwierdz nowe haslo</span>
            <input
              className="input input-bordered w-full"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          <div>
            <button className="btn btn-primary btn-sm" type="submit" disabled={!canSubmitPasswordChange}>
              {isChangingPassword ? "Zapisywanie..." : "Zmien haslo"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-box border border-error/40 bg-error/5 p-4">
        <h2 className="text-lg font-semibold text-error">Usuniecie konta</h2>
        <p className="mt-1 text-sm opacity-80">
          Ta operacja jest nieodwracalna i usunie Twoje konto wraz z danymi (boty, strategie, backtesty, logi).
        </p>

        <form className="mt-4 grid gap-3 md:max-w-xl" onSubmit={handleDeleteAccount}>
          <label className="form-control w-full">
            <span className="label-text mb-1 block">Podaj haslo, aby potwierdzic</span>
            <input
              className="input input-bordered w-full"
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <div>
            <button
              className="btn btn-error btn-sm"
              type="submit"
              disabled={isDeletingAccount || deletePassword.trim().length === 0}
            >
              {isDeletingAccount ? "Usuwanie..." : "Usun konto"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
