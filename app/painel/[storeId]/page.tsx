import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth/portals";
import { PortalShell } from "@/components/auth/portal-shell";
import { LiveOperations, type LiveOrder } from "@/components/food/live-operations";
export const dynamic = "force-dynamic";
export default async function StoreOperations({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) notFound();
  const { supabase, user, memberships } = await requireSeller();
  const { data: store, error: storeError } = await supabase.from("stores").select("id,tenant_id,name,public_slug,accepting_orders,is_storefront_published,accepts_delivery,accepts_pickup,default_prep_minutes").eq("id", storeId).in("tenant_id", memberships.map(m => m.tenant_id)).is("deleted_at", null).maybeSingle();
  if (storeError) throw new Error("Não foi possível carregar a unidade.");
  if (!store) notFound();
  const [products,categories,orders,zones]=await Promise.all([
    supabase.from("products").select("id,name,description,category_id,base_price,is_available").eq("tenant_id",store.tenant_id).eq("store_id",storeId).is("deleted_at",null).order("name"),
    supabase.from("categories").select("id,name").eq("tenant_id",store.tenant_id).eq("store_id",storeId).is("deleted_at",null).order("name"),
    supabase.from("orders").select("id,display_number,customer_name,status,total_amount,created_at,fulfillment_type,order_items(id,product_name,quantity,notes)").eq("tenant_id",store.tenant_id).eq("store_id",storeId).order("created_at",{ascending:false}).limit(100),
    supabase.from("delivery_zones").select("id,name,delivery_fee,minimum_order_amount").eq("tenant_id",store.tenant_id).eq("store_id",storeId).is("deleted_at",null),
  ]);
  if([products,categories,orders,zones].some(r=>r.error))throw Error("Não foi possível carregar a operação. Tente novamente.");
  return <PortalShell title="Minha loja" email={user.email}><LiveOperations store={store} products={products.data??[]} categories={categories.data??[]} orders={(orders.data??[]) as LiveOrder[]} zones={zones.data??[]}/></PortalShell>;
}
