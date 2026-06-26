import { z } from 'zod';

export const activateSchema = z.object({
  activationCode: z.string().trim().min(1),
});
