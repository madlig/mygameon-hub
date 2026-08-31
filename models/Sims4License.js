import mongoose from 'mongoose';

const Sims4LicenseSchema = new mongoose.Schema({
  invoice: { type: String, required: true, unique: true },
  hwid: { type: String, default: '' },
  cc: { type: String, enum: ['Y', 'N'], default: 'N' },
  status: { type: String, enum: ['Active', 'Banned'], default: 'Active' },
  email: { type: String, default: '', lowercase: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Sims4License || mongoose.model('Sims4License', Sims4LicenseSchema);
