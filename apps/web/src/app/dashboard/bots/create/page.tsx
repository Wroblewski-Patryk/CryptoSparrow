import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import BotCreateEditForm from "@/features/bots/components/BotCreateEditForm";
import { LuBot } from "react-icons/lu";

type BotsCreatePageProps = {
  searchParams?: Promise<{
    editId?: string;
  }>;
};

export default async function BotsCreatePage({ searchParams }: BotsCreatePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const editId = params?.editId?.trim() ? params.editId : null;
  const pageTitle = editId ? "Edytuj bota" : "Nowy bot";
  const breadcrumbLeaf = editId ? "Edit" : "Create";

  return (
    <section className="w-full space-y-4">
      <PageTitle
        title={pageTitle}
        icon={<LuBot className="h-5 w-5" />}
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bots", href: "/dashboard/bots" },
          { label: breadcrumbLeaf },
        ]}
      />

      <BotCreateEditForm editId={editId} />
    </section>
  );
}
