// State and rules are independent of the UI. 0 = ivory, 1 = charcoal.
export const VERSION = 2;
export const camp = side => side === 0 ? 21 : 0;
export const sideOf = pos => pos <= 10 ? 1 : 0;
export const numberOf = pos => pos === 0 || pos === 21 ? 6 : pos <= 10 ? 6 - Math.ceil(pos/2) : Math.ceil((pos-10)/2);
export function initialState() {
  return {version: VERSION, pieces: [Array(6).fill(21), Array(6).fill(0)], turn: 0, roll: null, ply: 0, winner: null, draw: false};
}
export function outcome(state) {
  for (const side of [0, 1]) {
    const enemyCamp = camp(1 - side);
    if (state.pieces[side].includes(enemyCamp) && !state.pieces[1-side].includes(enemyCamp)) return side;
    if (!state.pieces[1-side].some(p => p >= 0)) return side;
  }
  return null;
}
export function legalMoves(state, roll = state.roll, side = state.turn) {
  if (state.winner !== null || state.draw || !Number.isInteger(roll) || roll < 1 || roll > 6) return [];
  const moves = [];
  // Agents on the same space are interchangeable.
  const starts = [...new Set(state.pieces[side].filter(p => p >= 0))];
  for (const from of starts) {
    const piece = state.pieces[side].indexOf(from);
    for (let to = 0; to < 22; to++) {
      if (from === to || numberOf(to) !== roll) continue;
      const defenders = state.pieces[1-side].filter(p => p === to).length;
      if (roll !== 6 && state.pieces[side].includes(to)) continue;
      const mate = to % 2 === 1 ? to+1 : to-1;
      if (roll !== 6 && defenders && state.pieces[1-side].includes(mate)) continue;
      moves.push({piece, from, to});
    }
  }
  return moves;
}
export function applyMove(state, move, roll = state.roll) {
  const allowed = legalMoves(state, roll).find(m => m.piece === move.piece && m.to === move.to && m.from === move.from);
  if (!allowed) throw new Error('Illegal move');
  const next = structuredClone(state), side = state.turn, enemy = 1-side;
  const to = allowed.to;
  // At camp, only a returning defender captures an infiltrator. Entering a
  // guarded enemy camp does not capture its defenders (as shown in the reel).
  if (roll !== 6 || to === camp(side)) {
    const victim = next.pieces[enemy].indexOf(to);
    if (victim >= 0) next.pieces[enemy][victim] = -1;
  }
  next.pieces[side][allowed.piece] = to;
  next.ply++;
  next.winner = outcome(next);
  next.draw = next.winner === null && next.ply >= 300;
  next.turn = enemy;
  next.roll = null;
  return next;
}
export function passTurn(state) {
  if (state.roll === null || legalMoves(state).length) throw new Error('Cannot pass while a legal move exists');
  const next = structuredClone(state);
  next.turn = 1-next.turn; next.roll = null; next.ply++;
  next.draw = next.ply >= 300;
  return next;
}
export function evaluate(state, side) {
  const win = state.winner ?? outcome(state);
  if (win !== null) return win === side ? 10000 : -10000;
  if (state.draw) return 0;
  const score = s => {
    const own = state.pieces[s], enemies = state.pieces[1-s];
    const home = own.filter(p => p === camp(s)).length;
    const invaders = own.filter(p => p === camp(1-s)).length;
    let value = own.filter(p => p >= 0).length * 36;
    value += home > 0 ? 15 : -28;
    value += invaders * 24;
    if (invaders) value += Math.max(0, 6-enemies.filter(p => p === camp(1-s)).length) * 6;
    const positions = [...new Set(own.filter(p => p > 0 && p < 21))];
    for (const pos of positions) value += own.includes(pos % 2 === 1 ? pos+1 : pos-1) ? 9 : -2;
    if (enemies.includes(camp(s)) && home === 1) value -= 30;
    return value;
  };
  return score(side)-score(1-side);
}
function expectedReply(state, side) {
  if (state.winner !== null || state.draw) return evaluate(state,side);
  let sum = 0;
  for (let roll = 1; roll <= 6; roll++) {
    const moves = legalMoves(state,roll);
    if (!moves.length) { sum += evaluate(state,side); continue; }
    // The next player chooses their strongest response for each possible roll.
    const vals = moves.map(m => evaluate(applyMove(state,m,roll),side));
    sum += state.turn === side ? Math.max(...vals) : Math.min(...vals);
  }
  return sum/6;
}
export function chooseMove(state, difficulty = 'medium', random = Math.random) {
  const moves = legalMoves(state);
  if (!moves.length) return null;
  const immediate = moves.filter(m => applyMove(state,m).winner === state.turn);
  if (immediate.length) return immediate[Math.floor(random()*immediate.length)];
  if (difficulty === 'easy') return moves[Math.floor(random()*moves.length)];
  let best = -Infinity, choices = [];
  for (const move of moves) {
    const next = applyMove(state,move);
    const score = difficulty === 'hard' ? expectedReply(next,state.turn) : evaluate(next,state.turn);
    if (score > best + 0.001) { best=score; choices=[move]; }
    else if (Math.abs(score-best) < 0.001) choices.push(move);
  }
  return choices[Math.floor(random()*choices.length)];
}
export function validSave(s) {
  return !!s && s.version === VERSION && [0,1].includes(s.turn) &&
    (s.roll === null || (Number.isInteger(s.roll) && s.roll>=1 && s.roll<=6)) &&
    Number.isInteger(s.ply) && s.ply>=0 && s.ply<=300 &&
    [null,0,1].includes(s.winner) && typeof s.draw==='boolean' &&
    Array.isArray(s.pieces) && s.pieces.length===2 && s.pieces.every(a => Array.isArray(a) && a.length===6 && a.every(p => Number.isInteger(p) && p>=-1 && p<=21)) &&
    s.winner === outcome(s) && s.draw === (s.winner === null && s.ply >= 300) &&
    !Array.from({length:20},(_,i)=>i+1).some(p => s.pieces.flat().filter(x=>x===p).length>1);
}
