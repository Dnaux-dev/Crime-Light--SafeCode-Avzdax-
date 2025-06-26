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
import multer from 'multer';

const router = Router();

// Helper to wrap async route handlers for error handling
const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Multer setup for file uploads (photo, voice note)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// --- Incident Routes ---

// Create Incident (authenticated only, with file upload)
router.post(
  '/incidents',
  authenticate,
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'voiceNote', maxCount: 1 }
  ]),
  validateIncident,
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