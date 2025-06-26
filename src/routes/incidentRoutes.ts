// routes/incidentRoutes.ts
import { Router } from 'express';
import {
  createIncident,
  getAllIncidents,
  getIncidentById, // Add this if you implement get by ID
  updateIncident,
  deleteIncident,
} from '../controllers/incidentController';
import { authenticate } from '../middleware/auth'; // Your authentication middleware
import { validateIncident } from '../middleware/validator'; // Your validation middleware

const router = Router();

// Helper to wrap async route handlers for error handling
const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// --- Incident Routes ---

// Create Incident
router.post(
  '/incidents',
  authenticate,
  validateIncident, // Apply the validation middleware (ensure it no longer validates userId in body)
  asyncHandler(createIncident)
);

// Get All Incidents (only authenticated users can view)
router.get(
  '/incidents',
  authenticate,
  asyncHandler(getAllIncidents)
);

// Get Incident by ID (optional)
router.get(
  '/incidents/:id',
  authenticate,
  asyncHandler(getIncidentById)
);

// Update Incident by ID
router.put(
  '/incidents/:id',
  authenticate,
  // You might want a separate validation for updates, as not all fields might be present.
  // For simplicity, we'll omit it here, or you can reuse/modify validateIncident.
  asyncHandler(updateIncident)
);

// Delete Incident by ID
router.delete(
  '/incidents/:id',
  authenticate,
  asyncHandler(deleteIncident)
);

export default router;