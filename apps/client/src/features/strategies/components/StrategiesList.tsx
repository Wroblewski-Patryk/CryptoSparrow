"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuTrash2, LuPencilLine } from "react-icons/lu";
import axios from "axios";
import api from "apps/client/src/lib/api";
import { toast } from "sonner";
import { listStrategies } from "../api/strategies.api";
import { StrategyDto } from "../types/StrategyForm.type";
import { EmptyState, ErrorState, LoadingState } from "apps/client/src/ui/components/ViewState";

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

export default function StrategiesList() {
  const [strategies, setStrategies] = useState<StrategyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const router = useRouter();

  const loadStrategies = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await listStrategies();
      setStrategies(data);
    } catch (err: unknown) {
      const message = getAxiosMessage(err) ?? "Nie udalo sie pobrac listy strategii";
      setLoadError(message);
      toast.error("Nie udalo sie pobrac listy strategii", {
        description: getAxiosMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStrategies();
  }, [loadStrategies]);

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await api.delete(`/dashboard/strategies/${selectedId}`);
      setStrategies((prev) => prev.filter((s) => s.id !== selectedId));
      toast.success("Strategia usunieta");
    } catch (err: unknown) {
      toast.error(getAxiosMessage(err) ?? "Blad usuwania strategii");
    } finally {
      setShowModal(false);
      setSelectedId(null);
    }
  };

  return (
    <div>
      {loading && <LoadingState />}
      {!loading && loadError && (
        <ErrorState
          title="Nie udalo sie pobrac listy strategii"
          description={loadError}
          retryLabel="Sprobuj ponownie"
          onRetry={() => void loadStrategies()}
        />
      )}
      {!loading && !loadError && strategies.length === 0 && (
        <EmptyState
          title="Brak strategii"
          description="Dodaj pierwsza strategie, aby uruchomic backtest i bota."
          actionLabel="Nowa strategia"
          onAction={() => router.push("/dashboard/strategies/add")}
        />
      )}

      {!loading && !loadError && strategies.length > 0 && (
      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Nazwa</th>
              <th className="w-32">Dzwignia</th>
              <th className="w-32">Interwal</th>
              <th className="w-32">Data utworzenia</th>
              <th className="text-center w-32">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((strategy) => (
              <tr key={strategy.id}>
                <td>{strategy.name}</td>
                <td>{strategy.leverage}x</td>
                <td>{strategy.interval}</td>
                <td>{strategy.createdAt?.slice(0, 10) || "-"}</td>
                <td className="text-center">
                  <button
                    className="btn btn-sm btn-info mr-2"
                    onClick={() => router.push(`/dashboard/strategies/${strategy.id}`)}
                    title="Edytuj"
                  >
                    <LuPencilLine className="w-4 h-4" />
                  </button>
                  <button
                    className="btn btn-sm btn-error"
                    onClick={() => {
                      setSelectedId(strategy.id);
                      setShowModal(true);
                    }}
                    title="Usun"
                  >
                    <LuTrash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {showModal && (
        <dialog className="modal modal-open">
          <form method="dialog" className="modal-box">
            <h3 className="font-bold text-lg mb-2">Potwierdz usuniecie</h3>
            <p className="mb-4">Czy na pewno chcesz usunac te strategie?</p>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowModal(false)}>
                Anuluj
              </button>
              <button className="btn btn-error" onClick={handleDelete}>
                Usun
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
