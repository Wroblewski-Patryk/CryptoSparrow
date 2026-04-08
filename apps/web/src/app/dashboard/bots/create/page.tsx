import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from "@/ui/layout/dashboard/PageTitle";
import BotCreateEditForm from "@/features/bots/components/BotCreateEditForm";
import { LuBot, LuPencilLine, LuPlus, LuSave } from "react-icons/lu";

const BOT_FORM_ID = "bot-form-create";

type BotsCreatePageProps = {
  searchParams?: Promise<{
    editId?: string;
  }>;
};

export default async function BotsCreatePage({ searchParams }: BotsCreatePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const editId = params?.editId?.trim() ? params.editId : null;
  const pageTitle = "Bots";
  const breadcrumbLeaf = editId ? "Update" : "Create";
  const breadcrumbIcon = editId ? <LuPencilLine className="h-3.5 w-3.5" /> : <LuPlus className="h-3.5 w-3.5" />;

  return (
    <section className="w-full space-y-4">
      <PageTitle
        title={pageTitle}
        icon={<LuBot className="h-5 w-5" />}
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bots", href: "/dashboard/bots" },
          { label: breadcrumbLeaf, icon: breadcrumbIcon },
        ]}
        actions={
          <button type="submit" form={BOT_FORM_ID} className={PAGE_TITLE_ACTION_SAVE_CLASS}>
            <LuSave className="h-4 w-4" />
            Save
          </button>
        }
      />

      <BotCreateEditForm formId={BOT_FORM_ID} editId={editId} />
    </section>
  );
}
