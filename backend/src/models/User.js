import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin','client','lawyer','accountant','reception','hr','employee'], required: true, index: true },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  company: { type: String, default: '' },
  title: { type: String, default: '' },
  designation: { type: String, default: '' },
  department: { type: String, default: '' },
  joiningDate: Date,
  specialty: { type: String, default: '' },
  team: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.set('toJSON', { transform: (_doc, ret) => { delete ret.passwordHash; ret.id = ret._id; return ret; } });
export const User = mongoose.model('User', userSchema);
