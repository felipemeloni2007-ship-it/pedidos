"use client";

import {
  Check,
  ChevronLeft,
  Clock3,
  Maximize2,
  Play,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useOperationalOrders } from "@/lib/food/demo-order-store";
import type { DemoOrder, OrderStatus } from "@/lib/food/types";

export function KdsBoard() {
  const { orders: allOrders, setOrderStatus } = useOperationalOrders();
  const orders = allOrders.filter((order) =>
    ["new", "preparing", "ready"].includes(order.status),
  );
  const [soundOn, setSoundOn] = useState(true);

  function setStatus(orderId: string, status: OrderStatus) {
    setOrderStatus(orderId, status);
  }

  return (
    <main className="min-h-screen bg-[#121714] text-[#f4f6f0]">
      <header className="flex h-16 items-center justify-between border-b border-white/10 px-4 sm:px-6">
        <Link
          href="/admin/pedidos"
          className="flex items-center gap-2 text-sm font-bold text-[#d9ded7] hover:text-white"
        >
          <ChevronLeft className="size-4" />
          Voltar à operação
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm font-semibold text-[#bdc7bd] sm:inline">
            Estação · Cozinha principal
          </span>
          <button
            type="button"
            className={"grid size-9 place-items-center rounded-lg " + (soundOn ? "bg-[#e3ad3a] text-[#273029]" : "bg-white/10 text-white")}
            onClick={() => setSoundOn((current) => !current)}
            aria-label={soundOn ? "Desativar som" : "Ativar som"}
          >
            <Volume2 className="size-4" />
          </button>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg bg-white/10 text-white"
            onClick={() => document.documentElement.requestFullscreen?.()}
            aria-label="Tela cheia"
          >
            <Maximize2 className="size-4" />
          </button>
        </div>
      </header>

      <section className="p-4 sm:p-6">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-[#e7b645]">KDS em tempo real</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Fila da cozinha</h1>
          </div>
          <span className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold">
            {orders.filter((order) => order.status !== "ready").length} em produção
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {orders.map((order) => (
            <KdsCard key={order.id} order={order} onSetStatus={setStatus} />
          ))}
        </div>
      </section>
    </main>
  );
}

function KdsCard({
  order,
  onSetStatus,
}: {
  order: DemoOrder;
  onSetStatus: (id: string, status: OrderStatus) => void;
}) {
  const ready = order.status === "ready";

  return (
    <article
      className={
        "rounded-2xl border p-5 shadow-lg " +
        (ready
          ? "border-[#91bd80] bg-[#273a2b]"
          : order.elapsed === "23 min"
            ? "border-[#d98758] bg-[#3f2b22]"
            : "border-white/10 bg-[#202723]")
      }
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-black tracking-[-0.05em]">#{order.number}</p>
          <p className="mt-1 text-sm font-semibold text-[#c9d1c9]">
            {order.type === "delivery" ? "Delivery" : "Retirada"} · {order.customerName}
          </p>
        </div>
        <span
          className={
            "rounded-lg px-2.5 py-1.5 text-sm font-bold " +
            (order.elapsed === "23 min"
              ? "bg-[#e6a777] text-[#45281b]"
              : "bg-white/10 text-[#eff2ec]")
          }
        >
          <Clock3 className="mr-1 inline size-4 align-[-2px]" />
          {order.elapsed}
        </span>
      </div>
      <div className="my-5 h-px bg-white/10" />
      <div className="space-y-4">
        {order.items.map((item, index) => (
          <div key={index}>
            <p className="text-lg font-bold leading-6">
              <span className="mr-2 text-[#e7b645]">{item.quantity}×</span>
              {item.name}
            </p>
            {item.modifiers.map((modifier) => (
              <p key={modifier} className="pl-8 text-sm text-[#d3dbd2]">
                · {modifier}
              </p>
            ))}
            {item.note ? (
              <p className="mt-2 rounded-lg bg-[#f2c48a] px-3 py-2 text-sm font-bold text-[#482d1f]">
                {item.note}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-7 grid grid-cols-2 gap-2">
        {!ready ? (
          <button
            type="button"
            onClick={() => onSetStatus(order.id, "preparing")}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 text-sm font-bold hover:bg-white/10"
          >
            <Play className="size-4" />
            {order.status === "new" ? "Iniciar" : "Em preparo"}
          </button>
        ) : (
          <span className="grid h-12 place-items-center rounded-xl border border-[#9fcd8c]/40 bg-[#386441] text-sm font-bold">
            <Check className="mr-2 inline size-4" />
            Pronto
          </span>
        )}
        <button
          type="button"
          onClick={() => onSetStatus(order.id, "ready")}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#e3ad3a] text-sm font-black text-[#263029] hover:bg-[#f0bd4a]"
        >
          <Check className="size-4" />
          Marcar pronto
        </button>
      </div>
    </article>
  );
}
