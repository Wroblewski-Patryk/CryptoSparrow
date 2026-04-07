"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAdminSubscriptionPlans } from "../../subscriptions/services/adminSubscriptionPlan.service";
import { useAuth } from "@/context/AuthContext";
import { getAdminUsers, updateAdminUser } from "../services/adminUsers.service";
import { AdminSubscriptionPlanCode, AdminUser, AdminUserRole } from "../types/adminUser.type";

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default function AdminUsersPage() {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | AdminUserRole>("ALL");
  const [totalUsers, setTotalUsers] = useState(0);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [planCodes, setPlanCodes] = useState<AdminSubscriptionPlanCode[]>([]);
  const [planDraftByUserId, setPlanDraftByUserId] = useState<Record<string, AdminSubscriptionPlanCode>>({});

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getAdminUsers({
        page: 1,
        pageSize: 100,
        search: search || undefined,
        role: roleFilter === "ALL" ? undefined : roleFilter,
      });
      setUsers(payload.users);
      setTotalUsers(payload.meta.total);
      setPlanDraftByUserId((prev) => {
        const next = { ...prev };
        for (const item of payload.users) {
          if (item.activeSubscription?.planCode) {
            next[item.id] = item.activeSubscription.planCode;
          } else if (!next[item.id] && planCodes.length > 0) {
            next[item.id] = planCodes[0];
          }
        }
        return next;
      });
    } catch {
      setError("Could not load users.");
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const plans = await getAdminSubscriptionPlans();
      const codes = plans.map((plan) => plan.code);
      setPlanCodes(codes);
      setPlanDraftByUserId((prev) => {
        if (codes.length === 0) return prev;
        const next = { ...prev };
        for (const item of users) {
          if (!next[item.id]) {
            next[item.id] = item.activeSubscription?.planCode ?? codes[0];
          }
        }
        return next;
      });
    } catch {
      // Plans are optional for listing users; assignment controls stay disabled without catalog.
      setPlanCodes([]);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  const onApplyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
  };

  const onRefresh = async () => {
    await Promise.all([loadPlans(), loadUsers()]);
  };

  const upsertUser = (user: AdminUser) => {
    setUsers((prev) => prev.map((item) => (item.id === user.id ? user : item)));
    if (user.activeSubscription?.planCode) {
      setPlanDraftByUserId((prev) => ({
        ...prev,
        [user.id]: user.activeSubscription?.planCode ?? prev[user.id],
      }));
    }
  };

  const onToggleRole = async (user: AdminUser) => {
    const nextRole: AdminUserRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    setSavingKey(`role:${user.id}`);
    setActionError(null);
    try {
      const updated = await updateAdminUser(user.id, { role: nextRole });
      upsertUser(updated);
    } catch {
      setActionError(`Could not update role for ${user.email}.`);
    } finally {
      setSavingKey(null);
    }
  };

  const onAssignPlan = async (user: AdminUser) => {
    const selectedPlan = planDraftByUserId[user.id];
    if (!selectedPlan) return;

    setSavingKey(`plan:${user.id}`);
    setActionError(null);
    try {
      const updated = await updateAdminUser(user.id, {
        subscriptionPlanCode: selectedPlan,
      });
      upsertUser(updated);
    } catch {
      setActionError(`Could not assign subscription plan for ${user.email}.`);
    } finally {
      setSavingKey(null);
    }
  };

  const rows = useMemo(
    () => users.map((item) => ({ ...item, isCurrentUser: authUser?.email === item.email })),
    [users, authUser?.email]
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Users admin</h1>
          <p className="text-sm text-base-content/70">
            Manage account roles and active subscription plans for registered users.
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void onRefresh()} disabled={loading}>
          Refresh
        </button>
      </div>

      <form className="mb-4 grid gap-3 rounded-box border border-base-300/70 p-3 md:grid-cols-[2fr_1fr_auto]" onSubmit={onApplyFilters}>
        <label className="form-control">
          <span className="label-text">Search by email or name</span>
          <input
            className="input input-bordered"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="for example user@example.com"
          />
        </label>

        <label className="form-control">
          <span className="label-text">Role</span>
          <select
            className="select select-bordered"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as "ALL" | AdminUserRole)}
          >
            <option value="ALL">All roles</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </label>

        <div className="flex items-end">
          <button type="submit" className="btn btn-primary w-full md:w-auto">
            Apply
          </button>
        </div>
      </form>

      <p className="mb-3 text-sm text-base-content/70">Total users: {totalUsers}</p>

      {loading && <div className="alert alert-info">Loading users...</div>}
      {!loading && error && <div className="alert alert-error">{error}</div>}
      {actionError && <div className="alert alert-error mb-4">{actionError}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-box border border-base-300/70">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Active plan</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const targetRole = item.role === "ADMIN" ? "USER" : "ADMIN";
                const roleActionBusy = savingKey === `role:${item.id}`;
                const planActionBusy = savingKey === `plan:${item.id}`;
                const selectedPlan = planDraftByUserId[item.id] ?? item.activeSubscription?.planCode;
                const canAssignPlan = Boolean(selectedPlan) && selectedPlan !== item.activeSubscription?.planCode;
                const canDemoteCurrentUser = !(item.isCurrentUser && targetRole === "USER");

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="font-semibold">{item.email}</div>
                      <div className="text-xs opacity-60">{item.name ?? "No display name"}</div>
                    </td>
                    <td>
                      <span className={`badge ${item.role === "ADMIN" ? "badge-secondary" : "badge-ghost"}`}>
                        {item.role}
                      </span>
                    </td>
                    <td>
                      {item.activeSubscription ? (
                        <div>
                          <div className="font-semibold">{item.activeSubscription.planDisplayName}</div>
                          <div className="text-xs opacity-60">
                            {item.activeSubscription.planCode} ({item.activeSubscription.source})
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm opacity-60">No active subscription</span>
                      )}
                    </td>
                    <td className="text-sm">{formatDate(item.createdAt)}</td>
                    <td className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className={`btn btn-sm ${targetRole === "ADMIN" ? "btn-primary" : "btn-warning"} ${roleActionBusy ? "loading" : ""}`}
                          aria-label={`Toggle role for ${item.email}`}
                          disabled={roleActionBusy || !canDemoteCurrentUser}
                          onClick={() => void onToggleRole(item)}
                          title={!canDemoteCurrentUser ? "You cannot demote your own admin account." : undefined}
                        >
                          {targetRole === "ADMIN" ? "Make admin" : "Make user"}
                        </button>

                        <select
                          className="select select-bordered select-sm min-w-36"
                          value={selectedPlan ?? ""}
                          onChange={(event) =>
                            setPlanDraftByUserId((prev) => ({
                              ...prev,
                              [item.id]: event.target.value as AdminSubscriptionPlanCode,
                            }))
                          }
                          disabled={planCodes.length === 0 || planActionBusy}
                          aria-label={`Plan select for ${item.email}`}
                        >
                          {planCodes.map((code) => (
                            <option key={code} value={code}>
                              {code}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className={`btn btn-outline btn-sm ${planActionBusy ? "loading" : ""}`}
                          aria-label={`Assign plan for ${item.email}`}
                          disabled={planActionBusy || !canAssignPlan}
                          onClick={() => void onAssignPlan(item)}
                        >
                          Assign plan
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

