"use client";

import { useCallback, useEffect, useState } from "react";

import { demoOrders, demoStore, demoTenant } from "@/lib/food/demo-data";
import type { DemoOrder, OrderStatus, PaymentMethod, ServiceMode } from "@/lib/food/types";
import { createClient, hasPublicSupabaseConfig } from "@/lib/supabase/client";

const STORAGE_KEY = "mesa-pronta-demo-orders";
const CHANGE_EVENT = "mesa-pronta-demo-orders-change";

function canUseStorage() {
  return typeof window !== "undefined";
}

function notifyOrdersChanged() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function readDemoOrders(): DemoOrder[] {
  if (!canUseStorage()) return demoOrders;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return demoOrders;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DemoOrder[]) : demoOrders;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return demoOrders;
  }
}

function writeDemoOrders(orders: DemoOrder[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.slice(0, 60)));
  notifyOrdersChanged();
}

export function persistDemoOrder(order: DemoOrder) {
  const next = [order, ...readDemoOrders().filter((item) => item.id !== order.id)];
  writeDemoOrders(next);
}

export function updateDemoOrderStatus(orderId: string, status: OrderStatus) {
  const next = readDemoOrders().map((order) =>
    order.id === orderId ? { ...order, status, elapsed: "agora" } : order,
  );
  writeDemoOrders(next);
  return next;
}

export function subscribeToDemoOrders(onChange: (orders: DemoOrder[]) => void) {
  if (!canUseStorage()) return () => undefined;

  const refresh = () => onChange(readDemoOrders());
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) refresh();
  };

  window.addEventListener(CHANGE_EVENT, refresh);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, refresh);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDemoOperationalOrders() {
  const [orders, setOrders] = useState<DemoOrder[]>(demoOrders);

  useEffect(() => {
    const timer = window.setTimeout(() => setOrders(readDemoOrders()), 0);
    const unsubscribe = subscribeToDemoOrders(setOrders);

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const setOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOrders(updateDemoOrderStatus(orderId, status));
  }, []);

  return { orders, setOrderStatus };
}

type RemoteOrderItem = {
  product_name: string;
  quantity: number | string;
  notes: string | null;
  order_item_modifiers?: Array<{ option_name: string }> | null;
};

type RemoteOrder = {
  id: string;
  display_number: number | string;
  customer_name: string;
  customer_phone_e164: string | null;
  created_at: string;
  status: OrderStatus;
  fulfillment_type: string;
  total_amount: number | string;
  order_items?: RemoteOrderItem[] | null;
  payments?: Array<{ method: string }> | null;
};

function elapsedSince(timestamp: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  return minutes ? `${minutes} min` : "agora";
}

function toDemoOrder(order: RemoteOrder): DemoOrder {
  const fulfillment: ServiceMode =
    order.fulfillment_type === "delivery"
      ? "delivery"
      : order.fulfillment_type === "dine_in"
        ? "dine_in"
        : "pickup";
  const payment = order.payments?.[0]?.method;

  return {
    id: order.id,
    number: Number(order.display_number),
    customerName: order.customer_name,
    customerPhone: order.customer_phone_e164 ?? "",
    createdAt: order.created_at,
    status: order.status,
    type: fulfillment,
    items: (order.order_items ?? []).map((item) => ({
      name: item.product_name,
      quantity: Number(item.quantity),
      modifiers: (item.order_item_modifiers ?? []).map((modifier) => modifier.option_name),
      note: item.notes ?? undefined,
    })),
    total: Number(order.total_amount),
    payment: (payment === "cash" || payment === "credit_card" || payment === "pix"
      ? payment
      : "pix") as PaymentMethod,
    elapsed: elapsedSince(order.created_at),
  };
}

export function useOperationalOrders() {
  const { orders: demoOperationalOrders, setOrderStatus: setDemoOrderStatus } =
    useDemoOperationalOrders();
  const [remoteOrders, setRemoteOrders] = useState<DemoOrder[]>([]);
  const source = hasPublicSupabaseConfig() ? "remote" : "demo";

  const loadRemoteOrders = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, display_number, customer_name, customer_phone_e164, created_at, status, fulfillment_type, total_amount, order_items(product_name, quantity, notes, order_item_modifiers(option_name)), payments(method)",
      )
      .eq("tenant_id", demoTenant.id)
      .eq("store_id", demoStore.id)
      .order("created_at", { ascending: false })
      .limit(80);

    if (!error) {
      setRemoteOrders(((data ?? []) as RemoteOrder[]).map(toDemoOrder));
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      return;
    }

    const initialLoadTimer = window.setTimeout(() => void loadRemoteOrders(), 0);
    const channel = supabase
      .channel(`operational-orders:${demoStore.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${demoStore.id}`,
        },
        () => void loadRemoteOrders(),
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoadTimer);
      void supabase.removeChannel(channel);
    };
  }, [loadRemoteOrders]);

  const setOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      if (source === "demo") {
        setDemoOrderStatus(orderId, status);
        return;
      }

      setRemoteOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, status, elapsed: "agora" } : order,
        ),
      );

      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: demoTenant.id,
          storeId: demoStore.id,
          status,
        }),
      });

      if (!response.ok) {
        await loadRemoteOrders();
      }
    },
    [loadRemoteOrders, setDemoOrderStatus, source],
  );

  return {
    orders: source === "remote" ? remoteOrders : demoOperationalOrders,
    setOrderStatus,
    isRealtime: source === "remote",
  };
}
