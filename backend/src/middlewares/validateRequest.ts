import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export const createOrderSchema = z
  .object({
    symbol: z.string().optional(),
    side: z.enum(['BUY', 'SELL'], {
      required_error: 'Order side is required and must be BUY or SELL',
    }),
    type: z.enum(['LIMIT', 'MARKET']).optional().default('LIMIT'),
    price: z.union([z.number(), z.string()]).optional().default(0),
    quantity: z.union(
      [
        z.number().positive('Quantity must be greater than 0'),
        z.string().refine((val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num > 0;
        }, 'Quantity must be greater than 0'),
      ],
      {
        required_error: 'Quantity is required',
      }
    ),
    userId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'LIMIT') {
      const p = typeof data.price === 'string' ? parseFloat(data.price) : data.price;
      if (p === undefined || isNaN(p) || p <= 0) {
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
