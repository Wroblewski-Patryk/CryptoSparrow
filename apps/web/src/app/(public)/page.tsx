'use client';

import Link from 'next/link';
import {
  LuBot,
  LuChartLine,
  LuGauge,
  LuLayers,
  LuPlus,
  LuShieldCheck,
  LuSparkles,
} from 'react-icons/lu';

import { useI18n } from '@/i18n/I18nProvider';

export default function PublicPage() {
  const { locale } = useI18n();
  const landingActionPrimaryClass =
    'btn btn-sm h-9 min-h-9 border transition-colors duration-150 border-primary/45 bg-primary/10 text-primary hover:border-primary/70 hover:bg-primary/20';

  const copy =
    locale === 'pl'
      ? {
          badge: 'Platforma do budowy botow i strategii',
          heading: 'Automatyzuj trading od pomyslu do egzekucji.',
          lead:
            'Soar laczy research, strategy builder, backtesty i runtime bota w jednym flow. Testujesz szybciej, wdrazasz pewniej i kontrolujesz ryzyko na kazdym etapie.',
          trustA: 'Backtest + runtime w jednym miejscu',
          trustB: 'Strategie pod spot i futures',
          trustC: 'Kontrola ryzyka i transparentna historia',
          sectionFlowTitle: 'Jeden workflow, zero chaosu',
          sectionFlowLead:
            'Nie musisz skakac miedzy narzedziami. Soar prowadzi od konfiguracji rynku do monitoringu pozycji.',
          flow1Title: '1. Zdefiniuj kontekst rynku',
          flow1Desc: 'Zbuduj listy rynkow, wybierz gielde i typ rynku, przygotuj dane pod strategia.',
          flow2Title: '2. Zbuduj i przetestuj strategie',
          flow2Desc: 'Lacz wskazniki, warunki wejscia/wyjscia i sprawdz wyniki na danych historycznych.',
          flow3Title: '3. Uruchom bota i monitoruj',
          flow3Desc: 'Przejdz do runtime, sledz sygnaly, wykonania i historie transakcji w jednym panelu.',
          sectionAudienceTitle: 'Dla kazdego typu tradera',
          sectionAudienceLead:
            'Niezaleznie czy scalpujesz, swingujesz czy budujesz system portfelowy, ustawisz styl pracy pod siebie.',
          audience1Title: 'Momentum',
          audience1Desc: 'Szybkie sygnaly, szybkie egzekucje, pelna kontrola nad tempem wejsc.',
          audience2Title: 'Mean Reversion',
          audience2Desc: 'Warunki oparte o odchylenia i powroty do sredniej, z jasnymi limitami ryzyka.',
          audience3Title: 'Trend Following',
          audience3Desc: 'Filtry trendu, trailing i zarzadzanie pozycja pod dluzsze ruchy.',
          audience4Title: 'Systematic Portfolio',
          audience4Desc: 'Spojny framework do testowania wielu par i uruchamiania botow na tych samych zasadach.',
          sectionFeaturesTitle: 'Co dostajesz od razu',
          feature1Title: 'Strategie i wskazniki',
          feature1Desc: 'Kreator warunkow, czytelne parametry i konfiguracja bez kodowania.',
          feature2Title: 'Backtesty z kontekstem',
          feature2Desc: 'Wyniki, metryki i historia transakcji z naciskiem na zrozumienie zachowania strategii.',
          feature3Title: 'Runtime i operacje',
          feature3Desc: 'Podglad aktywnych botow, sygnalow i statusu wykonania w czasie rzeczywistym.',
          feature4Title: 'Bezpieczenstwo i kontrola',
          feature4Desc: 'Tryby pracy, limity i jasny podglad decyzji bota.',
          bottomTitle: 'Zacznij budowac swoj trading stack w Soar',
          bottomLead:
            'Skonfiguruj rynek, zbuduj strategie, uruchom bota. Wszystko w jednym miejscu, bez klejenia narzedzi.',
          bottomCta: 'Utworz konto',
        }
      : {
          badge: 'Trading bot and strategy execution platform',
          heading: 'Automate trading from idea to execution.',
          lead:
            'Soar unifies research, strategy builder, backtests, and live bot runtime in one flow. Test faster, deploy with confidence, and keep risk under control.',
          trustA: 'Backtest and runtime in one place',
          trustB: 'Strategies for spot and futures',
          trustC: 'Risk control and transparent trade history',
          sectionFlowTitle: 'One workflow, no tool chaos',
          sectionFlowLead:
            'No more jumping between tools. Soar takes you from market setup to position monitoring.',
          flow1Title: '1. Define your market context',
          flow1Desc: 'Build market sets, choose exchange and market type, prepare clean context for strategy logic.',
          flow2Title: '2. Build and validate strategy',
          flow2Desc: 'Combine indicators, entry/exit conditions, and validate behavior on historical data.',
          flow3Title: '3. Launch bot and monitor runtime',
          flow3Desc: 'Move to runtime and track signals, executions, and trade history in one panel.',
          sectionAudienceTitle: 'Designed for every trader type',
          sectionAudienceLead:
            'Scalper, swing trader, or systematic builder, you can shape the workflow to match your style.',
          audience1Title: 'Momentum',
          audience1Desc: 'Fast signals, fast execution, and full control over entry cadence.',
          audience2Title: 'Mean Reversion',
          audience2Desc: 'Deviation-to-mean conditions with clear risk limits and disciplined exits.',
          audience3Title: 'Trend Following',
          audience3Desc: 'Trend filters, trailing logic, and position management for larger directional moves.',
          audience4Title: 'Systematic Portfolio',
          audience4Desc: 'A consistent framework to test many pairs and run bots under the same rules.',
          sectionFeaturesTitle: 'What you get immediately',
          feature1Title: 'Strategy and indicators',
          feature1Desc: 'Condition builder, readable parameters, and no-code configuration.',
          feature2Title: 'Context-rich backtests',
          feature2Desc: 'Results, metrics, and trade timeline focused on understanding strategy behavior.',
          feature3Title: 'Runtime operations',
          feature3Desc: 'Clear view of active bots, signals, and execution status in near real time.',
          feature4Title: 'Safety and control',
          feature4Desc: 'Operational modes, limits, and transparent visibility into bot decisions.',
          bottomTitle: 'Build your trading stack in Soar',
          bottomLead:
            'Configure markets, build strategy, launch bot. One place, one workflow, no fragmented tooling.',
          bottomCta: 'Create account',
        };

  return (
    <>
      <section className='relative isolate min-h-[92svh] overflow-hidden'>
        <div
          aria-hidden
          className='public-hero-bg-layer absolute inset-0 bg-cover bg-center'
          style={{
            backgroundImage:
              "image-set(url('/hero-sky.webp') type('image/webp'), url('/hero-sky.png') type('image/png'))",
          }}
        />
        <div aria-hidden className='public-hero-grid absolute inset-0' />
        <div aria-hidden className='public-hero-orb public-hero-orb-one absolute' />
        <div aria-hidden className='public-hero-orb public-hero-orb-two absolute' />
        <div
          aria-hidden
          className='absolute inset-0 bg-gradient-to-b from-base-100/5 via-base-100/40 to-base-100'
        />

        <div className='relative mx-auto flex min-h-[92svh] w-full max-w-7xl items-center px-4 py-20'>
          <div className='max-w-3xl space-y-8'>
            <span className='inline-flex items-center gap-2 rounded-full border border-primary/45 bg-base-100/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary shadow-sm backdrop-blur'>
              <LuSparkles className='h-3.5 w-3.5' />
              {copy.badge}
            </span>

            <h1 className='font-heading text-4xl leading-tight text-base-content md:text-6xl'>
              {copy.heading}
            </h1>

            <p className='max-w-2xl text-base text-base-content/80 md:text-xl'>{copy.lead}</p>

            <div className='grid gap-3 sm:grid-cols-3'>
              <article className='rounded-box border border-base-300/70 bg-base-100/72 p-4 backdrop-blur'>
                <LuChartLine className='mb-2 h-5 w-5 text-primary' aria-hidden />
                <p className='text-sm font-semibold'>{copy.trustA}</p>
              </article>
              <article className='rounded-box border border-base-300/70 bg-base-100/72 p-4 backdrop-blur'>
                <LuLayers className='mb-2 h-5 w-5 text-primary' aria-hidden />
                <p className='text-sm font-semibold'>{copy.trustB}</p>
              </article>
              <article className='rounded-box border border-base-300/70 bg-base-100/72 p-4 backdrop-blur'>
                <LuShieldCheck className='mb-2 h-5 w-5 text-primary' aria-hidden />
                <p className='text-sm font-semibold'>{copy.trustC}</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className='mx-auto w-full max-w-7xl px-4 py-14'>
        <div className='grid gap-5 lg:grid-cols-[1.1fr_1fr]'>
          <div className='space-y-3'>
            <h2 className='font-heading text-3xl'>{copy.sectionFlowTitle}</h2>
            <p className='text-base-content/75'>{copy.sectionFlowLead}</p>
          </div>
          <div className='grid gap-3 sm:grid-cols-3 lg:grid-cols-1'>
            <article className='rounded-box border border-base-300/60 bg-base-100/85 p-4 shadow-sm'>
              <p className='text-sm font-semibold'>{copy.flow1Title}</p>
              <p className='mt-2 text-sm text-base-content/70'>{copy.flow1Desc}</p>
            </article>
            <article className='rounded-box border border-base-300/60 bg-base-100/85 p-4 shadow-sm'>
              <p className='text-sm font-semibold'>{copy.flow2Title}</p>
              <p className='mt-2 text-sm text-base-content/70'>{copy.flow2Desc}</p>
            </article>
            <article className='rounded-box border border-base-300/60 bg-base-100/85 p-4 shadow-sm'>
              <p className='text-sm font-semibold'>{copy.flow3Title}</p>
              <p className='mt-2 text-sm text-base-content/70'>{copy.flow3Desc}</p>
            </article>
          </div>
        </div>
      </section>

      <section className='mx-auto w-full max-w-7xl px-4 pb-14'>
        <div className='rounded-box border border-base-300/65 bg-gradient-to-br from-base-100 to-base-200/70 p-6 sm:p-7'>
          <h2 className='font-heading text-3xl'>{copy.sectionAudienceTitle}</h2>
          <p className='mt-2 max-w-3xl text-base-content/75'>{copy.sectionAudienceLead}</p>

          <div className='mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
            <article className='rounded-box border border-base-300/65 bg-base-100/85 p-4'>
              <p className='text-sm font-semibold'>{copy.audience1Title}</p>
              <p className='mt-2 text-sm text-base-content/70'>{copy.audience1Desc}</p>
            </article>
            <article className='rounded-box border border-base-300/65 bg-base-100/85 p-4'>
              <p className='text-sm font-semibold'>{copy.audience2Title}</p>
              <p className='mt-2 text-sm text-base-content/70'>{copy.audience2Desc}</p>
            </article>
            <article className='rounded-box border border-base-300/65 bg-base-100/85 p-4'>
              <p className='text-sm font-semibold'>{copy.audience3Title}</p>
              <p className='mt-2 text-sm text-base-content/70'>{copy.audience3Desc}</p>
            </article>
            <article className='rounded-box border border-base-300/65 bg-base-100/85 p-4'>
              <p className='text-sm font-semibold'>{copy.audience4Title}</p>
              <p className='mt-2 text-sm text-base-content/70'>{copy.audience4Desc}</p>
            </article>
          </div>
        </div>
      </section>

      <section className='mx-auto w-full max-w-7xl px-4 pb-14'>
        <h2 className='font-heading text-3xl'>{copy.sectionFeaturesTitle}</h2>
        <div className='mt-6 grid gap-3 sm:grid-cols-2'>
          <article className='rounded-box border border-base-300/65 bg-base-100/85 p-5'>
            <LuBot className='h-5 w-5 text-primary' aria-hidden />
            <p className='mt-3 text-base font-semibold'>{copy.feature1Title}</p>
            <p className='mt-2 text-sm text-base-content/70'>{copy.feature1Desc}</p>
          </article>
          <article className='rounded-box border border-base-300/65 bg-base-100/85 p-5'>
            <LuChartLine className='h-5 w-5 text-primary' aria-hidden />
            <p className='mt-3 text-base font-semibold'>{copy.feature2Title}</p>
            <p className='mt-2 text-sm text-base-content/70'>{copy.feature2Desc}</p>
          </article>
          <article className='rounded-box border border-base-300/65 bg-base-100/85 p-5'>
            <LuGauge className='h-5 w-5 text-primary' aria-hidden />
            <p className='mt-3 text-base font-semibold'>{copy.feature3Title}</p>
            <p className='mt-2 text-sm text-base-content/70'>{copy.feature3Desc}</p>
          </article>
          <article className='rounded-box border border-base-300/65 bg-base-100/85 p-5'>
            <LuShieldCheck className='h-5 w-5 text-primary' aria-hidden />
            <p className='mt-3 text-base font-semibold'>{copy.feature4Title}</p>
            <p className='mt-2 text-sm text-base-content/70'>{copy.feature4Desc}</p>
          </article>
        </div>
      </section>

      <section className='mx-auto w-full max-w-7xl px-4 pb-16'>
        <div className='rounded-box border-b-[3px] border-secondary/70 bg-gradient-to-br from-primary/70 to-secondary/70 p-px'>
          <div className='rounded-box bg-base-100/85 p-6 sm:p-8'>
            <h2 className='font-heading text-3xl'>{copy.bottomTitle}</h2>
            <p className='mt-3 max-w-3xl text-base-content/75'>{copy.bottomLead}</p>
            <div className='mt-5'>
              <Link href='/auth/register' className={`${landingActionPrimaryClass} gap-2`}>
                <LuPlus className='h-4 w-4' />
                {copy.bottomCta}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
