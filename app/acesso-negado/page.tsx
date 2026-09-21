import Link from "next/link";
export default function DeniedPage() {
  return <main className="mx-auto max-w-xl space-y-5 p-10"><h1 className="text-3xl font-semibold">Acesso não autorizado</h1><p>Sua conta não tem permissão para esta área. A administração da plataforma é exclusiva dos administradores cadastrados.</p><Link href="/acesso" className="underline">Escolher outra área</Link></main>;
}
