import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from "@/ui/layout/dashboard/PageTitle";
import BotCreateEditForm from "@/features/bots/components/BotCreateEditForm";
import { redirect } from "next/navigation";
import { LuBot, LuPlus, LuSave } from "react-icons/lu";
import { dashboardRoutes } from "@/ui/layout/dashboard/dashboardRoutes";
import { dashboardShellEn } from "@/i18n/namespaces/dashboard-shell.en";
import { dashboardBotsEn } from "@/i18n/namespaces/dashboard-bots.en";

const BOT_FORM_ID = "bot-form-create";

type BotsCreatePageProps = {
  searchParams?: Promise<{
    editId?: string;
  }>;
};

export default async function BotsCreatePage({ searchParams }: BotsCreatePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const editId = params?.editId?.trim() ? params.editId : null;

  if (editId) {
    redirect(dashboardRoutes.bots.edit(editId));
  }

  return (
    <section className="w-full space-y-4">
      <PageTitle
        title={dashboardShellEn.nav.bots}
        icon={<LuBot className="h-5 w-5" />}
        breadcrumb={[
          { label: dashboardShellEn.common.dashboard, href: "/dashboard" },
          { label: dashboardShellEn.nav.bots, href: "/dashboard/bots" },
          { label: dashboardBotsEn.page.breadcrumbCreate, icon: <LuPlus className="h-3.5 w-3.5" /> },
        ]}
        actions={
          <button type="submit" form={BOT_FORM_ID} className={PAGE_TITLE_ACTION_SAVE_CLASS}>
            <LuSave className="h-4 w-4" />
            {dashboardBotsEn.page.saveAction}
          </button>
        }
      />

      <BotCreateEditForm formId={BOT_FORM_ID} />
    </section>
  );
}
