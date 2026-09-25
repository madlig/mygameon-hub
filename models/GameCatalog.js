import mongoose from 'mongoose';

const GameCatalogSchema = new mongoose.Schema({
  // ── Inventori Riil Google Drive ──
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
    type: Number, // bytes murni dari scanning Google Drive
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

  // ── Aset & Metadata Resmi Steam / SteamDB ──
  steamAppId: {
    type: String,
    default: null,
    index: true,
  },
  cleanTitle: {
    type: String,
    default: null,
  },
  coverImageUrl: {
    type: String, // library_600x900.jpg dari CDN Steam
    default: null,
  },
  headerBannerUrl: {
    type: String, // header.jpg dari CDN Steam
    default: null,
  },
  screenshots: {
    type: [String],
    default: [],
  },
  genres: {
    type: [String],
    default: [],
  },
  tags: {
    type: [String],
    default: [],
  },
  shortDescription: {
    type: String,
    default: '',
  },
  releaseYear: {
    type: String,
    default: '',
  },
  developer: {
    type: String,
    default: '',
  },
  specs: {
    minimum: {
      os: { type: String, default: '' },
      cpu: { type: String, default: '' },
      ram: { type: String, default: '' },
      gpu: { type: String, default: '' },
      storage: { type: String, default: '' },
      directx: { type: String, default: '' },
    },
    recommended: {
      os: { type: String, default: '' },
      cpu: { type: String, default: '' },
      ram: { type: String, default: '' },
      gpu: { type: String, default: '' },
      storage: { type: String, default: '' },
      directx: { type: String, default: '' },
    },
  },

  // ── Storefront & Status ──
  packageType: {
    type: String,
    default: 'PRE-INSTALLED',
  },
  fileVersion: {
    type: String,
    default: '',
  },
  shopeeUrl: {
    type: String,
    default: '',
  },
  isPublished: {
    type: Boolean,
    default: true,
  },
  firestoreSyncedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// Full-text search index untuk pencarian game
GameCatalogSchema.index({ name: 'text', cleanTitle: 'text' });

export default mongoose.models.GameCatalog || mongoose.model('GameCatalog', GameCatalogSchema);
