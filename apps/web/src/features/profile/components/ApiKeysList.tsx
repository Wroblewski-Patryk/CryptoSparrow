"use client";
import { useCallback, useMemo, useState } from "react";
import { LuPencilLine, LuTrash2 } from "react-icons/lu";
import ApiKeyForm, { ApiKeyFormSavePayload } from "./ApiKeyForm";
import { useApiKeys } from "../hooks/useApiKeys";
import { EmptyState, ErrorState, LoadingState } from "../../../ui/components/ViewState";
import { useI18n } from "../../../i18n/I18nProvider";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import DataTable, { DataTableColumn } from "../../../ui/components/DataTable";
import { TableIconButtonAction, TableToneBadge } from "../../../ui/components/TableUi";
import type { ApiKey } from "../types/apiKey.type";

export default function ApiKeysList() {
  const { locale } = useI18n();
  const { formatDate } = useLocaleFormatting();
  const { keys, loading, error, handleAdd, handleEdit, handleDelete } = useApiKeys();
  const copy =
    locale === "pl"
      ? {
          addApiKeyTitle: "Dodaj klucz API",
          editApiKeyTitle: "Edytuj klucz API",
          tableLabel: "Nazwa",
          tableExchange: "Gielda",
          tableCreatedAt: "Utworzono",
          tableLastUsed: "Ostatnio uzywany",
          tableActions: "Akcje",
          edit: "Edytuj",
          remove: "Usun",
          sectionTitle: "Klucze API",
          addNewKey: "Dodaj nowy klucz",
          loadingTitle: "Ladowanie kluczy API",
          loadErrorTitle: "Nie mozna pobrac kluczy API",
          refresh: "Odswiez",
          emptyTitle: "Brak kluczy API",
          emptyDescription: "Dodaj pierwszy klucz, aby polaczyc gielde i uruchomic tryb live.",
          searchPlaceholder: "Szukaj kluczy API (label, gielda)",
          emptyFilter: "Brak kluczy API dla wybranego filtra.",
          close: "zamknij",
          deleteModalTitle: "Usun klucz API?",
          deleteModalDescription: "Czy na pewno chcesz usunac ten klucz? Tej operacji nie mozna cofnac.",
          deleteRisk: "Ryzyko LIVE: usuniecie klucza moze zatrzymac aktywne boty handlujace na zywo.",
          deleteRiskConfirm: "Rozumiem ryzyko i chce kontynuowac",
          cancel: "Anuluj",
        }
      : {
          addApiKeyTitle: "Add API key",
          editApiKeyTitle: "Edit API key",
          tableLabel: "Name",
          tableExchange: "Exchange",
          tableCreatedAt: "Created at",
          tableLastUsed: "Last used",
          tableActions: "Actions",
          edit: "Edit",
          remove: "Delete",
          sectionTitle: "API Keys",
          addNewKey: "Add new key",
          loadingTitle: "Loading API keys",
          loadErrorTitle: "Could not load API keys",
          refresh: "Refresh",
          emptyTitle: "No API keys",
          emptyDescription: "Add your first key to connect exchange and run live mode.",
          searchPlaceholder: "Search API keys (label, exchange)",
          emptyFilter: "No API keys for selected filter.",
          close: "close",
          deleteModalTitle: "Delete API key?",
          deleteModalDescription: "Are you sure you want to delete this key? This action cannot be undone.",
          deleteRisk: "LIVE risk: deleting key may stop actively running live bots.",
          deleteRiskConfirm: "I understand the risk and want to continue",
          cancel: "Cancel",
        };

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState(copy.addApiKeyTitle);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteRiskAccepted, setDeleteRiskAccepted] = useState(false);

  const handleAddKey = useCallback(() => {
    setEditId(null);
    setModalTitle(copy.addApiKeyTitle);
    setShowModal(true);
  }, [copy.addApiKeyTitle]);

  const handleEditKey = useCallback((id: string) => {
    setEditId(id);
    setModalTitle(copy.editApiKeyTitle);
    setShowModal(true);
  }, [copy.editApiKeyTitle]);

  const handleSave = async (data: ApiKeyFormSavePayload) => {
    if (editId) {
      await handleEdit(editId, data);
    } else {
      await handleAdd(data);
    }
    setShowModal(false);
    setEditId(null);
  };

  const handleDeleteKey = useCallback((id: string) => {
    setDeleteId(id);
    setDeleteRiskAccepted(false);
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = async () => {
    if (deleteId) {
      await handleDelete(deleteId);
    }
    setShowDeleteModal(false);
    setDeleteId(null);
    setDeleteRiskAccepted(false);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteId(null);
    setDeleteRiskAccepted(false);
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditId(null);
  };

  const selectedKey = editId ? keys.find((k) => k.id === editId) : undefined;
  const defaultValues = selectedKey
      ? {
        id: selectedKey.id,
        label: selectedKey.label,
        exchange: selectedKey.exchange,
        maskedApiKey: selectedKey.apiKey,
        syncExternalPositions: selectedKey.syncExternalPositions,
        manageExternalPositions: selectedKey.manageExternalPositions,
      }
    : undefined;

  const columns = useMemo<DataTableColumn<ApiKey>[]>(
    () => [
      {
        key: "label",
        label: copy.tableLabel,
        sortable: true,
        accessor: (row) => row.label,
        className: "font-medium",
      },
      {
        key: "exchange",
        label: copy.tableExchange,
        sortable: true,
        accessor: (row) => row.exchange,
        render: (row) => <TableToneBadge label={row.exchange} tone="info" />,
      },
      {
        key: "createdAt",
        label: copy.tableCreatedAt,
        sortable: true,
        accessor: (row) => row.createdAt,
        render: (row) => formatDate(row.createdAt),
      },
      {
        key: "lastUsed",
        label: copy.tableLastUsed,
        sortable: true,
        accessor: (row) => row.lastUsed ?? "",
        render: (row) => formatDate(row.lastUsed),
      },
      {
        key: "apiKey",
        label: "API Key",
        sortable: true,
        accessor: (row) => row.apiKey,
        render: (row) => (
          <span className="font-mono">
            {row.apiKey ? row.apiKey.slice(0, 2) + "********" + row.apiKey.slice(-2) : "-"}
          </span>
        ),
      },
      {
        key: "actions",
        label: copy.tableActions,
        className: "text-right",
        render: (row) => (
          <div className="flex items-center justify-end gap-2">
            <TableIconButtonAction
              label={copy.edit}
              icon={<LuPencilLine className="h-3.5 w-3.5" />}
              onClick={() => handleEditKey(row.id)}
              tone="info"
            />
            <TableIconButtonAction
              label={copy.remove}
              icon={<LuTrash2 className="h-3.5 w-3.5" />}
              onClick={() => handleDeleteKey(row.id)}
              tone="danger"
            />
          </div>
        ),
      },
    ],
    [
      copy.edit,
      copy.remove,
      copy.tableActions,
      copy.tableCreatedAt,
      copy.tableExchange,
      copy.tableLabel,
      copy.tableLastUsed,
      formatDate,
      handleDeleteKey,
      handleEditKey,
    ]
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{copy.sectionTitle}</h3>
        <button className="btn btn-primary btn-sm" onClick={handleAddKey}>
          {copy.addNewKey}
        </button>
      </div>
      {loading && <LoadingState title={copy.loadingTitle} />}
      {!loading && error && (
        <ErrorState
          title={copy.loadErrorTitle}
          description={error}
          retryLabel={copy.refresh}
          onRetry={() => window.location.reload()}
        />
      )}
      {!loading && !error && keys.length === 0 && (
        <EmptyState
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          actionLabel={copy.addNewKey}
          onAction={handleAddKey}
        />
      )}
      {!loading && !error && keys.length > 0 && (
        <DataTable
          compact
          rows={keys}
          columns={columns}
          getRowId={(row) => row.id}
          filterPlaceholder={copy.searchPlaceholder}
          filterFn={(row, query) => {
            const normalized = query.trim().toLowerCase();
            return (
              row.label.toLowerCase().includes(normalized) ||
              row.exchange.toLowerCase().includes(normalized) ||
              row.apiKey.toLowerCase().includes(normalized)
            );
          }}
          emptyText={copy.emptyFilter}
          paginationEnabled
          defaultPageSize={10}
        />
      )}

      <dialog id="apiKeyModal" className={`modal ${showModal ? "modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">{modalTitle}</h3>
          <ApiKeyForm
            key={editId || "add"}
            defaultValues={defaultValues}
            isEdit={!!editId}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
        <form method="dialog" className="modal-backdrop" onClick={handleCancel}>
          <button>{copy.close}</button>
        </form>
      </dialog>

      <dialog id="deleteApiKeyModal" className={`modal ${showDeleteModal ? "modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4 text-error">{copy.deleteModalTitle}</h3>
          <p className="mb-3">{copy.deleteModalDescription}</p>
          <p className="mb-4 text-sm text-warning">{copy.deleteRisk}</p>
          <label className="label cursor-pointer justify-start gap-2 mb-6">
            <input
              type="checkbox"
              className="checkbox checkbox-warning checkbox-sm"
              checked={deleteRiskAccepted}
              onChange={(event) => setDeleteRiskAccepted(event.target.checked)}
            />
            <span className="label-text">{copy.deleteRiskConfirm}</span>
          </label>
          <div className="flex gap-4 justify-end">
            <button className="btn btn-outline" type="button" onClick={cancelDelete}>
              {copy.cancel}
            </button>
            <button
              className="btn btn-error"
              type="button"
              disabled={!deleteRiskAccepted}
              onClick={confirmDelete}
            >
              {copy.remove}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop" onClick={cancelDelete}>
          <button>{copy.close}</button>
        </form>
      </dialog>
    </div>
  );
}
