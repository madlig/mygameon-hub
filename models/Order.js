import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema({
  email: {
    type: String,
    lowercase: true,
    trim: true,
    index: true,
    default: ''
  },
  invoice: {
    type: String,
    default: '',
    index: true,
    trim: true
  },
  cartItems: [{
    name: String,
    targetId: String,
    ownerEmail: String,
    isBonus: Boolean,
    isSims4: Boolean,
    allowCC: Boolean
  }],
  orderDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  bonusEligible: {
    type: Number,
    default: 0
  },
  bonusClaimed: {
    type: Number,
    default: 0
  }
})

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema)
export default Order
