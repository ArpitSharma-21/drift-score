# Drift Score (MERN)
Task tracker that turns completion behaviour into a risk score, finds where your drift began, and gives week-wise and month-wise performance reports with an AI coach.

Stack: MongoDB + Express + React + Node.js (JWT auth, Recharts, node-cron, nodemailer, Gemini/Claude API).

## Try it with no keys
```
cd server && npm install && npm run demo
cd client && npm install && npm run dev      (second terminal)
```
Open http://localhost:5173 and register. Data resets on restart.

## Real setup
1. MongoDB: create a free Atlas M0 cluster, add a database user, allow your IP, paste the connection string as MONGO_URI.
2. AI: create a free key at aistudio.google.com and set GEMINI_API_KEY.
3. `cd server && cp .env.example .env`, fill it in, `npm run dev`. Tests: `npm test`.

## Deploy (free)
Single deployment: Atlas (database) + Render (Web Service, Build: npm run build, Start: npm start). The server serves the built React app. Env vars: MONGO_URI, JWT_SECRET, GEMINI_API_KEY.
