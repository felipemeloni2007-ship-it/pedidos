import { AdminSignIn } from "@/components/auth/admin-sign-in";

export const metadata = {
  title: "Entrar na operação",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ portal?: string; error?: string }> }) {
  const query = await searchParams;
  const portal = query.portal === "platform" || query.portal === "customer" ? query.portal : "seller";
  return <AdminSignIn portal={portal} configurationMissing={query.error === "configuration"} />;
}
