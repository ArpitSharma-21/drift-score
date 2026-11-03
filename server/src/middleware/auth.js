import jwt from 'jsonwebtoken';
export default (req, res, next) => {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  try { req.userId = jwt.verify(t, process.env.JWT_SECRET).id; next(); }
  catch { res.status(401).json({ error: 'Unauthorized' }); }
};
