import mongoose from 'mongoose'

const studioTaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  targetDate: {
    type: String,
    default: ''
  },
  taskType: {
    type: String,
    enum: ['new', 'update'],
    default: 'new'
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
  timestamps: true,
  strict: false
})

if (mongoose.models.StudioTask) {
  delete mongoose.models.StudioTask
}
const StudioTask = mongoose.model('StudioTask', studioTaskSchema)

export default StudioTask
