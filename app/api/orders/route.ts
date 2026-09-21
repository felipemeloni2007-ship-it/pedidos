import { checkoutOrderSchema } from "@/lib/food/checkout-schema";
import { createOrder } from "@/lib/food/order-service";

export const runtime = "edge";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parsed = checkoutOrderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Confira os dados do pedido.",
        issues: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  try {
    const order = await createOrder(parsed.data);
    return Response.json(order, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível criar o pedido.";
    return Response.json({ error: message }, { status: 409 });
  }
}
