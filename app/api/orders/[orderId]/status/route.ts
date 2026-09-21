import { z } from "zod";

import {
  AuthorizationError,
  requireTenantPermission,
} from "@/lib/auth/authorization";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "edge";

const updateOrderStatusSchema = z.object({
  tenantId: z.string().uuid(),
  storeId: z.string().uuid(),
  status: z.enum([
    "confirmed",
    "preparing",
    "ready",
    "awaiting_driver",
    "out_for_delivery",
    "delivered",
    "canceled",
  ]),
  reason: z.string().trim().max(280).optional(),
});

const validTransitions: Record<string, string[]> = {
  new: ["confirmed", "preparing", "canceled"],
  confirmed: ["preparing", "canceled"],
  preparing: ["ready", "canceled"],
  ready: ["awaiting_driver", "out_for_delivery", "delivered", "canceled"],
  awaiting_driver: ["out_for_delivery", "canceled"],
  out_for_delivery: ["delivered", "canceled"],
  delivered: [],
  canceled: [],
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parsed = updateOrderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const { orderId } = await context.params;

  try {
    const actor = await requireTenantPermission(parsed.data.tenantId, [
      "orders.manage",
      "kds.manage",
      "delivery.manage",
    ]);
    const admin = createServiceRoleClient();

    if (!admin) {
      return Response.json({ error: "Operação indisponível." }, { status: 503 });
    }

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, tenant_id, store_id, status")
      .eq("id", orderId)
      .eq("tenant_id", parsed.data.tenantId)
      .eq("store_id", parsed.data.storeId)
      .maybeSingle();

    if (orderError || !order) {
      return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    if (!validTransitions[order.status]?.includes(parsed.data.status)) {
      return Response.json(
        { error: "Esta transição de status não é permitida." },
        { status: 409 },
      );
    }

    const timestamp = new Date().toISOString();
    const statusPayload: Record<string, string | null> = {
      status: parsed.data.status,
      updated_at: timestamp,
    };

    if (parsed.data.status === "confirmed") {
      statusPayload.accepted_at = timestamp;
    }

    if (parsed.data.status === "delivered") {
      statusPayload.completed_at = timestamp;
    }

    if (parsed.data.status === "canceled") {
      statusPayload.canceled_at = timestamp;
      statusPayload.cancellation_reason = parsed.data.reason ?? null;
    }

    const { data: updatedOrder, error: updateError } = await admin
      .from("orders")
      .update(statusPayload)
      .eq("id", order.id)
      .select("id, display_number, status, updated_at")
      .single();

    if (updateError || !updatedOrder) {
      return Response.json(
        { error: "Não foi possível atualizar o pedido." },
        { status: 409 },
      );
    }

    await admin.from("audit_logs").insert({
      tenant_id: parsed.data.tenantId,
      store_id: parsed.data.storeId,
      actor_user_id: actor.userId,
      action: "order.status_changed",
      entity_type: "order",
      entity_id: order.id,
      before_data: { status: order.status },
      after_data: { status: parsed.data.status, reason: parsed.data.reason ?? null },
    });

    return Response.json({ order: updatedOrder });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    return Response.json(
      { error: "Não foi possível atualizar o pedido." },
      { status: 500 },
    );
  }
}
