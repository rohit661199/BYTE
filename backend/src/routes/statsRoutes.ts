import { Router } from 'express';
import { StatsController } from '../controllers/statsController.js';

const router = Router();

router.get('/', StatsController.getStats);

export default router;
