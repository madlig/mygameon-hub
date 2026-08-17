import mongoose from 'mongoose';

const GameCatalogSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true,
  },
  folderId: {
    type: String,
    required: true,
    unique: true, // 1 folder game = 1 entry, tidak boleh duplikat
  },
  ownerEmail: {
    type: String,
    required: true,
    index: true,
  },
  fileCount: {
    type: Number,
    default: 0,
  },
  totalSize: {
    type: Number, // bytes
    default: 0,
  },
  sendCount: {
    type: Number, // counter pengiriman
    default: 0,
  },
  lastSyncedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// Full-text search index untuk pencarian game
GameCatalogSchema.index({ name: 'text' });

export default mongoose.models.GameCatalog || mongoose.model('GameCatalog', GameCatalogSchema);
