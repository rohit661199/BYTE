import { Router } from 'express';
import orderRoutes from './orderRoutes.js';
import tradeRoutes from './tradeRoutes.js';
import statsRoutes from './statsRoutes.js';
import orderbookRoutes from './orderbookRoutes.js';

const apiRouter = Router();

apiRouter.use('/orders', orderRoutes);
apiRouter.use('/trades', tradeRoutes);
apiRouter.use('/stats', statsRoutes);
apiRouter.use('/orderbook', orderbookRoutes);

export default apiRouter;
