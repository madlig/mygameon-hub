import mongoose from 'mongoose'

const desktopStateSchema = new mongoose.Schema({
  machineId: { type: String, required: true, unique: true }, // Identifier for the desktop PC (e.g. 'mygameon-pc-1')
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  folders: [{ 
    name: String, 
    path: String 
  }],
  currentTask: {
    status: { type: String, enum: ['idle', 'running', 'error', 'success'], default: 'idle' },
    progress: { type: Number, default: 0 },
    text: { type: String, default: '' },
    commandId: { type: mongoose.Schema.Types.ObjectId, ref: 'RemoteCommand', default: null }
  }
}, { timestamps: true })

export default mongoose.models.DesktopState || mongoose.model('DesktopState', desktopStateSchema)
