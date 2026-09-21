import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "edge";

const onboardingSchema = z.object({
  tenantName: z.string().trim().min(2).max(140),
  tenantSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  storeName: z.string().trim().min(2).max(140),
  storeSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  timezone: z.literal("America/Sao_Paulo").default("America/Sao_Paulo"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Confira os dados da loja." }, { status: 422 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return Response.json({ error: "O onboarding seguro não está configurado." }, { status: 503 });
  }

  const { data: claimsResult } = await supabase.auth.getClaims();
  if (!claimsResult?.claims?.sub) {
    return Response.json({ error: "Faça login para criar uma loja." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("bootstrap_tenant", {
    p_tenant_name: parsed.data.tenantName,
    p_tenant_slug: parsed.data.tenantSlug,
    p_store_name: parsed.data.storeName,
    p_store_slug: parsed.data.storeSlug,
    p_timezone: parsed.data.timezone,
  });

  if (error || !data) {
    return Response.json(
      { error: "Não foi possível criar essa loja. Tente outro link público." },
      { status: 409 },
    );
  }

  return Response.json({ onboarding: data }, { status: 201 });
}
