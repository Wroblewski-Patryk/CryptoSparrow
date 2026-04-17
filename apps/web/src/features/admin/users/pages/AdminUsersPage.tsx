"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getAdminSubscriptionPlans } from "../../subscriptions/services/adminSubscriptionPlan.service";
import { useAuth } from "@/context/AuthContext";
import { getAdminUsers, updateAdminUser } from "../services/adminUsers.service";
import { AdminSubscriptionPlanCode, AdminUser, AdminUserRole } from "../types/adminUser.type";
import { useI18n } from "@/i18n/I18nProvider";

const formatDate = (value: string, locale: "en" | "pl" | "pt") => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const dateLocale = locale === "pl" ? "pl-PL" : locale === "pt" ? "pt-PT" : "en-US";

  return new Intl.DateTimeFormat(dateLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default function AdminUsersPage() {
  const { locale, t } = useI18n();
  const { user: authUser } = useAuth();
  const labels = {
    loadError: t("admin.users.loadError"),
    roleUpdateErrorPrefix: t("admin.users.roleUpdateErrorPrefix"),
    planAssignErrorPrefix: t("admin.users.planAssignErrorPrefix"),
    title: t("admin.users.title"),
    description: t("admin.users.description"),
    refresh: t("admin.users.refresh"),
    searchLabel: t("admin.users.searchLabel"),
    searchPlaceholder: t("admin.users.searchPlaceholder"),
    roleLabel: t("admin.users.roleLabel"),
    allRoles: t("admin.users.allRoles"),
    apply: t("admin.users.apply"),
    totalUsers: t("admin.users.totalUsers"),
    loadingUsers: t("admin.users.loadingUsers"),
    tableUser: t("admin.users.tableUser"),
    tableRole: t("admin.users.tableRole"),
    tableActivePlan: t("admin.users.tableActivePlan"),
    tableCreated: t("admin.users.tableCreated"),
    tableActions: t("admin.users.tableActions"),
    noDisplayName: t("admin.users.noDisplayName"),
    noActiveSubscription: t("admin.users.noActiveSubscription"),
    cannotDemoteSelf: t("admin.users.cannotDemoteSelf"),
    makeAdmin: t("admin.users.makeAdmin"),
    makeUser: t("admin.users.makeUser"),
    assignPlan: t("admin.users.assignPlan"),
    toggleRoleAriaPrefix: t("admin.users.toggleRoleAriaPrefix"),
    planSelectAriaPrefix: t("admin.users.planSelectAriaPrefix"),
    assignPlanAriaPrefix: t("admin.users.assignPlanAriaPrefix"),
  } as const;

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
      setError(labels.loadError);
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = useCallback(async () => {
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
  }, [users]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

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
      setActionError(`${labels.roleUpdateErrorPrefix} ${user.email}.`);
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
      setActionError(`${labels.planAssignErrorPrefix} ${user.email}.`);
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
          <h1 className="text-2xl font-semibold">{labels.title}</h1>
          <p className="text-sm text-base-content/70">
            {labels.description}
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void onRefresh()} disabled={loading}>
          {labels.refresh}
        </button>
      </div>

      <form className="mb-4 grid gap-3 rounded-box border border-base-300/70 p-3 md:grid-cols-[2fr_1fr_auto]" onSubmit={onApplyFilters}>
        <label className="form-control">
          <span className="label-text">{labels.searchLabel}</span>
          <input
            className="input input-bordered"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={labels.searchPlaceholder}
          />
        </label>

        <label className="form-control">
          <span className="label-text">{labels.roleLabel}</span>
          <select
            className="select select-bordered"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as "ALL" | AdminUserRole)}
          >
            <option value="ALL">{labels.allRoles}</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </label>

        <div className="flex items-end">
          <button type="submit" className="btn btn-primary w-full md:w-auto">
            {labels.apply}
          </button>
        </div>
      </form>

      <p className="mb-3 text-sm text-base-content/70">{labels.totalUsers}: {totalUsers}</p>

      {loading && <div className="alert alert-info">{labels.loadingUsers}</div>}
      {!loading && error && <div className="alert alert-error">{error}</div>}
      {actionError && <div className="alert alert-error mb-4">{actionError}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-box border border-base-300/70">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>{labels.tableUser}</th>
                <th>{labels.tableRole}</th>
                <th>{labels.tableActivePlan}</th>
                <th>{labels.tableCreated}</th>
                <th className="text-right">{labels.tableActions}</th>
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
                      <div className="text-xs opacity-60">{item.name ?? labels.noDisplayName}</div>
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
                        <span className="text-sm opacity-60">{labels.noActiveSubscription}</span>
                      )}
                    </td>
                    <td className="text-sm">{formatDate(item.createdAt, locale)}</td>
                    <td className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className={`btn btn-sm ${targetRole === "ADMIN" ? "btn-primary" : "btn-warning"} ${roleActionBusy ? "loading" : ""}`}
                          aria-label={`${labels.toggleRoleAriaPrefix} ${item.email}`}
                          disabled={roleActionBusy || !canDemoteCurrentUser}
                          onClick={() => void onToggleRole(item)}
                          title={!canDemoteCurrentUser ? labels.cannotDemoteSelf : undefined}
                        >
                          {targetRole === "ADMIN" ? labels.makeAdmin : labels.makeUser}
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
                          aria-label={`${labels.planSelectAriaPrefix} ${item.email}`}
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
                          aria-label={`${labels.assignPlanAriaPrefix} ${item.email}`}
                          disabled={planActionBusy || !canAssignPlan}
                          onClick={() => void onAssignPlan(item)}
                        >
                          {labels.assignPlan}
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
