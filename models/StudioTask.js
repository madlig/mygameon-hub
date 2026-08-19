import mongoose from 'mongoose'

const studioTaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  isUploaded: {
    type: Boolean,
    default: false
  },
  shopeeListed: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

const StudioTask = mongoose.models.StudioTask || mongoose.model('StudioTask', studioTaskSchema)

export default StudioTask
