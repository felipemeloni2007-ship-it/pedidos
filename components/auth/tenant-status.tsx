"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export function TenantStatus({id,status}:{id:string;status:string}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const router=useRouter();
 async function update(){setBusy(true);setError("");try{const r=await fetch("/api/platform/tenants",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status:status==="suspended"?"active":"suspended"})});if(!r.ok)throw Error("Não foi possível alterar o estabelecimento.");router.refresh();}catch(e){setError(e instanceof Error?e.message:"Falha na conexão");}finally{setBusy(false);}}
 return <span className="text-right"><span className="block text-sm">{status}</span><button disabled={busy} onClick={()=>void update()} className="mt-2 rounded-lg border px-3 py-2 text-sm">{busy?"Salvando…":status==="suspended"?"Reativar":"Suspender"}</button>{error&&<span role="alert" className="block text-sm text-red-700">{error}</span>}</span>;
}
