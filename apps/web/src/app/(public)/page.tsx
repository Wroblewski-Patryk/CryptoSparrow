import { LuBot, LuChartLine, LuShieldCheck } from 'react-icons/lu';

export default function PublicPage() {
  return (
    <>
      <section className="relative min-h-[100svh] overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "image-set(url('/hero-sky.webp') type('image/webp'), url('/hero-sky.png') type('image/png'))",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-base-100/0 via-base-100/25 to-base-100"
        />

        <div className="relative mx-auto flex min-h-[100svh] max-w-7xl items-center px-4 py-20">
          <div className="max-w-3xl space-y-7">
            <h1 className="font-heading text-5xl leading-tight md:text-6xl">
              Bot tradingowy, który łączy rynki, strategie i AI w jednym miejscu.
            </h1>
            <p className="max-w-2xl text-lg text-base-content/80 md:text-xl">
              Soar pomaga budować i testować strategie szybciej: od grup rynków, przez backtesty, po
              automatyczne wykonanie zleceń.
            </p>

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
