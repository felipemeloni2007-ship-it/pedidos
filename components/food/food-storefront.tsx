"use client";

import {
  ArrowRight,
  Check,
  Clock3,
  CreditCard,
  Heart,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  categories,
  demoProducts,
  demoStore,
} from "@/lib/food/demo-data";
import {
  describeSelections,
  formatBRL,
  getCartSubtotal,
  getLineUnitPrice,
} from "@/lib/food/format";
import {
  persistDemoOrder,
  subscribeToDemoOrders,
} from "@/lib/food/demo-order-store";
import type {
  CartItem,
  OrderStatus,
  PaymentMethod,
  Product,
  ServiceMode,
} from "@/lib/food/types";
import { useStorefrontWebMcp } from "@/lib/food/use-storefront-webmcp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";

const CART_KEY = "mesa-pronta-demo-cart";

const fulfillmentOptions: Array<{
  id: ServiceMode;
  label: string;
  icon: typeof Truck;
}> = [
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "pickup", label: "Retirar", icon: Store },
  { id: "dine_in", label: "No local", icon: ShoppingBag },
];

const progressSteps: Array<{ status: OrderStatus; label: string }> = [
  { status: "new", label: "Recebido" },
  { status: "confirmed", label: "Confirmado" },
  { status: "preparing", label: "Preparando" },
  { status: "ready", label: "Pronto" },
  { status: "out_for_delivery", label: "A caminho" },
  { status: "delivered", label: "Entregue" },
];

function makeInitialSelections(product: Product) {
  return Object.fromEntries(
    (product.modifierGroups ?? []).map((group) => [
      group.id,
      group.required && group.options[0] ? [group.options[0].id] : [],
    ]),
  );
}

function initialOrderId() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now());
}

export function FoodStorefront() {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [serviceMode, setServiceMode] = useState<ServiceMode>("delivery");
  const [address, setAddress] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState(initialOrderId);
  const [isCartHydrated, setIsCartHydrated] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [order, setOrder] = useState<{
    id: string;
    number: number;
    status: OrderStatus;
    total: number;
    isDemo: boolean;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const rawCart = window.localStorage.getItem(CART_KEY);
      if (rawCart) {
        try {
          setCart(JSON.parse(rawCart) as CartItem[]);
        } catch {
          window.localStorage.removeItem(CART_KEY);
        }
      }

      setIsCartHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isCartHydrated) return;
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, isCartHydrated]);

  useEffect(() => {
    if (!order?.isDemo) return;

    return subscribeToDemoOrders((orders) => {
      const updated = orders.find((candidate) => candidate.id === order.id);
      if (!updated) return;

      setOrder((current) =>
        current
          ? { ...current, status: updated.status, total: updated.total }
          : current,
      );
    });
  }, [order?.id, order?.isDemo]);

  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

    return demoProducts.filter((product) => {
      const matchesCategory =
        activeCategory === "Todos" || product.category === activeCategory;
      const searchable = [
        product.name,
        product.shortDescription,
        product.description,
        product.category,
        ...(product.tags ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return matchesCategory && (!normalizedSearch || searchable.includes(normalizedSearch));
    });
  }, [activeCategory, search]);

  const subtotal = getCartSubtotal(cart);
  const deliveryFee = serviceMode === "delivery" ? demoStore.deliveryFee : 0;
  const total = subtotal + deliveryFee;

  const addToCart = useCallback((item: CartItem) => {
    setCart((current) => [...current, item]);
    setCheckoutIdempotencyKey(initialOrderId());
    setSelectedProduct(null);
    toast.success("Adicionado ao seu pedido", {
      description: item.product.name,
    });
  }, []);

  const startCheckout = useCallback(() => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  }, []);

  useStorefrontWebMcp({ addItem: addToCart, startCheckout });

  function updateQuantity(lineId: string, nextQuantity: number) {
    if (nextQuantity <= 0) {
      setCart((current) => current.filter((item) => item.lineId !== lineId));
      setCheckoutIdempotencyKey(initialOrderId());
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.lineId === lineId ? { ...item, quantity: nextQuantity } : item,
      ),
    );
    setCheckoutIdempotencyKey(initialOrderId());
  }

  async function placeOrder(payload: {
    name: string;
    phone: string;
    reference: string;
    payment: PaymentMethod;
    changeFor?: number;
  }) {
    const body = {
      storeSlug: demoStore.slug,
      idempotencyKey: checkoutIdempotencyKey,
      fulfillment: serviceMode,
      customer: {
        name: payload.name,
        phone: payload.phone,
        address: serviceMode === "delivery" ? address : undefined,
        reference: payload.reference || undefined,
      },
      payment: {
        method: payload.payment,
        changeFor: payload.changeFor,
      },
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        selections: item.selectedOptions,
        note: item.note,
      })),
    };

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = (await response.json()) as {
      id?: string;
      number?: number;
      total?: number;
      status?: OrderStatus;
      isDemo?: boolean;
      error?: string;
    };

    if (!response.ok || !result.id || !result.number || !result.total) {
      throw new Error(result.error ?? "Não foi possível enviar seu pedido.");
    }

    if (result.isDemo) {
      persistDemoOrder({
        id: result.id,
        number: result.number,
        customerName: payload.name,
        customerPhone: payload.phone,
        createdAt: new Intl.DateTimeFormat("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
        status: result.status ?? "new",
        type: serviceMode,
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          modifiers: describeSelections(item.product, item.selectedOptions),
          note: item.note,
        })),
        total: result.total,
        payment: payload.payment,
        elapsed: "agora",
      });
    }

    setOrder({
      id: result.id,
      number: result.number,
      total: result.total,
      status: result.status ?? "new",
      isDemo: Boolean(result.isDemo),
    });
    setCart([]);
    setCheckoutIdempotencyKey(initialOrderId());
    setIsCheckoutOpen(false);
    setIsCartOpen(false);
    toast.success("Pedido enviado para o Forno 27.");
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#25231f]">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#f7f6f2]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Forno 27">
            <span className="grid size-9 place-items-center rounded-xl bg-[#1f2421] text-sm font-black tracking-tight text-[#f5b83e]">
              27
            </span>
            <span>
              <span className="block font-semibold leading-4">Forno 27</span>
              <span className="block text-[11px] font-medium text-[#78746c]">
                Pizza & Smash
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-2 text-sm sm:flex">
            <Link
              href="/admin"
              className="rounded-full px-3 py-2 font-medium text-[#5c574f] transition hover:bg-white"
            >
              Painel
            </Link>
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#1f2421] px-3.5 py-2 font-semibold text-white transition hover:bg-[#373d38]"
            >
              <ShoppingBag className="size-4" />
              {cart.length ? formatBRL(total) : "Seu pedido"}
            </button>
          </div>
        </div>
      </header>

      {order ? (
        <OrderTracking
          order={order}
          onContinue={() => setOrder(null)}
          onSimulateAdvance={() =>
            setOrder((current) =>
              current
                ? {
                    ...current,
                    status: nextStatus(current.status),
                  }
                : current,
            )
          }
        />
      ) : (
        <>
          <section className="mx-auto max-w-6xl px-4 pb-5 pt-4 sm:px-6 sm:pt-6">
            <div className="overflow-hidden rounded-[28px] bg-[#1f2421] text-white shadow-[0_18px_50px_rgba(29,32,30,0.18)]">
              <div className="grid min-h-[238px] md:grid-cols-[1.1fr_0.9fr]">
                <div className="flex flex-col justify-between p-5 sm:p-8">
                  <div className="flex items-center gap-2 text-sm text-[#e9e6dd]">
                    <span className="flex size-2 rounded-full bg-[#9bd57f]" />
                    Aberto agora · {demoStore.deliveryMinutes}
                  </div>
                  <div className="max-w-lg">
                    <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#f5b83e]">
                      Feito no fogo, servido no tempo certo
                    </p>
                    <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                      Seu pedido merece sair do forno, não da fila.
                    </h1>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-[#dad8d0]">
                    <span className="flex items-center gap-1.5">
                      <Star className="size-4 fill-[#f5b83e] text-[#f5b83e]" />
                      4,9
                    </span>
                    <span>+2.400 avaliações</span>
                  </div>
                </div>
                <div className="relative min-h-[220px] overflow-hidden">
                  <img
                    src="/images/forno27-margherita.png"
                    alt="Pizza Margherita recém-assada"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#1f2421]/50 via-transparent to-transparent md:bg-gradient-to-l" />
                  <span className="absolute bottom-4 right-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#292722] shadow-sm">
                    Fermentação longa · 48h
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="rounded-2xl border border-black/[0.07] bg-white p-2 shadow-sm">
              <div className="grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-center">
                <div className="flex overflow-x-auto rounded-xl bg-[#f3f1ec] p-1 scrollbar-none">
                  {fulfillmentOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = serviceMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setServiceMode(option.id)}
                        className={
                          "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition " +
                          (isActive
                            ? "bg-white text-[#222521] shadow-sm"
                            : "text-[#77736b] hover:text-[#3d3a34]")
                        }
                      >
                        <Icon className="size-4" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <label className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 text-sm text-[#5f5b54]">
                  <MapPin className="size-4 shrink-0 text-[#c67228]" />
                  <input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder={
                      serviceMode === "delivery"
                        ? "Digite seu endereço para ver entrega e taxa"
                        : "Forno 27 · Rua das Palmeiras, 27"
                    }
                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#aaa69d]"
                    aria-label="Endereço de entrega"
                  />
                  {serviceMode === "delivery" && address ? (
                    <span className="whitespace-nowrap rounded-md bg-[#edf6e9] px-2 py-1 text-xs font-semibold text-[#3d6c38]">
                      Entregamos aqui
                    </span>
                  ) : null}
                </label>

                <div className="hidden items-center gap-2 pr-2 text-sm md:flex">
                  <Clock3 className="size-4 text-[#c67228]" />
                  <span>{serviceMode === "delivery" ? demoStore.deliveryMinutes : "20–30 min"}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 pb-32 pt-7 sm:px-6">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-[#8b867d]">Cardápio do dia</p>
                <h2 className="text-2xl font-semibold tracking-[-0.035em]">
                  Escolha o seu favorito
                </h2>
              </div>
              <label className="flex h-11 max-w-sm items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3 text-sm shadow-sm sm:w-72">
                <Search className="size-4 text-[#8b867d]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Busque pizza, bacon, brownie..."
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#aaa69d]"
                  aria-label="Buscar no cardápio"
                />
                {search ? (
                  <button
                    type="button"
                    className="rounded-md p-1 hover:bg-[#f5f3ef]"
                    onClick={() => setSearch("")}
                    aria-label="Limpar busca"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </label>
            </div>

            <nav
              aria-label="Categorias do cardápio"
              className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none"
            >
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={
                    "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition " +
                    (activeCategory === category
                      ? "border-[#1f2421] bg-[#1f2421] text-white"
                      : "border-black/[0.08] bg-white text-[#646057] hover:border-black/20")
                  }
                >
                  {category}
                </button>
              ))}
            </nav>

            {visibleProducts.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={() => setSelectedProduct(product)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center">
                <div>
                  <Search className="mx-auto mb-3 size-6 text-[#a29e95]" />
                  <h3 className="font-semibold">Nada encontrado</h3>
                  <p className="mt-1 text-sm text-[#78746c]">
                    Tente buscar por outro ingrediente ou categoria.
                  </p>
                </div>
              </div>
            )}

            <section className="mt-10 rounded-[24px] border border-[#edc974]/45 bg-[#fff9ea] p-5 sm:p-6">
              <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#a65d1c] shadow-sm">
                    <Sparkles className="size-3.5" />
                    Finalize melhor
                  </span>
                  <h2 className="text-xl font-semibold tracking-[-0.025em]">
                    Um pedido completo tem mais sabor.
                  </h2>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-[#71684f]">
                    Adicione batata, bebida ou brownie antes de fechar. O tempo de
                    preparo continua o mesmo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedProduct(
                      demoProducts.find((product) => product.slug === "batata-cheddar") ??
                        null,
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d9762a] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#ba5f1e]"
                >
                  Ver sugestões
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </section>
          </section>
        </>
      )}

      <ProductDialog
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAdd={addToCart}
      />

      <CartSheet
        open={isCartOpen}
        onOpenChange={setIsCartOpen}
        cart={cart}
        serviceMode={serviceMode}
        subtotal={subtotal}
        deliveryFee={deliveryFee}
        total={total}
        onUpdateQuantity={updateQuantity}
        onCheckout={() => {
          if (cart.length) startCheckout();
        }}
      />

      <CheckoutSheet
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        total={total}
        cartLength={cart.length}
        serviceMode={serviceMode}
        address={address}
        onPlaceOrder={placeOrder}
      />

      {cart.length && !order ? (
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="fixed inset-x-4 bottom-4 z-20 flex items-center justify-between rounded-2xl bg-[#1f2421] px-4 py-3.5 text-white shadow-[0_14px_35px_rgba(20,22,20,0.28)] sm:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-6 place-items-center rounded-full bg-white/15 text-xs">
              {cart.length}
            </span>
            Ver pedido
          </span>
          <span className="text-sm font-bold">{formatBRL(total)}</span>
        </button>
      ) : null}
    </main>
  );
}

function ProductCard({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-[22px] border border-black/[0.07] bg-white shadow-[0_5px_18px_rgba(33,31,26,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(33,31,26,0.1)]">
      <div className="relative aspect-[1.35] overflow-hidden bg-[#e7e3dc]">
        <button
          type="button"
          onClick={onSelect}
          className="absolute inset-0 h-full w-full text-left"
          aria-label={"Ver " + product.name}
        >
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            style={{ objectPosition: product.imagePosition ?? "center" }}
          />
          {product.badge ? (
            <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#48443c] shadow-sm">
              {product.badge}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white/90 text-[#625c54] shadow-sm transition hover:text-[#d9762a]"
          aria-label={"Favoritar " + product.name}
          onClick={() => {
            toast.success("Salvo nos favoritos", { description: product.name });
          }}
        >
          <Heart className="size-4" />
        </button>
      </div>
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="p-4">
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold tracking-[-0.015em]">
                {product.name}
              </h3>
              <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-[#78736a]">
                {product.shortDescription}
              </p>
            </div>
            <span className="shrink-0 pt-0.5 font-bold text-[#282722]">
              {formatBRL(product.price)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            {product.tags?.length ? (
              <span className="text-xs font-semibold text-[#5d8154]">{product.tags[0]}</span>
            ) : (
              <span className="text-xs text-[#a39e94]">Feito na hora</span>
            )}
            <span className="inline-flex items-center gap-1 text-sm font-bold text-[#c56c25]">
              Personalizar
              <Plus className="size-4" />
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}

function ProductDialog({
  product,
  onClose,
  onAdd,
}: {
  product: Product | null;
  onClose: () => void;
  onAdd: (item: CartItem) => void;
}) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!product) return;

    const timer = window.setTimeout(() => {
      setSelections(makeInitialSelections(product));
      setQuantity(1);
      setNote("");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [product]);

  if (!product) return null;

  const activeProduct = product;

  const requiredComplete = (product.modifierGroups ?? []).every(
    (group) => (selections[group.id] ?? []).length >= group.min,
  );
  const unitPrice = getLineUnitPrice(product, selections);

  function toggleOption(groupId: string, optionId: string) {
    const group = activeProduct.modifierGroups?.find(
      (candidate) => candidate.id === groupId,
    );
    if (!group) return;

    setSelections((current) => {
      const currentValues = current[groupId] ?? [];
      const includesOption = currentValues.includes(optionId);

      if (group.max === 1) {
        if (includesOption && group.min === 0) {
          return { ...current, [groupId]: [] };
        }
        return { ...current, [groupId]: [optionId] };
      }

      if (includesOption) {
        if (currentValues.length <= group.min) return current;
        return {
          ...current,
          [groupId]: currentValues.filter((value) => value !== optionId),
        };
      }

      if (currentValues.length >= group.max) {
        toast.message("Limite desse grupo atingido");
        return current;
      }

      return { ...current, [groupId]: [...currentValues, optionId] };
    });
  }

  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl gap-0 overflow-y-auto rounded-[26px] border-0 bg-[#f9f8f5] p-0 sm:max-w-2xl">
        <div className="grid sm:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-64 overflow-hidden bg-[#252925] sm:min-h-full">
            <img
              src={product.image}
              alt={product.name}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: product.imagePosition ?? "center" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            <span className="absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-[#34312c]">
              {product.category}
            </span>
          </div>
          <div className="p-5 sm:p-6">
            <DialogHeader className="text-left">
              <DialogTitle className="pr-8 text-2xl tracking-[-0.035em]">
                {product.name}
              </DialogTitle>
              <DialogDescription className="leading-6 text-[#706b62]">
                {product.description}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-5">
              {(product.modifierGroups ?? []).map((group) => (
                <fieldset key={group.id}>
                  <legend className="flex w-full items-center justify-between text-sm font-bold">
                    <span>{group.name}</span>
                    <span className="font-medium text-[#938d82]">
                      {group.required ? "Obrigatório" : "Opcional"}
                    </span>
                  </legend>
                  <div className="mt-2 grid gap-2">
                    {group.options.map((option) => {
                      const selected = selections[group.id]?.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleOption(group.id, option.id)}
                          className={
                            "flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-sm transition " +
                            (selected
                              ? "border-[#d9762a] bg-[#fff5e9] text-[#3a3025]"
                              : "border-black/[0.08] bg-white hover:border-black/20")
                          }
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={
                                "grid size-4 place-items-center rounded-full border " +
                                (selected
                                  ? "border-[#d9762a] bg-[#d9762a] text-white"
                                  : "border-[#c7c1b8] bg-white")
                              }
                            >
                              {selected ? <Check className="size-3" /> : null}
                            </span>
                            {option.name}
                          </span>
                          {option.priceDelta ? (
                            <span className="font-semibold text-[#686258]">
                              + {formatBRL(option.priceDelta)}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}

              <label className="block">
                <span className="text-sm font-bold">Alguma observação?</span>
                <textarea
                  value={note}
                  maxLength={280}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ex.: sem cebola, ponto da carne..."
                  className="mt-2 min-h-20 w-full resize-none rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-[#aaa59c] focus:border-[#d9762a] focus:ring-2 focus:ring-[#f5b83e]/20"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-12 items-center rounded-xl border border-black/[0.08] bg-white">
                <button
                  type="button"
                  className="grid h-full w-10 place-items-center rounded-l-xl text-[#5e5952] hover:bg-[#f7f5f1] disabled:opacity-30"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  disabled={quantity === 1}
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-7 text-center text-sm font-bold">{quantity}</span>
                <button
                  type="button"
                  className="grid h-full w-10 place-items-center rounded-r-xl text-[#5e5952] hover:bg-[#f7f5f1]"
                  onClick={() => setQuantity((current) => current + 1)}
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <button
                type="button"
                disabled={!requiredComplete}
                onClick={() =>
                  onAdd({
                    lineId: initialOrderId(),
                    product,
                    quantity,
                    selectedOptions: selections,
                    note: note.trim() || undefined,
                  })
                }
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1f2421] px-4 text-sm font-bold text-white transition hover:bg-[#373d38] disabled:cursor-not-allowed disabled:bg-[#8d8a84]"
              >
                Adicionar
                <span className="rounded-md bg-white/10 px-1.5 py-0.5">
                  {formatBRL(unitPrice * quantity)}
                </span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CartSheet({
  open,
  onOpenChange,
  cart,
  serviceMode,
  subtotal,
  deliveryFee,
  total,
  onUpdateQuantity,
  onCheckout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  serviceMode: ServiceMode;
  subtotal: number;
  deliveryFee: number;
  total: number;
  onUpdateQuantity: (lineId: string, quantity: number) => void;
  onCheckout: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-0 bg-[#f9f8f5] p-0 sm:max-w-md">
        <SheetHeader className="border-b border-black/[0.07] px-5 pb-4 pt-6">
          <SheetTitle className="text-xl tracking-[-0.025em]">Seu pedido</SheetTitle>
          <SheetDescription>
            Revise seus itens antes de finalizar.
          </SheetDescription>
        </SheetHeader>

        {cart.length ? (
          <div className="flex min-h-[calc(100vh-92px)] flex-col">
            <div className="space-y-4 p-5">
              {cart.map((item) => {
                const selected = describeSelections(item.product, item.selectedOptions);
                return (
                  <article key={item.lineId} className="flex gap-3">
                    <img
                      src={item.product.image}
                      alt=""
                      className="size-[72px] rounded-xl object-cover"
                      style={{ objectPosition: item.product.imagePosition ?? "center" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-3">
                        <h3 className="font-semibold">{item.product.name}</h3>
                        <span className="shrink-0 text-sm font-bold">
                          {formatBRL(
                            getLineUnitPrice(item.product, item.selectedOptions) *
                              item.quantity,
                          )}
                        </span>
                      </div>
                      {selected.length ? (
                        <p className="mt-1 text-xs leading-5 text-[#777169]">
                          {selected.join(" · ")}
                        </p>
                      ) : null}
                      {item.note ? (
                        <p className="mt-1 text-xs italic text-[#8e6a47]">
                          {item.note}
                        </p>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex h-8 items-center rounded-lg border border-black/[0.08] bg-white">
                          <button
                            type="button"
                            className="grid h-full w-8 place-items-center rounded-l-lg hover:bg-[#f4f2ee]"
                            onClick={() => onUpdateQuantity(item.lineId, item.quantity - 1)}
                            aria-label={"Diminuir " + item.product.name}
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            className="grid h-full w-8 place-items-center rounded-r-lg hover:bg-[#f4f2ee]"
                            onClick={() => onUpdateQuantity(item.lineId, item.quantity + 1)}
                            aria-label={"Aumentar " + item.product.name}
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#a05b30] hover:underline"
                          onClick={() => onUpdateQuantity(item.lineId, 0)}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-auto border-t border-black/[0.07] bg-white p-5">
              <div className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between text-[#706b62]">
                  <span>Subtotal</span>
                  <span>{formatBRL(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#706b62]">
                  <span>
                    {serviceMode === "delivery" ? "Entrega" : "Retirada no balcão"}
                  </span>
                  <span>{deliveryFee ? formatBRL(deliveryFee) : "Grátis"}</span>
                </div>
                <div className="flex justify-between border-t border-black/[0.07] pt-3 text-base font-bold text-[#292722]">
                  <span>Total</span>
                  <span>{formatBRL(total)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onCheckout}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d9762a] text-sm font-bold text-white transition hover:bg-[#ba5f1e]"
              >
                Ir para pagamento
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-[60vh] place-items-center p-8 text-center">
            <div>
              <ShoppingBag className="mx-auto mb-3 size-7 text-[#a8a39a]" />
              <h3 className="font-semibold">Sua sacola está vazia</h3>
              <p className="mt-1 text-sm text-[#7e796f]">
                Escolha algo gostoso para começar.
              </p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CheckoutSheet({
  open,
  onOpenChange,
  total,
  cartLength,
  serviceMode,
  address,
  onPlaceOrder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  cartLength: number;
  serviceMode: ServiceMode;
  address: string;
  onPlaceOrder: (payload: {
    name: string;
    phone: string;
    reference: string;
    payment: PaymentMethod;
    changeFor?: number;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [changeFor, setChangeFor] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit() {
    setError("");

    if (!name.trim() || !phone.trim()) {
      setError("Informe seu nome e telefone para acompanhar o pedido.");
      return;
    }

    if (serviceMode === "delivery" && !address.trim()) {
      setError("Digite seu endereço antes de confirmar a entrega.");
      return;
    }

    setIsSaving(true);
    try {
      await onPlaceOrder({
        name: name.trim(),
        phone: phone.trim(),
        reference: reference.trim(),
        payment,
        changeFor: changeFor ? Number(changeFor.replace(",", ".")) : undefined,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível confirmar seu pedido.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-0 bg-[#f9f8f5] p-0 sm:max-w-md">
        <SheetHeader className="border-b border-black/[0.07] px-5 pb-4 pt-6">
          <SheetTitle className="text-xl tracking-[-0.025em]">
            Finalizar em poucos passos
          </SheetTitle>
          <SheetDescription>
            Sem senha, sem cadastro longo. Só o necessário.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          <div className="rounded-xl bg-[#ece9e1] px-3.5 py-3 text-sm">
            <span className="font-bold">{cartLength} item(ns)</span>
            <span className="mx-2 text-[#aaa49a]">·</span>
            <span className="text-[#686258]">
              {serviceMode === "delivery"
                ? "Entrega no endereço informado"
                : serviceMode === "pickup"
                  ? "Retirada no balcão"
                  : "Pedido para consumir no local"}
            </span>
          </div>

          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm font-semibold">
              Seu nome
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Como podemos chamar você?"
                className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-sm font-normal outline-none focus:border-[#d9762a] focus:ring-2 focus:ring-[#f5b83e]/20"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              WhatsApp
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                placeholder="(11) 99999-9999"
                className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-sm font-normal outline-none focus:border-[#d9762a] focus:ring-2 focus:ring-[#f5b83e]/20"
              />
            </label>
            {serviceMode === "delivery" ? (
              <label className="grid gap-1.5 text-sm font-semibold">
                Referência (opcional)
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Apto, portão, ponto de referência..."
                  className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-sm font-normal outline-none focus:border-[#d9762a] focus:ring-2 focus:ring-[#f5b83e]/20"
                />
              </label>
            ) : null}
          </div>

          <fieldset>
            <legend className="text-sm font-bold">Como você quer pagar?</legend>
            <div className="mt-2 grid gap-2">
              {[
                ["pix", "Pix", "Confirmação pelo gateway"],
                ["credit_card", "Cartão", "Pagamento seguro online"],
                ["cash", "Dinheiro", "Pagamento na entrega"],
              ].map(([id, label, description]) => {
                const isSelected = payment === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPayment(id as PaymentMethod)}
                    className={
                      "flex items-center gap-3 rounded-xl border p-3 text-left transition " +
                      (isSelected
                        ? "border-[#d9762a] bg-[#fff5e9]"
                        : "border-black/[0.08] bg-white")
                    }
                  >
                    <span
                      className={
                        "grid size-5 place-items-center rounded-full border " +
                        (isSelected
                          ? "border-[#d9762a] bg-[#d9762a] text-white"
                          : "border-[#c7c1b8]")
                      }
                    >
                      {isSelected ? <Check className="size-3" /> : null}
                    </span>
                    <CreditCard className="size-4 text-[#6c665e]" />
                    <span className="flex-1">
                      <span className="block text-sm font-bold">{label}</span>
                      <span className="block text-xs text-[#847e74]">{description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {payment === "cash" ? (
            <label className="grid gap-1.5 text-sm font-semibold">
              Precisa de troco para quanto?
              <input
                value={changeFor}
                onChange={(event) => setChangeFor(event.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 100,00"
                className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-sm font-normal outline-none focus:border-[#d9762a] focus:ring-2 focus:ring-[#f5b83e]/20"
              />
            </label>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-xl bg-[#fce9e6] px-3 py-2.5 text-sm text-[#a34635]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 border-t border-black/[0.07] bg-white p-5">
          <button
            type="button"
            onClick={submit}
            disabled={isSaving || !cartLength}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1f2421] text-sm font-bold text-white transition hover:bg-[#373d38] disabled:bg-[#8c8982]"
          >
            {isSaving ? "Enviando pedido..." : "Confirmar pedido"}
            <span className="rounded-md bg-white/10 px-1.5 py-0.5">{formatBRL(total)}</span>
          </button>
          <p className="mt-2 text-center text-[11px] text-[#918b82]">
            Seus dados são usados apenas para entregar e acompanhar este pedido.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OrderTracking({
  order,
  onContinue,
  onSimulateAdvance,
}: {
  order: {
    number: number;
    status: OrderStatus;
    total: number;
    isDemo: boolean;
  };
  onContinue: () => void;
  onSimulateAdvance: () => void;
}) {
  const currentStep = Math.max(
    0,
    progressSteps.findIndex((step) => step.status === order.status),
  );

  return (
    <section className="mx-auto grid min-h-[calc(100vh-64px)] max-w-2xl place-items-center px-4 py-10">
      <div className="w-full rounded-[28px] border border-black/[0.07] bg-white p-6 shadow-[0_18px_55px_rgba(30,29,25,0.1)] sm:p-8">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#edf6e9] px-3 py-1 text-xs font-bold text-[#416f3c]">
              <Check className="size-3.5" />
              Pedido recebido
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
              Pedido #{order.number}
            </h1>
            <p className="mt-1 text-sm text-[#747067]">
              {order.isDemo
                ? "Demonstração ativa: o fluxo completo está pronto para o Supabase."
                : "Acompanhe cada etapa por aqui e no WhatsApp."}
            </p>
          </div>
          <span className="rounded-xl bg-[#fbf4e7] px-3 py-2 text-sm font-bold text-[#a55e1e]">
            {formatBRL(order.total)}
          </span>
        </div>

        <ol className="space-y-1">
          {progressSteps.map((step, index) => {
            const isDone = index <= currentStep;
            const isCurrent = index === currentStep;
            return (
              <li key={step.status} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={
                      "grid size-7 place-items-center rounded-full text-xs " +
                      (isDone
                        ? "bg-[#1f2421] text-white"
                        : "bg-[#efede8] text-[#aaa59c]")
                    }
                  >
                    {isDone ? <Check className="size-4" /> : index + 1}
                  </span>
                  {index < progressSteps.length - 1 ? (
                    <span
                      className={
                        "h-8 w-px " + (isDone ? "bg-[#1f2421]" : "bg-[#e7e4de]")
                      }
                    />
                  ) : null}
                </div>
                <div className="pt-1">
                  <p className={"text-sm font-semibold " + (isCurrent ? "text-[#24231f]" : "text-[#777169]")}>
                    {step.label}
                  </p>
                  {isCurrent ? (
                    <p className="mt-0.5 text-xs text-[#8b847a]">
                      Atualização em tempo real.
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onContinue}
            className="h-11 rounded-xl border border-black/[0.09] text-sm font-bold text-[#4d4941] hover:bg-[#f6f4f0]"
          >
            Voltar ao cardápio
          </button>
          {order.isDemo ? (
            <button
              type="button"
              onClick={onSimulateAdvance}
              className="h-11 rounded-xl bg-[#d9762a] text-sm font-bold text-white hover:bg-[#ba5f1e]"
            >
              Avançar demonstração
            </button>
          ) : (
            <Link
              href="/admin/pedidos"
              className="grid h-11 place-items-center rounded-xl bg-[#d9762a] text-sm font-bold text-white hover:bg-[#ba5f1e]"
            >
              Ver operação
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function nextStatus(status: OrderStatus): OrderStatus {
  const sequence: OrderStatus[] = [
    "new",
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
  ];
  const currentIndex = sequence.indexOf(status);
  return sequence[Math.min(sequence.length - 1, currentIndex + 1)] ?? "new";
}
