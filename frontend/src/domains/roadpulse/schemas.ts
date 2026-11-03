import { z } from "zod";

import { ngPhone } from "@/domains/auth/schemas";

export const tripSchema = z.object({
  destination: z.string().trim().min(2, "Where are you going?").max(120),
  eta_minutes: z.number().int().min(10, "At least 10 minutes").max(24 * 60, "At most 24 hours"),
  message: z.string().trim().max(200, "Keep the message under 200 characters").optional(),
  contacts: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Add a name"),
        phone: ngPhone,
        email: z.union([z.literal(""), z.email("Enter a valid email or leave it blank")]).optional(),
      }),
    )
    .min(1, "Add at least one person to inform")
    .max(3, "Up to three contacts"),
});

export type TripValues = z.input<typeof tripSchema>;
