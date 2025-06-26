// utils/mockDataGenerator.ts
import Incident from '../models/incident';

interface MockIncident {
  type: string;
  description: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  userId: string;
}

const mockIncidentTypes = [
  'theft',
  'assault',
  'vandalism',
  'suspicious person',
  'burglary',
  'harassment',
  'drug activity',
  'vehicle theft'
];

const mockDescriptions = [
  'Suspicious person loitering',
  'Vehicle break-in reported',
  'Graffiti on building',
  'Fight in progress',
  'Stolen bicycle',
  'Harassment at bus stop',
  'Drug deal observed',
  'Car window smashed',
  'Purse snatching',
  'Suspicious package'
];

// Generate random coordinates within a bounding box
function generateRandomLocation(
  centerLat: number,
  centerLon: number,
  radiusKm: number = 5
): { latitude: number; longitude: number } {
  const latOffset = (Math.random() - 0.5) * (radiusKm / 111); // 1 degree ≈ 111 km
  const lonOffset = (Math.random() - 0.5) * (radiusKm / (111 * Math.cos(centerLat * Math.PI / 180)));
  
  return {
    latitude: centerLat + latOffset,
    longitude: centerLon + lonOffset
  };
}

// Generate random timestamp within the last 30 days
function generateRandomTimestamp(): Date {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const randomTime = new Date(thirtyDaysAgo.getTime() + Math.random() * (now.getTime() - thirtyDaysAgo.getTime()));
  return randomTime;
}

// Generate mock incidents
export async function generateMockIncidents(count: number = 50): Promise<void> {
  try {
    console.log(`Generating ${count} mock incidents...`);

    // Define some hotspot areas (realistic coordinates)
    const hotspotAreas = [
      { lat: 40.7128, lon: -74.0060, name: 'Downtown NYC' },
      { lat: 40.7589, lon: -73.9851, name: 'Times Square' },
      { lat: 40.7505, lon: -73.9934, name: 'Penn Station' },
      { lat: 40.7484, lon: -73.9857, name: 'Madison Square Garden' },
      { lat: 40.7527, lon: -73.9772, name: 'Grand Central' }
    ];

    const mockIncidents: MockIncident[] = [];

    for (let i = 0; i < count; i++) {
      // Randomly select a hotspot area
      const area = hotspotAreas[Math.floor(Math.random() * hotspotAreas.length)];
      
      // Generate location near the hotspot (some clustering)
      const location = generateRandomLocation(area.lat, area.lon, 2);
      
      const incident: MockIncident = {
        type: mockIncidentTypes[Math.floor(Math.random() * mockIncidentTypes.length)],
        description: mockDescriptions[Math.floor(Math.random() * mockDescriptions.length)],
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: generateRandomTimestamp(),
        userId: 'mock-user-id-' + Math.floor(Math.random() * 10) // Mock user IDs
      };

      mockIncidents.push(incident);
    }

    // Insert into database
    await Incident.insertMany(mockIncidents);
    
    console.log(`Successfully generated ${count} mock incidents`);
    console.log('Hotspot areas used:');
    hotspotAreas.forEach(area => {
      console.log(`- ${area.name}: ${area.lat}, ${area.lon}`);
    });

  } catch (error) {
    console.error('Error generating mock incidents:', error);
    throw error;
  }
}

// Clear all mock data
export async function clearMockData(): Promise<void> {
  try {
    const result = await Incident.deleteMany({ userId: /^mock-user-id-/ });
    console.log(`Cleared ${result.deletedCount} mock incidents`);
  } catch (error) {
    console.error('Error clearing mock data:', error);
    throw error;
  }
}

// Generate incidents for testing specific scenarios
export async function generateTestScenario(): Promise<void> {
  try {
    console.log('Generating test scenario with specific patterns...');

    const now = new Date();
    const testIncidents: MockIncident[] = [];

    // Scenario 1: High-risk area (many recent incidents)
    for (let i = 0; i < 15; i++) {
      testIncidents.push({
        type: 'theft',
        description: 'Recent theft incident',
        latitude: 40.7128 + (Math.random() - 0.5) * 0.01,
        longitude: -74.0060 + (Math.random() - 0.5) * 0.01,
        timestamp: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Last 7 days
        userId: 'mock-user-id-1'
      });
    }

    // Scenario 2: Night-time incidents
    for (let i = 0; i < 10; i++) {
      const nightTime = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      nightTime.setHours(22 + Math.random() * 8); // 10 PM - 6 AM
      
      testIncidents.push({
        type: 'assault',
        description: 'Night-time incident',
        latitude: 40.7589 + (Math.random() - 0.5) * 0.01,
        longitude: -73.9851 + (Math.random() - 0.5) * 0.01,
        timestamp: nightTime,
        userId: 'mock-user-id-2'
      });
    }

    // Scenario 3: Weekend incidents
    for (let i = 0; i < 8; i++) {
      const weekendTime = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      weekendTime.setDate(weekendTime.getDate() - weekendTime.getDay() + (Math.random() > 0.5 ? 0 : 6)); // Saturday or Sunday
      
      testIncidents.push({
        type: 'vandalism',
        description: 'Weekend vandalism',
        latitude: 40.7505 + (Math.random() - 0.5) * 0.01,
        longitude: -73.9934 + (Math.random() - 0.5) * 0.01,
        timestamp: weekendTime,
        userId: 'mock-user-id-3'
      });
    }

    await Incident.insertMany(testIncidents);
    console.log(`Generated ${testIncidents.length} test scenario incidents`);

  } catch (error) {
    console.error('Error generating test scenario:', error);
    throw error;
  }
} 