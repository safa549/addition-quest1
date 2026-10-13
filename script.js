/* Addition Quest - Grade 2 math game (L3-5: Practice Adding Using Strategies)
   Plain JavaScript. No network requests, no storage, no cookies, no tracking.
   All scores live only in memory for the current play session. */
(function () {
'use strict';

/* ================= helpers ================= */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const rand = n => Math.floor(Math.random() * n);
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const tens = n => n - (n % 10);
const ones = n => n % 10;
const isFriendly = n => ones(n) !== 0 && 10 - ones(n) <= 5;
const MINUS = '\u2212';

/* ================= state ================= */
const state = {
  screen: 'welcome', started: false, level: 1, qIndex: 0, questions: [],
  score: 0, stars: 0, badges: [], results: {}, levelPoints: 0, levelStars: 0,
  sound: true, playCount: 0, tutTab: 'A', tutStep: 0, tutFrom: 'welcome', lock: false
};
let lastScore = 0, lastScreenKey = '', morphTimer = null;

/* ================= sound (generated in the browser, no files) ================= */
let audioCtx = null;
function ensureAudio() {
  try {
    if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { audioCtx = null; }
}
function tone(freq, start, dur, type, vol) {
  if (!state.sound || !audioCtx) return;
  try {
    const t = audioCtx.currentTime + start;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + dur + 0.05);
  } catch (e) { /* ignore sound errors */ }
}
const sfx = {
  click() { tone(520, 0, 0.08, 'triangle', 0.1); },
  good() { [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.18, 'sine', 0.16)); },
  bad() { tone(240, 0, 0.18, 'triangle', 0.12); tone(190, 0.12, 0.22, 'triangle', 0.1); },
  star() { tone(988, 0, 0.1, 'sine', 0.14); tone(1319, 0.1, 0.22, 'sine', 0.14); },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.22, 'square', 0.08)); }
};

/* ================= visual effects ================= */
function burst(count) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fx = $('#fx'); const em = ['⭐', '✨', '🎉', '💛', '🌟'];
  for (let i = 0; i < (count || 20); i++) {
    const s = document.createElement('span');
    s.className = 'bit'; s.textContent = em[rand(em.length)];
    s.style.left = (30 + rand(40)) + '%'; s.style.top = (30 + rand(20)) + '%';
    s.style.setProperty('--dx', (rand(500) - 250) + 'px');
    s.style.setProperty('--dy', (rand(420) - 300) + 'px');
    s.style.setProperty('--rot', (rand(360) - 180) + 'deg');
    fx.appendChild(s); setTimeout(() => s.remove(), 1600);
  }
}

/* ================= block pictures (tens rods and ones blocks) ================= */
function rodsOnly(t, cls) { return '<span class="rods ' + cls + '">' + '<i class="rod"></i>'.repeat(t) + '</span>'; }
function onesOnly(o, cls, gone) {
  let h = '';
  for (let i = 0; i < o; i++) h += '<i class="one' + (gone && i >= o - gone ? ' gone' : '') + '"></i>';
  return '<span class="ones ' + cls + '">' + h + '</span>';
}
function blocks(n, cls, gone) {
  return '<span class="blk" role="img" aria-label="' + n + ': ' + Math.floor(n / 10) + ' tens and ' + ones(n) + ' ones">' +
    rodsOnly(Math.floor(n / 10), cls) + onesOnly(ones(n), cls, gone) + '</span>';
}
function splitBlocks(n, cls) {
  return '<div class="splitcol"><div class="grp">' + rodsOnly(Math.floor(n / 10), cls) + onesOnly(ones(n), cls) + '</div>' +
    '<div class="lab">' + n + ' = ' + tens(n) + ' + ' + ones(n) + '</div></div>';
}

/* ================= question data ================= */
const L1_LIST = [[23, 14], [32, 25], [41, 16], [27, 31], [35, 22], [46, 13], [28, 34], [37, 26]];
const L2_LIST = [[29, 15], [39, 22], [48, 16], [59, 24], [27, 18], [38, 25], [49, 13], [58, 17]];
const L3_LIST = [[34, 27], [49, 16], [26, 32], [38, 24], [45, 23], [59, 18], [47, 25], [36, 28]];
/* Tournament pools (all different from Levels 1-3) */
const TB = [[42, 36], [53, 24], [64, 15], [37, 45], [26, 48], [18, 53], [44, 38], [61, 29]];
const TC = [[19, 43], [39, 36], [28, 45], [48, 34], [57, 26], [69, 22], [38, 47], [29, 58]];
const TS = [[36, 27], [49, 35], [54, 29], [43, 38], [25, 49], [67, 24], [28, 55], [17, 46]];

function genBreak() {
  for (let i = 0; i < 300; i++) { const a = 21 + rand(38), b = 11 + rand(30); if (a !== b && a + b <= 99 && ones(a) && ones(b)) return [a, b]; }
  return [23, 14];
}
function genComp() {
  for (let i = 0; i < 300; i++) {
    const n = 20 + 10 * rand(5) + 7 + rand(3), m = 11 + rand(30);
    if (m !== n && ones(m) && n + m <= 99) return rand(2) ? [n, m] : [m, n];
  }
  return [29, 15];
}
function genChoose() {
  for (let i = 0; i < 300; i++) {
    const a = 24 + rand(36), b = 16 + rand(24);
    if (a !== b && a + b <= 99 && (ones(a) >= 5 || ones(b) >= 5)) return [a, b];
  }
  return [34, 27];
}
/* First play = the listed questions in order. Replays = half listed, half new, shuffled. */
function mixed(list, gen, n) {
  if (state.playCount === 0) return list.slice(0, n);
  const keys = new Set(), out = [];
  shuffle(list).slice(0, Math.ceil(n / 2)).forEach(p => { out.push(p); keys.add(p.join('+')); });
  let guard = 0;
  while (out.length < n && guard++ < 800) {
    const p = gen(), k = p.join('+');
    if (!keys.has(k) && !list.some(l => l.join('+') === k)) { out.push(p); keys.add(k); }
  }
  let i = 0; while (out.length < n) out.push(list[i++ % list.length]);
  return shuffle(out);
}

/* Math Detective items. Every worked example has been checked. */
const HINT_BREAK = ['Go step by step. Check every line of the work.', 'Remember: tens are worth 10 each, so 3 tens is 30. Add carefully.'];
const HINT_COMP = ['Look at the number that was changed. How much was added?', 'If you add extra to make a ten, you must take the same extra away at the end.'];
const DET = [
  { type: 'comp', who: ['🐻', 'Benny'], problem: '39 + 12', work: ['40 + 12 = 52', 'Answer: 52'], q: 'What did Benny forget?',
    options: ['Add the extra 1 back.', 'Subtract the extra 1.', 'Add 10 more.', 'Subtract 12.'], correct: 1,
    explain: 'Benny changed 39 to 40, so he added 1 extra. He must subtract 1 from 52. The correct answer is 51.' },
  { type: 'comp', who: ['🐰', 'Daisy'], problem: '29 + 24', work: ['30 + 24 = 54', 'Answer: 54'], q: 'What did Daisy forget?',
    options: ['Subtract the extra 1.', 'Add 1 more.', 'Add 10 more.', 'Subtract 24.'], correct: 0,
    explain: 'Daisy changed 29 to 30, so she added 1 extra. She must subtract 1 from 54. The correct answer is 53.' },
  { type: 'comp', who: ['🐸', 'Freddy'], problem: '58 + 17', work: ['60 + 17 = 77', 'Answer: 77'], q: 'What did Freddy forget?',
    options: ['Add 2 more.', 'Subtract 17.', 'Subtract the extra 2.', 'Subtract 10.'], correct: 2,
    explain: 'Freddy changed 58 to 60, so he added 2 extra. He must subtract 2 from 77. The correct answer is 75.' },
  { type: 'break', who: ['🐼', 'Penny'], problem: '45 + 32', work: ['40 + 30 = 70', 'Answer: 70'], q: 'What did Penny forget?',
    options: ['Subtract the ones.', 'Add the ones: 5 + 2.', 'Add 10 more.', 'Add the tens again.'], correct: 1,
    explain: 'Penny added the tens but forgot the ones. 5 + 2 = 7, and 70 + 7 = 77. The correct answer is 77.' },
  { type: 'break', who: ['🦊', 'Foxy'], problem: '24 + 35', work: ['20 + 30 = 50', '4 + 5 = 8', '50 + 8 = 58'], q: 'Which step has the mistake?',
    options: ['20 + 30 = 50', '4 + 5 = 8', '50 + 8 = 58', 'There is no mistake.'], correct: 1,
    explain: '4 + 5 = 9, not 8. So 50 + 9 = 59. The correct answer is 59.' },
  { type: 'break', who: ['🐻', 'Benny'], problem: '38 + 26', work: ['30 + 20 = 50', '8 + 6 = 14', '50 + 14 = 54'], q: 'Which step has the mistake?',
    options: ['30 + 20 = 50', '8 + 6 = 14', '50 + 14 = 54', '38 = 30 + 8'], correct: 2,
    explain: '50 + 14 = 64, not 54. 14 has one ten, so 50 + 10 = 60, then 60 + 4 = 64. The correct answer is 64.' },
  { type: 'comp', who: ['🐰', 'Daisy'], problem: '46 + 28', work: ['Change 28 to 30 (add 2)', '46 + 30 = 76', '76 + 2 = 78'], q: "What is Daisy's mistake?",
    options: ['She should subtract 2, not add 2.', 'She should add 2 more.', '46 + 30 is not 76.', 'She should change 46 instead.'], correct: 0,
    explain: 'Daisy added 2 to make 30, so she must take 2 away at the end. 76 ' + MINUS + ' 2 = 74. The correct answer is 74.' },
  { type: 'comp', who: ['🐸', 'Freddy'], problem: '49 + 23', work: ['Change 49 to 50 (add 1)', '50 + 23 = 73', '73 ' + MINUS + ' 10 = 63'], q: "What is Freddy's mistake?",
    options: ['He should subtract 1, not 10.', 'He should add 1.', '50 + 23 is 63.', 'He should change 23 to 20.'], correct: 0,
    explain: 'Freddy added only 1 extra, so he must subtract only 1. 73 ' + MINUS + ' 1 = 72. The correct answer is 72.' },
  { type: 'comp', who: ['🐼', 'Penny'], problem: '57 + 16', work: ['Change 57 to 60 (add 3)', '60 + 16 = 76', '76 ' + MINUS + ' 2 = 74'], q: "What is Penny's mistake?",
    options: ['She should subtract 2.', 'She should subtract 3, because she added 3.', 'She should add 3.', 'She should subtract 16.'], correct: 1,
    explain: 'Penny added 3 to make 60, so she must subtract 3. 76 ' + MINUS + ' 3 = 73. The correct answer is 73.' },
  { type: 'break', who: ['🦊', 'Foxy'], problem: '52 + 37', work: ['5 + 3 = 8', '2 + 7 = 9', '8 + 9 = 17'], q: "What is Foxy's mistake?",
    options: ['She added 5 + 3 instead of 50 + 30.', 'She should subtract 9.', '2 + 7 is not 9.', 'She should add 10 more.'], correct: 0,
    explain: 'The 5 and the 3 are tens! 50 + 30 = 80. Then 80 + 9 = 89. The correct answer is 89.' }
];
const DET_T = [
  { type: 'comp', who: ['🐻', 'Benny'], problem: '19 + 34', work: ['20 + 34 = 54', 'Answer: 54'], q: 'What did Benny forget?',
    options: ['Add the extra 1 back.', 'Subtract the extra 1.', 'Subtract 34.', 'Add 10 more.'], correct: 1,
    explain: 'Benny changed 19 to 20, so he added 1 extra. He must subtract 1 from 54. The correct answer is 53.' },
  { type: 'break', who: ['🐰', 'Daisy'], problem: '63 + 25', work: ['60 + 20 = 80', '3 + 5 = 7', '80 + 7 = 87'], q: 'Which step has the mistake?',
    options: ['60 + 20 = 80', '3 + 5 = 7', '80 + 7 = 87', '63 = 60 + 3'], correct: 1,
    explain: '3 + 5 = 8, not 7. So 80 + 8 = 88. The correct answer is 88.' },
  { type: 'comp', who: ['🐸', 'Freddy'], problem: '48 + 27', work: ['Change 48 to 50 (add 2)', '50 + 27 = 77', '77 + 2 = 79'], q: "What is Freddy's mistake?",
    options: ['He should add 2 more.', 'He should subtract 2, not add 2.', '50 + 27 is not 77.', 'He should subtract 10.'], correct: 1,
    explain: 'Freddy added 2 to make 50, so he must take 2 away. 77 ' + MINUS + ' 2 = 75. The correct answer is 75.' },
  { type: 'break', who: ['🐼', 'Penny'], problem: '55 + 38', work: ['50 + 30 = 80', '5 + 8 = 13', '80 + 13 = 83'], q: 'Which step has the mistake?',
    options: ['50 + 30 = 80', '5 + 8 = 13', '80 + 13 = 83', '55 = 50 + 5'], correct: 2,
    explain: '80 + 13 = 93, not 83. 80 + 10 = 90, then 90 + 3 = 93. The correct answer is 93.' }
];

const LEVELS = [
  { n: 1, title: 'Break Apart Challenge', icon: '🧱', count: 8, badge: { name: 'Block Builder', icon: '🧱' },
    intro: 'Split each number into tens and ones. Add the tens. Add the ones. Then put them together!' },
  { n: 2, title: 'Compensation Challenge', icon: '🔟', count: 8, badge: { name: 'Friendly Ten Finder', icon: '🔟' },
    intro: 'Make one number end in zero. Solve the easy problem. Then fix your answer!' },
  { n: 3, title: 'Choose Your Strategy', icon: '🧭', count: 8, badge: { name: 'Strategy Star', icon: '🧭' },
    intro: 'You pick the strategy! Both Break Apart and Compensation can work.' },
  { n: 4, title: 'Math Detective', icon: '🔍', count: 6, badge: { name: 'Super Detective', icon: '🔍' },
    intro: 'Our friends made mistakes. Can you find them?' },
  { n: 5, title: 'Final Addition Tournament', icon: '🏆', count: 10, badge: { name: 'Addition Hero', icon: '🏆' },
    intro: 'A mix of everything you learned. Show what you know and become an Addition Hero!' }
];

function buildQuestions(n) {
  const mk = (kind, direct) => p => ({ kind: kind, a: p[0], b: p[1], direct: direct });
  const det = it => ({ kind: 'detective', item: it, direct: false });
  if (n === 1) return mixed(L1_LIST, genBreak, 8).map(mk('break', true));
  if (n === 2) return mixed(L2_LIST, genComp, 8).map(mk('comp', false));
  if (n === 3) return mixed(L3_LIST, genChoose, 8).map(mk('choose', true));
  if (n === 4) return [DET[0]].concat(shuffle(DET.slice(1)).slice(0, 5)).map(det);
  const b = shuffle(TB).slice(0, 3).map(mk('break', true));
  const c = shuffle(TC).slice(0, 3).map(mk('comp', false));
  const s = shuffle(TS).slice(0, 2).map(mk('choose', true));
  const d = shuffle(DET_T).slice(0, 2).map(det);
  return shuffle(b.concat(c, s, d));
}

/* ================= compensation helpers ================= */
function bestPick(a, b) {
  const gap = n => (ones(n) === 0 ? 99 : 10 - ones(n));
  return gap(a) <= gap(b) ? a : b;
}
function setPick(q, n) {
  const s = q.s; s.n = n; s.m = (n === q.a ? q.b : q.a);
  s.g = 10 - ones(n); s.T = n + s.g; s.temp = s.T + s.m;
}
function gapOptions(g) {
  const set = new Set([g]); while (set.size < 4) set.add(1 + rand(9));
  return Array.from(set).sort((x, y) => x - y);
}
function readNum(id) {
  const el = $('#' + id); if (!el || el.value.trim() === '') return null;
  const v = Number(el.value); return Number.isFinite(v) ? v : null;
}
function numInput(id, label) {
  return '<input id="' + id + '" class="num" type="number" inputmode="numeric" pattern="[0-9]*" min="0" max="100" autocomplete="off" aria-label="' + label + '">';
}
const checkBtn = '<div class="tools"><button class="btn go" data-act="check">Check ✔</button></div>';

/* ================= tasks ================= */
const TASKS = {
  split: {
    say: 'Tens first, then ones. You can do it!',
    ui(q) {
      return '<p class="prompt">Break apart each number into tens and ones.</p>' +
        '<div class="eqrow">' + q.a + ' = ' + numInput('i1', 'tens of ' + q.a) + ' + ' + numInput('i2', 'ones of ' + q.a) + '</div>' +
        '<div class="eqrow">' + q.b + ' = ' + numInput('i3', 'tens of ' + q.b) + ' + ' + numInput('i4', 'ones of ' + q.b) + '</div>' + checkBtn;
    },
    check(q) {
      const v = [1, 2, 3, 4].map(i => readNum('i' + i));
      if (v.some(x => x === null)) return { empty: true, msg: 'Fill in every box first!' };
      const exp = [tens(q.a), ones(q.a), tens(q.b), ones(q.b)]; let ok = true;
      v.forEach((x, i) => { const good = x === exp[i]; $('#i' + (i + 1)).classList.toggle('bad', !good); if (!good) ok = false; });
      return ok ? { ok: true } : { ok: false, msg: 'Almost! Tens are worth 10 each, so 5 tens is 50. Fix the red boxes.' };
    },
    after(q) { q.s.trail.push(q.a + ' = ' + tens(q.a) + ' + ' + ones(q.a) + '  and  ' + q.b + ' = ' + tens(q.b) + ' + ' + ones(q.b)); },
    answer(q) { return tens(q.a) + ' + ' + ones(q.a) + ' and ' + tens(q.b) + ' + ' + ones(q.b); },
    hint(q, l) {
      const ex = [52, 73, 84, 61].find(x => x !== q.a && x !== q.b);
      return l === 0 ? 'Tens are the big digit. For example, ' + ex + ' has ' + Math.floor(ex / 10) + ' tens, which is ' + tens(ex) + '.'
        : 'Ones are the last digit. For example, ' + ex + ' = ' + tens(ex) + ' + ' + ones(ex) + '. Now try ' + q.a + '!';
    }
  },
  tens: {
    say: 'Add the tens. Think of the rods!',
    ui(q) { return '<p class="prompt">Add the tens.</p><div class="eqrow">' + tens(q.a) + ' + ' + tens(q.b) + ' = ' + numInput('i1', 'sum of the tens') + '</div>' + checkBtn; },
    check(q) {
      const v = readNum('i1'); if (v === null) return { empty: true, msg: 'Type a number first!' };
      const exp = tens(q.a) + tens(q.b); if (v === exp) return { ok: true };
      if (v === exp / 10) return { ok: false, msg: 'Tens are worth 10 each! ' + (exp / 10) + ' tens is ' + exp + ', not ' + v + '.' };
      return { ok: false, msg: 'Not quite. Count by tens with the rods and try again!' };
    },
    after(q) { q.s.trail.push('Tens: ' + tens(q.a) + ' + ' + tens(q.b) + ' = ' + (tens(q.a) + tens(q.b))); },
    answer(q) { return String(tens(q.a) + tens(q.b)); },
    hint(q, l) {
      return l === 0 ? 'One number has ' + (tens(q.a) / 10) + ' rods and the other has ' + (tens(q.b) / 10) + ' rods. How many rods in all? Each rod is worth 10.'
        : 'Count by tens: 10, 20, 30... Point to each rod as you count!';
    }
  },
  ones: {
    say: 'Now add the little ones blocks.',
    ui(q) { return '<p class="prompt">Add the ones.</p><div class="eqrow">' + ones(q.a) + ' + ' + ones(q.b) + ' = ' + numInput('i1', 'sum of the ones') + '</div>' + checkBtn; },
    check(q) {
      const v = readNum('i1'); if (v === null) return { empty: true, msg: 'Type a number first!' };
      return v === ones(q.a) + ones(q.b) ? { ok: true } : { ok: false, msg: 'Not quite. Count the little blocks and try again!' };
    },
    after(q) { q.s.trail.push('Ones: ' + ones(q.a) + ' + ' + ones(q.b) + ' = ' + (ones(q.a) + ones(q.b))); },
    answer(q) { return String(ones(q.a) + ones(q.b)); },
    hint(q, l) {
      const hi = Math.max(ones(q.a), ones(q.b)), lo = Math.min(ones(q.a), ones(q.b));
      return l === 0 ? 'Count the little blocks! One number has ' + ones(q.a) + ' and the other has ' + ones(q.b) + '.'
        : 'Start at ' + hi + ' and count up ' + lo + ' more. Use your fingers!';
    }
  },
  combine: {
    say: 'Put the parts together. Almost there!',
    ui(q) {
      const P = tens(q.a) + tens(q.b), Q = ones(q.a) + ones(q.b);
      return '<p class="prompt">Add the partial sums to get the answer.</p><div class="eqrow">' + P + ' + ' + Q + ' = ' + numInput('i1', 'final answer') + '</div>' + checkBtn;
    },
    check(q) {
      const v = readNum('i1'); if (v === null) return { empty: true, msg: 'Type a number first!' };
      const P = tens(q.a) + tens(q.b), Q = ones(q.a) + ones(q.b), exp = q.a + q.b;
      if (v === exp) return { ok: true };
      if (v === P) return { ok: false, msg: "Don't forget to add the ones too!" };
      if (Q >= 10 && v === exp - 10) return { ok: false, msg: 'Look at ' + Q + ': it has 1 ten and ' + (Q - 10) + ' ones. That ten counts too!' };
      return { ok: false, msg: 'Not quite. Add the tens part and the ones part together.' };
    },
    after() { /* question completes after this task */ },
    answer(q) { return String(q.a + q.b); },
    hint(q, l) {
      const P = tens(q.a) + tens(q.b), Q = ones(q.a) + ones(q.b);
      return l === 0 ? 'Add your two answers: ' + P + ' (the tens) and ' + Q + ' (the ones).'
        : (Q >= 10 ? 'Start with ' + P + ' and count on ' + Q + '. Remember, 10 ones make 1 more ten!' : 'Start with ' + P + ' and count on ' + Q + '. The ones go in the ones place.');
    }
  },
  pick: {
    say: 'Look for a number that is close to a ten.',
    ui(q) {
      return '<p class="prompt">Which number can you change to make a friendly ten? Tap it!</p><div class="mc">' +
        [q.a, q.b].map(n => '<button class="btn choice numchoice" data-act="choose" data-val="' + n + '">' + n + '</button>').join('') + '</div>';
    },
    check(q, val) {
      const n = Number(val);
      if (isFriendly(n)) { setPick(q, n); return { ok: true }; }
      const other = (n === q.a ? q.b : q.a);
      return { ok: false, msg: isFriendly(other) ? 'Try the other number. Can you make a number end in zero?' : 'Look for a number that is just below a ten.' };
    },
    after(q) { q.s.trail.push('Change ' + q.s.n + ' to make a friendly ten.'); },
    answer(q) { const n = bestPick(q.a, q.b); setPick(q, n); return String(n); },
    hint(q, l) { return l === 0 ? 'Can you make a number end in zero? Look for a number just below a ten.' : 'Which number is closer to the next ten? Try that one!'; }
  },
  gap: {
    say: 'How far is it to the next ten?',
    ui(q) {
      const s = q.s;
      return '<p class="prompt">We want ' + s.n + ' to end in zero. How many do we add?</p><div class="mc">' +
        gapOptions(s.g).map(g => '<button class="btn choice numchoice" data-act="choose" data-val="' + g + '">+' + g + '</button>').join('') + '</div>';
    },
    check(q, val) {
      return Number(val) === q.s.g ? { ok: true } : { ok: false, msg: 'Count up from ' + q.s.n + ' to the next number that ends in 0.' };
    },
    after(q) { const s = q.s; s.trail.push(s.n + ' + ' + s.g + ' = ' + s.T + '  (we added ' + s.g + ' extra)'); },
    answer(q) { return '+' + q.s.g; },
    hint(q, l) {
      return l === 0 ? 'Count up from ' + q.s.n + ' to the next number that ends in 0.' : 'Use your fingers: say ' + q.s.n + ', then count on one at a time until you reach a ten.';
    }
  },
  easy: {
    say: 'Numbers that end in zero are easy to add!',
    ui(q) { const s = q.s; return '<p class="prompt">Now solve the easier problem.</p><div class="eqrow">' + s.T + ' + ' + s.m + ' = ' + numInput('i1', 'easy sum') + '</div>' + checkBtn; },
    check(q) {
      const v = readNum('i1'); if (v === null) return { empty: true, msg: 'Type a number first!' };
      return v === q.s.temp ? { ok: true } : { ok: false, msg: 'Not quite. Add the tens first, then the ones.' };
    },
    after(q) { const s = q.s; s.trail.push(s.T + ' + ' + s.m + ' = ' + s.temp); },
    answer(q) { return String(q.s.temp); },
    hint(q, l) { return l === 0 ? 'Numbers that end in zero are easy to add. Try the tens first.' : 'Add the tens, then add the ones.'; }
  },
  adjust: {
    say: 'We added extra. What should we do now?',
    ui(q) {
      const s = q.s;
      const opts = shuffle([['sub', 'Subtract ' + s.g], ['add', 'Add ' + s.g], ['ten', 'Subtract 10']]);
      return '<p class="prompt">Our easy sum is ' + s.temp + '. We added ' + s.g + ' extra to ' + s.n + '. What must we do to fix it?</p><div class="mc">' +
        opts.map(o => '<button class="btn choice" data-act="choose" data-val="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>';
    },
    check(q, val) {
      if (val === 'sub') return { ok: true };
      if (val === 'add') return { ok: false, msg: 'We already added extra. Adding more makes the sum even bigger!' };
      return { ok: false, msg: 'We only added ' + q.s.g + ' extra, so we only take away ' + q.s.g + '.' };
    },
    after(q) { q.s.trail.push('Take away the extra ' + q.s.g + '.'); },
    answer(q) { return 'Subtract ' + q.s.g; },
    hint(q, l) { return l === 0 ? 'We made a number bigger. Is our easy sum too big or too small?' : 'To get back to the true answer, we must undo what we did.'; }
  },
  final: {
    say: 'Last step. Fix the sum!',
    ui(q) { const s = q.s; return '<p class="prompt">Adjust the easy sum to get the final answer.</p><div class="eqrow">' + s.temp + ' ' + MINUS + ' ' + s.g + ' = ' + numInput('i1', 'final answer') + '</div>' + checkBtn; },
    check(q) {
      const v = readNum('i1'); if (v === null) return { empty: true, msg: 'Type a number first!' };
      const s = q.s, exp = q.a + q.b;
      if (v === exp) return { ok: true };
      if (v === s.temp + s.g) return { ok: false, msg: 'Careful! We need to subtract, not add.' };
      if (v === s.temp) return { ok: false, msg: 'That is the easy sum. Now take away the extra ' + s.g + '!' };
      return { ok: false, msg: 'Not quite. Count back ' + s.g + ' from ' + s.temp + '.' };
    },
    after() { /* question completes after this task */ },
    answer(q) { return String(q.a + q.b); },
    hint(q, l) { return l === 0 ? 'Start at ' + q.s.temp + ' and count back ' + q.s.g + '.' : 'Use a number line. Hop back ' + q.s.g + ' times from ' + q.s.temp + '.'; }
  },
  strategy: {
    say: 'Both ways work. Pick the one you like!',
    ui() {
      return '<p class="prompt">Which strategy will you use?</p><div class="mc">' +
        '<button class="btn choice" data-act="choose" data-val="break">🧱 Break Apart Numbers</button>' +
        '<button class="btn choice" data-act="choose" data-val="comp">🔟 Compensation Method</button></div>' +
        '<p class="small muted">Both ways give the same answer!</p>';
    },
    check(q, val) {
      q.s.strategy = val;
      q.tasks = ['strategy'].concat(val === 'break' ? ['split', 'tens', 'ones', 'combine'] : ['pick', 'gap', 'easy', 'adjust', 'final']);
      return { ok: true };
    },
    after(q) { q.s.trail.push('Strategy: ' + (q.s.strategy === 'break' ? 'Break Apart Numbers' : 'Compensation Method')); },
    answer() { return ''; },
    hint(q, l) {
      return l === 0 ? 'Compensation works well when a number is close to a ten, like 39 or 48. Break Apart works for any numbers.' : "You can't go wrong. Both ways give the same answer!";
    }
  },
  direct: {
    say: 'Type the answer. You can do it!',
    ui(q) { return '<p class="prompt">Type your answer.</p><div class="eqrow">' + q.a + ' + ' + q.b + ' = ' + numInput('i1', 'answer') + '</div>' + checkBtn; },
    check(q) {
      const v = readNum('i1'); if (v === null) return { empty: true, msg: 'Type a number first!' };
      return v === q.a + q.b ? { ok: true } : { ok: false, msg: 'Not quite. Try again! A strategy can help you.' };
    },
    after() { /* completes */ },
    answer(q) { return String(q.a + q.b); },
    hint(q, l) { return l === 0 ? 'Try breaking the numbers into tens and ones, or make a friendly ten.' : 'Add the tens, add the ones, then put the parts together.'; }
  },
  detect: {
    say: 'Read the work slowly. Where does it go wrong?',
    ui(q) {
      const it = q.item, s = q.s;
      return '<div class="detect"><div class="who" aria-hidden="true">' + it.who[0] + '</div><div class="notebook"><div class="nbtitle">' + it.who[1] + "'s work for " + it.problem + '</div>' +
        it.work.map(l => '<div class="nbline">' + l + '</div>').join('') + '</div></div>' +
        '<p class="prompt">🔍 ' + it.q + '</p><div class="mc">' +
        s.opts.map((o, i) => '<button class="btn choice" data-act="choose" data-val="' + i + '"><b>' + 'ABCD'[i] + '</b> ' + o.t + '</button>').join('') + '</div>';
    },
    check(q, val) {
      return q.s.opts[Number(val)].ok ? { ok: true } : { ok: false, msg: "Hmm, that's not the mistake. Read each step again!" };
    },
    after() { /* completes */ },
    answer(q) { return q.s.opts.find(o => o.ok).t; },
    hint(q, l) { const h = q.item.type === 'comp' ? HINT_COMP : HINT_BREAK; return h[l]; }
  }
};

/* ================= question flow ================= */
const curQ = () => state.questions[state.qIndex];
const praise = () => ['Great job!', 'Awesome!', 'You got it!', 'Super!', 'Fantastic!', 'Nice thinking!', 'Brilliant!'][rand(7)];

function initialTasks(q) {
  if (q.kind === 'break') return ['split', 'tens', 'ones', 'combine'];
  if (q.kind === 'comp') return ['pick', 'gap', 'easy', 'adjust', 'final'];
  if (q.kind === 'choose') return ['strategy'];
  return ['detect'];
}
function initQuestion() {
  const q = curQ();
  q.s = { task: 0, mistakes: 0, hints: 0, taskWrong: 0, hintLevel: 0, trail: [], msg: null, msgKind: '', done: false, pts: 0, star: false };
  q.tasks = initialTasks(q);
  if (q.kind === 'detective') q.s.opts = shuffle(q.item.options.map((t, i) => ({ t: t, ok: i === q.item.correct })));
}

function startLevelIntro(n) { state.level = n; state.screen = 'intro'; render(); }
function startLevel(n) {
  state.level = n; state.qIndex = 0; state.levelPoints = 0; state.levelStars = 0;
  state.questions = buildQuestions(n); state.screen = 'question'; initQuestion(); render();
}
function startGame() {
  Object.assign(state, { started: true, score: 0, stars: 0, badges: [], results: {}, levelPoints: 0, levelStars: 0 });
  lastScore = 0; startLevelIntro(1);
}

function setBubble(text, kind) {
  const b = $('#bubble'); if (!b) return;
  b.textContent = text; b.className = 'bubble ' + (kind || '');
}
function shakeTask() {
  const t = $('.task'); if (!t) return;
  t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake');
}
function afterWrong(q, msg) {
  const s = q.s; s.mistakes++; s.taskWrong++; sfx.bad(); shakeTask();
  setBubble(msg || 'Not quite. Try again!', 'bad');
  if (s.taskWrong >= 3 && q.tasks[s.task] !== 'strategy') { const b = $('#showme'); if (b) b.hidden = false; }
}
function passTask(q, revealedText) {
  const s = q.s, name = q.tasks[s.task];
  TASKS[name].after(q);
  sfx.good(); burst(10);
  s.task++; s.taskWrong = 0; s.hintLevel = 0; state.lock = false;
  if (s.task >= q.tasks.length) { completeQuestion(q, revealedText); return; }
  s.msg = revealedText ? revealedText : praise() + ' Next step!'; s.msgKind = 'ok';
  render();
}
function completeQuestion(q, revealedText) {
  const s = q.s;
  s.done = true; s.pts = Math.max(3, 10 - 2 * s.mistakes - s.hints); s.star = s.mistakes === 0;
  state.score += s.pts; state.levelPoints += s.pts;
  if (s.star) { state.stars++; state.levelStars++; }
  s.revealNote = revealedText || '';
  burst(26); setTimeout(() => sfx.star(), 150);
  render();
}
function onCheck() {
  const q = curQ(); if (!q || q.s.done || state.lock) return;
  const name = q.tasks[q.s.task], res = TASKS[name].check(q);
  if (res.empty) { setBubble(res.msg, 'bad'); return; }
  if (res.ok) passTask(q); else afterWrong(q, res.msg);
}
function onChoose(btn) {
  const q = curQ(); if (!q || q.s.done || state.lock) return;
  const name = q.tasks[q.s.task], res = TASKS[name].check(q, btn.dataset.val);
  if (res.ok) {
    btn.classList.add('right'); state.lock = true;
    if (name === 'strategy') { passTask(q); return; }
    setTimeout(() => { if (curQ() === q) passTask(q); else state.lock = false; }, 450);
  } else {
    btn.classList.add('wrong'); btn.disabled = true; afterWrong(q, res.msg);
  }
}
function onHint() {
  const q = curQ(); if (!q || q.s.done) return;
  const s = q.s, name = q.tasks[s.task];
  const text = TASKS[name].hint(q, Math.min(s.hintLevel, 1));
  s.hintLevel++; s.hints++; sfx.click(); setBubble('💡 ' + text, 'hint');
}
function onShowMe() {
  const q = curQ(); if (!q || q.s.done || state.lock) return;
  const s = q.s, name = q.tasks[s.task]; s.mistakes++;
  const ans = TASKS[name].answer(q);
  passTask(q, 'The answer is ' + ans + '. Watch how it works, then keep going!');
}
function onDirect() {
  const q = curQ(); if (!q || q.s.done) return;
  q.tasks = ['direct']; q.s.task = 0; q.s.taskWrong = 0; q.s.hintLevel = 0;
  q.s.msg = 'Type the answer. You can do it!'; q.s.msgKind = ''; sfx.click(); render();
}
function onNext() {
  sfx.click();
  if (state.qIndex + 1 < state.questions.length) { state.qIndex++; initQuestion(); render(); } else finishLevel();
}
function finishLevel() {
  const L = LEVELS[state.level - 1];
  state.results[state.level] = { points: state.levelPoints, stars: state.levelStars, count: state.questions.length };
  if (!state.badges.some(b => b.name === L.badge.name)) state.badges.push(L.badge);
  state.screen = state.level === 5 ? 'final' : 'levelDone';
  sfx.win(); burst(40); render();
}

/* ================= solutions shown after each question ================= */
function breakSolution(a, b) {
  const ta = tens(a), oa = ones(a), tb = tens(b), ob = ones(b);
  return '<div class="sol"><b>🧱 Break Apart</b><div>' + a + ' = ' + ta + ' + ' + oa + ' &nbsp; and &nbsp; ' + b + ' = ' + tb + ' + ' + ob + '</div>' +
    '<div>Tens: ' + ta + ' + ' + tb + ' = ' + (ta + tb) + '</div><div>Ones: ' + oa + ' + ' + ob + ' = ' + (oa + ob) + '</div>' +
    '<div>' + (ta + tb) + ' + ' + (oa + ob) + ' = <b>' + (a + b) + '</b></div></div>';
}
function compSolution(a, b) {
  const n = bestPick(a, b), m = (n === a ? b : a), g = 10 - ones(n), T = n + g, temp = T + m;
  return '<div class="sol"><b>🔟 Compensation</b><div>Change ' + n + ' to ' + T + ' (add ' + g + ').</div>' +
    '<div>' + T + ' + ' + m + ' = ' + temp + '</div><div>We added ' + g + ' extra, so subtract ' + g + ': ' + temp + ' ' + MINUS + ' ' + g + ' = <b>' + (a + b) + '</b></div></div>';
}
function solutionHTML(q) {
  if (q.kind === 'detective') {
    return '<div class="sol"><div>' + q.item.explain + '</div></div>';
  }
  const how = q.kind === 'comp' ? 'comp' : (q.kind === 'choose' && q.s.strategy === 'comp' ? 'comp' : 'break');
  return how === 'comp' ? compSolution(q.a, q.b) : breakSolution(q.a, q.b);
}

/* ================= screens ================= */
function soundBtn(cls) {
  return '<button class="' + cls + ' js-sound" data-act="sound" aria-label="Turn sound on or off"><span class="ico">' + (state.sound ? '🔊' : '🔇') +
    '</span><span class="txt">Sound: ' + (state.sound ? 'On' : 'Off') + '</span></button>';
}
function updateSoundButtons() {
  $$('.js-sound').forEach(b => {
    $('.ico', b).textContent = state.sound ? '🔊' : '🔇';
    $('.txt', b).textContent = 'Sound: ' + (state.sound ? 'On' : 'Off');
  });
}

function renderHud() {
  const hud = $('#hud');
  if (!state.started || state.screen === 'welcome' || state.screen === 'tutorial') { hud.hidden = true; hud.innerHTML = ''; return; }
  hud.hidden = false;
  const dots = LEVELS.map(L => {
    const cls = state.results[L.n] ? 'done' : (L.n === state.level ? 'now' : '');
    return '<li class="' + cls + '" aria-label="Level ' + L.n + (cls === 'done' ? ' finished' : cls === 'now' ? ' now' : '') + '">' + (cls === 'done' ? '✔' : L.n) + '</li>';
  }).join('');
  hud.innerHTML = '<div class="hud-in"><div class="brand">➕ Addition Quest</div><ol class="lvls" aria-label="Level progress">' + dots + '</ol>' +
    '<div class="stat' + (state.score !== lastScore ? ' bump' : '') + '" title="Coins"><span class="coin"></span> <b>' + state.score + '</b></div>' +
    '<div class="stat" title="Stars">⭐ <b>' + state.stars + '</b></div>' +
    '<button class="icon" data-act="learn" aria-label="Open the strategy lessons"><span class="ico">📘</span><span class="txt">Learn</span></button>' +
    soundBtn('icon') +
    '<button class="icon" data-act="restart" aria-label="Start over"><span class="ico">🔄</span><span class="txt">Restart</span></button></div>';
  lastScore = state.score;
}

function rWelcome() {
  return '<section class="screen welcome"><div class="card titlecard">' +
    '<div class="logo">➕ Addition Quest – Beat the Number Challenge!</div>' +
    '<div class="heroes" aria-hidden="true"><span>🦊</span><span>🐻</span><span>🐰</span><span>🐸</span><span>🐼</span></div>' +
    '<h1>Welcome to Addition Quest!</h1>' +
    '<p class="lead">Choose your strategy, solve the puzzles, and collect stars!</p>' +
    '<div class="row"><button class="btn go big" data-act="start">▶ Start Game</button></div>' +
    '<div class="row" style="margin-top:18px"><button class="btn purple" data-act="tutorial">📘 Learn the Strategies</button>' + soundBtn('btn light') + '</div>' +
    '<div class="cards2">' +
    '<div class="mini a"><h3>🧱 Break Apart Numbers</h3><p>Split numbers into tens and ones. Add the tens. Add the ones. Put them together!</p><div class="eq">34 + 25 → 50 + 9 = 59</div></div>' +
    '<div class="mini b"><h3>🔟 Compensation Method</h3><p>Make a friendly ten. Solve the easy problem. Then fix your answer!</p><div class="eq">39 + 24 → 40 + 24 = 64 → 64 ' + MINUS + ' 1 = 63</div></div>' +
    '</div>' +
    '<p class="privacy">No sign-in. No names. Nothing is saved or sent anywhere.</p></div></section>';
}

function tutA(st) {
  const L = [];
  L.push('<div class="tline"><div class="eq big">34 + 25 = ?</div><div class="vis">' + blocks(34, 'cA') + '<span class="plus">+</span>' + blocks(25, 'cB') + '</div><p class="center">Let\'s break the numbers apart into tens and ones.</p></div>');
  L.push('<div class="tline"><h3>Step 1: Break apart</h3><div class="splitrow">' + splitBlocks(34, 'cA') + splitBlocks(25, 'cB') + '</div><div class="eq center">34 = 30 + 4 &nbsp;&nbsp; 25 = 20 + 5</div></div>');
  L.push('<div class="tline"><h3>Step 2: Add the tens</h3><div class="vis">' + rodsOnly(3, 'cA') + '<span class="plus">+</span>' + rodsOnly(2, 'cB') + '<span class="plus">=</span>' + rodsOnly(5, 'cC') + '</div><div class="eq center">30 + 20 = 50</div></div>');
  L.push('<div class="tline"><h3>Step 3: Add the ones</h3><div class="vis">' + onesOnly(4, 'cA') + '<span class="plus">+</span>' + onesOnly(5, 'cB') + '<span class="plus">=</span>' + onesOnly(9, 'cC') + '</div><div class="eq center">4 + 5 = 9</div></div>');
  L.push('<div class="tline"><h3>Step 4: Add the partial sums</h3><div class="vis">' + blocks(59, 'cC') + '</div><div class="eq center">50 + 9 = 59</div><div class="answer">Answer: 59 🎉</div></div>');
  return L.slice(0, st + 1).join('');
}
function tutB(st) {
  const L = [];
  L.push('<div class="tline"><div class="eq big">39 + 24 = ?</div><div class="vis">' + blocks(39, 'cA') + '<span class="plus">+</span>' + blocks(24, 'cB') + '</div><p class="center">39 is almost 40. Let\'s make a friendly ten!</p></div>');
  L.push('<div class="tline"><h3>Step 1: Change 39 to 40 by adding 1</h3><div class="morphrow"><span class="bignum" id="morph">' + (st > 1 ? 40 : 39) + '</span><span class="plus1" id="plus1">+1</span></div><div class="eq center">39 + 1 = 40</div></div>');
  L.push('<div class="tline"><h3>Step 2: Add the easier numbers</h3><div class="vis">' + blocks(40, 'cC') + '<span class="plus">+</span>' + blocks(24, 'cB') + '</div><div class="eq center">40 + 24 = 64</div></div>');
  L.push('<div class="tline"><h3>Step 3: Subtract the extra 1</h3><div class="vis">' + blocks(64, 'cC', 1) + '</div><div class="eq center">64 ' + MINUS + ' 1 = 63</div></div>');
  L.push('<div class="tline"><div class="why">💡 Why? We made 39 bigger by 1, so our sum is 1 too big. When a number goes up by 1, we must take 1 away from the sum to keep the answer true.</div><div class="eq center">39 + 24 = 63 ✔</div><div class="answer">Answer: 63 🎉</div></div>');
  return L.slice(0, st + 1).join('');
}
function rTutorial() {
  const A = state.tutTab === 'A', max = 4, st = state.tutStep;
  const last = st >= max;
  let next;
  if (!last) next = '<button class="btn go" data-act="tutnext">Next ▶</button>';
  else if (A) next = '<button class="btn orange" data-act="tutswitch">Learn Strategy B ▶</button>';
  else next = state.tutFrom === 'welcome' ? '<button class="btn go" data-act="start">▶ Start Game</button>' : '<button class="btn go" data-act="tutclose">Back to the game ▶</button>';
  return '<section class="screen"><div class="card"><div class="tabs">' +
    '<button class="btn tab ' + (A ? 'on' : 'light') + '" data-act="tuttab" data-val="A">🧱 A: Break Apart</button>' +
    '<button class="btn tab ' + (!A ? 'orange on' : 'light') + '" data-act="tuttab" data-val="B">🔟 B: Compensation</button></div>' +
    '<h2>' + (A ? 'Strategy A: Break Apart Numbers' : 'Strategy B: Compensation Method') + '</h2>' +
    (A ? tutA(st) : tutB(st)) +
    '<div class="navrow"><div><button class="btn light" data-act="tutclose">✖ Close</button> ' +
    (st > 0 ? '<button class="btn light" data-act="tutback">◀ Back</button>' : '') + '</div>' + next + '</div></div></section>';
}

function rIntro() {
  const L = LEVELS[state.level - 1];
  return '<section class="screen intro"><div class="card"><div class="bigicon" aria-hidden="true">' + L.icon + '</div>' +
    '<h2>Level ' + L.n + ': ' + L.title + '</h2><p class="lead">' + L.intro + '</p>' +
    '<div class="facts"><span class="fact">' + L.count + ' questions</span><span class="fact">Earn up to 10 coins each</span><span class="fact">⭐ Answer without mistakes for a star</span></div>' +
    '<div class="row"><button class="btn go big" data-act="startlevel">Let\'s go! ▶</button><button class="btn purple" data-act="learn">📘 Need a reminder?</button></div></div></section>';
}

function problemHTML(q) {
  return '<div class="card problem"><div class="eq">' + q.a + ' + ' + q.b + ' = ?</div><div class="vis">' + blocks(q.a, 'cA') + '<span class="plus">+</span>' + blocks(q.b, 'cB') + '</div></div>';
}
function trailHTML(q) {
  return q.s.trail.length ? '<ul class="trail" aria-label="Steps so far">' + q.s.trail.map(t => '<li>' + t + '</li>').join('') + '</ul>' : '';
}
function taskHTML(q) {
  const s = q.s, name = q.tasks[s.task], T = TASKS[name];
  const msg = s.msg || T.say, kind = s.msg ? s.msgKind : ''; s.msg = null; s.msgKind = '';
  const directBtn = (q.direct && name !== 'direct') ? '<button class="btn orange" data-act="direct">✍️ I know the answer!</button>' : '';
  const hintBtn = name === 'strategy' ? '' : '<button class="btn purple" data-act="hint">💡 Hint</button>';
  const hintBtn2 = name === 'strategy' ? '<button class="btn purple" data-act="hint">💡 Hint</button>' : '';
  return '<div class="board">' + trailHTML(q) + '<div class="task" data-task="' + name + '">' + T.ui(q) + '</div>' +
    '<div class="guide"><div class="fox" aria-hidden="true">🦊</div><div id="bubble" class="bubble ' + kind + '" role="status" aria-live="polite">' + msg + '</div></div>' +
    '<div class="tools">' + hintBtn + hintBtn2 + directBtn + '<button id="showme" class="btn light" data-act="showme"' + (s.taskWrong >= 3 && name !== 'strategy' ? '' : ' hidden') + '>🧑‍🏫 Show me how</button></div></div>';
}
function completionHTML(q) {
  const s = q.s, last = state.qIndex + 1 >= state.questions.length;
  const total = q.kind === 'detective' ? '' : '<div class="eq big">' + q.a + ' + ' + q.b + ' = ' + (q.a + q.b) + '</div>';
  const note = s.revealNote ? '<p class="small muted">' + s.revealNote + '</p>' : '';
  return '<div class="board card done"><div class="cheer">🎉 ' + (s.star ? praise() : 'You did it!') + '</div>' + total + note + solutionHTML(q) +
    '<div class="reward"><span><span class="coin"></span> +' + s.pts + ' coins</span>' +
    (s.star ? '<span class="starpop">⭐ Star earned!</span>' : '<span class="small muted">Answer with no mistakes to earn a star!</span>') + '</div>' +
    '<button class="btn go big" data-act="next">' + (last ? 'Finish Level 🏁' : 'Next Question ▶') + '</button></div>';
}
function rQuestion() {
  const q = curQ(), s = q.s, L = LEVELS[state.level - 1], total = state.questions.length, done = state.qIndex + (s.done ? 1 : 0);
  return '<section class="screen qscreen"><div class="qhead"><div class="chip">' + L.icon + ' Level ' + L.n + ': ' + L.title + '</div>' +
    '<div class="qcount">Question ' + (state.qIndex + 1) + ' of ' + total + '</div></div>' +
    '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + done + '"><span style="width:' + (done / total * 100) + '%"></span></div>' +
    (q.kind === 'detective' ? '' : problemHTML(q)) + (s.done ? completionHTML(q) : taskHTML(q)) + '</section>';
}

const chestSvg = '<svg class="chest" viewBox="0 0 120 100" role="img" aria-label="Treasure chest">' +
  '<circle class="gc" cx="40" cy="38" r="9" fill="#ffd23f" stroke="#c98200" stroke-width="3"/>' +
  '<circle class="gc" cx="62" cy="34" r="9" fill="#ffd23f" stroke="#c98200" stroke-width="3"/>' +
  '<circle class="gc" cx="82" cy="38" r="9" fill="#ffd23f" stroke="#c98200" stroke-width="3"/>' +
  '<rect x="10" y="40" width="100" height="50" rx="6" fill="#d97706" stroke="#78350f" stroke-width="4"/>' +
  '<g class="lid"><path d="M10 40 Q10 8 60 8 Q110 8 110 40 Z" fill="#b45309" stroke="#78350f" stroke-width="4"/></g>' +
  '<rect x="52" y="40" width="16" height="22" rx="3" fill="#fde047" stroke="#78350f" stroke-width="3"/></svg>';
function starRow(n) { let h = '<div class="stars3" aria-label="' + n + ' out of 3 stars">'; for (let i = 0; i < 3; i++) h += '<span class="' + (i < n ? '' : 'off') + '">⭐</span>'; return h + '</div>'; }
function rating(stars, count) { const r = stars / count; return r >= 0.85 ? 3 : r >= 0.5 ? 2 : 1; }
function badgeHTML(b, hero) { return '<div class="badge' + (hero ? ' hero' : '') + '"><div class="disc" aria-hidden="true">' + b.icon + '</div><div>' + b.name + '</div></div>'; }

function rLevelDone() {
  const L = LEVELS[state.level - 1], r = state.results[state.level];
  return '<section class="screen done"><div class="card"><h2>Level ' + L.n + ' complete!</h2>' + starRow(rating(r.stars, r.count)) +
    '<div class="row">' + chestSvg + '</div>' +
    '<div class="scorebox"><div><span class="coin"></span> ' + r.points + ' coins</div><div>⭐ ' + r.stars + ' of ' + r.count + ' stars</div></div>' +
    '<p class="lead">You earned a new badge!</p><div class="badges">' + badgeHTML(L.badge) + '</div>' +
    '<div class="row"><button class="btn go big" data-act="nextlevel">Next Level ▶</button></div></div></section>';
}
function rFinal() {
  let maxPts = 0, maxStars = 0;
  Object.keys(state.results).forEach(k => { maxPts += state.results[k].count * 10; maxStars += state.results[k].count; });
  const pct = maxPts ? state.score / maxPts : 0;
  const rank = pct >= 0.85 ? 'Math Superstar!' : pct >= 0.65 ? 'Great Mathematician!' : 'Brave Explorer! Play again to earn more!';
  const hero = LEVELS[4].badge;
  return '<section class="screen done"><div class="card"><h2>🎉 You finished the Tournament!</h2>' +
    '<div class="badges">' + badgeHTML(hero, true) + '</div><p class="lead">You are an Addition Hero!</p>' +
    '<div class="scorebox"><div><span class="coin"></span> ' + state.score + ' / ' + maxPts + ' coins</div><div>⭐ ' + state.stars + ' / ' + maxStars + ' stars</div></div>' +
    '<h3>' + rank + '</h3><p class="muted">Your badges</p><div class="badges">' + state.badges.filter(b => b.name !== hero.name).map(b => badgeHTML(b)).join('') + '</div>' +
    '<div class="row" style="margin-top:14px"><button class="btn go big" data-act="again">🔁 Play Again</button><button class="btn light" data-act="home">🏠 Home</button></div>' +
    '<p class="privacy">Your score is only kept on this screen. Nothing is saved or sent.</p></div></section>';
}

/* ================= render ================= */
function render() {
  clearTimeout(morphTimer);
  renderHud();
  const fn = { welcome: rWelcome, tutorial: rTutorial, intro: rIntro, question: rQuestion, levelDone: rLevelDone, final: rFinal }[state.screen];
  $('#app').innerHTML = fn();
  const key = state.screen + '|' + state.level + '|' + state.qIndex + '|' + state.tutTab;
  if (key !== lastScreenKey) { window.scrollTo(0, 0); lastScreenKey = key; }
  if (state.screen === 'tutorial' && state.tutTab === 'B' && state.tutStep === 1) {
    morphTimer = setTimeout(() => {
      const m = $('#morph'), p = $('#plus1'); if (!m) return;
      m.textContent = '40'; m.classList.add('morphing'); if (p) p.classList.add('show'); sfx.star();
    }, 700);
  }
  if (state.screen === 'question' && !curQ().s.done) {
    const inp = $('.task .num'); if (inp) { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }
  }
}

/* ================= modal ================= */
function openModal(html) { const m = $('#modal'); m.innerHTML = '<div class="card" role="dialog" aria-modal="true">' + html + '</div>'; m.hidden = false; const b = $('button', m); if (b) b.focus(); }
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
function resetGame() {
  closeModal();
  if (state.started) state.playCount++;
  Object.assign(state, { screen: 'welcome', started: false, level: 1, qIndex: 0, questions: [], score: 0, stars: 0, badges: [], results: {}, levelPoints: 0, levelStars: 0, lock: false });
  lastScore = 0; render();
}

/* ================= events ================= */
function openTutorial() {
  state.tutFrom = state.screen; state.screen = 'tutorial'; state.tutTab = 'A'; state.tutStep = 0; render();
}
function closeTutorial() { state.screen = state.tutFrom || 'welcome'; render(); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  ensureAudio();
  const act = el.dataset.act;
  switch (act) {
    case 'start': sfx.click(); startGame(); break;
    case 'sound': state.sound = !state.sound; if (state.sound) { ensureAudio(); sfx.click(); } updateSoundButtons(); break;
    case 'tutorial': case 'learn': sfx.click(); openTutorial(); break;
    case 'tuttab': sfx.click(); state.tutTab = el.dataset.val; state.tutStep = 0; render(); break;
    case 'tutnext': sfx.click(); state.tutStep = Math.min(4, state.tutStep + 1); render(); break;
    case 'tutback': sfx.click(); state.tutStep = Math.max(0, state.tutStep - 1); render(); break;
    case 'tutswitch': sfx.click(); state.tutTab = 'B'; state.tutStep = 0; render(); break;
    case 'tutclose': sfx.click(); closeTutorial(); break;
    case 'startlevel': sfx.click(); startLevel(state.level); break;
    case 'check': onCheck(); break;
    case 'choose': onChoose(el); break;
    case 'hint': onHint(); break;
    case 'showme': onShowMe(); break;
    case 'direct': onDirect(); break;
    case 'next': onNext(); break;
    case 'nextlevel': sfx.click(); startLevelIntro(state.level + 1); break;
    case 'again': sfx.click(); state.playCount++; startGame(); break;
    case 'home': sfx.click(); resetGame(); break;
    case 'restart':
      sfx.click();
      openModal('<h2>Start over?</h2><p>Your coins and stars will be cleared.</p><div class="row"><button class="btn go" data-act="restartyes">Yes, start over</button><button class="btn light" data-act="restartno">No, keep playing</button></div>');
      break;
    case 'restartyes': resetGame(); break;
    case 'restartno': closeModal(); break;
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target && e.target.classList && e.target.classList.contains('num')) {
    e.preventDefault(); onCheck();
  }
  if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
});

/* Optional hook so the teacher/developer can run automated checks. Does nothing in normal use. */
if (window.__AQ_TEST__) {
  Object.assign(window.__AQ_TEST__, { LEVELS, buildQuestions, DET, DET_T, L1_LIST, L2_LIST, L3_LIST, TB, TC, TS, genBreak, genComp, genChoose, state, bestPick, isFriendly, mixed, TASKS, startGame, startLevel, curQ, passTask, onNext });
}

render();
})();
