import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import {
  User, Client, Case, Hearing, Appointment, Document, Invoice, Payment, Receipt,
  Candidate, Payroll, Attendance, Leave, Task, Expense, Notification, ContactMessage, FirmSettings
} from '../models/index.js';

await connectDatabase();
const collections = [
  User, Client, Case, Hearing, Appointment, Document, Invoice, Payment, Receipt,
  Candidate, Payroll, Attendance, Leave, Task, Expense, Notification, ContactMessage, FirmSettings
];
await Promise.all(collections.map((Model) => Model.deleteMany({})));
await User.create({
  name: 'Administrator',
  email: 'admin@lawfirm.com',
  passwordHash: await bcrypt.hash('admin123', 12),
  role: 'admin',
  active: true
});
console.log('Database reset complete. Created only admin@lawfirm.com / admin123.');
await mongoose.disconnect();
