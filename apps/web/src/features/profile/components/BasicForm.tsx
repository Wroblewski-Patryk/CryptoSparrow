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
  const { timeZone, timeZonePreference, setTimeZonePreference, t } = useI18n();
  const { user, updateUser, loading } = useUser();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setAvatarUrl(user?.avatarUrl || "");
    const preferredTimeZone = user?.uiPreferences?.timeZonePreference;
    if (preferredTimeZone) {
      setTimeZonePreference(preferredTimeZone);
    }
  }, [setTimeZonePreference, user]);

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
      toast.success(t("dashboard.profileBasic.avatarUploadChanged"));
    } catch {
      toast.error(t("dashboard.profileBasic.avatarUploadFailed"));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateUser({
        name,
        avatarUrl,
        uiPreferences: {
          timeZonePreference,
        },
      });
      toast.success(t("dashboard.profileBasic.profileSaved"));
    } catch {
      toast.error(t("dashboard.profileBasic.profileSaveFailed"));
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
              alt={t("dashboard.profileBasic.avatarAlt")}
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
              {avatarUrl
                ? t("dashboard.profileBasic.changeAvatar")
                : t("dashboard.profileBasic.addAvatar")}
            </span>
          </label>
        </div>

        <div className="flex-grow">
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">{t("dashboard.profileBasic.nameLabel")}</span>
            </label>
            <input
              type="text"
              placeholder={t("dashboard.profileBasic.namePlaceholder")}
              className="input input-bordered w-full"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">{t("dashboard.profileBasic.emailLabel")}</span>
            </label>
            <input
              type="email"
              placeholder={t("dashboard.profileBasic.emailPlaceholder")}
              className="input input-bordered w-full"
              value={email}
              disabled
            />
          </div>

          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">{t("dashboard.profileBasic.timeZoneLabel")}</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={timeZonePreference}
              onChange={(event) => setTimeZonePreference(event.target.value)}
            >
              <option value="auto">{`${t("dashboard.profileBasic.timeZoneAuto")} (${timeZone})`}</option>
              {[...new Set([...COMMON_TIME_ZONES, timeZone])].sort((a, b) => a.localeCompare(b)).map((zone) => (
                <option key={zone} value={zone}>
                  {formatTimeZoneLabel(zone)}
                </option>
              ))}
            </select>
            <span className="mt-1 text-xs opacity-70">{t("dashboard.profileBasic.timeZoneHint")}</span>
          </div>

          <button
            className={`btn btn-primary ${saving ? "loading" : ""}`}
            type="submit"
            disabled={saving || loading}
          >
            {t("dashboard.profileBasic.saveChanges")}
          </button>
        </div>
      </div>
    </form>
  );
}
