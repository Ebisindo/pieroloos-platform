import { PlatformPermission } from "@prisma/client";
import { notFound } from "next/navigation";
import { AdministratorManagement } from "@/components/admin/AdministratorManagement";
import { getCurrentPlatformActor, hasPlatformPermission } from "@/lib/auth/platform-access";
import { listPlatformAdministrators } from "@/lib/services/platform-admin-service";

export default async function AdministratorsPage() {
  const actor = await getCurrentPlatformActor();
  if (!actor || !hasPlatformPermission(actor, PlatformPermission.ADMINS_READ)) notFound();
  const data = await listPlatformAdministrators(actor);
  const initialData = {
    administrators: data.administrators.map((administrator) => ({
      ...administrator,
      createdAt: administrator.createdAt.toISOString(),
      permissions: administrator.permissions.map((permission) => ({
        ...permission,
        createdAt: permission.createdAt.toISOString(),
      })),
    })),
    eligibleUsers: data.eligibleUsers,
  };

  return <AdministratorManagement initialData={initialData} canManage={actor.isSuperAdmin} />;
}
