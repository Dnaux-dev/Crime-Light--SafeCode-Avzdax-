import Incident from '../models/incident';

export interface RiskScore {
  location: {
    latitude: number;
    longitude: number;
  };
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    incidentCount: number;
    recentIncidents: number;
    timeOfDayRisk: number;
    dayOfWeekRisk: number;
  };
}

export interface MapData {
  hotspots: RiskScore[];
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalIncidents: number;
}

class PredictionService {
  // Calculate distance between two points using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI/180);
  }

  // Calculate time-based risk factors
  private calculateTimeRisk(timestamp: Date): number {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Night time risk (10 PM - 6 AM)
    let timeRisk = 1.0;
    if (hour >= 22 || hour <= 6) {
      timeRisk = 2.5;
    } else if (hour >= 18 || hour <= 22) {
      timeRisk = 1.8; // Evening
    } else if (hour >= 6 && hour <= 9) {
      timeRisk = 1.2; // Early morning
    }

    // Weekend risk
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      timeRisk *= 1.3;
    }

    return timeRisk;
  }

  // Calculate risk score for a specific location
  private calculateLocationRisk(
    targetLat: number, 
    targetLon: number, 
    incidents: any[], 
    radiusKm: number = 1.0
  ): RiskScore {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let totalIncidents = 0;
    let recentIncidents = 0;
    let timeWeightedRisk = 0;

    incidents.forEach(incident => {
      const distance = this.calculateDistance(
        targetLat, targetLon, 
        incident.latitude, incident.longitude
      );

      if (distance <= radiusKm) {
        totalIncidents++;
        const incidentTime = new Date(incident.timestamp);
        
        if (incidentTime >= oneDayAgo) {
          recentIncidents++;
        }

        // Weight by recency and time risk
        const daysAgo = (now.getTime() - incidentTime.getTime()) / (1000 * 60 * 60 * 24);
        const recencyWeight = Math.max(0.1, 1 - (daysAgo / 30)); // Decay over 30 days
        const timeRisk = this.calculateTimeRisk(incidentTime);
        
        timeWeightedRisk += recencyWeight * timeRisk;
      }
    });

    // Calculate base risk score (0-100)
    let riskScore = Math.min(100, 
      (totalIncidents * 10) + 
      (recentIncidents * 20) + 
      (timeWeightedRisk * 5)
    );

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore < 20) riskLevel = 'low';
    else if (riskScore < 40) riskLevel = 'medium';
    else if (riskScore < 70) riskLevel = 'high';
    else riskLevel = 'critical';

    return {
      location: { latitude: targetLat, longitude: targetLon },
      riskScore: Math.round(riskScore),
      riskLevel,
      factors: {
        incidentCount: totalIncidents,
        recentIncidents,
        timeOfDayRisk: this.calculateTimeRisk(now),
        dayOfWeekRisk: now.getDay() === 0 || now.getDay() === 6 ? 1.3 : 1.0
      }
    };
  }

  // Generate grid-based hotspots for map visualization
  private generateGrid(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }, gridSize: number = 0.01): Array<{lat: number, lon: number}> {
    const grid: Array<{lat: number, lon: number}> = [];
    
    for (let lat = bounds.south; lat <= bounds.north; lat += gridSize) {
      for (let lon = bounds.west; lon <= bounds.east; lon += gridSize) {
        grid.push({ lat, lon });
      }
    }
    
    return grid;
  }

  // Main method to get map data with risk scores
  async getMapData(bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): Promise<MapData> {
    try {
      
      const incidents = await Incident.find({}).sort({ timestamp: -1 });
      
      if (incidents.length === 0) {
        return {
          hotspots: [],
          overallRiskLevel: 'low',
          totalIncidents: 0
        };
      }

      // If no bounds provided, calculate from incident data
      if (!bounds) {
        const lats = incidents.map(i => i.latitude);
        const lons = incidents.map(i => i.longitude);
        bounds = {
          north: Math.max(...lats) + 0.01,
          south: Math.min(...lats) - 0.01,
          east: Math.max(...lons) + 0.01,
          west: Math.min(...lons) - 0.01
        };
      }

      // Generate grid points
      const gridPoints = this.generateGrid(bounds);
      
      // Calculate risk scores for each grid point
      const hotspots: RiskScore[] = gridPoints
        .map(point => this.calculateLocationRisk(point.lat, point.lon, incidents))
        .filter(hotspot => hotspot.riskScore > 10) // Only include meaningful hotspots
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 50); // Limit to top 50 hotspots

      // Calculate overall risk level
      const avgRiskScore = hotspots.length > 0 
        ? hotspots.reduce((sum, h) => sum + h.riskScore, 0) / hotspots.length 
        : 0;

      let overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (avgRiskScore < 20) overallRiskLevel = 'low';
      else if (avgRiskScore < 40) overallRiskLevel = 'medium';
      else if (avgRiskScore < 70) overallRiskLevel = 'high';
      else overallRiskLevel = 'critical';

      return {
        hotspots,
        overallRiskLevel,
        totalIncidents: incidents.length
      };

    } catch (error) {
      console.error('Error generating map data:', error);
      throw new Error('Failed to generate map data');
    }
  }

  // Get risk score for a specific location
  async getLocationRisk(latitude: number, longitude: number): Promise<RiskScore> {
    try {
      const incidents = await Incident.find({}).sort({ timestamp: -1 });
      return this.calculateLocationRisk(latitude, longitude, incidents);
    } catch (error) {
      console.error('Error calculating location risk:', error);
      throw new Error('Failed to calculate location risk');
    }
  }

  // Update risk scores when new incident is added
  async updateRiskScores(newIncident: any): Promise<void> {
    // In a real implementation, you might want to:
    // 1. Retrain the model
    // 2. Update cached predictions
    // 3. Trigger real-time updates to connected clients
    
    console.log('Risk scores updated for new incident:', newIncident._id);
  }
}

export default new PredictionService(); 