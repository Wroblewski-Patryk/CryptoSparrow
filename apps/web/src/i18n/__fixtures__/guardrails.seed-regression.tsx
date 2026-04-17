import { toast } from "sonner";

export function GuardrailsSeedRegression({ locale }: { locale?: string }) {
  const selectedLocale = locale ?? "pl";
  const copy = {
    en: { title: "Seed title" },
    pl: { title: "Tytul testowy" },
    pt: { title: "Titulo de teste" },
  } as const;

  toast.error("Hardcoded toast message");

  return (
    <section>
      <h1>{copy[selectedLocale as "en" | "pl" | "pt"].title}</h1>
      <input placeholder="Hardcoded placeholder" aria-label="Hardcoded aria label" title="Hardcoded title" />
    </section>
  );
}
