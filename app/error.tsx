"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="grid min-h-screen place-items-center bg-[#f7f6f2] p-6 font-sans text-[#24231f]">
        <section className="max-w-md rounded-3xl border border-black/10 bg-white p-7 text-center shadow-lg">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#c56c25]">
            Algo saiu do forno errado
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Não foi possível carregar esta tela.
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#736f67]">
            Tente novamente. Se o problema continuar, volte ao início.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={reset}
              className="h-11 rounded-xl bg-[#202723] text-sm font-bold text-white"
            >
              Tentar novamente
            </button>
            <Link
              href="/"
              className="grid h-11 place-items-center rounded-xl border border-black/10 text-sm font-bold"
            >
              Voltar ao início
            </Link>
          </div>
        </section>
      </body>
    </html>
  );
}
