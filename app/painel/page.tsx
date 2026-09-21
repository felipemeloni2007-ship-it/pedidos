import Link from "next/link";
import { requireSeller } from "@/lib/auth/portals";
import { PortalShell } from "@/components/auth/portal-shell";
export const dynamic = "force-dynamic";
export default async function SellerPage() {
  const { supabase, user, memberships } = await requireSeller();
  const tenantIds = memberships.map(item => item.tenant_id);
  const { data: stores, error } = await supabase.from("stores").select("id,tenant_id,name,public_slug").in("tenant_id", tenantIds).is("deleted_at", null);
  if (error) throw new Error("Não foi possível carregar suas lojas.");
  return <PortalShell title="Minhas lojas" email={user.email}><h1 className="text-3xl font-semibold">Seus estabelecimentos</h1><div className="grid gap-4 md:grid-cols-2">{stores?.map(store => <Link key={store.id} href={`/painel/${store.id}`} className="rounded-xl border bg-white p-6"><h2 className="text-xl font-semibold">{store.name}</h2><p className="mt-2 text-stone-600">Abrir pedidos →</p></Link>)}</div>{!stores?.length && <p>Nenhuma unidade disponível para sua conta.</p>}<Link href="/onboarding" className="inline-block rounded-lg bg-stone-900 px-5 py-3 text-white">Criar estabelecimento</Link></PortalShell>;
}
