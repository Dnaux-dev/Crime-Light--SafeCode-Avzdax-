// middleware/validator.ts (Revised if userId should NOT be in body)
import { Request, Response, NextFunction } from 'express';

export const validateIncident = (req: Request, res: Response, next: NextFunction) => {
  const { type, description, latitude, longitude } = req.body; // userId removed
  
  console.log('Validation middleware received:', { type, description, latitude, longitude, latitudeType: typeof latitude, longitudeType: typeof longitude });

  if (!type || typeof type !== 'string') {
    res.status(400).json({ error: 'Invalid or missing type' });
    return;
  }
  if (!description || typeof description !== 'string') {
    res.status(400).json({ error: 'Invalid or missing description' });
    return;
  }
  
  // Handle latitude and longitude - they can come as strings from form-data
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  
  console.log('Parsed values:', { lat, lng, latIsNaN: isNaN(lat), lngIsNaN: isNaN(lng) });
  
  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: 'Invalid or missing latitude/longitude' });
    return;
  }
  
  // Convert to numbers in the request body for the controller
  req.body.latitude = lat;
  req.body.longitude = lng;
  
  // userId validation removed from here
  next();
};