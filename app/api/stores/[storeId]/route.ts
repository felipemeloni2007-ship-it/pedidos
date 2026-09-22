import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const command = z.discriminatedUnion("action", [
 z.object({ action:z.literal("category"), name:z.string().trim().min(1).max(120) }),
 z.object({ action:z.literal("product"), id:z.string().uuid().optional(), name:z.string().trim().min(1).max(160), description:z.string().trim().max(2000), category_id:z.string().uuid(), base_price:z.number().min(0).max(100000), is_available:z.boolean() }),
 z.object({ action:z.literal("availability"), id:z.string().uuid(), is_available:z.boolean() }),
 z.object({ action:z.literal("settings"), accepting_orders:z.boolean(), is_storefront_published:z.boolean(), accepts_delivery:z.boolean(), accepts_pickup:z.boolean(), default_prep_minutes:z.number().int().min(1).max(240) }),
 z.object({ action:z.literal("zone"), name:z.string().trim().min(2).max(120), delivery_fee:z.number().min(0).max(1000), minimum_order_amount:z.number().min(0).max(10000) }),
 z.object({ action:z.literal("order"), id:z.string().uuid(), status:z.enum(["confirmed","preparing","ready","awaiting_driver","out_for_delivery","delivered","canceled"]) }),
]);

export async function POST(request:Request, {params}:{params:Promise<{storeId:string}>}) {
 if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({error:"Origem inválida"},{status:403});
 const {storeId}=await params;
 if(!z.string().uuid().safeParse(storeId).success) return Response.json({error:"Loja inválida"},{status:400});
 const supabase=await createServerSupabaseClient();
 if(!supabase) return Response.json({error:"Serviço indisponível"},{status:503});
 const {data:auth}=await supabase.auth.getUser();
 if(!auth.user) return Response.json({error:"Entre novamente para continuar"},{status:401});
 const parsed=command.safeParse(await request.json().catch(()=>null));
 if(!parsed.success) return Response.json({error:"Confira os campos preenchidos"},{status:422});
 const {data:store}=await supabase.from("stores").select("id,tenant_id").eq("id",storeId).is("deleted_at",null).maybeSingle();
 if(!store) return Response.json({error:"Loja não disponível"},{status:404});
 const {data:membership}=await supabase.from("tenant_memberships").select("id").eq("tenant_id",store.tenant_id).eq("user_id",auth.user.id).eq("status","active").maybeSingle();
 if(!membership) return Response.json({error:"Sem acesso a esta loja"},{status:403});
 const input=parsed.data, scope={tenant_id:store.tenant_id,store_id:storeId};
 let result;
 if(input.action==="category") result=await supabase.from("categories").insert({...scope,name:input.name}).select("id").single();
 else if(input.action==="product") {
   const fields={name:input.name,description:input.description,category_id:input.category_id,base_price:input.base_price,is_available:input.is_available};
   result=input.id ? await supabase.from("products").update(fields).eq("id",input.id).eq("tenant_id",scope.tenant_id).eq("store_id",storeId).select("id").single()
    : await supabase.from("products").insert({...scope,...fields}).select("id").single();
 } else if(input.action==="availability") result=await supabase.from("products").update({is_available:input.is_available}).eq("id",input.id).eq("tenant_id",scope.tenant_id).eq("store_id",storeId).select("id").single();
 else if(input.action==="settings") {
  const {action:_,...fields}=input; void _;
  result=await supabase.from("stores").update(fields).eq("id",storeId).eq("tenant_id",scope.tenant_id).select("id").single();
 } else if(input.action==="zone") result=await supabase.from("delivery_zones").insert({...scope,name:input.name,zone_type:"neighborhood",neighborhood_names:[input.name],delivery_fee:input.delivery_fee,minimum_order_amount:input.minimum_order_amount}).select("id").single();
 else {
   const {data:order}=await supabase.from("orders").select("id").eq("id",input.id).eq("tenant_id",scope.tenant_id).eq("store_id",storeId).maybeSingle();
   if(!order) return Response.json({error:"Pedido não encontrado"},{status:404});
   result=await supabase.rpc("change_order_status",{p_order:order.id,p_status:input.status});
 }
 if(result.error) return Response.json({error:"Não foi possível salvar. Verifique suas permissões, os campos e o estado atual do registro."},{status:409});
 return Response.json({ok:true});
}
