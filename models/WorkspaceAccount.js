import mongoose from 'mongoose';

const WorkspaceAccountSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  refreshToken: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: 'active', // active, error
  },
  gameFolderId: {
    type: String,
    default: 'root', // 'root' = My Drive root, karena game langsung di root
  },
  lastCatalogSync: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

export default mongoose.models.WorkspaceAccount || mongoose.model('WorkspaceAccount', WorkspaceAccountSchema);
