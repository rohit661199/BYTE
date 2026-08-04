import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export const createOrderSchema = z
  .object({
    side: z.enum(['BUY', 'SELL'], {
      required_error: 'Order side is required and must be BUY or SELL',
    }),
    type: z.enum(['LIMIT', 'MARKET']).optional().default('LIMIT'),
    price: z.number().optional().default(0),
    quantity: z
      .number({ required_error: 'Quantity is required' })
      .positive('Quantity must be greater than 0'),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'LIMIT') {
      if (data.price === undefined || data.price <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['price'],
          message: 'Price must be greater than 0 for LIMIT orders',
        });
      }
    }
  });

export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const formattedErrors = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload',
          details: formattedErrors,
        },
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
