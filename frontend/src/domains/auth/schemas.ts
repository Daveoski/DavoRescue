import { z } from "zod";

export const ngPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, ""))
  .refine((v) => /^(?:\+?234|0)[789][01]\d{8}$/.test(v), "Enter a Nigerian mobile number, e.g. 0803 123 4567");

export const signInSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your phone number or email"),
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your name").max(80),
    phone: ngPhone,
    email: z.union([z.literal(""), z.email("Enter a valid email or leave it blank")]),
    password: z.string().min(8, "Use at least 8 characters").max(128),
    responder: z.boolean(),
    invite_code: z.string().trim().max(64),
    agency_slug: z.string().trim().max(64),
  })
  .refine((v) => !v.responder || v.invite_code.length > 0, {
    path: ["invite_code"],
    message: "Responder accounts need the invite code from your command",
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.input<typeof signUpSchema>;

/** Flatten Zod issues to { field: firstMessage } for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
