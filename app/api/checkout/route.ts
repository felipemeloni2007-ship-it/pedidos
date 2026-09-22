import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
const schema=z.object({slug:z.string().min(1).max(80),key:z.string().uuid(),mode:z.enum(["delivery","pickup","dine_in"]),customer:z.object({name:z.string().trim().min(2).max(120),phone:z.string().min(10).max(20),address:z.string().max(500).optional(),reference:z.string().max(250).optional()}),items:z.array(z.object({productId:z.string().uuid(),quantity:z.number().int().min(1).max(30),selections:z.record(z.array(z.string().uuid())).default({}),note:z.string().max(500).optional()})).min(1).max(50)});
export async function POST(request:Request) {
 if(request.headers.get("origin")!==new URL(request.url).origin) return Response.json({error:"Origem inválida"},{status:403});
 const body=schema.safeParse(await request.json().catch(()=>null));
 if(!body.success) return Response.json({error:"Confira seu pedido e seus dados"},{status:422});
 const client=await createServerSupabaseClient();
 if(!client) return Response.json({error:"Loja indisponível"},{status:503});
 const b=body.data;
 const {data,error}=await client.rpc("storefront_checkout",{p_slug:b.slug,p_key:b.key,p_mode:b.mode,p_customer:b.customer,p_items:b.items});
 if(error) return Response.json({error:"Não foi possível confirmar. Verifique se a loja está aberta, os itens, o endereço e o pedido mínimo."},{status:409});
 return Response.json(data,{status:201,headers:{"Cache-Control":"no-store"}});
}
