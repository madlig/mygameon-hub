import mongoose from 'mongoose'

const accessLogSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  gameName: {
    type: String,
    required: true
  },
  folderId: {
    type: String,
    required: true
  },
  permissionId: {
    type: String,
    required: true
  },
  ownerEmail: {
    type: String,
    required: true
  },
  isBonus: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked'],
    default: 'active'
  },
  expiresAt: {
    type: Date,
    default: null
  },
  grantedAt: {
    type: Date,
    default: Date.now
  }
})

// Index untuk query yang sering dilakukan
accessLogSchema.index({ email: 1, status: 1 })
accessLogSchema.index({ expiresAt: 1, status: 1 })

const AccessLog = mongoose.models.AccessLog || mongoose.model('AccessLog', accessLogSchema)

export default AccessLog
