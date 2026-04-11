"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

import api from "../../../lib/api";
import { useI18n } from "../../../i18n/I18nProvider";
import { useUser } from "../hooks/useUser";

const COMMON_TIME_ZONES = [
  "UTC",
  "Europe/Warsaw",
  "Europe/Berlin",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const formatTimeZoneLabel = (value: string) => value.replaceAll("_", " ");

export default function ProfileForm() {
  const { locale, timeZone, timeZonePreference, setTimeZonePreference } = useI18n();
  const { user, updateUser, loading } = useUser();
  const copy =
    locale === "pl"
      ? {
          avatarAlt: "Avatar",
          avatarUploadChanged: "Avatar zmieniony!",
          avatarUploadFailed: "Nie udalo sie zapisac avatara.",
          profileSaved: "Zapisano zmiany profilu!",
          profileSaveFailed: "Nie udalo sie zapisac zmian.",
          addAvatar: "Dodaj avatar",
          changeAvatar: "Zmien avatar",
          nameLabel: "Imie / Nick",
          emailLabel: "Email",
          timeZoneLabel: "Strefa czasowa",
          timeZoneAuto: "Auto (system)",
          timeZoneHint: "Ustawienie wplywa na format dat i godzin zdarzen w calej aplikacji.",
          saveChanges: "Zapisz zmiany",
        }
      : {
          avatarAlt: "Avatar",
          avatarUploadChanged: "Avatar updated!",
          avatarUploadFailed: "Could not save avatar.",
          profileSaved: "Profile changes saved.",
          profileSaveFailed: "Could not save profile changes.",
          addAvatar: "Add avatar",
          changeAvatar: "Change avatar",
          nameLabel: "Name / Nickname",
          emailLabel: "Email",
          timeZoneLabel: "Time zone",
          timeZoneAuto: "Auto (system)",
          timeZoneHint: "This setting affects date/time rendering across the application.",
          saveChanges: "Save changes",
        };

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setAvatarUrl(user?.avatarUrl || "");
  }, [user]);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const response = await api.post("/upload/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAvatarUrl(response.data.url);
      toast.success(copy.avatarUploadChanged);
    } catch {
      toast.error(copy.avatarUploadFailed);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateUser({
        name,
        avatarUrl,
      });
      toast.success(copy.profileSaved);
    } catch {
      toast.error(copy.profileSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="w-full mx-auto space-y-6" onSubmit={handleSubmit}>
      <div className="flex items-center gap-4 py-2">
        <div className="flex-shrink-0 pr-8">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={copy.avatarAlt}
              width={192}
              height={192}
              loader={({ src }) => src}
              unoptimized
              className="w-48 h-48 rounded-full object-cover mb-4"
            />
          ) : (
            <div className="w-48 h-48 rounded-full bg-primary mb-4" />
          )}

          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <label htmlFor="avatar-upload">
            <span className="btn btn-outline btn-info w-full mt-2 cursor-pointer">
              {avatarUrl ? copy.changeAvatar : copy.addAvatar}
            </span>
          </label>
        </div>

        <div className="flex-grow">
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">{copy.nameLabel}</span>
            </label>
            <input
              type="text"
              placeholder="John Doe"
              className="input input-bordered w-full"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">{copy.emailLabel}</span>
            </label>
            <input
              type="email"
              placeholder="user@example.com"
              className="input input-bordered w-full"
              value={email}
              disabled
            />
          </div>

          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">{copy.timeZoneLabel}</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={timeZonePreference}
              onChange={(event) => setTimeZonePreference(event.target.value)}
            >
              <option value="auto">{`${copy.timeZoneAuto} (${timeZone})`}</option>
              {[...new Set([...COMMON_TIME_ZONES, timeZone])].sort((a, b) => a.localeCompare(b)).map((zone) => (
                <option key={zone} value={zone}>
                  {formatTimeZoneLabel(zone)}
                </option>
              ))}
            </select>
            <span className="mt-1 text-xs opacity-70">{copy.timeZoneHint}</span>
          </div>

          <button
            className={`btn btn-primary ${saving ? "loading" : ""}`}
            type="submit"
            disabled={saving || loading}
          >
            {copy.saveChanges}
          </button>
        </div>
      </div>
    </form>
  );
}
