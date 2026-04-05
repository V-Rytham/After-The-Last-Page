import { z } from 'zod';

const idSchema = z.string().trim().min(1).max(128);

export const startSessionSchema = z.object({
  user_id: idSchema,
  book_id: idSchema,
});

export const sendMessageSchema = z.object({
  session_id: z.string().uuid(),
  message: z.string().trim().min(1).max(4_000),
  chapter_progress: z.coerce.number().int().min(0).max(10_000).optional(),
});

export const endSessionSchema = z.object({
  session_id: z.string().uuid(),
});
