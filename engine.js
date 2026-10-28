import {initialLinear,linearOutcome,linearMoves,applyLinear,evaluateLinear,validLinear} from './linear.js?v=12';
// State and rules are independent of the UI. 0 = ivory, 1 = charcoal.
export const VERSION = 4;
export const camp = side => side === 0 ? 21 : 0;
export const sideOf = pos => pos <= 10 ? 1 : 0;
export const numberOf = pos => pos === 0 || pos === 21 ? 6 : pos <= 10 ? 6 - Math.ceil(pos/2) : Math.ceil((pos-10)/2);
export const partner = pos => pos % 2 === 1 ? pos+1 : pos-1;
export function initialState(mode = 'classic', random = Math.random) {
  if(mode==='linear')return initialLinear();
  if (!['classic','ultra'].includes(mode)) throw new Error('Unknown mode');
  const state = {version: VERSION, mode, coins:[3,3], forcedRolls:[null,null], powerUsed:false, rollLocked:false, pieces: [Array(6).fill(21), Array(6).fill(0)], turn: 0, roll: null, ply: 0, winner: null, draw: false};
  return upgradeCards(state, random);
}
export function outcome(state) {
  if(state.mode==='linear')return linearOutcome(state);
  for (const side of [0, 1]) {
    const enemyCamp = camp(1 - side);
    if (state.pieces[side].includes(enemyCamp) && !state.pieces[1-side].includes(enemyCamp)) return side;
    if (!state.pieces[1-side].some(p => p >= 0)) return side;
  }
  return null;
}
export function legalMoves(state, roll = state.roll, side = state.turn) {
  if(state.mode==='linear')return linearMoves(state,roll,side);
  if (state.winner !== null || state.draw) return [];
  if (roll !== null && (!Number.isInteger(roll) || roll < 1 || roll > 6)) return [];
  const moves = [];
  // Agents on the same space are interchangeable.
  const starts = [...new Set(state.pieces[side].filter(p => p >= 0))];
  for (const from of starts) {
    const piece = state.pieces[side].indexOf(from);
    // The resident agent responds first, without needing a matching roll.
    // An approaching agent must wait for the opponent response turn.
    if (from > 0 && from < 21 && state.pieces[1-side].includes(partner(from)) &&
        !(state.pendingCaptures || []).some(c=>c.side===side&&c.from===from&&c.waiting)) {
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
  if(state.mode==='linear')return applyLinear(state,move,roll);
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
    next.pendingCaptures.push({side, from: to, waiting: true});
  }
  if (next.mode === 'ultra') {
    const captured = state.pieces[enemy].filter(p=>p>=0).length - next.pieces[enemy].filter(p=>p>=0).length;
    next.coins[side] += captured * 3;
    if(captured && next.cardVersion){next.coins[side]+=next.bounties[side];next.bounties[side]=0;}
  }
  return finishAction(next, side);
}
function finishAction(next, side) {
  next.winner=outcome(next);next.roll=null;next.rollLocked=false;
  if(next.cardVersion && next.extraActions>0 && next.winner===null){next.extraActions--;return next;}
  next.ply++;next.draw=next.winner===null&&next.ply>=300;next.turn=1-side;
  finishEconomy(next,side);return next;
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
  if(state.mode==='linear')return evaluateLinear(state,side);
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
    for (const pos of positions) value += own.includes(pos % 2 === 1 ? pos+1 : pos-1) ? 3 : -2;
    value += positions.length * 4; // Deployment should beat endless opening skips.
    // Advancing enables a six; mixed rows favor the side with a pending capture.
    value += positions.filter(p => sideOf(p) !== s).length * 14;
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
  // If waiting is only tied with a move, prefer acting. Keep strictly better
  // defensive skips (for example, a six that would abandon a protected row).
  const activeChoices=choices.filter(Boolean);
  const pool=activeChoices.length?activeChoices:choices;
  return pool[Math.floor(random()*pool.length)];
}
export function validSave(s) {
  if(s?.mode==='linear')return validLinear(s);
  return !!s && s.version === VERSION && [0,1].includes(s.turn) &&
    (s.roll === null || (Number.isInteger(s.roll) && s.roll>=1 && s.roll<=6)) &&
    Number.isInteger(s.ply) && s.ply>=0 && s.ply<=300 &&
    [null,0,1].includes(s.winner) && typeof s.draw==='boolean' &&
    Array.isArray(s.pieces) && s.pieces.length===2 && s.pieces.every(a => Array.isArray(a) && a.length>=6 && a.length<=(s.mode==='ultra'?8:6) && a.every(p => Number.isInteger(p) && p>=-1 && p<=21)) &&
    (s.mode === undefined || ['classic','ultra'].includes(s.mode)) &&
    (s.mode !== 'ultra' || (Array.isArray(s.coins) && s.coins.length===2 && s.coins.every(c=>Number.isInteger(c)&&c>=0&&c<=2000) &&
      Array.isArray(s.forcedRolls) && s.forcedRolls.length===2 && s.forcedRolls.every(r=>r===null||(Number.isInteger(r)&&r>=1&&r<=6)) &&
      typeof s.powerUsed==='boolean' && typeof s.rollLocked==='boolean' && (!s.rollLocked || s.roll!==null))) &&
    validCards(s) &&
    (s.pendingCaptures === undefined || (Array.isArray(s.pendingCaptures) && s.pendingCaptures.length <= 10 && s.pendingCaptures.every(c =>
      c && [0,1].includes(c.side) && Number.isInteger(c.from) && c.from > 0 && c.from < 21 && (c.waiting===undefined||typeof c.waiting==='boolean') &&
      s.pieces[c.side].includes(c.from) && s.pieces[1-c.side].includes(partner(c.from))))) &&
    s.winner === outcome(s) && s.draw === (s.winner === null && s.ply >= 300) &&
    !Array.from({length:20},(_,i)=>i+1).some(p => s.pieces.flat().filter(x=>x===p).length>1);
}


function finishEconomy(state, side) {
  for(const c of state.pendingCaptures||[])if(c.side===state.turn)c.waiting=false;
  if (state.mode !== 'ultra') return;
  // Pay once at the end of the owner's turn, regardless of infiltrator count.
  if (state.pieces[side].includes(camp(1-side))) state.coins[side]++;
  state.powerUsed=false;state.rollLocked=false;
  if(state.cardVersion){state.extraActions=0;if(canPass(state))state.offers[state.turn]=makeOffers(state); }
}
export function rollTurn(state, value) {
  if (!canPass(state) || state.roll !== null || !Number.isInteger(value) || value<1 || value>6) throw new Error('Cannot roll');
  const next=structuredClone(state);
  const forced=state.mode==='ultra'?state.forcedRolls[state.turn]:null;
  next.roll=forced ?? value;
  if(next.mode==='ultra'){next.rollLocked=forced!==null;next.forcedRolls[state.turn]=null;}
  return next;
}
function bestTurnValue(state, side) {
  if(state.turn!==side||!canPass(state))return evaluate(state,side);
  return Math.max(evaluate(passTurn(state),side),...legalMoves(state).map(m=>evaluate(applyMove(state,m),side)));
}

export const CARDS = {
 recruit:{name:'Reinforcements',cost:6,icon:'♟',type:'Agent',text:'Create an agent at home. Uses one action. Maximum 8 living agents.'},
 reroll:{name:'Second Chance',cost:2,icon:'↻',type:'Die',text:'Reroll your current die. Does not use an action.'},
 set:{name:'Loaded Die',cost:4,icon:'⚄',type:'Die',text:'Set your current die to the chosen face. Does not use an action.'},
 sabotage:{name:'False Orders',cost:5,icon:'⚑',type:'Sabotage',text:'Set the enemy’s next roll to the chosen face. That roll cannot be changed.'},
 extra:{name:'Double Agent',cost:5,icon:'Ⅱ',type:'Tempo',text:'Gain one extra action this turn. After moving or capturing, roll again and act again. Stacks.'},
 bounty:{name:'Marked Target',cost:3,icon:'◎',type:'Reward',text:'Your next capture earns 3 bonus coins. Stacks and lasts until you capture.'},
 grant:{name:'War Chest',cost:3,icon:'◈',type:'Coins',text:'Gain 4 coins immediately. Does not use an action.'},
 draw:{name:'Dead Drop',cost:4,icon:'✉',type:'Cards',text:'Draw 2 random cards other than Dead Drop. Needs one free hand slot. Does not use an action.'}
};
export function upgradeCards(state, random=Math.random){
 const next=structuredClone(state);
 if(next.mode!=='ultra'||next.cardVersion)return next;
 next.cardVersion=1;next.cardSeed=Math.floor(random()*4294967296)>>>0;next.nextCardId=1;
 next.hands=[[],[]];next.offers=[[],[]];next.extraActions=0;next.bounties=[0,0];
 for(const side of [0,1]){next.hands[side].push(makeCard(next));next.offers[side]=makeOffers(next);}
 return next;
}
function cardRandom(s){s.cardSeed=(Math.imul(1664525,s.cardSeed)+1013904223)>>>0;return s.cardSeed/4294967296;}
function makeCard(s,keys=Object.keys(CARDS)){return {id:s.nextCardId++,kind:keys[Math.floor(cardRandom(s)*keys.length)]};}
function makeOffers(s){const keys=Object.keys(CARDS),offers=[];for(let i=0;i<3;i++){const c=makeCard(s,keys);offers.push(c);keys.splice(keys.indexOf(c.kind),1);}return offers;}
function validCards(s){
 if(s.cardVersion===undefined)return true;
 if(s.mode!=='ultra'||s.cardVersion!==1||!Number.isInteger(s.cardSeed)||s.cardSeed<0||s.cardSeed>4294967295||!Number.isInteger(s.nextCardId)||s.nextCardId<1||
 !Number.isInteger(s.extraActions)||s.extraActions<0||s.extraActions>100||!Array.isArray(s.bounties)||s.bounties.length!==2||!s.bounties.every(n=>Number.isInteger(n)&&n>=0&&n<=2000))return false;
 for(const [name,max] of [['hands',8],['offers',3]])if(!Array.isArray(s[name])||s[name].length!==2||!s[name].every(a=>Array.isArray(a)&&a.length<=max&&a.every(c=>c&&Number.isInteger(c.id)&&c.id>0&&c.id<s.nextCardId&&Object.hasOwn(CARDS,c.kind))))return false;
 const ids=[...s.hands.flat(),...s.offers.flat()].map(c=>c.id);return new Set(ids).size===ids.length;
}
export function canBuyCard(s,id){return !!(s.cardVersion&&canPass(s)&&s.hands[s.turn].length<8&&s.offers[s.turn].some(c=>c.id===id&&s.coins[s.turn]>=CARDS[c.kind].cost));}
export function buyCard(s,id){
 if(!canBuyCard(s,id))throw new Error('Cannot buy this card');
 const n=structuredClone(s),i=n.offers[n.turn].findIndex(c=>c.id===id),c=n.offers[n.turn].splice(i,1)[0];
 n.coins[n.turn]-=CARDS[c.kind].cost;n.hands[n.turn].push(c);return n;
}
export function cardBlock(s,id){
 if(!s.cardVersion||!canPass(s))return 'Game complete';
 const c=s.hands[s.turn].find(c=>c.id===id);if(!c)return 'Not in your hand';
 if(c.kind==='recruit'&&s.pieces[s.turn].filter(p=>p>=0).length>=8)return 'Army full: 8 agents';
 if(c.kind==='sabotage'&&s.forcedRolls[1-s.turn]!==null)return 'Enemy roll already set';
 if(['set','reroll'].includes(c.kind)){if(s.roll===null)return 'Roll first';if(s.rollLocked)return 'Die locked by enemy';}
 if(c.kind==='draw'&&s.hands[s.turn].length>=8)return 'Needs one free hand slot';
 return '';
}
export function playCard(s,id,value){
 const blocked=cardBlock(s,id);if(blocked)throw new Error(blocked);
 const n=structuredClone(s),side=s.turn,i=n.hands[side].findIndex(c=>c.id===id),c=n.hands[side][i];
 if(['set','reroll','sabotage'].includes(c.kind)&&(!Number.isInteger(value)||value<1||value>6))throw new Error('Choose a die face');
 n.hands[side].splice(i,1);
 if(c.kind==='extra')n.extraActions++;
 if(c.kind==='bounty')n.bounties[side]+=3;
 if(c.kind==='grant')n.coins[side]+=4;
 if(c.kind==='draw')for(let j=0;j<2;j++)n.hands[side].push(makeCard(n,Object.keys(CARDS).filter(k=>k!=='draw')));
 if(c.kind==='sabotage')n.forcedRolls[1-side]=value;
 if(c.kind==='reroll'||c.kind==='set')n.roll=value;
 if(c.kind==='recruit'){
  const removed=n.pieces[side].indexOf(-1);if(removed>=0)n.pieces[side][removed]=camp(side);else n.pieces[side].push(camp(side));
  return finishAction(n,side);
 }
 return n;
}
export function chooseCard(s,difficulty='medium',random=Math.random){
 if(!s.cardVersion||!canPass(s))return null;
 if(legalMoves(s).some(m=>applyMove(s,m).winner===s.turn))return null;
 const side=s.turn,base=bestTurnValue(s,side),choices=[];
 for(const c of s.hands[side]){
  if(cardBlock(s,c.id))continue;
  let value,score;
  if(c.kind==='set'){
   score=-Infinity;for(let v=1;v<=6;v++){const x=bestTurnValue(playCard(s,c.id,v),side);if(x>score){score=x;value=v;}}
   score-=base;
  }else if(c.kind==='reroll'){score=[1,2,3,4,5,6].reduce((sum,v)=>sum+bestTurnValue(playCard(s,c.id,v),side),0)/6-base;}
  else if(c.kind==='sabotage'){
   score=-Infinity;for(let v=1;v<=6;v++){const n=playCard(s,c.id,v);const x=expectedReply(passTurn(n),side)-expectedReply(passTurn(s),side);if(x>score){score=x;value=v;}}
  }else if(c.kind==='recruit')score=bestTurnValue(playCard(s,c.id),side)-base;
  else if(c.kind==='extra')score=legalMoves(s).some(m=>m.to!==camp(side)&&m.from!==m.to)?6:0;
  else score=({grant:8,draw:8,bounty:3})[c.kind];
  if(score>0||difficulty==='easy'&&random()<.25)choices.push({type:'play',id:c.id,value,score});
 }
 if(choices.length){choices.sort((a,b)=>b.score-a.score);return difficulty==='easy'?choices[Math.floor(random()*choices.length)]:choices[0];}
 const buys=s.offers[side].filter(c=>canBuyCard(s,c.id)).map(c=>({type:'buy',id:c.id,score:({grant:10,extra:7,recruit:5,draw:6,set:5,reroll:3,sabotage:3,bounty:2})[c.kind]}));
 if(!buys.length||difficulty==='easy'&&random()<.5)return null;
 buys.sort((a,b)=>b.score-a.score);return difficulty==='easy'?buys[Math.floor(random()*buys.length)]:buys[0];
}
