import mongoose from 'mongoose';
export default mongoose.model('User', new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  bestStreak: { type: Number, default: 0 },
  tz: { type: Number, default: 0 }, // browser getTimezoneOffset(), so nudges go out at the user's local time
  nudge: { email: { type: Boolean, default: false }, hour: { type: Number, default: 19 }, lastDay: String, lastId: String, sentDay: String },
  badges: [{ _id: false, id: String, earnedAt: Date }],
}, { timestamps: true }));
