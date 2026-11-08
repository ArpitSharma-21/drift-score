import mongoose from 'mongoose';
export default mongoose.model('Doc', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  title: { type: String, required: true, maxlength: 80 },
  chars: Number, chunkCount: Number,
  mode: { type: String, default: 'keyword' }, // 'meaning' when embeddings were stored, else 'keyword'
}, { timestamps: true }));
