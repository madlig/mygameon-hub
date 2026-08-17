import mongoose from 'mongoose';

const UserPreferencesSchema = new mongoose.Schema({
  adminEmail: {
    type: String,
    required: true,
    unique: true,
  },
  recentEmails: {
    type: [String],
    default: [],
  },
  recentGames: {
    type: Array, // Array of { id, name, ownerEmail }
    default: [],
  },
  favGames: {
    type: Array, // Array of { id, name, ownerEmail }
    default: [],
  },
  bundles: {
    type: Array, // Array of { id, name, items: [] }
    default: [],
  },
}, { timestamps: true });

export default mongoose.models.UserPreferences || mongoose.model('UserPreferences', UserPreferencesSchema);
