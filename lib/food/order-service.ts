import { demoProducts, demoStore } from "@/lib/food/demo-data";
import { getLineUnitPrice, roundMoney } from "@/lib/food/format";
import type { CheckoutOrderInput } from "@/lib/food/checkout-schema";
import type { OrderStatus } from "@/lib/food/types";
import { createServiceRoleClient } from "@/lib/supabase/server";

type CreatedOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  total: number;
  isDemo: boolean;
};

type CheckoutCommandResult = {
  order_id: string;
  display_number: number;
  order_status: OrderStatus;
  total_amount: number | string;
  tracking_token: string;
};

function randomOrderNumber() {
  return Math.floor(1000 + Math.random() * 8999);
}

function createDemoOrder(input: CheckoutOrderInput): CreatedOrder {
  if (input.storeSlug !== demoStore.slug) {
    throw new Error("Esta loja não está disponível na demonstração.");
  }

  const canonicalProducts = input.items.map((item) => {
    const product = demoProducts.find((candidate) => candidate.id === item.productId);

    if (!product || !product.available) {
      throw new Error("Um item do pedido não está mais disponível.");
    }

    return {
      source: item,
      product,
      unitPrice: getLineUnitPrice(product, item.selections),
    };
  });

  const subtotal = roundMoney(
    canonicalProducts.reduce(
      (sum, item) => sum + item.unitPrice * item.source.quantity,
      0,
    ),
  );
  const total = roundMoney(
    subtotal + (input.fulfillment === "delivery" ? demoStore.deliveryFee : 0),
  );

  return {
    id: crypto.randomUUID(),
    number: randomOrderNumber(),
    status: "new",
    total,
    isDemo: true,
  };
}

function checkoutErrorMessage(message: string) {
  if (/outside the delivery area/i.test(message)) {
    return "Este endereço ainda não está dentro da área de entrega.";
  }
  if (/minimum order/i.test(message)) {
    return "O pedido não atingiu o valor mínimo para esta modalidade.";
  }
  if (/product is unavailable|selected modifier/i.test(message)) {
    return "Um item ou complemento ficou indisponível. Atualize o pedido e tente novamente.";
  }
  if (/store is not accepting|fulfillment option is unavailable/i.test(message)) {
    return "A loja não está disponível para este tipo de pedido agora.";
  }
  if (/Invalid customer|Delivery address|Invalid change/i.test(message)) {
    return "Confira seus dados de entrega e pagamento.";
  }
  return "Não foi possível processar o pedido agora. Tente novamente.";
}

export async function createOrder(
  input: CheckoutOrderInput,
): Promise<CreatedOrder> {
  const admin = createServiceRoleClient();
  const hasPublicSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!admin) {
    if (!hasPublicSupabaseConfig || process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      return createDemoOrder(input);
    }

    throw new Error("O checkout seguro ainda não foi configurado para esta loja.");
  }

  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id, tenant_id")
    .eq("public_slug", input.storeSlug)
    .eq("is_storefront_published", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (storeError || !store) {
    throw new Error("A loja não está disponível para receber pedidos.");
  }

  const { data, error } = await admin.rpc("create_checkout_order", {
    p_tenant_id: store.tenant_id,
    p_store_id: store.id,
    p_idempotency_key: input.idempotencyKey,
    p_fulfillment_type: input.fulfillment,
    p_customer: {
      name: input.customer.name,
      phone: input.customer.phone,
      address: input.customer.address ?? null,
      reference: input.customer.reference ?? null,
    },
    p_payment: {
      method: input.payment.method,
      changeFor: input.payment.changeFor ?? null,
    },
    p_items: input.items,
  });

  const result = Array.isArray(data)
    ? (data[0] as CheckoutCommandResult | undefined)
    : (data as CheckoutCommandResult | null);

  if (error || !result) {
    throw new Error(checkoutErrorMessage(error?.message ?? ""));
  }

  return {
    id: result.order_id,
    number: Number(result.display_number),
    status: result.order_status,
    total: Number(result.total_amount),
    isDemo: false,
  };
}
