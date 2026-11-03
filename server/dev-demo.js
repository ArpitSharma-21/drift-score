// Runs the API against a throwaway in-memory MongoDB. No keys needed. Run: npm run demo
import { MongoMemoryServer } from 'mongodb-memory-server';
const mongod = await MongoMemoryServer.create();
process.env.MONGO_URI = mongod.getUri('driftscore');
process.env.JWT_SECRET = 'demo-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
await import('./src/index.js');
