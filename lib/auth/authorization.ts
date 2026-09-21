import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function requireTenantPermission(
  tenantId: string,
  acceptedPermissions: string[],
) {
  const sessionClient = await createServerSupabaseClient();
  const admin = createServiceRoleClient();

  if (!sessionClient || !admin) {
    throw new AuthorizationError("Autenticação não configurada.", 503);
  }

  const { data: claimsData, error: claimsError } =
    await sessionClient.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    throw new AuthorizationError("Sessão inválida ou expirada.", 401);
  }

  const { data: membership, error: membershipError } = await admin
    .from("tenant_memberships")
    .select("id, is_owner")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    throw new AuthorizationError("Você não pertence a este estabelecimento.", 403);
  }

  if (membership.is_owner) {
    return { userId, membershipId: membership.id };
  }

  const { data: roles, error: rolesError } = await admin
    .from("user_roles")
    .select("role_id")
    .eq("tenant_id", tenantId)
    .eq("membership_id", membership.id);

  if (rolesError || !roles?.length) {
    throw new AuthorizationError("Seu cargo não permite esta ação.", 403);
  }

  const roleIds = roles.map((role) => role.role_id);
  const { data: rolePermissions, error: permissionsError } = await admin
    .from("role_permissions")
    .select("permission_id, permissions!inner(code)")
    .eq("tenant_id", tenantId)
    .in("role_id", roleIds);

  const hasPermission =
    !permissionsError &&
    (rolePermissions ?? []).some((permission) =>
      acceptedPermissions.includes(
        (permission.permissions as { code?: string } | null)?.code ?? "",
      ),
    );

  if (!hasPermission) {
    throw new AuthorizationError("Seu cargo não permite esta ação.", 403);
  }

  return { userId, membershipId: membership.id };
}
