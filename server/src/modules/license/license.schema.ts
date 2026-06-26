import { z } from 'zod';

export const activateSchema = z.object({
  activationCode: z.string().trim().min(1),
});

export const manualSchema = z.object({
  key: z.string().trim().min(1),
});
