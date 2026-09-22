import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LiveStorefront, type PublicCatalog } from "@/components/food/live-storefront";
export const dynamic="force-dynamic";
export default async function PublicStore({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const client=await createServerSupabaseClient();
 if(!client)throw Error("Loja temporariamente indisponível.");
 const [catalog,zones]=await Promise.all([client.rpc("get_storefront_catalog",{p_store_slug:slug}),client.rpc("public_delivery_zones",{p_slug:slug})]);
 if(catalog.error||zones.error)throw Error("Não foi possível carregar o cardápio.");
 if(!catalog.data)notFound();
 return <LiveStorefront catalog={catalog.data as PublicCatalog} zones={zones.data??[]}/>;
}
