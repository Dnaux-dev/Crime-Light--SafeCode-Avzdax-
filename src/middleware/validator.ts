// middleware/validator.ts (Revised if userId should NOT be in body)
import { Request, Response, NextFunction } from 'express';

export const validateIncident = (req: Request, res: Response, next: NextFunction) => {
  const { type, description, latitude, longitude } = req.body; // userId removed

  if (!type || typeof type !== 'string') {
    res.status(400).json({ error: 'Invalid or missing type' });
    return;
  }
  if (!description || typeof description !== 'string') {
    res.status(400).json({ error: 'Invalid or missing description' });
    return;
  }
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    res.status(400).json({ error: 'Invalid or missing latitude/longitude' });
    return;
  }
  // userId validation removed from here
  next();
};