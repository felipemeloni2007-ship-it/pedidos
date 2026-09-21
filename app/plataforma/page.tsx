import { requirePlatformAdmin } from "@/lib/auth/portals";
import { PortalShell } from "@/components/auth/portal-shell";
export const dynamic = "force-dynamic";
export default async function PlatformPage() {
  const { admin, user } = await requirePlatformAdmin();
  const { data, error } = await admin.from("tenants").select("id,name,slug,status,created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Não foi possível carregar os estabelecimentos.");
  return <PortalShell title="Administração da plataforma" email={user.email}><h1 className="text-3xl font-semibold">Estabelecimentos</h1><p>Últimos 100 estabelecimentos cadastrados na plataforma.</p><div className="divide-y rounded-xl border bg-white">{data?.map(tenant => <article key={tenant.id} className="flex justify-between gap-4 p-5"><div><h2 className="font-bold">{tenant.name}</h2><p className="text-sm text-stone-500">{tenant.slug}</p></div><span>{tenant.status}</span></article>)}{!data?.length && <p className="p-5">Nenhum estabelecimento cadastrado.</p>}</div></PortalShell>;
}
