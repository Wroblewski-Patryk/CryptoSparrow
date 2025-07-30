// /modules/profile/components/ApiKeysList.tsx
"use client";
import { useState } from "react";
import ApiKeyForm from "./ApiKeyForm";
import { useApiKeys } from "../hooks/useApiKeys";

export default function ApiKeysList() {
  const {
    keys,
    loading,
    error,
    handleAdd,
    handleEdit,
    handleDelete,
    refresh,
  } = useApiKeys();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState("Dodaj klucz API");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Dodaj nowy
  const handleAddKey = () => {
    setEditId(null);
    setModalTitle("Dodaj klucz API");
    setShowModal(true);
  };

  // Edytuj istniejący
  const handleEditKey = (id: string) => {
    setEditId(id);
    setModalTitle("Edytuj klucz API");
    setShowModal(true);
  };

  // Zapisz (dodaj/edytuj)
  const handleSave = async (data: any) => {
    if (editId) {
      await handleEdit(editId, data);
    } else {
      await handleAdd(data);
    }
    setShowModal(false);
    setEditId(null);
  };

  // Usuń
  const handleDeleteKey = (id: string) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await handleDelete(deleteId);
    }
    setShowDeleteModal(false);
    setDeleteId(null);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteId(null);
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditId(null);
  };

  // Dane do formularza przy edycji
  const defaultValues =
  editId && keys.find((k) => k.id === editId)
    ? {
        label: keys.find((k) => k.id === editId)!.label,
        exchange: keys.find((k) => k.id === editId)!.exchange,
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
      {loading && <div className="alert alert-info">Ładowanie...</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {!loading && keys.length === 0 && (
        <div className="alert alert-info">Brak kluczy API.</div>
      )}
      {!loading && keys.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Giełda</th>
                <th>Utworzono</th>
                <th>Ostatnio używany</th>
                <th>API Key</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>{key.label}</td>
                  <td>{key.exchange}</td>
                  <td>{key.createdAt?.slice(0, 10) || "-"}</td>
                  <td>{key.lastUsed?.slice(0, 10) || "-"}</td>
                  <td>
                    <span className="font-mono">
                      {key.apiKey
                        ? key.apiKey.slice(0, 2) +
                          "********" +
                          key.apiKey.slice(-2)
                        : ""}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleEditKey(key.id)}
                      >
                        Edytuj
                      </button>
                      <button
                        className="btn btn-sm btn-error"
                        onClick={() => handleDeleteKey(key.id)}
                      >
                        Usuń
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DaisyUI modal */}
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
      {/* DaisyUI modal – potwierdzenie usuwania */}
      <dialog id="deleteApiKeyModal" className={`modal ${showDeleteModal ? "modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4 text-error">Usuń klucz API?</h3>
          <p className="mb-6">Czy na pewno chcesz usunąć ten klucz? Tej operacji nie można cofnąć.</p>
          <div className="flex gap-4 justify-end">
            <button className="btn btn-outline" type="button" onClick={cancelDelete}>
              Anuluj
            </button>
            <button className="btn btn-error" type="button" onClick={confirmDelete}>
              Usuń
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
