import {createServerSupabaseClient} from "@/lib/supabase/server";
import {z} from "zod";
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Origem inválida"},{status:403});
 const input=z.object({id:z.string().uuid(),status:z.enum(["active","suspended"])}).safeParse(await request.json().catch(()=>null));
 if(!input.success)return Response.json({error:"Dados inválidos"},{status:422});
 const client=await createServerSupabaseClient();if(!client)return Response.json({error:"Indisponível"},{status:503});
 const {data}=await client.auth.getUser();if(!data.user)return Response.json({error:"Faça login"},{status:401});
 const {error}=await client.rpc("platform_tenant_status",{p_tenant:input.data.id,p_status:input.data.status});
 if(error)return Response.json({error:"Sem permissão ou estabelecimento indisponível"},{status:403});
 return Response.json({ok:true});
}
