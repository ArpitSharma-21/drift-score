// The daily nudge messages. The texts are exactly as written by the project owner.
// "when" = which situation a message fits: any, behind (overdue tasks), inactive (was active before but
// nothing finished in 2 days), streak (3+ day streak), yesterday (running streak, nothing done yet today).
import { computeStreak } from './streak.js';

export const NUDGES = [
  // Savage and roasting
  { id: 'sv1', when: ['behind'], text: "Your books filed a missing person report. Should we be worried? 💀" },
  { id: 'sv2', when: ['behind'], text: "Even your syllabus has stopped expecting anything from you. 😭" },
  { id: 'sv3', when: ['behind'], text: "Your productivity is playing hide and seek. It's winning." },
  { id: 'sv4', when: ['any'], text: "Bro opened the laptop just to admire the wallpaper. 💻" },
  { id: 'sv5', when: ['behind'], text: "Your goals called. They said they've been ghosted." },
  { id: 'sv6', when: ['any'], text: "At this point, even Google doesn't know what you're studying." },
  { id: 'sv7', when: ['behind'], text: "Your study schedule is more fictional than Bollywood love stories." },
  { id: 'sv8', when: ['any'], text: "Netflix isn't the only thing getting your attention. Your future is crying too. 😂" },
  { id: 'sv9', when: ['behind'], text: "Breaking news: Student spotted avoiding responsibilities again!" },
  { id: 'sv10', when: ['behind'], text: "Your chair has seen more studying than you have." },
  // Flirty and cheeky
  { id: 'fl1', when: ['inactive'], text: "Hey stranger, haven't seen you studying lately. Should I get jealous? 😉" },
  { id: 'fl2', when: ['any'], text: "Are you Wi-Fi? Because I'm feeling disconnected from your productivity." },
  { id: 'fl3', when: ['any'], text: "I was thinking about you... then I checked your study hours. We need to talk. 👀" },
  { id: 'fl4', when: ['inactive'], text: "You + Books = My favourite couple. When's the reunion? ❤️" },
  { id: 'fl5', when: ['inactive'], text: "Stop making me miss your productive side. 🥹" },
  { id: 'fl6', when: ['streak'], text: "If consistency were attractive, you'd be irresistible. Just saying. 😉" },
  { id: 'fl7', when: ['any'], text: "Your future is waiting for you. Don't keep it single for too long." },
  { id: 'fl8', when: ['inactive'], text: "I have a crush on your discipline. Can I see it again?" },
  { id: 'fl9', when: ['streak'], text: "Not to flirt, but your study streak looks really attractive." },
  { id: 'fl10', when: ['yesterday'], text: "You looked productive yesterday. I haven't stopped thinking about it. ❤️" },
  // Unexpected and random
  { id: 'rn1', when: ['any'], text: "This is your daily reminder that you're not a potato. Grow. 🥔" },
  { id: 'rn2', when: ['inactive'], text: "A mosquito just completed more activity than you today. Respectfully." },
  { id: 'rn3', when: ['any'], text: "Your keyboard misses being touched for productive reasons." },
  { id: 'rn4', when: ['any'], text: "Somewhere, someone is studying. Don't let them win." },
  { id: 'rn5', when: ['any'], text: "Plot twist: Your exam won't postpone itself." },
  { id: 'rn6', when: ['any'], text: "The universe sent you a sign. Unfortunately, it's this notification." },
  { id: 'rn7', when: ['any'], text: "Your laptop is ready. Your brain is still buffering... ⏳" },
  { id: 'rn8', when: ['behind'], text: "I checked your progress. Even my calculator is disappointed." },
  { id: 'rn9', when: ['any'], text: "Your dreams are expensive. Studying is currently free." },
  { id: 'rn10', when: ['inactive'], text: "Hello? Is this thing on? Your productivity seems offline." },
];


export function pickNudge(state, lastId) {
  const on = Object.keys(state).filter(k => state[k]);
  let pool = NUDGES.filter(n => n.when.includes('any') || n.when.some(w => on.includes(w)));
  if (!pool.length) pool = NUDGES;
  const fresh = pool.filter(n => n.id !== lastId);
  const list = fresh.length ? fresh : pool;
  return list[Math.floor(Math.random() * list.length)];
}

// tasks need only completedAt and dueDate. offsetMin is the user's getTimezoneOffset().
export function stateFor(tasks, offsetMin = 0, now = new Date()) {
  const done = tasks.filter(t => t.completedAt);
  const s = computeStreak(done.map(t => t.completedAt), offsetMin, now);
  return {
    activeToday: s.activeToday,
    state: {
      behind: tasks.some(t => !t.completedAt && new Date(t.dueDate) < now),
      inactive: done.length > 0 && !done.some(t => now - new Date(t.completedAt) < 48 * 3600e3),
      streak: s.current >= 3,
      yesterday: s.current > 0 && !s.activeToday,
    },
  };
}
