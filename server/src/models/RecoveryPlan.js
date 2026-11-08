import mongoose from 'mongoose';
export default mongoose.model('RecoveryPlan', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
  focus: String, summary: String,
  causes: [{ _id: false, text: String, evidence: String }],
  items: [{ _id: false, day: Number, title: String, category: String, topic: String, priority: Number }],
  sources: [{ _id: false, title: String, snippet: String }],
  mode: String, // search mode used: meaning | keyword | none
  trace: [{ _id: false, step: String, ms: Number }],
  status: { type: String, default: 'proposed' }, // proposed | active | finished | dismissed
  approvedAt: Date, result: { done: Number, total: Number },
}, { timestamps: true }));
