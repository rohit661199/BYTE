import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export const createOrderSchema = z.object({
  side: z.enum(['BUY', 'SELL'], {
    required_error: 'Order side is required and must be BUY or SELL',
  }),
  type: z.enum(['LIMIT', 'MARKET']).optional().default('LIMIT'),
  price: z
    .number({ required_error: 'Price is required' })
    .positive('Price must be greater than 0'),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .positive('Quantity must be greater than 0'),
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
