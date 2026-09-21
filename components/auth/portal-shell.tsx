import Link from "next/link";

export function PortalShell({ title, email, children }: { title: string; email?: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-stone-50 text-stone-900"><header className="flex flex-wrap items-center justify-between gap-4 border-b bg-white px-6 py-5"><Link href="/acesso" className="font-bold">Mesa Pronta · {title}</Link><div className="flex items-center gap-4 text-sm"><span>{email}</span><form action="/auth/signout" method="post"><button className="rounded-lg border px-4 py-2">Sair</button></form></div></header><section className="mx-auto max-w-6xl space-y-6 p-6">{children}</section></main>;
}
