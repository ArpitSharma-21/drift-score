import mongoose from 'mongoose';
export default mongoose.model('PushSub', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  endpoint: { type: String, unique: true, required: true },
  keys: { p256dh: String, auth: String },
}, { timestamps: true }));
