// controllers/incidentController.ts
import { Request, Response } from 'express';
import Incident, { IIncident } from '../models/incident'; // Import IIncident interface
import predictionService from '../services/predictionService';

// Extend the Request interface to include the 'user' property from the authenticate middleware
interface AuthenticatedRequest extends Request {
  user?: { userId: string; role: string };
  files?: { [fieldname: string]: Express.Multer.File[] };
}

// Helper function to handle async errors (already in your routes, but good to have)
const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);


// --- CREATE INCIDENT (already existing, slightly refined) ---
export const createIncident = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, description, latitude, longitude } = req.body;
    const userId = req.user?.userId; // User must be authenticated

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated or userId missing from token.' });
    }

    // Handle file uploads
    let photoPath = undefined;
    let voiceNotePath = undefined;
    if (req.files?.photo && req.files.photo[0]) {
      photoPath = req.files.photo[0].path;
    }
    if (req.files?.voiceNote && req.files.voiceNote[0]) {
      voiceNotePath = req.files.voiceNote[0].path;
    }

    const newIncident: IIncident = new Incident({
      type,
      description,
      latitude,
      longitude,
      userId,
      photo: photoPath,
      voiceNote: voiceNotePath,
      timestamp: new Date(),
      status: 'pending',
    });

    await newIncident.save();

    // Update risk scores for the prediction engine
    await predictionService.updateRiskScores(newIncident);

    res.status(201).json({ message: 'Incident created successfully', incident: newIncident });

  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({ error: 'Failed to create incident', details: (error as Error).message || error });
  }
};


// --- GET ALL INCIDENTS ---
export const getAllIncidents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Implement logic for filtering/pagination if needed
    const incidents = await Incident.find({}); // Find all incidents
    res.status(200).json(incidents);
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ error: 'Failed to fetch incidents', details: (error as Error).message || error });
  }
};


// --- GET INCIDENT BY ID (Optional, but often useful) ---
export const getIncidentById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // Incident ID from URL parameter
    const incident = await Incident.findById(id);

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.status(200).json(incident);
  } catch (error) {
    console.error('Error fetching incident by ID:', error);
    res.status(500).json({ error: 'Failed to fetch incident', details: (error as Error).message || error });
  }
};


// --- UPDATE INCIDENT ---
export const updateIncident = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // Incident ID from URL parameter
    const updates = req.body; // Updates to apply (e.g., status, description)
    const userId = req.user?.userId; // User performing the update

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    // Find the incident
    const incident = await Incident.findById(id);

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Basic authorization: Only the user who created the incident or an admin can update it
    // You might expand this with a role-based check (e.g., if (req.user?.role === 'admin'))
    if (incident.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this incident' });
    }

    // Prevent updating userId or timestamp directly via API
    delete updates.userId;
    delete updates.timestamp;

    const updatedIncident = await Incident.findByIdAndUpdate(
      id,
      { $set: updates }, // Use $set to update only the fields provided
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );

    if (!updatedIncident) {
      // This should ideally not happen if incident was found, but as a safeguard
      return res.status(404).json({ error: 'Incident not found after update attempt' });
    }

    res.status(200).json({ message: 'Incident updated successfully', incident: updatedIncident });

  } catch (error) {
    console.error('Error updating incident:', error);
    res.status(500).json({ error: 'Failed to update incident', details: (error as Error).message || error });
  }
};


// --- DELETE INCIDENT ---
export const deleteIncident = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // Incident ID from URL parameter
    const userId = req.user?.userId; // User performing the delete

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    const incident = await Incident.findById(id);

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Basic authorization: Only the user who created the incident or an admin can delete it
    if (incident.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this incident' });
    }

    const deletedIncident = await Incident.findByIdAndDelete(id);

    if (!deletedIncident) {
      // This should ideally not happen if incident was found, but as a safeguard
      return res.status(404).json({ error: 'Incident not found during delete attempt' });
    }

    res.status(200).json({ message: 'Incident deleted successfully', incidentId: deletedIncident._id });

  } catch (error) {
    console.error('Error deleting incident:', error);
    res.status(500).json({ error: 'Failed to delete incident', details: (error as Error).message || error });
  }
};