import { Router } from 'express';
import { OrderbookController } from '../controllers/orderbookController.js';

const router = Router();

router.get('/', OrderbookController.getOrderBook);

export default router;
