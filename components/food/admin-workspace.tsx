"use client";

import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  CookingPot,
  LayoutDashboard,
  Menu,
  Package,
  Pause,
  Plus,
  ReceiptText,
  Settings2,
  Truck,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useOperationalOrders } from "@/lib/food/demo-order-store";
import { formatBRL } from "@/lib/food/format";
import type { DemoOrder, OrderStatus } from "@/lib/food/types";

type AdminView = "overview" | "orders";

const navItems = [
  { label: "Visão geral", href: "/admin", icon: LayoutDashboard, view: "overview" },
  { label: "Pedidos", href: "/admin/pedidos", icon: ClipboardList, view: "orders" },
  { label: "Cozinha", href: "/kds", icon: CookingPot },
  { label: "Cardápio", href: "/admin#cardapio", icon: Package },
  { label: "Clientes", href: "/admin#clientes", icon: UsersRound },
  { label: "Entregas", href: "/admin#entregas", icon: Truck },
  { label: "Financeiro", href: "/admin#financeiro", icon: CircleDollarSign },
];

const boardColumns: Array<{
  id: OrderStatus;
  title: string;
  color: string;
  next: OrderStatus;
  action: string;
}> = [
  {
    id: "new",
    title: "Novos",
    color: "bg-[#f2d79c]",
    next: "preparing",
    action: "Aceitar e preparar",
  },
  {
    id: "preparing",
    title: "Em preparo",
    color: "bg-[#c9d8f4]",
    next: "ready",
    action: "Marcar pronto",
  },
  {
    id: "ready",
    title: "Prontos",
    color: "bg-[#cde4c5]",
    next: "out_for_delivery",
    action: "Enviar entrega",
  },
  {
    id: "out_for_delivery",
    title: "Em entrega",
    color: "bg-[#e2d7ef]",
    next: "delivered",
    action: "Concluir pedido",
  },
];

export function AdminWorkspace({ view }: { view: AdminView }) {
  const { orders, setOrderStatus, isRealtime } = useOperationalOrders();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeliveryPaused, setIsDeliveryPaused] = useState(false);

  const activeCount = orders.filter(
    (order) => !["delivered", "canceled"].includes(order.status),
  ).length;
  const todayRevenue = orders.reduce((total, order) => total + order.total, 0);

  function advanceOrder(orderId: string, nextStatus: OrderStatus) {
    setOrderStatus(orderId, nextStatus);
  }

  const currentOrders = useMemo(
    () => orders.filter((order) => order.status !== "delivered"),
    [orders],
  );

  return (
    <main className="min-h-screen bg-[#f5f5f2] text-[#222422]">
      <div className="flex min-h-screen">
        <aside
          className={
            "fixed inset-y-0 left-0 z-40 flex w-[276px] flex-col border-r border-[#e2e2dc] bg-[#202723] p-4 text-white transition-transform lg:static lg:translate-x-0 " +
            (isMenuOpen ? "translate-x-0" : "-translate-x-full")
          }
        >
          <div className="flex h-12 items-center justify-between px-2">
            <Link href="/admin" className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-[#f0b43a] font-black text-[#273029]">
                27
              </span>
              <span>
                <span className="block text-sm font-bold">Forno 27</span>
                <span className="block text-[11px] text-[#b9c1b9]">Centro · Operação</span>
              </span>
            </Link>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg text-[#cdd4cd] hover:bg-white/10 lg:hidden"
              onClick={() => setIsMenuOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
          </div>

          <nav className="mt-7 space-y-1" aria-label="Navegação administrativa">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.view === view;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={
                    "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition " +
                    (active
                      ? "bg-[#37473e] text-white"
                      : "text-[#bdc6be] hover:bg-white/7 hover:text-white")
                  }
                >
                  <Icon className="size-4.5" />
                  {item.label}
                  {item.label === "Pedidos" && activeCount ? (
                    <span className="ml-auto grid size-5 place-items-center rounded-full bg-[#f0b43a] text-[11px] font-bold text-[#293129]">
                      {activeCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-white/10 pt-4">
            <Link
              href="/admin#configuracoes"
              className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-[#bdc6be] hover:bg-white/7 hover:text-white"
            >
              <Settings2 className="size-4.5" />
              Configurações
            </Link>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 p-3">
              <span className="grid size-8 place-items-center rounded-full bg-[#798c7b] text-xs font-bold">
                AM
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">Ana Martins</span>
                <span className="block truncate text-[11px] text-[#9eaaa0]">Proprietária</span>
              </span>
              <ChevronDown className="size-4 text-[#aeb9b0]" />
            </div>
          </div>
        </aside>

        {isMenuOpen ? (
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-30 bg-black/45 lg:hidden"
            onClick={() => setIsMenuOpen(false)}
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#e2e2dc] bg-[#f5f5f2]/95 px-4 backdrop-blur sm:px-7">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid size-9 place-items-center rounded-lg border border-[#deded8] bg-white lg:hidden"
                onClick={() => setIsMenuOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="size-4.5" />
              </button>
              <div>
                <p className="text-xs font-medium text-[#85877f]">Sábado, 20 de setembro</p>
                <h1 className="font-semibold tracking-[-0.02em]">
                  {view === "orders" ? "Central de pedidos" : "Bom turno, Ana"}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={
                  "hidden h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold sm:flex " +
                  (isDeliveryPaused
                    ? "border-[#d7725c] bg-[#fff0ed] text-[#a94d3e]"
                    : "border-[#d9e6d4] bg-[#eff7ec] text-[#477340]")
                }
                onClick={() => setIsDeliveryPaused((current) => !current)}
              >
                <Pause className="size-3.5" />
                {isDeliveryPaused ? "Delivery pausado" : "Delivery aberto"}
              </button>
              <Link
                href="/"
                className="hidden h-9 items-center rounded-lg px-3 text-xs font-bold text-[#56584f] hover:bg-white sm:flex"
              >
                Ver loja
                <ArrowUpRight className="ml-1 size-3.5" />
              </Link>
              <button
                type="button"
                className="relative grid size-9 place-items-center rounded-lg border border-[#deded8] bg-white"
                aria-label="Notificações"
              >
                <Bell className="size-4.5" />
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#d9762a]" />
              </button>
            </div>
          </header>

          {view === "overview" ? (
            <Overview
              orders={currentOrders}
              revenue={todayRevenue}
              isDeliveryPaused={isDeliveryPaused}
              onToggleDelivery={() => setIsDeliveryPaused((current) => !current)}
            />
          ) : (
            <OrdersBoard
              orders={orders}
              onAdvance={advanceOrder}
              isRealtime={isRealtime}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function Overview({
  orders,
  revenue,
  isDeliveryPaused,
  onToggleDelivery,
}: {
  orders: DemoOrder[];
  revenue: number;
  isDeliveryPaused: boolean;
  onToggleDelivery: () => void;
}) {
  const metrics = [
    {
      label: "Faturamento hoje",
      value: formatBRL(revenue),
      helper: "+12,8% vs. último sábado",
      positive: true,
    },
    {
      label: "Pedidos em operação",
      value: String(orders.length),
      helper: "2 aguardam aceite",
      positive: false,
    },
    {
      label: "Ticket médio",
      value: formatBRL(revenue / Math.max(orders.length, 1)),
      helper: "+ R$ 4,20 esta semana",
      positive: true,
    },
    {
      label: "Tempo de preparo",
      value: "19 min",
      helper: "Meta: até 22 min",
      positive: true,
    },
  ];

  return (
    <div className="mx-auto max-w-[1440px] p-4 sm:p-7">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-2xl border border-[#e0e0da] bg-white p-4 shadow-[0_3px_10px_rgba(34,36,33,0.03)]"
          >
            <p className="text-sm font-medium text-[#777a71]">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.035em]">{metric.value}</p>
            <p
              className={
                "mt-2 text-xs font-semibold " +
                (metric.positive ? "text-[#53844c]" : "text-[#a1742d]")
              }
            >
              {metric.helper}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-2xl border border-[#e0e0da] bg-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold">Vendas por horário</p>
              <p className="mt-1 text-sm text-[#777a71]">
                O movimento começa a subir a partir das 18h.
              </p>
            </div>
            <span className="rounded-lg bg-[#f2f4ef] px-2.5 py-1 text-xs font-semibold text-[#697068]">
              Hoje
            </span>
          </div>
          <div className="mt-8 flex h-48 items-end gap-2 sm:gap-3">
            {[24, 31, 42, 36, 52, 67, 89, 100, 78, 56, 39, 25].map(
              (height, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-2">
                  <span
                    className={
                      "w-full rounded-t-md " +
                      (index === 7 ? "bg-[#d9762a]" : "bg-[#e4e9e1]")
                    }
                    style={{ height: height + "%" }}
                  />
                  <span className="text-[10px] text-[#8e908a]">
                    {String(index + 11).padStart(2, "0")}h
                  </span>
                </div>
              ),
            )}
          </div>
          <div className="mt-5 rounded-xl bg-[#f7f2e8] p-3 text-sm text-[#705f3d]">
            <span className="font-bold">Pico previsto:</span> 19h–21h. Considere
            preparar mise en place para +14 pedidos.
          </div>
        </article>

        <article className="rounded-2xl border border-[#e0e0da] bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Ações rápidas</p>
              <p className="mt-1 text-sm text-[#777a71]">Atalhos da operação.</p>
            </div>
            <Plus className="size-4 text-[#75776f]" />
          </div>
          <div className="mt-5 grid gap-2">
            <Link
              href="/admin/pedidos"
              className="flex h-11 items-center justify-between rounded-xl bg-[#202723] px-3.5 text-sm font-bold text-white transition hover:bg-[#35443b]"
            >
              Novo pedido
              <ChevronRight className="size-4" />
            </Link>
            <Link
              href="/admin#cardapio"
              className="flex h-11 items-center justify-between rounded-xl border border-[#e1e1dc] px-3.5 text-sm font-bold text-[#4f534d] hover:bg-[#f6f7f3]"
            >
              Adicionar produto
              <ChevronRight className="size-4" />
            </Link>
            <button
              type="button"
              onClick={onToggleDelivery}
              className="flex h-11 items-center justify-between rounded-xl border border-[#e1e1dc] px-3.5 text-left text-sm font-bold text-[#4f534d] hover:bg-[#f6f7f3]"
            >
              {isDeliveryPaused ? "Reabrir delivery" : "Pausar delivery"}
              <Pause className="size-4" />
            </button>
            <Link
              href="/kds"
              className="flex h-11 items-center justify-between rounded-xl border border-[#e1e1dc] px-3.5 text-sm font-bold text-[#4f534d] hover:bg-[#f6f7f3]"
            >
              Ver cozinha
              <CookingPot className="size-4" />
            </Link>
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="overflow-hidden rounded-2xl border border-[#e0e0da] bg-white">
          <div className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm font-semibold">Pedidos em operação</p>
              <p className="mt-1 text-sm text-[#777a71]">
                Acompanhe o que precisa de atenção agora.
              </p>
            </div>
            <Link href="/admin/pedidos" className="text-sm font-bold text-[#b86620] hover:underline">
              Abrir central
            </Link>
          </div>
          <div className="divide-y divide-[#eeeDE8]">
            {orders.slice(0, 4).map((order) => (
              <div key={order.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid size-9 place-items-center rounded-xl bg-[#f4f3ef] text-xs font-bold">
                  #{order.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{order.customerName}</span>
                  <span className="block truncate text-xs text-[#85877f]">
                    {order.items.map((item) => item.quantity + "× " + item.name).join(" · ")}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-xs font-bold">{order.elapsed}</span>
                  <span className="block text-[11px] text-[#868980]">
                    {statusLabel(order.status)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-[#e0e0da] bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Produtos em alta</p>
              <p className="mt-1 text-sm text-[#777a71]">Últimas 24 horas</p>
            </div>
            <ReceiptText className="size-4 text-[#8c8f88]" />
          </div>
          <div className="mt-5 space-y-4">
            {[
              ["Pizza Margherita", "38 pedidos", "R$ 1.858"],
              ["Smash Bacon", "31 pedidos", "R$ 1.113"],
              ["Batata com Cheddar", "24 pedidos", "R$ 454"],
            ].map(([name, volume, revenue], index) => (
              <div key={name} className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-[#f5f1e8] text-xs font-black text-[#b86b26]">
                  {index + 1}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-bold">{name}</span>
                  <span className="block text-xs text-[#85877f]">{volume}</span>
                </span>
                <span className="text-sm font-bold">{revenue}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function OrdersBoard({
  orders,
  onAdvance,
  isRealtime,
}: {
  orders: DemoOrder[];
  onAdvance: (orderId: string, nextStatus: OrderStatus) => void;
  isRealtime: boolean;
}) {
  return (
    <div className="p-4 sm:p-7">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-[#777a71]">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#79b66b]" />
              {isRealtime ? "Atualização em tempo real" : "Modo demonstração sincronizado"}
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">{orders.length} pedidos hoje</span>
        </div>
        <Link
          href="/kds"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#202723] px-3.5 text-sm font-bold text-white hover:bg-[#35443b]"
        >
          <CookingPot className="size-4" />
          Abrir modo cozinha
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {boardColumns.map((column) => {
          const columnOrders = orders.filter((order) => order.status === column.id);
          return (
            <section
              key={column.id}
              className="min-h-[500px] rounded-2xl border border-[#e0e0da] bg-[#eff0ed] p-3"
            >
              <div className="mb-3 flex items-center gap-2 px-1.5">
                <span className={"size-2.5 rounded-full " + column.color} />
                <h2 className="flex-1 text-sm font-bold">{column.title}</h2>
                <span className="grid size-5 place-items-center rounded-full bg-white text-[11px] font-bold text-[#666960]">
                  {columnOrders.length}
                </span>
              </div>
              <div className="space-y-3">
                {columnOrders.map((order) => (
                  <OrderCard key={order.id} order={order} column={column} onAdvance={onAdvance} />
                ))}
                {!columnOrders.length ? (
                  <div className="rounded-xl border border-dashed border-[#d5d7d1] bg-white/45 p-4 text-center text-xs text-[#91938d]">
                    Nenhum pedido nesta etapa.
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  column,
  onAdvance,
}: {
  order: DemoOrder;
  column: (typeof boardColumns)[number];
  onAdvance: (orderId: string, nextStatus: OrderStatus) => void;
}) {
  return (
    <article className="rounded-xl border border-[#dfdfda] bg-white p-3.5 shadow-[0_3px_10px_rgba(32,34,31,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-black tracking-[-0.02em]">#{order.number}</p>
          <p className="mt-0.5 text-xs font-semibold text-[#767870]">{order.customerName}</p>
        </div>
        <span
          className={
            "rounded-md px-2 py-1 text-[11px] font-bold " +
            (order.elapsed === "37 min"
              ? "bg-[#ffede7] text-[#b75641]"
              : "bg-[#f4f3ef] text-[#767870]")
          }
        >
          <Clock3 className="mr-1 inline size-3 align-[-1px]" />
          {order.elapsed}
        </span>
      </div>
      <div className="my-3 border-t border-[#efefeb]" />
      <ul className="space-y-1.5">
        {order.items.map((item, index) => (
          <li key={index} className="text-xs leading-5">
            <span className="font-bold text-[#373933]">{item.quantity}× </span>
            <span className="font-semibold text-[#4b4d47]">{item.name}</span>
            {item.modifiers.length ? (
              <span className="block pl-4 text-[#898b84]">{item.modifiers.join(" · ")}</span>
            ) : null}
            {item.note ? (
              <span className="block rounded-md bg-[#fff5e9] px-2 py-1 text-[#95613a]">
                {item.note}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between text-xs text-[#777a71]">
        <span className="capitalize">{order.type === "delivery" ? "Delivery" : "Retirada"}</span>
        <span className="font-bold text-[#454842]">{formatBRL(order.total)}</span>
      </div>
      <button
        type="button"
        className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#202723] text-xs font-bold text-white hover:bg-[#35443b]"
        onClick={() => onAdvance(order.id, column.next)}
      >
        {column.action}
        <ChevronRight className="size-3.5" />
      </button>
    </article>
  );
}

function statusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    new: "Novo",
    confirmed: "Confirmado",
    preparing: "Em preparo",
    ready: "Pronto",
    awaiting_driver: "Aguardando entregador",
    out_for_delivery: "Em entrega",
    delivered: "Entregue",
    canceled: "Cancelado",
  };
  return labels[status];
}
