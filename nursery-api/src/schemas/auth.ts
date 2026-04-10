// Zod schemas for auth endpoints.
//
// Password policy is enforced in src/lib/password.ts (server-side) — schemas
// here only validate shape + normalize email. We intentionally do NOT echo
// the password rules in the zod error ("too short", "too long") because
// login is not the right place to leak password requirements. Bad creds →
// generic 401 regardless of which field was wrong.

import { z } from 'zod';

export const loginBodySchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('invalid email'),
  password: z.string().min(1, 'password is required'),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
