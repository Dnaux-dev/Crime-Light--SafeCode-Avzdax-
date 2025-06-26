import { Request, Response, NextFunction } from 'express';

export const validateIncident = (req: Request, res: Response, next: NextFunction) => {
  const { type, description, latitude, longitude, userId } = req.body;
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
  if (!userId || typeof userId !== 'string') {
    res.status(400).json({ error: 'Invalid or missing userId' });
    return;
  }
  next();
}; 