"use client";
import { useState } from "react";
import ApiKeyForm, { ApiKeyFormSavePayload } from "./ApiKeyForm";
import { useApiKeys } from "../hooks/useApiKeys";
import { EmptyState, ErrorState, LoadingState, SuccessState } from "../../../ui/components/ViewState";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";

export default function ApiKeysList() {
  const { formatDate } = useLocaleFormatting();
  const { keys, loading, error, handleAdd, handleEdit, handleDelete } = useApiKeys();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState("Dodaj klucz API");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteRiskAccepted, setDeleteRiskAccepted] = useState(false);

  const handleAddKey = () => {
    setEditId(null);
    setModalTitle("Dodaj klucz API");
    setShowModal(true);
  };

  const handleEditKey = (id: string) => {
    setEditId(id);
    setModalTitle("Edytuj klucz API");
    setShowModal(true);
  };

  const handleSave = async (data: ApiKeyFormSavePayload) => {
    if (editId) {
      await handleEdit(editId, data);
    } else {
      await handleAdd(data);
    }
    setShowModal(false);
    setEditId(null);
  };

  const handleDeleteKey = (id: string) => {
    setDeleteId(id);
    setDeleteRiskAccepted(false);
    setShowDeleteModal(true);
  };

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
        label: selectedKey.label,
        exchange: selectedKey.exchange,
      }
    : undefined;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Klucze API</h3>
        <button className="btn btn-primary btn-sm" onClick={handleAddKey}>
          Dodaj nowy klucz
        </button>
      </div>
      {loading && <LoadingState title="Ladowanie kluczy API" />}
      {!loading && error && (
        <ErrorState
          title="Nie mozna pobrac kluczy API"
          description={error}
          retryLabel="Odswiez"
          onRetry={() => window.location.reload()}
        />
      )}
      {!loading && !error && keys.length === 0 && (
        <EmptyState
          title="Brak kluczy API"
          description="Dodaj pierwszy klucz, aby polaczyc gielde i uruchomic tryb live."
          actionLabel="Dodaj nowy klucz"
          onAction={handleAddKey}
        />
      )}
      {!loading && !error && keys.length > 0 && (
        <div className="space-y-3">
          <SuccessState
            title="Klucze API aktywne"
            description={`Skonfigurowano ${keys.length} ${keys.length === 1 ? "klucz" : "klucze"}.`}
          />
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th>Gielda</th>
                  <th>Utworzono</th>
                  <th>Ostatnio uzywany</th>
                  <th>API Key</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td>{key.label}</td>
                    <td>{key.exchange}</td>
                    <td>{formatDate(key.createdAt)}</td>
                    <td>{formatDate(key.lastUsed)}</td>
                    <td>
                      <span className="font-mono">
                        {key.apiKey ? key.apiKey.slice(0, 2) + "********" + key.apiKey.slice(-2) : ""}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEditKey(key.id)}>
                          Edytuj
                        </button>
                        <button className="btn btn-sm btn-error" onClick={() => handleDeleteKey(key.id)}>
                          Usun
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
          <button>close</button>
        </form>
      </dialog>

      <dialog id="deleteApiKeyModal" className={`modal ${showDeleteModal ? "modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4 text-error">Usun klucz API?</h3>
          <p className="mb-3">Czy na pewno chcesz usunac ten klucz? Tej operacji nie mozna cofnac.</p>
          <p className="mb-4 text-sm text-warning">
            Ryzyko LIVE: usuniecie klucza moze zatrzymac aktywne boty handlujace na zywo.
          </p>
          <label className="label cursor-pointer justify-start gap-2 mb-6">
            <input
              type="checkbox"
              className="checkbox checkbox-warning checkbox-sm"
              checked={deleteRiskAccepted}
              onChange={(event) => setDeleteRiskAccepted(event.target.checked)}
            />
            <span className="label-text">Rozumiem ryzyko i chce kontynuowac</span>
          </label>
          <div className="flex gap-4 justify-end">
            <button className="btn btn-outline" type="button" onClick={cancelDelete}>
              Anuluj
            </button>
            <button
              className="btn btn-error"
              type="button"
              disabled={!deleteRiskAccepted}
              onClick={confirmDelete}
            >
              Usun
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop" onClick={cancelDelete}>
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}
