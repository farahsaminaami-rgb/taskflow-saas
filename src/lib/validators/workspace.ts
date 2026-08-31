import { z } from "zod";
import { UserRole } from "@prisma/client";

const requiredString = (min = 1, max = 120, label = "This field") =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} is too long`);

export const slugSchema = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters")
  .max(32, "Slug is too long")
  .regex(/^[a-z0-9-]+$/, "Use only lowercase letters, numbers and hyphens");

export const createWorkspaceSchema = z.object({
  name: requiredString(2, 80, "Workspace name"),
  slug: slugSchema,
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateWorkspaceSchema = createWorkspaceSchema.partial().extend({
  logoUrl: z.string().url().optional().nullable(),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: "Invalid role" }),
  }).default(UserRole.MEMBER),
});

export const updateMemberRoleSchema = z.object({
  memberId: z.string().uuid("Invalid member id"),
  role: z.nativeEnum(UserRole),
});

export const removeMemberSchema = z.object({
  memberId: z.string().uuid("Invalid member id"),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(20, "Invalid invitation token"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;