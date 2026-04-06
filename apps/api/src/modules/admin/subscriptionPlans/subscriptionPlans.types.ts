import { Prisma, SubscriptionPlanCode } from '@prisma/client';
import { z } from 'zod';
import { SubscriptionEntitlementsSchema } from '../../subscriptions/subscriptionEntitlements.service';

export const AdminSubscriptionPlanCodeParamsSchema = z.object({
  code: z.nativeEnum(SubscriptionPlanCode),
});

const currencySchema = z
  .string()
  .trim()
  .min(3)
  .max(3)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), {
    message: 'currency must be a 3-letter ISO code',
  });

export const UpdateAdminSubscriptionPlanSchema = z
  .object({
    displayName: z.string().trim().min(1).max(64).optional(),
    isActive: z.boolean().optional(),
    monthlyPriceMinor: z.number().int().min(0).optional(),
    currency: currencySchema.optional(),
    entitlements: SubscriptionEntitlementsSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at least one field is required',
      });
    }
  });

export type UpdateAdminSubscriptionPlanDto = z.infer<typeof UpdateAdminSubscriptionPlanSchema>;
export type UpdateAdminSubscriptionPlanParamsDto = z.infer<
  typeof AdminSubscriptionPlanCodeParamsSchema
>;

export type AdminSubscriptionPlanItem = {
  code: SubscriptionPlanCode;
  slug: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  monthlyPriceMinor: number;
  currency: string;
  entitlements: Prisma.JsonValue;
  updatedAt: string;
};
