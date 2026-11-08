import mongoose from 'mongoose';
export default mongoose.model('Chunk', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
  doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Doc', index: true, required: true },
  idx: Number, text: String, embedding: { type: [Number], default: undefined },
}));
