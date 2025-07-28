import Link from "next/link";

export default function PublicPage() {
  return (
    <section className="min-h-[calc(100vh-96px-72px)] flex items-center justify-center text-center px-4">
      <div>
        <h1 className="text-4xl font-bold mb-4">Zautomatyzuj swój handel z CryptoSparrow</h1>
        <p className="text-gray-600 mb-6 max-w-xl mx-auto">
          Inteligentny bot futures wspierany przez AI. Zarabiaj nawet, gdy śpisz.
        </p>
        <Link href="/auth/register" className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 transition">
          Rozpocznij teraz
        </Link>
      </div>
    </section>
  );
}
