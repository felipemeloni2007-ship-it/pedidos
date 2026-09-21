import Link from "next/link";

export default function AccessPage() {
  const portals = [
    ["platform", "Administração da plataforma", "Gestão dos estabelecimentos e da operação SaaS."],
    ["seller", "Minha loja", "Gerencie seu estabelecimento e acompanhe seus pedidos."],
    ["customer", "Minha conta", "Consulte pedidos vinculados à sua conta."],
  ];
  return <main className="min-h-screen bg-stone-50 p-6 text-stone-900"><section className="mx-auto max-w-5xl py-20"><p className="font-bold text-orange-700">Mesa Pronta</p><h1 className="mt-3 text-4xl font-semibold">Como você quer acessar?</h1><div className="mt-10 grid gap-5 md:grid-cols-3">{portals.map(([id, title, description]) => <Link key={id} href={`/login?portal=${id}`} className="rounded-2xl border bg-white p-6 transition hover:border-orange-500"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 text-stone-600">{description}</p><span className="mt-6 block font-semibold text-orange-700">Entrar →</span></Link>)}</div><Link href="/" className="mt-8 inline-block underline">Ver cardápio</Link></section></main>;
}
