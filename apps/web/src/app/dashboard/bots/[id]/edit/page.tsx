import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from "@/ui/layout/dashboard/PageTitle";
import BotCreateEditForm from "@/features/bots/components/BotCreateEditForm";
import { LuBot, LuPencilLine, LuSave } from "react-icons/lu";

const BOT_FORM_ID = "bot-form-edit";

type BotsEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BotsEditPage({ params }: BotsEditPageProps) {
  const { id } = await params;

  return (
    <section className="w-full space-y-4">
      <PageTitle
        title="Bots"
        icon={<LuBot className="h-5 w-5" />}
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bots", href: "/dashboard/bots" },
          { label: "Update", icon: <LuPencilLine className="h-3.5 w-3.5" /> },
        ]}
        actions={
          <button type="submit" form={BOT_FORM_ID} className={PAGE_TITLE_ACTION_SAVE_CLASS}>
            <LuSave className="h-4 w-4" />
            Save
          </button>
        }
      />

      <BotCreateEditForm formId={BOT_FORM_ID} editId={id} />
    </section>
  );
}
