"use client";

import { FormEvent, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { toast } from "sonner";

import { useI18n } from "../../../i18n/I18nProvider";
import PasswordVisibilityToggle from "../../auth/components/PasswordVisibilityToggle";
import { changePassword, deleteAccount } from "../services/security.service";

const mapApiError = (error: unknown, fallback: string) => {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback;
  }
  return fallback;
};

export default function SecurityPanel() {
  const { locale } = useI18n();
  const copy =
    locale === "pl"
      ? {
          mismatch: "Nowe haslo i potwierdzenie musza byc identyczne.",
          samePassword: "Nowe haslo musi byc inne niz obecne.",
          passwordChanged: "Haslo zostalo zmienione.",
          passwordChangeFailed: "Nie udalo sie zmienic hasla.",
          deletePasswordMissing: "Podaj haslo, aby potwierdzic usuniecie konta.",
          deleteConfirm: "Ta operacja usunie konto i wszystkie dane. Czy na pewno kontynuowac?",
          accountDeleted: "Konto zostalo usuniete. Przekierowanie do logowania...",
          deleteFailed: "Nie udalo sie usunac konta.",
          passwordSectionTitle: "Zmiana hasla",
          passwordSectionDescription: "Zmien haslo dostepu do panelu. Minimalna dlugosc: 6 znakow.",
          currentPassword: "Obecne haslo",
          newPassword: "Nowe haslo",
          confirmPassword: "Potwierdz nowe haslo",
          savePassword: "Zmien haslo",
          savingPassword: "Zapisywanie...",
          deleteSectionTitle: "Usuniecie konta",
          deleteSectionDescription:
            "Ta operacja jest nieodwracalna i usunie Twoje konto wraz z danymi (boty, strategie, backtesty, logi).",
          deletePasswordLabel: "Podaj haslo, aby potwierdzic",
          deleteAction: "Usun konto",
          deleting: "Usuwanie...",
        }
      : {
          mismatch: "New password and confirmation must match.",
          samePassword: "New password must be different from current password.",
          passwordChanged: "Password changed successfully.",
          passwordChangeFailed: "Could not change password.",
          deletePasswordMissing: "Provide your password to confirm account deletion.",
          deleteConfirm: "This operation will remove your account and all data. Continue?",
          accountDeleted: "Account deleted. Redirecting to login...",
          deleteFailed: "Could not delete account.",
          passwordSectionTitle: "Change password",
          passwordSectionDescription: "Update your panel password. Minimum length: 6 characters.",
          currentPassword: "Current password",
          newPassword: "New password",
          confirmPassword: "Confirm new password",
          savePassword: "Change password",
          savingPassword: "Saving...",
          deleteSectionTitle: "Delete account",
          deleteSectionDescription:
            "This operation is irreversible and will remove your account with all data (bots, strategies, backtests, logs).",
          deletePasswordLabel: "Enter password to confirm",
          deleteAction: "Delete account",
          deleting: "Deleting...",
        };

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
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
      toast.error(copy.mismatch);
      return;
    }

    if (currentPassword === newPassword) {
      toast.error(copy.samePassword);
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
      toast.success(copy.passwordChanged);
    } catch (error) {
      toast.error(mapApiError(error, copy.passwordChangeFailed));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!deletePassword.trim()) {
      toast.error(copy.deletePasswordMissing);
      return;
    }

    const accepted = typeof window === "undefined" ? false : window.confirm(copy.deleteConfirm);
    if (!accepted) return;

    setIsDeletingAccount(true);
    try {
      await deleteAccount({ password: deletePassword });
      toast.success(copy.accountDeleted);
      if (typeof window !== "undefined") {
        window.location.href = "/auth/login";
      }
    } catch (error) {
      toast.error(mapApiError(error, copy.deleteFailed));
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-box border border-base-300 bg-base-100 p-4 h-full">
        <h2 className="text-lg font-semibold">{copy.passwordSectionTitle}</h2>
        <p className="mt-1 text-sm opacity-70">{copy.passwordSectionDescription}</p>

        <form className="mt-4 grid gap-3" onSubmit={handlePasswordChange}>
          <label className="form-control w-full">
            <span className="label-text mb-1 block">{copy.currentPassword}</span>
            <div className="join w-full">
              <input
                className="input input-bordered join-item w-full"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <PasswordVisibilityToggle
                show={showCurrentPassword}
                disabled={isChangingPassword}
                onToggle={() => setShowCurrentPassword((prev) => !prev)}
              />
            </div>
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-1 block">{copy.newPassword}</span>
            <div className="join w-full">
              <input
                className="input input-bordered join-item w-full"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <PasswordVisibilityToggle
                show={showNewPassword}
                disabled={isChangingPassword}
                onToggle={() => setShowNewPassword((prev) => !prev)}
              />
            </div>
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-1 block">{copy.confirmPassword}</span>
            <div className="join w-full">
              <input
                className="input input-bordered join-item w-full"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <PasswordVisibilityToggle
                show={showConfirmPassword}
                disabled={isChangingPassword}
                onToggle={() => setShowConfirmPassword((prev) => !prev)}
              />
            </div>
          </label>

          <div>
            <button className="btn btn-primary btn-sm" type="submit" disabled={!canSubmitPasswordChange}>
              {isChangingPassword ? copy.savingPassword : copy.savePassword}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-box border border-error/40 bg-error/5 p-4 h-full">
        <h2 className="text-lg font-semibold text-error">{copy.deleteSectionTitle}</h2>
        <p className="mt-1 text-sm opacity-80">{copy.deleteSectionDescription}</p>

        <form className="mt-4 grid gap-3" onSubmit={handleDeleteAccount}>
          <label className="form-control w-full">
            <span className="label-text mb-1 block">{copy.deletePasswordLabel}</span>
            <div className="join w-full">
              <input
                className="input input-bordered join-item w-full"
                type={showDeletePassword ? "text" : "password"}
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <PasswordVisibilityToggle
                show={showDeletePassword}
                disabled={isDeletingAccount}
                onToggle={() => setShowDeletePassword((prev) => !prev)}
              />
            </div>
          </label>

          <div>
            <button
              className="btn btn-error btn-sm"
              type="submit"
              disabled={isDeletingAccount || deletePassword.trim().length === 0}
            >
              {isDeletingAccount ? copy.deleting : copy.deleteAction}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
