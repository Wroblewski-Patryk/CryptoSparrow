'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuTrash2, LuPencilLine } from "react-icons/lu";
import api from "apps/client/src/lib/api";
import { StrategyDto } from "../types/StrategyForm.type";
import { toast } from "sonner";
import { listStrategies } from "../api/strategies.api";

export default function StrategiesList() {
    const [strategies, setStrategies] = useState<StrategyDto[]>([]);

    const [showModal, setShowModal] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const router = useRouter();


    useEffect(() => {
        (async () => {
            try {
                const data = await listStrategies();
                setStrategies(data);
            } catch (e: any) {
                toast.error("Nie udało się pobrać listy strategii", { description: e?.response?.data?.message });
            }
        })();
    }, []);


    const handleDelete = async () => {
        if (!selectedId) return;
        try {
            await api.delete(`/dashboard/strategies/${selectedId}`);
            setStrategies(prev => prev.filter(s => s.id !== selectedId));

            toast.success("Strategia usunięta");

        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? "Błąd usuwania strategii");
        } finally {
            setShowModal(false);
            setSelectedId(null);
        }
    };

    return (
        <div>
            {/* Tabela strategii */}
            <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                    <thead>
                        <tr>
                            <th>Nazwa</th>
                            <th className="w-32">Dźwignia</th>
                            <th className="w-32">Interwał</th>
                            <th className="w-32">Data utworzenia</th>
                            <th className="text-center w-32">Akcje</th>
                        </tr>
                    </thead>
                    <tbody>
                        {strategies.map(strategy => (
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
                                        onClick={() => { setSelectedId(strategy.id); setShowModal(true); }}
                                        title="Usuń"
                                    >
                                        <LuTrash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {strategies.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center opacity-50">Brak strategii</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal potwierdzenia usuwania */}
            {showModal && (
                <dialog className="modal modal-open">
                    <form method="dialog" className="modal-box">
                        <h3 className="font-bold text-lg mb-2">Potwierdź usunięcie</h3>
                        <p className="mb-4">Czy na pewno chcesz usunąć tę strategię?</p>
                        <div className="modal-action">
                            <button className="btn" onClick={() => setShowModal(false)}>Anuluj</button>
                            <button className="btn btn-error" onClick={handleDelete}>Usuń</button>
                        </div>
                    </form>
                </dialog>
            )}
        </div>
    );
}
