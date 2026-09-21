import { requirePortalSession } from "@/lib/auth/portals";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { PortalShell } from "@/components/auth/portal-shell";
export const dynamic = "force-dynamic";
export default async function CustomerPage() {
  const { user, supabase } = await requirePortalSession("customer");
  const { data: identities, error } = await supabase.from("customer_auth_identities").select("tenant_id,customer_id").eq("auth_user_id", user.id);
  if (error) throw new Error("Não foi possível verificar sua conta de cliente.");
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("O serviço de consulta de pedidos ainda não está configurado.");
  const groups = await Promise.all((identities ?? []).map(async identity => {
    // Both filters derive exclusively from verified identity records, never from a URL or email match.
    const { data, error: ordersError } = await admin.from("orders").select("id,display_number,status,total_amount,created_at").eq("tenant_id", identity.tenant_id).eq("customer_id", identity.customer_id).order("created_at", { ascending: false }).limit(50);
    if (ordersError) throw new Error("Não foi possível consultar seus pedidos.");
    return data ?? [];
  }));
  const orders = groups.flat().sort((a,b) => b.created_at.localeCompare(a.created_at));
  return <PortalShell title="Minha conta" email={user.email}><h1 className="text-3xl font-semibold">Meus pedidos</h1><div className="divide-y rounded-xl border bg-white">{orders.map(order => <article key={order.id} className="flex justify-between gap-4 p-5"><span>Pedido #{order.display_number}</span><span>{order.status}</span><strong>{Number(order.total_amount).toLocaleString("pt-BR", { style:"currency", currency:"BRL" })}</strong></article>)}{!orders.length && <p className="p-5">Você ainda não tem pedidos vinculados à sua conta.</p>}</div></PortalShell>;
}
