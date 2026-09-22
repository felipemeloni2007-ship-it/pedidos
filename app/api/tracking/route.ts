import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export async function POST(request:Request) {
 const parsed=z.object({id:z.string().uuid(),token:z.string().uuid()}).safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return Response.json({error:"Link inválido"},{status:400});
 const client=await createServerSupabaseClient();
 if(!client)return Response.json({error:"Indisponível"},{status:503});
 const {data,error}=await client.rpc("get_guest_order_tracking",{p_order_id:parsed.data.id,p_tracking_token:parsed.data.token});
 if(error||!data?.length)return Response.json({error:"Pedido não encontrado"},{status:404});
 return Response.json(data[0],{headers:{"Cache-Control":"no-store"}});
}
