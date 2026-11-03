import mongoose from 'mongoose';
export default mongoose.model('User', new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
}, { timestamps: true }));
