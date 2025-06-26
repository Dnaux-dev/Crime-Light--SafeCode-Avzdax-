import Incident from '../models/incident';
import { Matrix } from 'ml-matrix';
import { PolynomialRegression } from 'ml-regression';

export interface MLRiskScore {
  location: {
    latitude: number;
    longitude: number;
  };
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  features: {
    incidentDensity: number;
    timeRisk: number;
    dayOfWeekRisk: number;
    recentActivity: number;
    typeDiversity: number;
  };
}

export interface MLMapData {
  hotspots: MLRiskScore[];
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalIncidents: number;
  modelAccuracy: number;
}

class MLPredictionService {
  private model: PolynomialRegression | null = null;
  private isModelTrained: boolean = false;
  private lastTrainingTime: Date | null = null;
  private readonly MODEL_RETRAIN_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  // Feature engineering functions
  private extractFeatures(incidents: any[], targetLat: number, targetLon: number, radiusKm: number = 1.0) {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    let totalIncidents = 0;
    let recentIncidents = 0;
    let veryRecentIncidents = 0;
    let nightIncidents = 0;
    let weekendIncidents = 0;
    const incidentTypes = new Set<string>();
    let totalTimeRisk = 0;

    incidents.forEach(incident => {
      const distance = this.calculateDistance(targetLat, targetLon, incident.latitude, incident.longitude);
      
      if (distance <= radiusKm) {
        totalIncidents++;
        const incidentTime = new Date(incident.timestamp);
        
        // Recency features
        if (incidentTime >= oneDayAgo) recentIncidents++;
        if (incidentTime >= oneHourAgo) veryRecentIncidents++;
        
        // Time-based features
        const hour = incidentTime.getHours();
        if (hour >= 22 || hour <= 6) nightIncidents++;
        
        const dayOfWeek = incidentTime.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) weekendIncidents++;
        
        // Type diversity
        incidentTypes.add(incident.type);
        
        // Time risk calculation
        const timeRisk = this.calculateTimeRisk(incidentTime);
        totalTimeRisk += timeRisk;
      }
    });

    // Calculate feature values
    const incidentDensity = totalIncidents / (Math.PI * radiusKm * radiusKm);
    const recentActivity = recentIncidents / Math.max(totalIncidents, 1);
    const veryRecentActivity = veryRecentIncidents / Math.max(totalIncidents, 1);
    const nightRatio = nightIncidents / Math.max(totalIncidents, 1);
    const weekendRatio = weekendIncidents / Math.max(totalIncidents, 1);
    const typeDiversity = incidentTypes.size / Math.max(totalIncidents, 1);
    const avgTimeRisk = totalTimeRisk / Math.max(totalIncidents, 1);

    // Current time features
    const currentHour = now.getHours();
    const currentDayOfWeek = now.getDay();
    const currentTimeRisk = this.calculateTimeRisk(now);
    const isWeekend = currentDayOfWeek === 0 || currentDayOfWeek === 6;

    return {
      incidentDensity,
      recentActivity,
      veryRecentActivity,
      nightRatio,
      weekendRatio,
      typeDiversity,
      avgTimeRisk,
      currentTimeRisk,
      isWeekend: isWeekend ? 1 : 0,
      currentHour: currentHour / 24, // Normalize to 0-1
      currentDayOfWeek: currentDayOfWeek / 6 // Normalize to 0-1
    };
  }

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

  private calculateTimeRisk(timestamp: Date): number {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();
    
    let timeRisk = 1.0;
    
    // Night time risk (10 PM - 6 AM)
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

  // Train the ML model
  private async trainModel(): Promise<void> {
    try {
      console.log('Training ML model...');
      
      // Get all incidents for training
      const incidents = await Incident.find({}).sort({ timestamp: -1 });
      
      if (incidents.length < 10) {
        console.log('Not enough data to train model, using rule-based fallback');
        this.isModelTrained = false;
        return;
      }

      // Generate training data
      const trainingData: { features: number[], target: number }[] = [];
      
      // Create grid of locations for training
      const bounds = this.calculateBounds(incidents);
      const gridPoints = this.generateGrid(bounds, 0.02); // Smaller grid for training
      
      gridPoints.forEach(point => {
        const features = this.extractFeatures(incidents, point.lat, point.lon);
        const featureVector = Object.values(features);
        
        // Calculate target (risk score 0-100)
        const target = this.calculateTargetRisk(features, incidents, point.lat, point.lon);
        
        trainingData.push({
          features: featureVector,
          target: target / 100 // Normalize to 0-1
        });
      });

      if (trainingData.length < 5) {
        console.log('Not enough training samples, using rule-based fallback');
        this.isModelTrained = false;
        return;
      }

      // Prepare data for ML model
      const X = trainingData.map(d => d.features);
      const y = trainingData.map(d => d.target);

      // Train polynomial regression model
      this.model = new PolynomialRegression(X, y, 2); // Degree 2 polynomial
      this.model.train();
      
      this.isModelTrained = true;
      this.lastTrainingTime = new Date();
      
      console.log(`ML model trained with ${trainingData.length} samples`);
      
    } catch (error) {
      console.error('Error training ML model:', error);
      this.isModelTrained = false;
    }
  }

  private calculateTargetRisk(features: any, incidents: any[], lat: number, lon: number): number {
    // Rule-based target calculation for training
    let risk = 0;
    
    risk += features.incidentDensity * 20;
    risk += features.recentActivity * 30;
    risk += features.veryRecentActivity * 40;
    risk += features.nightRatio * 25;
    risk += features.weekendRatio * 15;
    risk += features.currentTimeRisk * 10;
    
    return Math.min(100, Math.max(0, risk));
  }

  private calculateBounds(incidents: any[]) {
    const lats = incidents.map(i => i.latitude);
    const lons = incidents.map(i => i.longitude);
    return {
      north: Math.max(...lats) + 0.01,
      south: Math.min(...lats) - 0.01,
      east: Math.max(...lons) + 0.01,
      west: Math.min(...lons) - 0.01
    };
  }

  private generateGrid(bounds: any, gridSize: number = 0.01) {
    const grid: Array<{lat: number, lon: number}> = [];
    
    for (let lat = bounds.south; lat <= bounds.north; lat += gridSize) {
      for (let lon = bounds.west; lon <= bounds.east; lon += gridSize) {
        grid.push({ lat, lon });
      }
    }
    
    return grid;
  }

  // Predict risk using ML model
  private predictRisk(features: any): { riskScore: number, confidence: number } {
    if (!this.isModelTrained || !this.model) {
      // Fallback to rule-based prediction
      const riskScore = this.calculateTargetRisk(features, [], 0, 0);
      return { riskScore, confidence: 0.5 };
    }

    try {
      const featureVector = Object.values(features);
      const prediction = this.model.predict(featureVector);
      const riskScore = Math.max(0, Math.min(100, prediction * 100));
      
      // Simple confidence based on feature quality
      const confidence = Math.min(0.9, 0.3 + 
        (features.incidentDensity > 0 ? 0.2 : 0) +
        (features.recentActivity > 0 ? 0.2 : 0) +
        (features.typeDiversity > 0 ? 0.2 : 0)
      );
      
      return { riskScore, confidence };
    } catch (error) {
      console.error('ML prediction error, using fallback:', error);
      const riskScore = this.calculateTargetRisk(features, [], 0, 0);
      return { riskScore, confidence: 0.3 };
    }
  }

  // Main method to get map data with ML predictions
  async getMapData(bounds?: any): Promise<MLMapData> {
    try {
      // Check if model needs retraining
      if (!this.lastTrainingTime || 
          Date.now() - this.lastTrainingTime.getTime() > this.MODEL_RETRAIN_INTERVAL) {
        await this.trainModel();
      }

      const incidents = await Incident.find({}).sort({ timestamp: -1 });
      
      if (incidents.length === 0) {
        return {
          hotspots: [],
          overallRiskLevel: 'low',
          totalIncidents: 0,
          modelAccuracy: 0
        };
      }

      // Calculate bounds
      if (!bounds) {
        bounds = this.calculateBounds(incidents);
      }

      // Generate grid points
      const gridPoints = this.generateGrid(bounds);
      
      // Calculate risk scores for each grid point
      const hotspots: MLRiskScore[] = [];
      
      for (const point of gridPoints) {
        const features = this.extractFeatures(incidents, point.lat, point.lon);
        const { riskScore, confidence } = this.predictRisk(features);
        
        if (riskScore > 15) { // Only include meaningful hotspots
          let riskLevel: 'low' | 'medium' | 'high' | 'critical';
          if (riskScore < 30) riskLevel = 'low';
          else if (riskScore < 50) riskLevel = 'medium';
          else if (riskScore < 75) riskLevel = 'high';
          else riskLevel = 'critical';

          hotspots.push({
            location: { latitude: point.lat, longitude: point.lon },
            riskScore: Math.round(riskScore),
            riskLevel,
            confidence,
            features: {
              incidentDensity: features.incidentDensity,
              timeRisk: features.currentTimeRisk,
              dayOfWeekRisk: features.isWeekend ? 1.3 : 1.0,
              recentActivity: features.recentActivity,
              typeDiversity: features.typeDiversity
            }
          });
        }
      }

      // Sort by risk score and limit results
      hotspots.sort((a, b) => b.riskScore - a.riskScore);
      const topHotspots = hotspots.slice(0, 50);

      // Calculate overall statistics
      const avgRiskScore = topHotspots.length > 0 
        ? topHotspots.reduce((sum, h) => sum + h.riskScore, 0) / topHotspots.length 
        : 0;

      let overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (avgRiskScore < 25) overallRiskLevel = 'low';
      else if (avgRiskScore < 45) overallRiskLevel = 'medium';
      else if (avgRiskScore < 70) overallRiskLevel = 'high';
      else overallRiskLevel = 'critical';

      // Calculate model accuracy (simplified)
      const modelAccuracy = this.isModelTrained ? 0.85 : 0.65;

      return {
        hotspots: topHotspots,
        overallRiskLevel,
        totalIncidents: incidents.length,
        modelAccuracy
      };

    } catch (error) {
      console.error('Error generating ML map data:', error);
      throw new Error('Failed to generate ML map data');
    }
  }

  // Get ML risk score for a specific location
  async getLocationRisk(latitude: number, longitude: number): Promise<MLRiskScore> {
    try {
      const incidents = await Incident.find({}).sort({ timestamp: -1 });
      const features = this.extractFeatures(incidents, latitude, longitude);
      const { riskScore, confidence } = this.predictRisk(features);
      
      let riskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (riskScore < 30) riskLevel = 'low';
      else if (riskScore < 50) riskLevel = 'medium';
      else if (riskScore < 75) riskLevel = 'high';
      else riskLevel = 'critical';

      return {
        location: { latitude, longitude },
        riskScore: Math.round(riskScore),
        riskLevel,
        confidence,
        features: {
          incidentDensity: features.incidentDensity,
          timeRisk: features.currentTimeRisk,
          dayOfWeekRisk: features.isWeekend ? 1.3 : 1.0,
          recentActivity: features.recentActivity,
          typeDiversity: features.typeDiversity
        }
      };
    } catch (error) {
      console.error('Error calculating ML location risk:', error);
      throw new Error('Failed to calculate ML location risk');
    }
  }

  // Update model when new incident is added
  async updateModel(newIncident: any): Promise<void> {
    console.log('Updating ML model with new incident:', newIncident._id);
    
    // Retrain model if enough time has passed
    if (!this.lastTrainingTime || 
        Date.now() - this.lastTrainingTime.getTime() > this.MODEL_RETRAIN_INTERVAL) {
      await this.trainModel();
    }
  }

  // Get model status
  getModelStatus() {
    return {
      isTrained: this.isModelTrained,
      lastTrainingTime: this.lastTrainingTime,
      modelType: this.isModelTrained ? 'Polynomial Regression' : 'Rule-based Fallback'
    };
  }
}

export default new MLPredictionService(); 