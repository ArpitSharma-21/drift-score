import mongoose from 'mongoose';
const s = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, default: 'general' }, // dsa, assignment, project...
  priority: { type: Number, min: 1, max: 5, default: 3 },
  dueDate: { type: Date, required: true },
  completedAt: Date,
  topic: { type: String, default: '', trim: true, maxlength: 40 },
  source: { type: String, default: '' }, // 'drift-ai' for tasks created from an approved plan
  planId: { type: mongoose.Schema.Types.ObjectId, index: true },
  reminded: { type: Boolean, default: false },
}, { timestamps: true });
export default mongoose.model('Task', s);
