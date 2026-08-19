import mongoose from 'mongoose'

const customerSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  orderCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'blacklisted'],
    default: 'active'
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema)

export default Customer
