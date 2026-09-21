import { createServerSupabaseClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin) return new Response("Origem inválida", { status: 403 });
  const client = await createServerSupabaseClient();
  if (client) {
    const { error } = await client.auth.signOut();
    if (error) return new Response("Não foi possível encerrar a sessão.", { status: 503 });
  }
  return new Response(null, { status: 303, headers: { Location: "/acesso", "Cache-Control": "no-store" } });
}
