import Link from "next/link";

export default function PublicPage() {
  return (
    <section className="min-h-[calc(100vh-133px)] flex items-center justify-center text-center px-4">
      <div>
        <h1 className="text-4xl font-bold mb-4">Zautomatyzuj swój handel z CryptoSparrow</h1>
        <p className="max-w-xl mx-auto mb-4">
          Inteligentny bot futures wspierany przez AI. Zarabiaj nawet, gdy śpisz.
        </p> 
        <Link href="/auth/register" className="btn btn-secondary btn-large">
          Rozpocznij teraz
        </Link>        
      </div>
    </section>
  );
}
