import mongoose from 'mongoose'

const bonusSchemaData = new mongoose.Schema({
  rules: [{
    buyMin: { type: Number, required: true },
    getBonus: { type: Number, required: true }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
})

const BonusSchema = mongoose.models.BonusSchema || mongoose.model('BonusSchema', bonusSchemaData)
export default BonusSchema
