import { Request, Response } from 'express';
import predictionService from '../services/predictionService';

// Extend the Request interface to include the 'user' property
interface AuthenticatedRequest extends Request {
  user?: { userId: string; role: string };
}

// Helper function to handle async errors
const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Get map data with crime risk scores
export const getMapData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { north, south, east, west } = req.query;
    
    let bounds;
    if (north && south && east && west) {
      bounds = {
        north: parseFloat(north as string),
        south: parseFloat(south as string),
        east: parseFloat(east as string),
        west: parseFloat(west as string)
      };
    }

    const mapData = await predictionService.getMapData(bounds);
    res.status(200).json(mapData);

  } catch (error) {
    console.error('Error fetching map data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch map data', 
      details: (error as Error).message || error 
    });
  }
};

// Get risk score for a specific location
export const getLocationRisk = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Latitude and longitude are required' 
      });
    }

    const lat = parseFloat(latitude as string);
    const lng = parseFloat(longitude as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ 
        error: 'Invalid latitude or longitude values' 
      });
    }

    const riskScore = await predictionService.getLocationRisk(lat, lng);
    res.status(200).json(riskScore);

  } catch (error) {
    console.error('Error calculating location risk:', error);
    res.status(500).json({ 
      error: 'Failed to calculate location risk', 
      details: (error as Error).message || error 
    });
  }
};

// Get prediction statistics
export const getPredictionStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get overall statistics about predictions and incidents
    const mapData = await predictionService.getMapData();
    
    const stats = {
      totalIncidents: mapData.totalIncidents,
      totalHotspots: mapData.hotspots.length,
      overallRiskLevel: mapData.overallRiskLevel,
      riskDistribution: {
        low: mapData.hotspots.filter(h => h.riskLevel === 'low').length,
        medium: mapData.hotspots.filter(h => h.riskLevel === 'medium').length,
        high: mapData.hotspots.filter(h => h.riskLevel === 'high').length,
        critical: mapData.hotspots.filter(h => h.riskLevel === 'critical').length
      },
      averageRiskScore: mapData.hotspots.length > 0 
        ? Math.round(mapData.hotspots.reduce((sum, h) => sum + h.riskScore, 0) / mapData.hotspots.length)
        : 0
    };

    res.status(200).json(stats);

  } catch (error) {
    console.error('Error fetching prediction stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch prediction statistics', 
      details: (error as Error).message || error 
    });
  }
}; 