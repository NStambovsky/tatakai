// State and rules are independent of the UI. 0 = ivory, 1 = charcoal.
export const VERSION = 4;
export const camp = side => side === 0 ? 21 : 0;
export const sideOf = pos => pos <= 10 ? 1 : 0;
export const numberOf = pos => pos === 0 || pos === 21 ? 6 : pos <= 10 ? 6 - Math.ceil(pos/2) : Math.ceil((pos-10)/2);
export const partner = pos => pos % 2 === 1 ? pos+1 : pos-1;
export function initialState(mode = 'classic') {
  if (!['classic','ultra'].includes(mode)) throw new Error('Unknown mode');
  return {version: VERSION, mode, coins:[3,3], forcedRolls:[null,null], powerUsed:false, rollLocked:false, pieces: [Array(6).fill(21), Array(6).fill(0)], turn: 0, roll: null, ply: 0, winner: null, draw: false};
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
  if (state.winner !== null || state.draw) return [];
  if (roll !== null && (!Number.isInteger(roll) || roll < 1 || roll > 6)) return [];
  const moves = [];
  // Agents on the same space are interchangeable.
  const starts = [...new Set(state.pieces[side].filter(p => p >= 0))];
  for (const from of starts) {
    const piece = state.pieces[side].indexOf(from);
    // Arrival never captures on numbered rows. A home-side attacker earns
    // a later capture; home defenders still countercapture on a matching roll.
    if (from > 0 && from < 21 && state.pieces[1-side].includes(partner(from)) &&
        (sideOf(from) !== side || roll === numberOf(from) || (state.pendingCaptures || []).some(c => c.side === side && c.from === from))) {
      moves.push({piece, from, to: from, kind: 'capture'});
    }
    if (roll === null) continue;
    for (let to = 0; to < 22; to++) {
      if (numberOf(to) !== roll) continue;
      // Deploy from a camp to your own numbered half before crossing.
      const fromCamp = from === 0 || from === 21;
      if (fromCamp && roll !== 6 && sideOf(to) !== side) continue;
      // A camp-to-camp shortcut would bypass deployment entirely.
      if (to === camp(1-side) && (fromCamp || sideOf(from) === side)) continue;
      // A home defender may use a six to discover an infiltrator without moving.
      const sweep = roll === 6 && from === to && to === camp(side) && state.pieces[1-side].includes(to);
      if (from === to && !sweep) continue;
      // Captures happen across a row: enter its empty partner space.
      if (roll !== 6 && state.pieces.flat().includes(to)) continue;
      moves.push({piece, from, to});
    }
  }
  return moves;
}
export function applyMove(state, move, roll = state.roll) {
  const allowed = legalMoves(state, roll).find(m => m.piece === move.piece && m.to === move.to && m.from === move.from && m.kind === move.kind);
  if (!allowed) throw new Error('Illegal move');
  const next = structuredClone(state), side = state.turn, enemy = 1-side;
  const to = allowed.to;
  // At camp, only a returning defender captures an infiltrator. Entering a
  // guarded enemy camp does not capture its defenders (as shown in the reel).
  if (allowed.kind === 'capture' || (roll === 6 && to === camp(side))) {
    const captureAt = allowed.kind === 'capture' ? partner(to) : roll === 6 ? to : partner(to);
    const victim = next.pieces[enemy].indexOf(captureAt);
    if (victim >= 0) next.pieces[enemy][victim] = -1;
  }
  next.pieces[side][allowed.piece] = to;
  // Forget an old approach if either agent moved or was captured.
  next.pendingCaptures = (state.pendingCaptures || []).filter(c =>
    !(c.side === side && c.from === allowed.from) &&
    next.pieces[c.side].includes(c.from) && next.pieces[1-c.side].includes(partner(c.from)));
  if (to > 0 && to < 21 && allowed.from !== to && next.pieces[enemy].includes(partner(to))) {
    next.pendingCaptures.push({side, from: to});
  }
  if (next.mode === 'ultra') {
    const captured = state.pieces[enemy].filter(p=>p>=0).length - next.pieces[enemy].filter(p=>p>=0).length;
    next.coins[side] += captured * 3;
  }
  next.ply++;
  next.winner = outcome(next);
  next.draw = next.winner === null && next.ply >= 300;
  next.turn = enemy;
  next.roll = null;
  finishEconomy(next, side);
  return next;
}
export function canPass(state) {
  return state.winner === null && !state.draw;
}
export function passTurn(state) {
  if (!canPass(state)) throw new Error('Cannot skip this turn');
  const next = structuredClone(state);
  next.turn = 1-next.turn; next.roll = null; next.ply++;
  next.draw = next.ply >= 300;
  finishEconomy(next, state.turn);
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
    let value = (state.mode === 'ultra' ? state.coins[s] * 2 : 0) + own.filter(p => p >= 0).length * 36;
    value += home > 0 ? 15 : -28;
    value += invaders * 24;
    if (invaders) value += Math.max(0, 6-enemies.filter(p => p === camp(1-s)).length) * 6;
    const positions = [...new Set(own.filter(p => p > 0 && p < 21))];
    for (const pos of positions) value += own.includes(pos % 2 === 1 ? pos+1 : pos-1) ? 9 : -2;
    value += positions.length * 4; // Deployment should beat endless opening skips.
    // Advancing enables a six; mixed rows favor the side with a pending capture.
    value += positions.filter(p => sideOf(p) !== s).length * 5;
    for (const pos of positions) if (enemies.includes(partner(pos))) {
      value += state.turn === s ? 12 : -12;
    }
    if (enemies.includes(camp(s)) && home === 1) value -= 30;
    return value;
  };
  return score(side)-score(1-side);
}
function expectedReply(state, side) {
  if (state.winner !== null || state.draw) return evaluate(state,side);
  let sum = 0;
  const rolls = state.mode === 'ultra' && state.forcedRolls[state.turn] ? [state.forcedRolls[state.turn]] : [1,2,3,4,5,6];
  for (const roll of rolls) {
    const moves = legalMoves(state,roll);
    if (!moves.length) { sum += evaluate(passTurn({...state,roll}),side); continue; }
    // The next player chooses their strongest response for each possible roll.
    const vals = moves.map(m => evaluate(applyMove(state,m,roll),side));
    vals.push(evaluate(passTurn({...state,roll}),side));
    sum += state.turn === side ? Math.max(...vals) : Math.min(...vals);
  }
  return sum/rolls.length;
}
export function chooseMove(state, difficulty = 'medium', random = Math.random) {
  const moves = legalMoves(state);
  if (!moves.length) return null;
  const immediate = moves.filter(m => applyMove(state,m).winner === state.turn);
  if (immediate.length) return immediate[Math.floor(random()*immediate.length)];
  moves.push(null); // Optional skip competes with moving.
  if (difficulty === 'easy') return moves[Math.floor(random()*moves.length)];
  let best = -Infinity, choices = [];
  for (const move of moves) {
    const next = move ? applyMove(state,move) : passTurn(state);
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
    Array.isArray(s.pieces) && s.pieces.length===2 && s.pieces.every(a => Array.isArray(a) && a.length>=6 && a.length<=(s.mode==='ultra'?8:6) && a.every(p => Number.isInteger(p) && p>=-1 && p<=21)) &&
    (s.mode === undefined || ['classic','ultra'].includes(s.mode)) &&
    (s.mode !== 'ultra' || (Array.isArray(s.coins) && s.coins.length===2 && s.coins.every(c=>Number.isInteger(c)&&c>=0&&c<=2000) &&
      Array.isArray(s.forcedRolls) && s.forcedRolls.length===2 && s.forcedRolls.every(r=>r===null||(Number.isInteger(r)&&r>=1&&r<=6)) &&
      typeof s.powerUsed==='boolean' && typeof s.rollLocked==='boolean' && (!s.rollLocked || s.roll!==null))) &&
    (s.pendingCaptures === undefined || (Array.isArray(s.pendingCaptures) && s.pendingCaptures.length <= 10 && s.pendingCaptures.every(c =>
      c && [0,1].includes(c.side) && Number.isInteger(c.from) && c.from > 0 && c.from < 21 &&
      s.pieces[c.side].includes(c.from) && s.pieces[1-c.side].includes(partner(c.from))))) &&
    s.winner === outcome(s) && s.draw === (s.winner === null && s.ply >= 300) &&
    !Array.from({length:20},(_,i)=>i+1).some(p => s.pieces.flat().filter(x=>x===p).length>1);
}

export const POWER_COSTS = {recruit:6, reroll:2, set:4, sabotage:5};
function finishEconomy(state, side) {
  if (state.mode !== 'ultra') return;
  // Pay once at the end of the owner's turn, regardless of infiltrator count.
  if (state.pieces[side].includes(camp(1-side))) state.coins[side]++;
  state.powerUsed=false;state.rollLocked=false;
}
export function rollTurn(state, value) {
  if (!canPass(state) || state.roll !== null || !Number.isInteger(value) || value<1 || value>6) throw new Error('Cannot roll');
  const next=structuredClone(state);
  const forced=state.mode==='ultra'?state.forcedRolls[state.turn]:null;
  next.roll=forced ?? value;
  if(next.mode==='ultra'){next.rollLocked=forced!==null;next.forcedRolls[state.turn]=null;}
  return next;
}
export function canPower(state, kind) {
  if(state.mode!=='ultra'||!canPass(state)||state.powerUsed||!Object.hasOwn(POWER_COSTS,kind)||state.coins[state.turn]<POWER_COSTS[kind])return false;
  if(kind==='recruit')return state.pieces[state.turn].filter(p=>p>=0).length<8;
  if(kind==='sabotage')return state.forcedRolls[1-state.turn]===null;
  return state.roll!==null&&!state.rollLocked;
}
export function usePower(state, kind, value) {
  if(!canPower(state,kind))throw new Error('Power unavailable');
  if(kind!=='recruit'&&(!Number.isInteger(value)||value<1||value>6))throw new Error('Choose a die face');
  let next=structuredClone(state);const side=state.turn;
  next.coins[side]-=POWER_COSTS[kind];next.powerUsed=true;
  if(kind==='recruit'){
    const index=next.pieces[side].indexOf(-1);
    if(index>=0)next.pieces[side][index]=camp(side);else next.pieces[side].push(camp(side));
    // Reinforcements arrive at home; they do not sweep infiltrators.
    next=passTurn(next);
  } else if(kind==='sabotage')next.forcedRolls[1-side]=value;
  else next.roll=value;
  return next;
}
function bestTurnValue(state, side) {
  if(state.turn!==side||!canPass(state))return evaluate(state,side);
  return Math.max(evaluate(passTurn(state),side),...legalMoves(state).map(m=>evaluate(applyMove(state,m),side)));
}
export function choosePower(state, difficulty='medium', random=Math.random) {
  if(state.mode!=='ultra'||state.powerUsed||!canPass(state))return null;
  if(legalMoves(state).some(m=>applyMove(state,m).winner===state.turn))return null;
  const options=[];
  if(canPower(state,'recruit'))options.push({kind:'recruit'});
  if(canPower(state,'reroll'))options.push({kind:'reroll'});
  for(let value=1;value<=6;value++)for(const kind of ['set','sabotage'])if(canPower(state,kind))options.push({kind,value});
  if(!options.length)return null;
  if(difficulty==='easy')return random()<.4?options[Math.floor(random()*options.length)]:null;
  const side=state.turn, base=bestTurnValue(state,side);
  let best=base+1, choice=null;
  for(const option of options){
    let score;
    if(option.kind==='reroll')score=[1,2,3,4,5,6].reduce((sum,v)=>sum+bestTurnValue(usePower(state,'reroll',v),side),0)/6;
    else {
      const next=usePower(state,option.kind,option.value);
      score=bestTurnValue(next,side);
      if(option.kind==='sabotage'){
        const passed=passTurn(next);
        // Value denying an opponent their best roll, allowing them to skip.
        score+=expectedReply(passed,side)-expectedReply(passTurn(state),side);
      }
    }
    if(score>best){best=score;choice=option;}
  }
  return choice;
}
