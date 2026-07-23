import type { z } from "zod";

import type { UserRole } from "../../generated/prisma/enums.js";
import type {
  cancelAdminJobSchema,
  createAdminSourceSchema,
  listAdminAuditLogsQuerySchema,
  listAdminJobsQuerySchema,
  listAdminSourcesQuerySchema,
  listAdminUsersQuerySchema,
  sourceReasonSchema,
  updateAdminSourceSchema,
  updateAdminUserRoleSchema,
  updateAdminUserStatusSchema,
} from "./admin.schemas.js";

export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;
export type UpdateAdminUserStatusInput = z.infer<
  typeof updateAdminUserStatusSchema
>;
export type UpdateAdminUserRoleInput = z.infer<
  typeof updateAdminUserRoleSchema
>;
export type ListAdminJobsQuery = z.infer<typeof listAdminJobsQuerySchema>;
export type CancelAdminJobInput = z.infer<typeof cancelAdminJobSchema>;
export type ListAdminAuditLogsQuery = z.infer<
  typeof listAdminAuditLogsQuerySchema
>;
export type ListAdminSourcesQuery = z.infer<typeof listAdminSourcesQuerySchema>;
export type CreateAdminSourceInput = z.infer<typeof createAdminSourceSchema>;
export type UpdateAdminSourceInput = z.infer<typeof updateAdminSourceSchema>;
export type SourceReasonInput = z.infer<typeof sourceReasonSchema>;

export type AdminActionContext = {
  actorUserId: string;
  actorRole: UserRole;
  ipAddress?: string;
  userAgent?: string;
};
