import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().max(200).optional().nullable(),
  permission_keys: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  description: z.string().trim().max(200).optional().nullable(),
  permission_keys: z.array(z.string()).optional(),
});
