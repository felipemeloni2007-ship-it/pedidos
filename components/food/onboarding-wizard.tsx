"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  Palette,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const steps = [
  { label: "Seu negócio", icon: Store },
  { label: "Operação", icon: UtensilsCrossed },
  { label: "Localização", icon: MapPin },
  { label: "Sua marca", icon: Palette },
  { label: "Pronto", icon: Check },
];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72) || "minha-loja";
}

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Forno 27");
  const [segment, setSegment] = useState("Pizzaria / Hamburgueria");
  const [completed, setCompleted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState("");

  async function createStore() {
    if (name.trim().length < 2) {
      setCreationError("Informe o nome do estabelecimento para continuar.");
      return;
    }

    const configured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );

    if (!configured) {
      setCreationError("O cadastro está indisponível até a conexão de autenticação ser configurada.");
      return;
    }

    setIsCreating(true);
    setCreationError("");
    try {
      const slug = slugify(name);
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantName: name.trim(),
          tenantSlug: slug,
          storeName: name.trim(),
          storeSlug: slug,
          timezone: "America/Sao_Paulo",
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível criar a loja.");
      }
      setCompleted(true);
    } catch (error) {
      setCreationError(
        error instanceof Error ? error.message : "Não foi possível criar a loja.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  if (completed) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f5f1] p-4 text-[#222522]">
        <section className="w-full max-w-lg rounded-[28px] border border-[#e3e0d8] bg-white p-8 text-center shadow-[0_18px_50px_rgba(31,36,31,0.09)]">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eaf5e5] text-[#4e8545]">
            <Check className="size-7" />
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">
            Seu estabelecimento foi criado.
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#77736b]">
            Agora configure o cardápio e a operação antes de publicar sua loja.
          </p>
          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            <Link
              href="/"
              className="grid h-11 place-items-center rounded-xl border border-[#dedbd3] text-sm font-bold text-[#555149] hover:bg-[#f8f7f3]"
            >
              Ver loja
            </Link>
            <Link
              href="/painel"
              className="grid h-11 place-items-center rounded-xl bg-[#202723] text-sm font-bold text-white hover:bg-[#344239]"
            >
              Abrir painel
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const StepIcon = steps[step].icon;

  return (
    <main className="min-h-screen bg-[#f6f5f1] p-4 text-[#222522] sm:p-8">
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-[26px] bg-[#202723] p-5 text-white lg:min-h-[620px]">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-[#efb53b] text-xs font-black text-[#293129]">
              27
            </span>
            <span className="text-sm font-bold">Mesa Pronta</span>
          </Link>
          <div className="mt-10 hidden space-y-2 lg:block">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const done = index < step;
              const active = index === step;
              return (
                <div
                  key={item.label}
                  className={
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm " +
                    (active ? "bg-white/12 font-bold" : "text-[#adb9af]")
                  }
                >
                  <span
                    className={
                      "grid size-7 place-items-center rounded-lg " +
                      (done
                        ? "bg-[#7bad67] text-white"
                        : active
                          ? "bg-[#efb53b] text-[#293129]"
                          : "bg-white/8")
                    }
                  >
                    {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  {item.label}
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-sm leading-6 text-[#c1cbc2] lg:mt-auto">
            Leva menos de 5 minutos. Você pode ajustar tudo depois.
          </p>
        </aside>

        <section className="rounded-[26px] border border-[#e3e0d8] bg-white p-6 shadow-[0_12px_32px_rgba(31,36,31,0.05)] sm:p-9">
          <div className="mb-8 flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-[#f3f1eb] text-[#c2712a]">
              <StepIcon className="size-5" />
            </span>
            <span className="text-sm font-bold text-[#89847a]">
              {step + 1} de {steps.length}
            </span>
          </div>

          {step === 0 ? (
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#c2712a]">
                Vamos começar
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                Qual é o nome do seu estabelecimento?
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#77736b]">
                Este nome aparecerá na loja, nos pedidos e nas mensagens para seus
                clientes.
              </p>
              <label className="mt-8 grid max-w-lg gap-2 text-sm font-bold">
                Nome do estabelecimento
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-12 rounded-xl border border-[#dedbd3] px-3 text-base font-medium outline-none focus:border-[#d9762a] focus:ring-2 focus:ring-[#f0b43a]/20"
                />
              </label>
              <label className="mt-4 grid max-w-lg gap-2 text-sm font-bold">
                Segmento principal
                <select
                  value={segment}
                  onChange={(event) => setSegment(event.target.value)}
                  className="h-12 rounded-xl border border-[#dedbd3] bg-white px-3 text-base font-medium outline-none focus:border-[#d9762a] focus:ring-2 focus:ring-[#f0b43a]/20"
                >
                  <option>Pizzaria / Hamburgueria</option>
                  <option>Restaurante</option>
                  <option>Sushi / Japonês</option>
                  <option>Açaí / Sorveteria</option>
                  <option>Cafeteria / Padaria</option>
                </select>
              </label>
            </div>
          ) : null}

          {step === 1 ? (
            <WizardChoice
              title="Como você pretende atender?"
              description="Ative os canais que fazem sentido agora. Você poderá configurar horários e limites em seguida."
              options={["Delivery próprio", "Retirada no balcão", "Consumo no local / QR Code"]}
            />
          ) : null}
          {step === 2 ? (
            <WizardChoice
              title="Onde fica a sua unidade?"
              description="Usaremos esse endereço para mostrar retirada e calcular regiões de entrega."
              options={["Rua das Palmeiras, 27 — Centro", "Atender até 8 km de distância", "Taxa inicial de R$ 6,00"]}
            />
          ) : null}
          {step === 3 ? (
            <WizardChoice
              title="Dê personalidade à sua loja"
              description="Um tema base será aplicado ao cardápio e você poderá personalizar cada cor depois."
              options={["Tema artesanal escuro", "Destaque em laranja queimado", "Cards arredondados"]}
            />
          ) : null}
          {step === 4 ? (
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#c2712a]">
                Tudo certo
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                {name || "Sua loja"} já tem uma base para começar.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#77736b]">
                A base de {segment}, os canais de pedido e a operação estão prontos
                para você configurar e revisar.
              </p>
              <div className="mt-8 rounded-2xl bg-[#f5f1e8] p-5 text-sm leading-6 text-[#665b47]">
                <strong className="block text-[#37332d]">Próximo passo recomendado</strong>
                Revise os produtos, preços e horário de funcionamento antes de abrir
                a loja.
              </div>
            </div>
          ) : null}

          <div className="mt-10 flex items-center justify-between gap-3 border-t border-[#efede7] pt-5">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[#605b53] hover:bg-[#f7f5f1] disabled:opacity-30"
            >
              <ArrowLeft className="size-4" />
              Voltar
            </button>
              <button
                type="button"
                onClick={() => {
                  if (step === steps.length - 1) {
                    void createStore();
                  } else {
                    setStep((current) => current + 1);
                  }
                }}
                disabled={isCreating}
                className="flex h-11 items-center gap-2 rounded-xl bg-[#202723] px-4 text-sm font-bold text-white hover:bg-[#344239]"
              >
                {step === steps.length - 1
                  ? isCreating
                    ? "Criando loja..."
                    : "Criar minha loja"
                  : "Continuar"}
                <ArrowRight className="size-4" />
              </button>
            </div>
            {creationError ? (
              <p role="alert" className="mt-3 rounded-xl bg-[#fce9e6] px-3 py-2 text-sm text-[#a34635]">
                {creationError}
              </p>
            ) : null}
        </section>
      </div>
    </main>
  );
}

function WizardChoice({
  title,
  description,
  options,
}: {
  title: string;
  description: string;
  options: string[];
}) {
  const [selected, setSelected] = useState<string[]>(options);

  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#c2712a]">Configuração rápida</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#77736b]">{description}</p>
      <div className="mt-8 grid max-w-xl gap-3">
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() =>
                setSelected((current) =>
                  current.includes(option)
                    ? current.filter((item) => item !== option)
                    : [...current, option],
                )
              }
              className={
                "flex min-h-12 items-center gap-3 rounded-xl border px-4 text-left text-sm font-semibold transition " +
                (isSelected
                  ? "border-[#d9762a] bg-[#fff5e9]"
                  : "border-[#dedbd3] bg-white hover:bg-[#faf9f5]")
              }
            >
              <span
                className={
                  "grid size-5 place-items-center rounded-md border " +
                  (isSelected
                    ? "border-[#d9762a] bg-[#d9762a] text-white"
                    : "border-[#c9c5bd]")
                }
              >
                {isSelected ? <Check className="size-3.5" /> : null}
              </span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
