import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth/portals";
import { PortalShell } from "@/components/auth/portal-shell";
export const dynamic = "force-dynamic";
export default async function StoreOperations({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) notFound();
  const { supabase, user, memberships } = await requireSeller();
  const { data: store, error: storeError } = await supabase.from("stores").select("id,tenant_id,name").eq("id", storeId).in("tenant_id", memberships.map(m => m.tenant_id)).is("deleted_at", null).maybeSingle();
  if (storeError) throw new Error("Não foi possível carregar a unidade.");
  if (!store) notFound();
  const { data: orders, error } = await supabase.from("orders").select("id,display_number,customer_name,status,total_amount,created_at").eq("tenant_id", store.tenant_id).eq("store_id", store.id).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Não foi possível consultar os pedidos. Verifique sua permissão de operação.");
  return <PortalShell title={store.name} email={user.email}><h1 className="text-3xl font-semibold">Pedidos da loja</h1><div className="divide-y rounded-xl border bg-white">{orders?.map(order => <article key={order.id} className="flex flex-wrap justify-between gap-4 p-5"><span>#{order.display_number} · {order.customer_name}</span><span>{order.status}</span><strong>{Number(order.total_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></article>)}{!orders?.length && <p className="p-5">Nenhum pedido disponível para esta unidade e seu perfil.</p>}</div></PortalShell>;
}
