import mongoose from 'mongoose'

const uploadHistorySchema = new mongoose.Schema({
  gameName: {
    type: String,
    required: true,
    trim: true
  },
  workspaceEmail: {
    type: String,
    required: true,
    trim: true
  },
  totalSize: {
    type: Number,
    required: true
  },
  fileCount: {
    type: Number,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
})

uploadHistorySchema.index({ uploadedAt: -1 })

const UploadHistory = mongoose.models.UploadHistory || mongoose.model('UploadHistory', uploadHistorySchema)

export default UploadHistory
