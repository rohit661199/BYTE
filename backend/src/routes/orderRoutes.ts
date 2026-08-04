import { Router } from 'express';
import { OrderController } from '../controllers/orderController.js';
import { validateRequest, createOrderSchema } from '../middlewares/validateRequest.js';

const router = Router();

router.post('/', validateRequest(createOrderSchema), OrderController.createOrder);
router.post('/reset', OrderController.resetExchange);
router.get('/', OrderController.getAllOrders);
router.delete('/:id', OrderController.cancelOrder);

export default router;
