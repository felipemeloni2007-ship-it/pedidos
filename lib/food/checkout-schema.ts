import { z } from "zod";

const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(30),
  selections: z
    .record(z.string().uuid(), z.array(z.string().uuid()).max(10))
    .default({}),
  note: z.string().trim().max(280).optional(),
});

export const checkoutOrderSchema = z
  .object({
    storeSlug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    idempotencyKey: z.string().uuid(),
    fulfillment: z.enum(["delivery", "pickup", "dine_in"]),
    customer: z.object({
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(8).max(30),
      address: z.string().trim().min(6).max(280).optional(),
      reference: z.string().trim().max(180).optional(),
    }),
    payment: z.object({
      method: z.enum(["pix", "credit_card", "cash"]),
      changeFor: z.number().positive().max(10000).optional(),
    }),
    items: z.array(itemSchema).min(1).max(50),
  })
  .superRefine((value, context) => {
    if (value.fulfillment === "delivery" && !value.customer.address) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customer", "address"],
        message: "Informe o endereço para receber por delivery.",
      });
    }

    if (
      value.payment.method === "cash" &&
      value.payment.changeFor !== undefined &&
      !Number.isFinite(value.payment.changeFor)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payment", "changeFor"],
        message: "Informe um valor válido para o troco.",
      });
    }
  });

export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;
