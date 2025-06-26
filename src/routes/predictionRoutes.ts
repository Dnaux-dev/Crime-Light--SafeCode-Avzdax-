import { Router } from 'express';
import {
  getMapData,
  getLocationRisk,
  getPredictionStats
} from '../controllers/predictionController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Helper to wrap async route handlers for error handling
const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// --- Prediction Routes ---

// Get map data with crime risk scores
router.get(
  '/map-data',
  authenticate,
  asyncHandler(getMapData)
);

// Get risk score for a specific location
router.get(
  '/location-risk',
  authenticate,
  asyncHandler(getLocationRisk)
);

// Get prediction statistics
router.get(
  '/stats',
  authenticate,
  asyncHandler(getPredictionStats)
);

export default router; 