// scripts/generateMockData.ts
import mongoose from 'mongoose';
import { generateMockIncidents, generateTestScenario, clearMockData } from '../src/utils/mockDataGenerator';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crime-light';

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const command = process.argv[2];

    switch (command) {
      case 'generate':
        const count = parseInt(process.argv[3]) || 50;
        await generateMockIncidents(count);
        break;
      
      case 'scenario':
        await generateTestScenario();
        break;
      
      case 'clear':
        await clearMockData();
        break;
      
      default:
        console.log('Usage:');
        console.log('  npm run mock:generate [count] - Generate random mock incidents');
        console.log('  npm run mock:scenario        - Generate test scenario incidents');
        console.log('  npm run mock:clear          - Clear all mock data');
        break;
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main(); 