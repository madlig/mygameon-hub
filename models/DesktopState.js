import mongoose from 'mongoose'

const desktopStateSchema = new mongoose.Schema({
  machineId: { type: String, required: true, unique: true }, // Identifier for the desktop PC (e.g. 'mygameon-pc-1')
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  uploadPath: { type: String },
  folders: [{ 
    name: String, 
    path: String,
    hasArchive: Boolean,
    archiveParts: Number
  }],
  currentTask: {
    status: { type: String, default: 'idle' },
    progress: { type: Number, default: 0 },
    text: { type: String, default: '' },
    commandId: { type: mongoose.Schema.Types.Mixed, default: null }
  }
}, { timestamps: true })

export default mongoose.models.DesktopState || mongoose.model('DesktopState', desktopStateSchema)
