import { Schema, model, Document } from 'mongoose';

export interface IIncident extends Document {
  type: string;
  description: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  userId: string;
  status: string;
}

const incidentSchema = new Schema<IIncident>({
  type: { type: String, required: true },
  description: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  userId: { type: String, required: true },
  status: { type: String, default: 'pending' },
});

export default model<IIncident>('Incident', incidentSchema); 