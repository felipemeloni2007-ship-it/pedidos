"use client";

import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  CookingPot,
  CreditCard,
  Download,
  FileText,
  Gauge,
  Heart,
  Link2,
  Menu,
  MoreHorizontal,
  Package,
  Pause,
  Percent,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Tag,
  Truck,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useOperationalOrders } from "@/lib/food/demo-order-store";
import { categories, demoProducts } from "@/lib/food/demo-data";
import { formatBRL } from "@/lib/food/format";
import type { DemoOrder, OrderStatus } from "@/lib/food/types";

type AdminSection =
  | "overview"
  | "orders"
  | "catalog"
  | "customers"
  | "delivery"
  | "inventory"
  | "finance"
  | "marketing"
  | "team"
  | "settings";

const sections: Array<{ id: AdminSection; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "Visão geral", icon: Gauge },
  { id: "orders", label: "Pedidos e PDV", icon: ClipboardList },
  { id: "catalog", label: "Cardápio", icon: Package },
  { id: "customers", label: "Clientes e CRM", icon: UsersRound },
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "inventory", label: "Estoque e CMV", icon: Boxes },
  { id: "finance", label: "Financeiro", icon: CircleDollarSign },
  { id: "marketing", label: "Marketing", icon: Tag },
];

const moreSections: Array<{ id: AdminSection; label: string; icon: typeof Gauge }> = [
  { id: "team", label: "Equipe e permissões", icon: ShieldCheck },
  { id: "settings", label: "Configurações", icon: Settings2 },
];

const money = (value: number) => formatBRL(value);

export function AdminCommandCenter() {
  const router = useRouter();
  const [section, setSection] = useState<AdminSection>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(true);
  const [deliveryPaused, setDeliveryPaused] = useState(false);
  const [toast, setToast] = useState("");
  const { orders, setOrderStatus, isRealtime } = useOperationalOrders();

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const activeOrders = orders.filter((order) => !["delivered", "canceled"].includes(order.status));
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);

  function navigate(next: AdminSection) {
    setSection(next);
    setMenuOpen(false);
  }

  return (
    <main className="min-h-screen bg-[#f5f6f3] text-[#202522]">
      <div className="flex min-h-screen">
        <aside
          className={
            "fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-[#2d3a32] bg-[#202823] p-4 text-white transition-transform lg:static lg:translate-x-0 " +
            (menuOpen ? "translate-x-0" : "-translate-x-full")
          }
        >
          <div className="flex items-center justify-between px-2">
            <Link href="/admin" className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-[#f2b747] font-black text-[#253029]">27</span>
              <span>
                <span className="block text-sm font-bold">Forno 27</span>
                <span className="block text-[11px] text-[#b9c4bc]">Centro · Operação</span>
              </span>
            </Link>
            <button type="button" className="grid size-9 place-items-center rounded-lg text-[#cdd6cf] hover:bg-white/10 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#aab8ae]">Unidade ativa</p>
            <button type="button" className="mt-2 flex w-full items-center gap-2 text-left" onClick={() => notify("Alternador de unidades pronto para sua rede") }>
              <Store className="size-4 text-[#f2b747]" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">Centro</span>
              <ChevronDown className="size-4 text-[#aab8ae]" />
            </button>
          </div>

          <nav className="mt-6 space-y-1" aria-label="Navegação administrativa">
            {sections.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button key={item.id} type="button" onClick={() => navigate(item.id)} className={"flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition " + (active ? "bg-[#385047] text-white" : "text-[#bdc8bf] hover:bg-white/10 hover:text-white")}>
                  <Icon className="size-4" />
                  <span className="flex-1">{item.label}</span>
                  {item.id === "orders" && activeOrders.length > 0 ? <span className="grid size-5 place-items-center rounded-full bg-[#f2b747] text-[10px] font-black text-[#253029]">{activeOrders.length}</span> : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7f9385]">Gestão</p>
            <div className="mt-2 space-y-1">
              {moreSections.map((item) => {
                const Icon = item.icon;
                return <button key={item.id} type="button" onClick={() => navigate(item.id)} className={"flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium " + (section === item.id ? "bg-[#385047] text-white" : "text-[#bdc8bf] hover:bg-white/10 hover:text-white")}><Icon className="size-4" />{item.label}</button>;
              })}
            </div>
          </div>

          <div className="mt-auto border-t border-white/10 pt-4">
            <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
              <span className="grid size-8 place-items-center rounded-full bg-[#78917d] text-xs font-bold">AM</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">Ana Martins</span><span className="block truncate text-[11px] text-[#9eaaa0]">Proprietária</span></span>
              <ChevronDown className="size-4 text-[#aeb9b0]" />
            </div>
          </div>
        </aside>

        {menuOpen ? <button type="button" aria-label="Fechar menu" className="fixed inset-0 z-30 bg-black/45 lg:hidden" onClick={() => setMenuOpen(false)} /> : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-[#e2e5df] bg-[#f5f6f3]/95 px-4 py-3 backdrop-blur sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" className="grid size-9 place-items-center rounded-lg border border-[#dfe3dd] bg-white lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu className="size-4" /></button>
              <div className="min-w-0"><p className="truncate text-xs font-medium text-[#858d87]">Sábado, 20 de setembro · turno da noite</p><h1 className="truncate text-lg font-semibold tracking-[-0.02em]">{sectionTitle(section)}</h1></div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setDeliveryPaused((value) => !value); notify(deliveryPaused ? "Delivery reaberto" : "Delivery pausado"); }} className={"hidden h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold sm:flex " + (deliveryPaused ? "border-[#e19a8b] bg-[#fff1ee] text-[#a64f42]" : "border-[#cce2c8] bg-[#eef8eb] text-[#477340]")}><Pause className="size-3.5" />{deliveryPaused ? "Delivery pausado" : "Delivery aberto"}</button>
              <Link href="/" className="hidden h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold text-[#565d57] hover:bg-white sm:flex">Ver loja <ChevronRight className="size-3.5" /></Link>
              <button type="button" className="relative grid size-9 place-items-center rounded-lg border border-[#dfe3dd] bg-white" onClick={() => notify("Você está em dia: nenhuma notificação crítica")} aria-label="Notificações"><Bell className="size-4" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#d9762a]" /></button>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] p-4 sm:p-7">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => { setStoreOpen((value) => !value); notify(storeOpen ? "Loja fechada para novos pedidos" : "Loja aberta e aceitando pedidos"); }} className={"inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-xs font-bold " + (storeOpen ? "bg-[#eaf5e6] text-[#3f7438]" : "bg-[#fff0ed] text-[#a94d3e]")}><span className={"size-2 rounded-full " + (storeOpen ? "bg-[#69ae5d]" : "bg-[#d7725c]")} />{storeOpen ? "Loja aberta" : "Loja fechada"}</button>
              <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#687069] shadow-sm">{isRealtime ? "Realtime conectado" : "Demonstração sincronizada"}</span>
              <span className="ml-auto hidden text-xs text-[#858d87] md:inline">Última atualização agora · dados protegidos por tenant</span>
            </div>

            {section === "overview" ? <OverviewPanel orders={orders} revenue={revenue} navigate={navigate} notify={notify} onOpenKds={() => router.push("/kds")} /> : null}
            {section === "orders" ? <OrdersPanel orders={orders} onStatus={(id, status) => { setOrderStatus(id, status); notify("Status do pedido atualizado"); }} notify={notify} /> : null}
            {section === "catalog" ? <CatalogPanel notify={notify} /> : null}
            {section === "customers" ? <CustomersPanel notify={notify} /> : null}
            {section === "delivery" ? <DeliveryPanel orders={orders} notify={notify} /> : null}
            {section === "inventory" ? <InventoryPanel notify={notify} /> : null}
            {section === "finance" ? <FinancePanel revenue={revenue} notify={notify} /> : null}
            {section === "marketing" ? <MarketingPanel notify={notify} /> : null}
            {section === "team" ? <TeamPanel notify={notify} /> : null}
            {section === "settings" ? <SettingsPanel storeOpen={storeOpen} deliveryPaused={deliveryPaused} notify={notify} /> : null}
          </div>
        </div>
      </div>
      {toast ? <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl bg-[#202823] px-4 py-3 text-sm font-semibold text-white shadow-xl"><CheckCircle2 className="size-4 text-[#9bd57f]" />{toast}</div> : null}
    </main>
  );
}

function sectionTitle(section: AdminSection) {
  return ({ overview: "Bom turno, Ana", orders: "Pedidos e PDV", catalog: "Cardápio e produtos", customers: "Clientes e CRM", delivery: "Despacho e entregas", inventory: "Estoque e CMV", finance: "Financeiro", marketing: "Marketing e fidelidade", team: "Equipe e permissões", settings: "Configurações da operação" })[section];
}

function SectionHeader({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#aa6a2b]">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{title}</h2><p className="mt-1 max-w-2xl text-sm text-[#727b73]">{description}</p></div>{action ? <button type="button" onClick={onAction} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#202823] px-3.5 text-sm font-bold text-white hover:bg-[#35463c]"><Plus className="size-4" />{action}</button> : null}</div>;
}

function MetricCard({ label, value, helper, icon: Icon, tone = "neutral" }: { label: string; value: string; helper: string; icon: typeof Activity; tone?: "neutral" | "green" | "orange" | "purple" }) {
  const tones = { neutral: "bg-[#f2f4f0] text-[#69736a]", green: "bg-[#eaf5e6] text-[#4d8546]", orange: "bg-[#fff1df] text-[#a46225]", purple: "bg-[#eeeaf7] text-[#6f5a9a]" };
  return <article className="rounded-2xl border border-[#e0e4de] bg-white p-4 shadow-[0_3px_10px_rgba(34,36,33,0.03)]"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-[#727b73]">{label}</p><span className={"grid size-8 place-items-center rounded-lg " + tones[tone]}><Icon className="size-4" /></span></div><p className="mt-3 text-2xl font-semibold tracking-[-0.035em]">{value}</p><p className="mt-2 text-xs font-semibold text-[#56814f]">{helper}</p></article>;
}

function OverviewPanel({ orders, revenue, navigate, notify, onOpenKds }: { orders: DemoOrder[]; revenue: number; navigate: (section: AdminSection) => void; notify: (message: string) => void; onOpenKds: () => void }) {
  const active = orders.filter((order) => !["delivered", "canceled"].includes(order.status));
  const avgTicket = revenue / Math.max(orders.length, 1);
  const topProducts = [
    ["Pizza Margherita", 38, 1858],
    ["Smash Bacon", 31, 1113],
    ["Batata com Cheddar", 24, 454],
    ["Brownie intenso", 19, 228],
  ] as const;
  return <div>
    <SectionHeader eyebrow="Visão executiva" title="Tudo que precisa de atenção, em um lugar" description="Acompanhe vendas, operação, capacidade da cozinha e oportunidades de receita sem trocar de tela." action="Novo pedido" onAction={() => navigate("orders")} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Faturamento hoje" value={money(revenue)} helper="+12,8% vs. último sábado" icon={CircleDollarSign} tone="green" /><MetricCard label="Pedidos em operação" value={String(active.length)} helper="2 aguardam aceite" icon={ClipboardList} tone="orange" /><MetricCard label="Ticket médio" value={money(avgTicket)} helper="+ R$ 4,20 esta semana" icon={BarChart3} tone="purple" /><MetricCard label="Tempo de preparo" value="19 min" helper="Meta: até 22 min" icon={Clock3} tone="green" /></div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
      <article className="rounded-2xl border border-[#e0e4de] bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold">Vendas por horário</p><p className="mt-1 text-sm text-[#727b73]">Use o pico para planejar mise en place e equipe.</p></div><select className="h-9 rounded-lg border border-[#dfe3dd] bg-white px-2 text-xs font-semibold"><option>Hoje</option><option>Últimos 7 dias</option><option>Este mês</option></select></div><div className="mt-7 flex h-48 items-end gap-2 sm:gap-3">{[25, 28, 34, 42, 50, 62, 78, 100, 86, 66, 46, 30].map((height, index) => <div key={index} className="flex flex-1 flex-col items-center gap-2"><span className={"w-full rounded-t-md " + (index === 7 ? "bg-[#d9762a]" : "bg-[#e1e8df]")} style={{ height: height + "%" }} /><span className="text-[10px] text-[#8e968e]">{String(index + 11).padStart(2, "0")}h</span></div>)}</div><div className="mt-5 flex items-center gap-2 rounded-xl bg-[#fff7e9] p-3 text-sm text-[#79613f]"><Activity className="size-4 text-[#d9762a]" /><span><strong>Pico previsto 19h–21h.</strong> Capacidade recomendada: +14 pedidos por janela.</span></div></article>
      <article className="rounded-2xl border border-[#e0e4de] bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Ações rápidas</p><p className="mt-1 text-sm text-[#727b73]">Os atalhos que a equipe mais usa.</p></div><ZapIcon /></div><div className="mt-5 grid gap-2"><QuickAction label="Abrir frente de caixa" icon={WalletCards} onClick={() => notify("PDV pronto para iniciar um pedido de balcão")} primary /><QuickAction label="Ver KDS da cozinha" icon={CookingPot} onClick={onOpenKds} /><QuickAction label="Criar promoção" icon={Tag} onClick={() => navigate("marketing")} /><QuickAction label="Adicionar produto" icon={Package} onClick={() => navigate("catalog")} /></div></article>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <article className="overflow-hidden rounded-2xl border border-[#e0e4de] bg-white"><div className="flex items-center justify-between border-b border-[#edf0eb] p-5"><div><p className="text-sm font-semibold">Fila operacional</p><p className="mt-1 text-sm text-[#727b73]">Pedidos que precisam de uma ação agora.</p></div><button type="button" onClick={() => navigate("orders")} className="text-sm font-bold text-[#b86620] hover:underline">Abrir central</button></div><div className="divide-y divide-[#edf0eb]">{active.slice(0, 5).map((order) => <div key={order.id} className="flex items-center gap-3 px-5 py-3.5"><span className="grid size-9 place-items-center rounded-xl bg-[#f2f4f0] text-xs font-bold">#{order.number}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{order.customerName}</span><span className="block truncate text-xs text-[#858d87]">{order.items.map((item) => item.quantity + "× " + item.name).join(" · ")}</span></span><span className="text-right"><span className="block text-xs font-bold">{order.elapsed}</span><span className="block text-[11px] text-[#858d87]">{statusLabel(order.status)}</span></span></div>)}{!active.length ? <EmptyState icon={CheckCircle2} title="Operação em dia" description="Nenhum pedido aguardando ação." /> : null}</div></article>
      <article className="rounded-2xl border border-[#e0e4de] bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Produtos em alta</p><p className="mt-1 text-sm text-[#727b73]">Últimas 24 horas · margem estimada incluída</p></div><button type="button" onClick={() => navigate("catalog")} aria-label="Abrir catálogo" className="rounded-lg p-2 hover:bg-[#f2f4f0]"><MoreHorizontal className="size-4" /></button></div><div className="mt-5 space-y-4">{topProducts.map(([name, volume, amount], index) => <div key={name} className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-[#fff3e1] text-xs font-black text-[#b86b26]">{index + 1}</span><span className="flex-1"><span className="block text-sm font-bold">{name}</span><span className="block text-xs text-[#858d87]">{volume} pedidos · CMV {index === 0 ? "31%" : "28%"}</span></span><span className="text-sm font-bold">{money(amount)}</span></div>)}</div></article>
    </div>

    <div className="mt-5 grid gap-5 md:grid-cols-3"><AlertCard label="Estoque baixo" value="6 insumos" helper="Queijo muçarela é o próximo a acabar" icon={Boxes} tone="orange" onClick={() => navigate("inventory")} /><AlertCard label="Clientes em risco" value="42 clientes" helper="Sem pedido há mais de 30 dias" icon={Heart} tone="purple" onClick={() => navigate("customers")} /><AlertCard label="Pagamento pendente" value="R$ 124,60" helper="2 Pix aguardando confirmação" icon={CreditCard} tone="green" onClick={() => navigate("finance")} /></div>
  </div>;
}

function OrdersPanel({ orders, onStatus, notify }: { orders: DemoOrder[]; onStatus: (id: string, status: OrderStatus) => void; notify: (message: string) => void }) {
  const [filter, setFilter] = useState("todos");
  const [query, setQuery] = useState("");
  const filtered = orders.filter((order) => (filter === "todos" || order.status === filter) && (!query || `${order.number} ${order.customerName}`.toLowerCase().includes(query.toLowerCase())));
  const actions: Array<{ id: OrderStatus; label: string; next?: OrderStatus; tone: string }> = [{ id: "new", label: "Novos", next: "confirmed", tone: "bg-[#fff3d8]" }, { id: "confirmed", label: "Confirmados", next: "preparing", tone: "bg-[#eaf0fb]" }, { id: "preparing", label: "Em preparo", next: "ready", tone: "bg-[#eaf0fb]" }, { id: "ready", label: "Prontos", next: "out_for_delivery", tone: "bg-[#eaf5e6]" }, { id: "out_for_delivery", label: "Em entrega", next: "delivered", tone: "bg-[#eeeaf7]" }];
  return <div><SectionHeader eyebrow="Operação" title="Pedidos, PDV e canais em uma só fila" description="Aceite, prepare, despache e conclua pedidos com poucos toques. A mesma tela atende delivery, retirada, balcão, mesa e WhatsApp." action="Pedido de balcão" onAction={() => notify("Novo pedido de balcão iniciado no PDV")} /><div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">{actions.map((action) => <div key={action.id} className={"rounded-xl p-3 " + action.tone}><p className="text-xs font-bold text-[#69736a]">{action.label}</p><p className="mt-1 text-2xl font-semibold">{orders.filter((order) => order.status === action.id).length}</p></div>)}</div><div className="mt-5 rounded-2xl border border-[#e0e4de] bg-white"><div className="flex flex-col gap-3 border-b border-[#edf0eb] p-4 sm:flex-row sm:items-center"><label className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-[#dfe3dd] px-3 text-sm"><Search className="size-4 text-[#8a938b]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por cliente ou número" className="min-w-0 flex-1 bg-transparent outline-none" /></label><div className="flex gap-1 overflow-x-auto">{["todos", ...actions.map((item) => item.id)].map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={"shrink-0 rounded-lg px-3 py-2 text-xs font-bold " + (filter === value ? "bg-[#202823] text-white" : "text-[#687069] hover:bg-[#f2f4f0]")}>{value === "todos" ? "Todos" : statusLabel(value as OrderStatus)}</button>)}</div><button type="button" onClick={() => notify("Relatório CSV preparado para exportação")} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dfe3dd] px-3 text-xs font-bold text-[#5e685f] hover:bg-[#f5f6f3]"><Download className="size-3.5" />Exportar</button></div><div className="divide-y divide-[#edf0eb]">{filtered.map((order) => <div key={order.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[100px_1.2fr_1fr_130px_170px] lg:items-center"><span className="text-sm font-black">#{order.number}<span className="mt-1 block text-[11px] font-normal text-[#8a938b]">{order.createdAt}</span></span><span><span className="block text-sm font-bold">{order.customerName}</span><span className="block text-xs text-[#7b857d]">{order.items.map((item) => item.quantity + "× " + item.name).join(" · ")}</span></span><span className="text-sm text-[#69736a]"><span className="block font-semibold">{order.type === "delivery" ? "Delivery" : order.type === "pickup" ? "Retirada" : "Salão"}</span><span className="block text-xs">{order.payment === "pix" ? "Pix" : order.payment === "cash" ? "Dinheiro" : "Cartão"} · {money(order.total)}</span></span><span className="inline-flex w-fit rounded-full bg-[#f2f4f0] px-2.5 py-1 text-xs font-bold">{statusLabel(order.status)}</span><div className="flex items-center gap-2"><select value={order.status} onChange={(event) => onStatus(order.id, event.target.value as OrderStatus)} className="h-9 min-w-0 flex-1 rounded-lg border border-[#dfe3dd] bg-white px-2 text-xs font-semibold"><option value="new">Novo</option><option value="confirmed">Confirmado</option><option value="preparing">Em preparo</option><option value="ready">Pronto</option><option value="awaiting_driver">Aguardando entregador</option><option value="out_for_delivery">Em entrega</option><option value="delivered">Entregue</option><option value="canceled">Cancelado</option></select><button type="button" onClick={() => notify(`Impressão do pedido #${order.number} enviada`)} className="grid size-9 place-items-center rounded-lg border border-[#dfe3dd] hover:bg-[#f2f4f0]" aria-label="Imprimir pedido"><FileText className="size-4" /></button></div></div>)}{!filtered.length ? <EmptyState icon={ClipboardList} title="Nenhum pedido encontrado" description="Ajuste os filtros ou aguarde o próximo pedido." /> : null}</div></div></div>;
}

function CatalogPanel({ notify }: { notify: (message: string) => void }) {
  const [products, setProducts] = useState(() => demoProducts.map((product) => ({ ...product })));
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const visible = products.filter((product) => (!query || `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase())) && (selectedCategory === "Todas" || product.category === selectedCategory));
  return <div><SectionHeader eyebrow="Catálogo" title="Cardápio que vende sozinho" description="Gerencie preços, disponibilidade, fotos, tags alimentares, adicionais, combos, horários e canais sem sair desta tela." action="Novo produto" onAction={() => notify("Editor de produto aberto: nome, preço, foto e modificadores")} /><div className="grid gap-3 md:grid-cols-4"><MiniStat label="Produtos ativos" value={`${products.filter((product) => product.available).length}/${products.length}`} helper="Catálogo publicado" /><MiniStat label="Categorias" value={String(categories.length - 1)} helper="Ordenadas para o cliente" /><MiniStat label="Itens em promoção" value="3" helper="2 combos + 1 oferta" /><MiniStat label="CMV médio" value="29,4%" helper="Meta abaixo de 32%" /></div><div className="mt-5 rounded-2xl border border-[#e0e4de] bg-white"><div className="flex flex-col gap-3 border-b border-[#edf0eb] p-4 sm:flex-row"><label className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-[#dfe3dd] px-3 text-sm"><Search className="size-4 text-[#8a938b]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto, SKU ou categoria" className="min-w-0 flex-1 bg-transparent outline-none" /></label><select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="h-10 rounded-lg border border-[#dfe3dd] bg-white px-3 text-sm font-semibold"><option>Todas</option>{categories.slice(1).map((category) => <option key={category}>{category}</option>)}</select><button type="button" onClick={() => notify("Editor em massa: selecione produtos e aplique +10%, disponibilidade ou categoria")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#dfe3dd] px-3 text-xs font-bold"><RefreshCcw className="size-3.5" />Edição em massa</button></div><div className="divide-y divide-[#edf0eb]">{visible.map((product) => <div key={product.id} className="grid gap-3 px-4 py-3.5 sm:grid-cols-[44px_1fr_130px_130px_130px] sm:items-center"><img src={product.image} alt="" className="size-11 rounded-lg object-cover" /><span className="min-w-0"><span className="block truncate text-sm font-bold">{product.name}</span><span className="block truncate text-xs text-[#7b857d]">{product.category} · {product.modifierGroups?.length ?? 0} grupos de adicionais</span></span><span className="text-sm font-bold">{money(product.price)}<span className="block text-[11px] font-normal text-[#7b857d]">CMV {product.name.includes("Pizza") ? "31%" : "27%"}</span></span><button type="button" onClick={() => { setProducts((current) => current.map((item) => item.id === product.id ? { ...item, available: !item.available } : item)); notify(`${product.name} ${product.available ? "marcado como indisponível" : "reaberto"}`); }} className={"inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold " + (product.available ? "bg-[#eaf5e6] text-[#477340]" : "bg-[#fff0ed] text-[#a94d3e]")}><span className={"size-1.5 rounded-full " + (product.available ? "bg-[#69ae5d]" : "bg-[#d7725c]")} />{product.available ? "Disponível" : "Indisponível"}</button><button type="button" onClick={() => notify(`Editando ${product.name}: preço, foto, ingredientes e regras`)} className="h-9 rounded-lg border border-[#dfe3dd] px-3 text-xs font-bold text-[#5e685f] hover:bg-[#f5f6f3]">Editar</button></div>)}</div></div></div>;
}

function CustomersPanel({ notify }: { notify: (message: string) => void }) {
  const customers = [{ name: "Ana Martins", contact: "(11) 99811-0042", segment: "VIP", orders: 18, spent: 1248, last: "Hoje" }, { name: "Rafael Lima", contact: "(11) 99722-1870", segment: "Recorrente", orders: 9, spent: 612, last: "Hoje" }, { name: "Bia Torres", contact: "(11) 99444-0130", segment: "Novo", orders: 1, spent: 60, last: "Hoje" }, { name: "Matheus Costa", contact: "(11) 99338-3211", segment: "Em risco", orders: 7, spent: 438, last: "34 dias" }, { name: "Camila Souza", contact: "(11) 99127-4421", segment: "Inativo", orders: 12, spent: 814, last: "72 dias" }];
  return <div><SectionHeader eyebrow="Relacionamento" title="Conheça cada cliente e faça a próxima venda" description="Segmentos, histórico, ticket, preferências, endereços e consentimento de marketing em uma visão única." action="Importar clientes" onAction={() => notify("Importador CSV/XLSX pronto para mapear nome, telefone e consentimento")} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Clientes cadastrados" value="2.486" helper="+84 nos últimos 30 dias" icon={UsersRound} tone="purple" /><MetricCard label="Recorrência" value="42,8%" helper="+6,4 pts no trimestre" icon={RefreshCcw} tone="green" /><MetricCard label="Ticket médio" value="R$ 58,40" helper="VIP: R$ 94,20" icon={BarChart3} /><MetricCard label="Cashback em aberto" value="R$ 1.842" helper="Expira em até 30 dias" icon={Heart} tone="orange" /></div><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => notify("Segmento VIP selecionado")} className="rounded-full bg-[#202823] px-3 py-2 text-xs font-bold text-white">VIP · 128</button><button type="button" onClick={() => notify("Segmento em risco selecionado")} className="rounded-full border border-[#e6c98d] bg-[#fff8e8] px-3 py-2 text-xs font-bold text-[#8b6728]">Em risco · 342</button><button type="button" onClick={() => notify("Segmento inativo selecionado")} className="rounded-full border border-[#dfe3dd] bg-white px-3 py-2 text-xs font-bold text-[#687069]">Inativos 60d · 516</button><button type="button" onClick={() => notify("Campanha de recompra criada")} className="rounded-full border border-[#dfe3dd] bg-white px-3 py-2 text-xs font-bold text-[#687069]"><Plus className="mr-1 inline size-3" />Novo segmento</button></div><div className="mt-4 overflow-hidden rounded-2xl border border-[#e0e4de] bg-white"><div className="flex items-center justify-between border-b border-[#edf0eb] p-4"><p className="text-sm font-semibold">Base de clientes</p><button type="button" onClick={() => notify("Exportação de clientes respeitando consentimentos preparada")} className="inline-flex items-center gap-2 text-xs font-bold text-[#a76225]"><Download className="size-3.5" />Exportar</button></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[#f7f8f5] text-xs text-[#7a847c]"><tr><th className="px-4 py-3 font-semibold">Cliente</th><th className="px-4 py-3 font-semibold">Segmento</th><th className="px-4 py-3 font-semibold">Pedidos</th><th className="px-4 py-3 font-semibold">Gasto total</th><th className="px-4 py-3 font-semibold">Último pedido</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-[#edf0eb]">{customers.map((customer) => <tr key={customer.contact}><td className="px-4 py-3"><span className="block font-bold">{customer.name}</span><span className="block text-xs text-[#7b857d]">{customer.contact}</span></td><td className="px-4 py-3"><span className={"rounded-full px-2 py-1 text-[11px] font-bold " + (customer.segment === "VIP" ? "bg-[#eeeaf7] text-[#6e5794]" : customer.segment === "Em risco" || customer.segment === "Inativo" ? "bg-[#fff3df] text-[#956125]" : "bg-[#eaf5e6] text-[#477340]")}>{customer.segment}</span></td><td className="px-4 py-3 font-semibold">{customer.orders}</td><td className="px-4 py-3 font-semibold">{money(customer.spent)}</td><td className="px-4 py-3 text-[#667068]">{customer.last}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => notify(`Perfil de ${customer.name} aberto com histórico e favoritos`)} className="rounded-lg p-2 hover:bg-[#f2f4f0]" aria-label={"Ver " + customer.name}><ChevronRight className="size-4" /></button></td></tr>)}</tbody></table></div></div></div>;
}

function DeliveryPanel({ orders, notify }: { orders: DemoOrder[]; notify: (message: string) => void }) {
  const deliveryOrders = orders.filter((order) => order.type === "delivery" && order.status !== "delivered");
  return <div><SectionHeader eyebrow="Logística" title="Despache com clareza e menos espera" description="Veja pedidos prontos, entregadores, regiões, taxa, distância e agrupamentos antes de sair para a rua." action="Cadastrar entregador" onAction={() => notify("Cadastro de entregador: documentos, veículo e disponibilidade")} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Em entrega" value={String(deliveryOrders.length)} helper="1 aguardando coleta" icon={Truck} tone="purple" /><MetricCard label="Tempo médio" value="27 min" helper="-4 min vs. ontem" icon={Clock3} tone="green" /><MetricCard label="Taxas hoje" value="R$ 184,00" helper="R$ 6,13 por pedido" icon={CircleDollarSign} /><MetricCard label="Área atendida" value="8,2 km" helper="3 zonas ativas" icon={Activity} tone="orange" /></div><div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><article className="rounded-2xl border border-[#e0e4de] bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Fila de despacho</p><p className="mt-1 text-sm text-[#727b73]">Agrupe rotas sem comprometer o SLA.</p></div><button type="button" onClick={() => notify("Modo mapa aberto com zonas, endereços e rotas")} className="inline-flex items-center gap-1 text-xs font-bold text-[#a76225]">Ver mapa <ChevronRight className="size-3.5" /></button></div><div className="mt-4 space-y-3">{deliveryOrders.map((order, index) => <div key={order.id} className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3"><span className="grid size-9 place-items-center rounded-lg bg-[#eeeaf7] text-xs font-bold text-[#6e5794]">#{order.number}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{order.customerName}</span><span className="block truncate text-xs text-[#7b857d]">{index === 0 ? "Centro · 1,8 km" : "Jardim Europa · 3,4 km"}</span></span><span className="text-right"><span className="block text-xs font-bold">{order.status === "ready" ? "Pronto" : "Em preparo"}</span><span className="block text-[11px] text-[#7b857d]">{order.elapsed}</span></span><button type="button" onClick={() => notify(`Pedido #${order.number} atribuído ao entregador disponível`)} className="h-8 rounded-lg bg-[#202823] px-2.5 text-[11px] font-bold text-white">Atribuir</button></div>)}{!deliveryOrders.length ? <EmptyState icon={Truck} title="Nenhuma entrega pendente" description="Quando um pedido sair, ele aparecerá aqui." /> : null}</div></article><article className="rounded-2xl border border-[#e0e4de] bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Zonas de entrega</p><p className="mt-1 text-sm text-[#727b73]">Taxas e mínimos por região.</p></div><button type="button" onClick={() => notify("Nova zona: bairro, distância ou polígono")} className="grid size-8 place-items-center rounded-lg border border-[#dfe3dd]"><Plus className="size-4" /></button></div><div className="mt-4 space-y-3">{[["Centro", "0–2 km", "R$ 5,00", "R$ 20"], ["Jardim Europa", "2–5 km", "R$ 7,00", "R$ 30"], ["Vila Madalena", "5–8 km", "R$ 12,00", "R$ 40"]].map(([zone, distance, fee, minimum]) => <div key={zone} className="flex items-center gap-3 rounded-xl bg-[#f7f8f5] p-3"><span className="grid size-8 place-items-center rounded-lg bg-white text-[#a76225]"><Truck className="size-4" /></span><span className="flex-1"><span className="block text-sm font-bold">{zone}</span><span className="block text-xs text-[#7b857d]">{distance} · mínimo {minimum}</span></span><span className="text-sm font-bold">{fee}</span><button type="button" className="rounded-lg p-1.5 hover:bg-white" aria-label={"Editar zona " + zone}><MoreHorizontal className="size-4" /></button></div>)}</div></article></div></div>;
}

function InventoryPanel({ notify }: { notify: (message: string) => void }) {
  const items = [{ name: "Muçarela fior di latte", unit: "kg", current: 7.4, minimum: 10, cost: 34.9, supplier: "Laticínios Serra" }, { name: "Carne smash 90g", unit: "un", current: 184, minimum: 80, cost: 3.1, supplier: "Frigorífico Prime" }, { name: "Bacon fatiado", unit: "kg", current: 2.8, minimum: 4, cost: 29.9, supplier: "Frios Paulista" }, { name: "Farinha italiana", unit: "kg", current: 42, minimum: 20, cost: 8.2, supplier: "Moinho 27" }, { name: "Coca-Cola lata", unit: "un", current: 18, minimum: 36, cost: 3.6, supplier: "Distribuidora Norte" }];
  return <div><SectionHeader eyebrow="Back office" title="Estoque, ficha técnica e margem" description="Saiba o que está acabando, quanto cada produto consome e onde sua margem está escapando." action="Nova compra" onAction={() => notify("Entrada de compra criada com fornecedor e vencimento")} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Valor em estoque" value="R$ 18.420" helper="+4,2% este mês" icon={Boxes} tone="purple" /><MetricCard label="Alertas ativos" value="6" helper="2 críticos para hoje" icon={Activity} tone="orange" /><MetricCard label="CMV do período" value="29,4%" helper="Meta: até 32%" icon={BarChart3} tone="green" /><MetricCard label="Compras no mês" value="R$ 7.840" helper="8 fornecedores" icon={FileText} /></div><div className="mt-5 overflow-hidden rounded-2xl border border-[#e0e4de] bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0eb] p-4"><div><p className="text-sm font-semibold">Insumos monitorados</p><p className="mt-1 text-sm text-[#727b73]">Baixa automática pela ficha técnica ao vender.</p></div><div className="flex gap-2"><button type="button" onClick={() => notify("Filtro de estoque baixo aplicado")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e6c98d] bg-[#fff8e8] px-3 text-xs font-bold text-[#8b6728]"><Activity className="size-3.5" />Baixo estoque</button><button type="button" onClick={() => notify("Movimentações exportadas")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dfe3dd] px-3 text-xs font-bold"><Download className="size-3.5" />Exportar</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f7f8f5] text-xs text-[#7a847c]"><tr><th className="px-4 py-3">Insumo</th><th className="px-4 py-3">Saldo</th><th className="px-4 py-3">Mínimo</th><th className="px-4 py-3">Custo unitário</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-[#edf0eb]">{items.map((item) => { const low = item.current < item.minimum; return <tr key={item.name}><td className="px-4 py-3 font-bold">{item.name}<span className="block text-xs font-normal text-[#7b857d]">Ficha técnica vinculada</span></td><td className="px-4 py-3"><span className={"font-bold " + (low ? "text-[#b55a43]" : "text-[#435c47]")}>{item.current} {item.unit}</span>{low ? <span className="ml-2 rounded-full bg-[#fff0ed] px-2 py-1 text-[10px] font-bold text-[#a94d3e]">Comprar</span> : null}</td><td className="px-4 py-3 text-[#687069]">{item.minimum} {item.unit}</td><td className="px-4 py-3 font-semibold">{money(item.cost)}</td><td className="px-4 py-3 text-[#687069]">{item.supplier}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => notify(`Movimentação de ${item.name} registrada`)} className="rounded-lg p-2 hover:bg-[#f2f4f0]" aria-label={"Registrar movimentação de " + item.name}><Plus className="size-4" /></button></td></tr>; })}</tbody></table></div></div></div>;
}

function FinancePanel({ revenue, notify }: { revenue: number; notify: (message: string) => void }) {
  return <div><SectionHeader eyebrow="Controle financeiro" title="Feche o dia sabendo exatamente o que entrou" description="Caixa, recebimentos, taxas, descontos, despesas, contas a pagar e margem em uma visão preparada para conciliação." action="Lançar despesa" onAction={() => notify("Despesa lançada com categoria, vencimento e comprovante")} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Receita bruta" value={money(revenue)} helper="Hoje · 32 pedidos" icon={CircleDollarSign} tone="green" /><MetricCard label="Recebido" value="R$ 1.762,40" helper="92% conciliado" icon={CheckCircle2} tone="purple" /><MetricCard label="Taxas e descontos" value="R$ 148,20" helper="8,4% da receita" icon={Percent} tone="orange" /><MetricCard label="Resultado estimado" value="R$ 1.028,60" helper="Margem 58,3%" icon={BarChart3} tone="green" /></div><div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]"><article className="rounded-2xl border border-[#e0e4de] bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Caixa do turno</p><p className="mt-1 text-sm text-[#727b73]">Centro · aberto às 17:02</p></div><span className="rounded-full bg-[#eaf5e6] px-2.5 py-1 text-[11px] font-bold text-[#477340]">Aberto</span></div><div className="mt-5 rounded-xl bg-[#f7f8f5] p-4"><p className="text-xs text-[#7b857d]">Saldo esperado</p><p className="mt-1 text-2xl font-semibold">R$ 840,00</p><p className="mt-1 text-xs text-[#56814f]">+ R$ 240,00 desde a última sangria</p></div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => notify("Sangria registrada no caixa")} className="h-10 rounded-lg border border-[#dfe3dd] text-xs font-bold">Sangria</button><button type="button" onClick={() => notify("Fechamento iniciado: confira dinheiro, Pix e cartões")} className="h-10 rounded-lg bg-[#202823] text-xs font-bold text-white">Fechar caixa</button></div></article><article className="rounded-2xl border border-[#e0e4de] bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Recebimentos por método</p><p className="mt-1 text-sm text-[#727b73]">Inclui conciliação de gateway.</p></div><button type="button" onClick={() => notify("Relatório financeiro exportado")} className="inline-flex items-center gap-1 text-xs font-bold text-[#a76225]"><Download className="size-3.5" />CSV</button></div><div className="mt-5 space-y-4">{[["Pix", "R$ 1.046,30", 62, "bg-[#6e5794]"], ["Cartão", "R$ 634,80", 38, "bg-[#d9762a]"], ["Dinheiro", "R$ 174,20", 16, "bg-[#6ca05f]"]].map(([label, value, percent, color]) => <div key={label}><div className="mb-1.5 flex justify-between text-sm"><span className="font-semibold">{label}</span><span className="font-bold">{value}</span></div><div className="h-2 rounded-full bg-[#edf0eb]"><span className={"block h-full rounded-full " + color} style={{ width: `${percent}%` }} /></div></div>)}</div></article></div></div>;
}

function MarketingPanel({ notify }: { notify: (message: string) => void }) {
  return <div><SectionHeader eyebrow="Receita e retenção" title="Promoções que trazem o cliente de volta" description="Cupons, cashback, pontos, selos, combos, horário feliz e recuperação de carrinho com consentimento LGPD." action="Criar campanha" onAction={() => notify("Editor de campanha aberto com público, canal, período e limite")} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Receita de campanhas" value="R$ 8.420" helper="+18,2% no período" icon={Tag} tone="green" /><MetricCard label="Cashback resgatado" value="R$ 642" helper="36% dos clientes ativos" icon={Heart} tone="purple" /><MetricCard label="Carrinhos recuperáveis" value="84" helper="R$ 4.260 em potencial" icon={RefreshCcw} tone="orange" /><MetricCard label="Opt-in marketing" value="68%" helper="Base com consentimento" icon={ShieldCheck} /></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><article className="rounded-2xl border border-[#e0e4de] bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Campanhas ativas</p><p className="mt-1 text-sm text-[#727b73]">Regras e desempenho em tempo real.</p></div><button type="button" onClick={() => notify("Nova campanha pronta: primeira compra, aniversário ou recompra")} className="grid size-8 place-items-center rounded-lg border border-[#dfe3dd]"><Plus className="size-4" /></button></div><div className="mt-4 space-y-3">{[["BEMVINDO10", "10% na primeira compra", "124 usos", "bg-[#eaf5e6] text-[#477340]"], ["VOLTE5", "R$ 5 de cashback", "68 usos", "bg-[#eeeaf7] text-[#6e5794]"], ["HAPPYHOUR", "Bebida grátis · 17h–19h", "Ativa hoje", "bg-[#fff3df] text-[#956125]"]].map(([code, description, result, tone]) => <div key={code} className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3"><span className={"grid size-9 place-items-center rounded-lg text-xs font-black " + tone}><Tag className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{code}</span><span className="block truncate text-xs text-[#7b857d]">{description} · {result}</span></span><button type="button" onClick={() => notify(`Cupom ${code} editado`)} className="rounded-lg p-1.5 hover:bg-[#f2f4f0]"><MoreHorizontal className="size-4" /></button></div>)}</div></article><article className="rounded-2xl border border-[#e0e4de] bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Funil de venda</p><p className="mt-1 text-sm text-[#727b73]">Onde o cliente desiste e onde recuperar.</p></div><BarChart3 className="size-4 text-[#8a938b]" /></div><div className="mt-5 space-y-3">{[["Visitou o cardápio", "100%", "bg-[#dfe9dd]"], ["Viu um produto", "71%", "bg-[#c2d9bc]"], ["Adicionou ao carrinho", "38%", "bg-[#e3c584]"], ["Finalizou", "24%", "bg-[#d9762a]"]].map(([label, value, color]) => <div key={label}><div className="mb-1.5 flex justify-between text-xs font-semibold"><span>{label}</span><span>{value}</span></div><div className="h-2 rounded-full bg-[#edf0eb]"><span className={"block h-full rounded-full " + color} style={{ width: value }} /></div></div>)}<button type="button" onClick={() => notify("Automação de carrinho abandonado configurada para 30 minutos")} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#202823] text-xs font-bold text-white"><MessageIcon />Ativar recuperação automática</button></div></article></div></div>;
}

function TeamPanel({ notify }: { notify: (message: string) => void }) {
  const users = [["Ana Martins", "Proprietária", "Tudo", "Ativa"], ["Carlos Oliveira", "Gerente", "Operação + relatórios", "Ativa"], ["Julia Santos", "Cozinha", "KDS + pedidos", "Ativa"], ["Pedro Lima", "Entregador", "Entregas atribuídas", "Offline"]];
  return <div><SectionHeader eyebrow="Controle de acesso" title="Cada pessoa vê só o que precisa" description="RBAC por função, permissões individuais, convite seguro, trilha de auditoria e troca de unidade." action="Convidar pessoa" onAction={() => notify("Convite enviado com função, unidade e permissões personalizadas")} /><div className="grid gap-3 md:grid-cols-3"><MiniStat label="Pessoas na equipe" value="12" helper="8 ativas agora" /><MiniStat label="Perfis personalizados" value="4" helper="Além dos papéis padrão" /><MiniStat label="Ações auditadas" value="248" helper="Últimas 24 horas" /></div><div className="mt-5 overflow-hidden rounded-2xl border border-[#e0e4de] bg-white"><div className="flex items-center justify-between border-b border-[#edf0eb] p-4"><p className="text-sm font-semibold">Equipe da unidade Centro</p><button type="button" onClick={() => notify("Logs de auditoria abertos")} className="inline-flex items-center gap-2 text-xs font-bold text-[#a76225]"><FileText className="size-3.5" />Ver auditoria</button></div><div className="divide-y divide-[#edf0eb]">{users.map(([name, role, access, status]) => <div key={name} className="flex items-center gap-3 px-4 py-3.5"><span className="grid size-9 place-items-center rounded-full bg-[#e5eee3] text-xs font-black text-[#4e7650]">{name.split(" ").map((word) => word[0]).join("")}</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{name}</span><span className="block truncate text-xs text-[#7b857d]">{role} · {access}</span></span><span className={"rounded-full px-2 py-1 text-[11px] font-bold " + (status === "Ativa" ? "bg-[#eaf5e6] text-[#477340]" : "bg-[#f2f4f0] text-[#687069]")}>{status}</span><button type="button" onClick={() => notify(`Permissões de ${name} abertas`)} className="rounded-lg p-2 hover:bg-[#f2f4f0]" aria-label={"Editar " + name}><MoreHorizontal className="size-4" /></button></div>)}</div></div></div>;
}

function SettingsPanel({ storeOpen, deliveryPaused, notify }: { storeOpen: boolean; deliveryPaused: boolean; notify: (message: string) => void }) {
  const rows = [["Loja e identidade", "Logo, cores, domínio e horários", true], ["Canais de venda", "Delivery, retirada, QR Code e balcão", true], ["Pagamentos", "Pix, cartão, dinheiro e webhooks", true], ["Impressão", "Cozinha, bar, etiquetas e comprovantes", false], ["Integrações", "WhatsApp, mapas, fiscal e analytics", false]] as const;
  return <div><SectionHeader eyebrow="Operação" title="Configurações que acompanham seu negócio" description="Centralize marca, canais, pagamentos, dispositivos, integrações, LGPD e preferências de notificação." action="Salvar alterações" onAction={() => notify("Configurações salvas com trilha de auditoria")} /><div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]"><article className="rounded-2xl border border-[#e0e4de] bg-white p-5"><p className="text-sm font-semibold">Módulos da unidade</p><div className="mt-4 divide-y divide-[#edf0eb]">{rows.map(([label, description, configured]) => <div key={label} className="flex items-center gap-3 py-3.5"><span className="grid size-9 place-items-center rounded-lg bg-[#f2f4f0] text-[#67736a]"><Settings2 className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{label}</span><span className="block text-xs text-[#7b857d]">{description}</span></span><span className={"rounded-full px-2 py-1 text-[11px] font-bold " + (configured ? "bg-[#eaf5e6] text-[#477340]" : "bg-[#fff3df] text-[#956125]")}>{configured ? "Configurado" : "Conectar"}</span><button type="button" onClick={() => notify(`${label}: configurações abertas`)} className="rounded-lg p-2 hover:bg-[#f2f4f0]"><ChevronRight className="size-4" /></button></div>)}</div></article><article className="rounded-2xl border border-[#e0e4de] bg-white p-5"><p className="text-sm font-semibold">Status ao vivo</p><div className="mt-4 space-y-3">{[["Loja pública", storeOpen ? "Aberta" : "Fechada", storeOpen], ["Delivery", deliveryPaused ? "Pausado" : "Aceitando", !deliveryPaused], ["Supabase", "Modo demonstração", false], ["Realtime", "Pronto para conectar", false]].map(([label, value, active]) => <div key={String(label)} className="flex items-center justify-between rounded-xl bg-[#f7f8f5] p-3"><span className="text-sm font-semibold">{label}</span><span className={"inline-flex items-center gap-1.5 text-xs font-bold " + (active ? "text-[#477340]" : "text-[#9a6a2d]")}><span className={"size-1.5 rounded-full " + (active ? "bg-[#69ae5d]" : "bg-[#d6a04c]")} />{value}</span></div>)}</div><div className="mt-4 rounded-xl border border-[#dfe3dd] p-3 text-xs leading-5 text-[#69736a]"><Link2 className="mr-1 inline size-3.5" />Conecte o gateway, WhatsApp Cloud API e impressoras por adapters. As credenciais ficam somente no servidor.</div></article></div></div>;
}

function QuickAction({ label, icon: Icon, onClick, primary = false }: { label: string; icon: typeof Activity; onClick: () => void; primary?: boolean }) { return <button type="button" onClick={onClick} className={"flex h-11 items-center justify-between rounded-xl px-3.5 text-sm font-bold " + (primary ? "bg-[#202823] text-white hover:bg-[#35463c]" : "border border-[#dfe3dd] text-[#4f5b52] hover:bg-[#f5f6f3]")}><span className="flex items-center gap-2"><Icon className="size-4" />{label}</span><ChevronRight className="size-4" /></button>; }
function MiniStat({ label, value, helper }: { label: string; value: string; helper: string }) { return <article className="rounded-xl border border-[#e0e4de] bg-white p-4"><p className="text-xs font-semibold text-[#7b857d]">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-[#56814f]">{helper}</p></article>; }
function AlertCard({ label, value, helper, icon: Icon, tone, onClick }: { label: string; value: string; helper: string; icon: typeof Activity; tone: "orange" | "purple" | "green"; onClick: () => void }) { const colors = { orange: "bg-[#fff3df] text-[#956125]", purple: "bg-[#eeeaf7] text-[#6e5794]", green: "bg-[#eaf5e6] text-[#477340]" }; return <button type="button" onClick={onClick} className="rounded-2xl border border-[#e0e4de] bg-white p-4 text-left hover:border-[#c6d4c7]"><span className={"grid size-8 place-items-center rounded-lg " + colors[tone]}><Icon className="size-4" /></span><p className="mt-3 text-xs font-semibold text-[#7b857d]">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-[#727b73]">{helper}</p></button>; }
function EmptyState({ icon: Icon, title, description }: { icon: typeof Activity; title: string; description: string }) { return <div className="grid place-items-center gap-2 p-10 text-center"><span className="grid size-10 place-items-center rounded-xl bg-[#f2f4f0] text-[#839087]"><Icon className="size-5" /></span><p className="text-sm font-bold">{title}</p><p className="text-xs text-[#7b857d]">{description}</p></div>; }
function ZapIcon() { return <Activity className="size-4 text-[#8a938b]" />; }
function MessageIcon() { return <Bell className="size-4" />; }
function statusLabel(status: OrderStatus) { return ({ new: "Novo", confirmed: "Confirmado", preparing: "Em preparo", ready: "Pronto", awaiting_driver: "Aguardando entregador", out_for_delivery: "Em entrega", delivered: "Entregue", canceled: "Cancelado" })[status]; }

