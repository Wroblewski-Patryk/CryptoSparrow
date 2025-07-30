"use client";
import { useState, useEffect, SetStateAction } from "react";
import { useUser } from "../hooks/useUser";
import { toast } from "sonner";
import api from "../../../lib/api";

export default function ProfileForm() {
  const { user, updateUser, loading } = useUser();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setAvatarUrl(user?.avatarUrl || "");
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('avatar change handled');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      console.log('avatar formData collection');
      const formData = new FormData();
      formData.append("avatar", file);
      console.log('avatar formData'+ formData);
      const res = await api.post("/upload/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data;
      console.log(data.url);
      setAvatarUrl(data.url);
      toast.success("Avatar zmieniony!");
    } catch {
      toast.error("Nie udało się zapisać avatara.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUser({
        name,
        avatarUrl,
      });
      toast.success("Zapisano zmiany profilu!");
    } catch (err: any) {
      toast.error("Nie udało się zapisać zmian.");
    }
    setSaving(false);
  };

  return (
    <form className="w-full mx-auto space-y-6" onSubmit={handleSubmit}>
      <div className="flex items-center gap-4 py-2">
        <div className="flex-shrink-0 pr-8">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt="Avatar" 
              className="w-48 h-48 rounded-full object-cover mb-4" />
          ) : (
            <div className="w-48 h-48 rounded-full bg-primary flex mb-4"></div>
          )}
          <div>

          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          /> 
          <label htmlFor="avatar-upload">
            <span className="btn btn-outline btn-info w-full mt-2 cursor-pointer">
              {avatarUrl ? "Zmień avatar" : "Dodaj avatar"}
            </span>
          </label>
        </div>
        </div>
        <div className="flex-grow">
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Imię / Nick</span>
            </label>
            <input
              type="text"
              placeholder="John Doe"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Email</span>
            </label>
            <input
              type="email"
              placeholder="user@example.com"
              className="input input-bordered w-full"
              value={email}
              disabled
            />
          </div>
          <button
            className={`btn btn-primary ${saving ? "loading" : ""}`}
            type="submit"
            disabled={saving || loading}
          >
            Zapisz zmiany
          </button>
        </div>
      </div>
    </form>
  );
}
