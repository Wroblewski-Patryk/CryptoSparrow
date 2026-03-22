import Link from 'next/link';
import { LuBot, LuChartLine, LuShieldCheck } from 'react-icons/lu';

export default function PublicPage() {
  return (
    <>
      <section className="relative min-h-[100svh] overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-alpine-future.svg')" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-base-100/55 via-base-100/75 to-base-100"
        />

        <div className="relative mx-auto flex min-h-[100svh] max-w-7xl items-center px-4 py-20">
          <div className="max-w-3xl space-y-7">
            <p className="badge badge-secondary badge-outline font-semibold tracking-wide">ALPINE FUTURE</p>
            <h1 className="font-heading text-5xl leading-tight md:text-6xl">
              Bot tradingowy, który łączy rynki, strategie i AI w jednym miejscu.
            </h1>
            <p className="max-w-2xl text-lg text-base-content/80 md:text-xl">
              CryptoSparrow pomaga budować i testować strategie szybciej: od grup rynków, przez backtesty, po
              automatyczne wykonanie zleceń.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/auth/register" className="btn btn-primary btn-md">
                Załóż konto
              </Link>
              <Link href="/auth/login" className="btn btn-outline btn-secondary btn-md glass">
                Zaloguj się
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-box border border-secondary/40 bg-base-100/55 p-4 backdrop-blur">
                <LuBot className="mb-2 h-5 w-5 text-primary" aria-hidden />
                <p className="text-sm font-semibold">AI-ready workflow</p>
              </article>
              <article className="rounded-box border border-secondary/40 bg-base-100/55 p-4 backdrop-blur">
                <LuChartLine className="mb-2 h-5 w-5 text-primary" aria-hidden />
                <p className="text-sm font-semibold">Spot i futures</p>
              </article>
              <article className="rounded-box border border-secondary/40 bg-base-100/55 p-4 backdrop-blur">
                <LuShieldCheck className="mb-2 h-5 w-5 text-primary" aria-hidden />
                <p className="text-sm font-semibold">Kontrola ryzyka</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-16">
        <div className="rounded-box border border-base-300 bg-base-200/70 p-6 text-base-content/75">
          Kolejne sekcje (funkcje, pricing, FAQ) dodamy pod hero w następnych iteracjach.
        </div>
      </section>
    </>
  );
}
