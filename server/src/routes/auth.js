import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
const r = Router();
const sign = u => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

r.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password || password.length < 6) return res.status(400).json({ error: 'Email and 6+ char password required' });
  if (await User.findOne({ email })) return res.status(409).json({ error: 'Email already used' });
  const u = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
  res.json({ token: sign(u), name: u.name });
});
r.post('/login', async (req, res) => {
  const u = await User.findOne({ email: req.body.email });
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password))) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: sign(u), name: u.name });
});
export default r;
