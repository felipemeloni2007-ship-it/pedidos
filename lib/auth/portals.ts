import { redirect } from "next/navigation";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const portalPaths = { platform: "/plataforma", seller: "/painel", customer: "/conta" } as const;
export type Portal = keyof typeof portalPaths;

export async function requirePortalSession(portal: Portal) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`/login?portal=${portal}&error=configuration`);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect(`/login?portal=${portal}`);
  return { supabase, user: data.user };
}

export async function requirePlatformAdmin() {
  const session = await requirePortalSession("platform");
  const admin = createServiceRoleClient();
  if (!admin) redirect("/login?portal=platform&error=configuration");
  const { data, error } = await admin.from("platform_admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
  if (error) throw new Error("Não foi possível verificar o acesso à plataforma.");
  if (!data) redirect("/acesso-negado");
  return { ...session, admin };
}

export async function requireSeller() {
  const session = await requirePortalSession("seller");
  const { data, error } = await session.supabase.from("tenant_memberships")
    .select("id, tenant_id, is_owner").eq("user_id", session.user.id).eq("status", "active");
  if (error) throw new Error("Não foi possível verificar seus estabelecimentos.");
  if (!data?.length) redirect("/onboarding");
  return { ...session, memberships: data };
}
