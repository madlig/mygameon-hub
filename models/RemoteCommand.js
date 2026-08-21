import mongoose from 'mongoose'

const remoteCommandSchema = new mongoose.Schema({
  machineId: { type: String, required: true }, // Which PC should execute this
  type: { type: String, required: true, enum: ['START_UPLOAD', 'PING', 'SCRAPE', 'PHOTOSHOP', 'PHOTOSHOP_EXPORT'] },
  payload: { type: mongoose.Schema.Types.Mixed }, // JSON payload with command args
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  result: { type: mongoose.Schema.Types.Mixed }, // Output from the command (e.g. scraped data)
  error: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete after 24h
})

export default mongoose.models.RemoteCommand || mongoose.model('RemoteCommand', remoteCommandSchema)
