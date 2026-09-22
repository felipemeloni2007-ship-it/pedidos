import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";

export default async function StorefrontPage() {
  const client=await createServerSupabaseClient();
  const result=client?await client.rpc("list_public_stores"):null;
  return <main className="min-h-screen bg-[#f7f6f2] text-[#25231f]"><header className="flex items-center justify-between border-b bg-white px-6 py-5"><strong className="text-xl">Mesa Pronta</strong><Link href="/acesso" className="rounded-xl bg-[#202823] px-5 py-3 text-white">Entrar</Link></header><section className="mx-auto max-w-5xl px-6 py-14"><p className="font-semibold text-orange-700">Peça direto de quem prepara</p><h1 className="mt-3 text-4xl font-semibold">Encontre sua próxima refeição.</h1><div className="mt-10 grid gap-5 sm:grid-cols-2">{result?.data?.map((s:{slug:string;name:string})=><Link key={s.slug} href={`/loja/${s.slug}`} className="rounded-2xl border bg-white p-6 text-xl font-semibold hover:border-orange-500">{s.name}<span className="mt-3 block text-sm font-normal text-stone-500">Ver cardápio →</span></Link>)}</div>{!result?.data?.length&&<p className="mt-8 text-stone-600">{result?.error?"Não foi possível carregar as lojas. Tente novamente em instantes.":"As primeiras lojas estão preparando seus cardápios."}</p>}<Link href="/login?portal=seller" className="mt-10 inline-block underline">Tenho um estabelecimento</Link></section></main>;
}
