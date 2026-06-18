import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6).max(100),
  full_name: z.string().trim().max(100).optional().nullable(),
  role_id: z.number().int().positive(),
});

export const updateUserSchema = z.object({
  full_name: z.string().trim().max(100).optional().nullable(),
  role_id: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  new_password: z.string().min(6).max(100),
});
