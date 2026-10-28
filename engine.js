import {initialExtreme,extremeMoves,extremeOutcome,applyExtreme,passExtreme,evaluateExtreme,validExtreme,rollExtreme,chooseExtreme} from './extreme.js?v=18';
import {initialLinear,linearOutcome,linearMoves,applyLinear,evaluateLinear,validLinear,linearCamp,TURN_LIMIT,collectIntel} from './linear.js?v=18';
export const VERSION=5;
export const camp=linearCamp;
export function initialState(mode='linear',random=Math.random){
 if(mode==='extreme')return initialExtreme();
 if(!['linear','ultra'].includes(mode))throw new Error('Unknown mode');
 const s={...initialLinear(),mode};
 if(mode==='ultra')Object.assign(s,{coins:[3,3],forcedRolls:[null,null],powerUsed:false,rollLocked:false});
 return upgradeCards(s,random);
}
export const outcome=s=>s.mode==='extreme'?extremeOutcome(s):linearOutcome(s);
export const legalMoves=(s,...args)=>s.mode==='extreme'?extremeMoves(s):linearMoves(s,...args);
export function applyMove(s,m,roll=s.roll){
 if(s.mode==='extreme')return applyExtreme(s,m);
 const n=applyLinear(s,m,roll,false),side=s.turn,enemy=1-side;
 if(s.mode==='ultra'){
  const victim=s.pieces[enemy].findIndex((p,i)=>p>=0&&n.pieces[enemy][i]===-1);
  if(victim>=0){n.coins[side]+=3;if(n.bounties[side]===victim){n.coins[side]+=3;n.bounties[side]=null;}}
  if(n.health[enemy]<s.health[enemy])n.coins[side]++;
 }
 return finishAction(n,side);
}
function finishAction(n,side){
 n.winner=outcome(n);n.roll=null;n.rollLocked=false;
 if(n.extraActions>0&&n.winner===null){n.extraActions--;return n;}
 return endTurn(n,side);
}
function endTurn(n,side){
 n.ply++;n.turn=1-side;n.roll=null;n.rollLocked=false;
 if(n.mode==='ultra'){n.extraActions=0;n.extraUsed=false;n.powerUsed=false;}
 if(n.winner===null&&n.ply<TURN_LIMIT)collectIntel(n);
 n.winner=outcome(n);n.draw=n.winner===null&&n.ply>=TURN_LIMIT;
 if(n.mode==='ultra'&&canPass(n))n.offers[n.turn]=makeOffers(n);
 return n;
}
export const canPass=s=>s.winner===null&&!s.draw;
export function passTurn(s){if(!canPass(s))throw new Error('Cannot skip this turn');return s.mode==='extreme'?passExtreme(s):endTurn(structuredClone(s),s.turn);}
export function evaluate(s,side){return s.mode==='extreme'?evaluateExtreme(s,side):evaluateLinear(s,side)+(s.winner===null&&!s.draw&&s.mode==='ultra'?(s.coins[side]-s.coins[1-side])*2:0);}
export function adjustRoll(s,delta){
 if(s.mode==='extreme'||!canPass(s)||s.roll===null||s.rollLocked||![-1,1].includes(delta)||s.commands[s.turn]<=0||s.roll+delta<1||s.roll+delta>6)throw new Error('Cannot adjust roll');
 const n=structuredClone(s);n.roll+=delta;n.commands[n.turn]--;return n;
}
export function chooseCommand(s,difficulty='medium'){
 if(s.mode==='extreme'||difficulty==='easy'||s.roll===null||s.rollLocked||!s.commands[s.turn]||!canPass(s))return null;
 const base=bestTurnValue(s,s.turn);let best=base+12,delta=null;
 for(const d of [-1,1])if(s.roll+d>=1&&s.roll+d<=6){const score=bestTurnValue(adjustRoll(s,d),s.turn);if(score>best){best=score;delta=d;}}
 return delta;
}
export function validSave(s){
 if(s?.mode==='extreme')return validExtreme(s);
 if(!validLinear(s))return false;
 if(s.mode==='linear')return s.cardVersion===undefined;
 return Array.isArray(s.coins)&&s.coins.length===2&&s.coins.every(c=>Number.isInteger(c)&&c>=0&&c<=2000)&&
 Array.isArray(s.forcedRolls)&&s.forcedRolls.length===2&&s.forcedRolls.every(r=>r===null||Number.isInteger(r)&&r>=1&&r<=6)&&
 typeof s.rollLocked==='boolean'&&(!s.rollLocked||s.roll!==null)&&typeof s.extraUsed==='boolean'&&(!s.extraActions||s.extraUsed)&&s.extraActions<=1&&validCards(s)&&s.cardVersion===1;
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
  if(state.mode==='extreme')return chooseExtreme(state,difficulty,random);
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
  // defensive skips when acting would expose a valuable position.
  const activeChoices=choices.filter(Boolean);
  const pool=activeChoices.length?activeChoices:choices;
  return pool[Math.floor(random()*pool.length)];
}
export function rollTurn(state, value) {
  if(state.mode==='extreme')return rollExtreme(state,value);
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
 extra:{name:'Double Agent',cost:5,icon:'Ⅱ',type:'Tempo',text:'Gain one extra action this turn. Maximum one extra action per turn.'},
 bounty:{name:'Marked Target',cost:1,icon:'◎',type:'Reward',text:'Mark a visible enemy agent. Capturing that agent earns 3 bonus coins. One active mark.'},
 grant:{name:'War Chest',cost:0,icon:'◈',type:'Coins',text:'Spend one action to gain 3 coins.'},
 draw:{name:'Dead Drop',cost:4,icon:'✉',type:'Cards',text:'Draw 2 random cards other than Dead Drop. Needs one free hand slot. Does not use an action.'}
};
export function upgradeCards(state, random=Math.random){
 const next=structuredClone(state);
 if(next.mode!=='ultra'||next.cardVersion)return next;
 next.cardVersion=1;next.cardSeed=Math.floor(random()*4294967296)>>>0;next.nextCardId=1;
 next.hands=[[],[]];next.offers=[[],[]];next.extraActions=0;next.extraUsed=false;next.bounties=[null,null];
 for(const side of [0,1]){next.hands[side].push(makeCard(next));next.offers[side]=makeOffers(next);}
 return next;
}
function cardRandom(s){s.cardSeed=(Math.imul(1664525,s.cardSeed)+1013904223)>>>0;return s.cardSeed/4294967296;}
function makeCard(s,keys=Object.keys(CARDS)){return {id:s.nextCardId++,kind:keys[Math.floor(cardRandom(s)*keys.length)]};}
function makeOffers(s){const keys=Object.keys(CARDS),offers=[];for(let i=0;i<3;i++){const c=makeCard(s,keys);offers.push(c);keys.splice(keys.indexOf(c.kind),1);}return offers;}
function validCards(s){
 if(s.cardVersion===undefined)return true;
 if(s.mode!=='ultra'||s.cardVersion!==1||!Number.isInteger(s.cardSeed)||s.cardSeed<0||s.cardSeed>4294967295||!Number.isInteger(s.nextCardId)||s.nextCardId<1||
 !Number.isInteger(s.extraActions)||s.extraActions<0||s.extraActions>1||!Array.isArray(s.bounties)||s.bounties.length!==2||!s.bounties.every((n,side)=>n===null||Number.isInteger(n)&&n>=0&&n<s.pieces[1-side].length&&s.pieces[1-side][n]>=0))return false;
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
 if(c.kind==='extra'&&s.extraUsed)return 'Extra action already used this turn';
 if(c.kind==='bounty'&&(s.bounties[s.turn]!==null||!s.pieces[1-s.turn].some(p=>p>0&&p<25)))return 'Needs an unmarked visible enemy';
 if(c.kind==='draw'&&s.hands[s.turn].length>=8)return 'Needs one free hand slot';
 return '';
}
export function playCard(s,id,value){
 const blocked=cardBlock(s,id);if(blocked)throw new Error(blocked);
 const n=structuredClone(s),side=s.turn,i=n.hands[side].findIndex(c=>c.id===id),c=n.hands[side][i];
 if(['set','reroll','sabotage'].includes(c.kind)&&(!Number.isInteger(value)||value<1||value>6))throw new Error('Choose a die face');
 n.hands[side].splice(i,1);
 if(c.kind==='extra'){n.extraActions=1;n.extraUsed=true;}
 if(c.kind==='bounty'){if(!Number.isInteger(value)||!(s.pieces[1-side][value]>0&&s.pieces[1-side][value]<25))throw new Error('Choose a visible enemy');n.bounties[side]=value;}
 if(c.kind==='grant'){n.coins[side]+=3;return finishAction(n,side);}
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
  }else if(c.kind==='bounty'){value=s.pieces[1-side].findIndex(p=>p>0&&p<25);score=3;}else if(c.kind==='grant'){score=bestTurnValue(playCard(s,c.id),side)-base;}else if(c.kind==='recruit')score=bestTurnValue(playCard(s,c.id),side)-base;
  else if(c.kind==='extra')score=legalMoves(s).some(m=>m.to!==camp(side)&&m.from!==m.to)?6:0;
  else score=({grant:8,draw:8,bounty:3})[c.kind];
  if(score>0||difficulty==='easy'&&random()<.25)choices.push({type:'play',id:c.id,value,score});
 }
 if(choices.length){choices.sort((a,b)=>b.score-a.score);return difficulty==='easy'?choices[Math.floor(random()*choices.length)]:choices[0];}
 const buys=s.offers[side].filter(c=>canBuyCard(s,c.id)).map(c=>({type:'buy',id:c.id,score:({grant:10,extra:7,recruit:5,draw:6,set:5,reroll:3,sabotage:3,bounty:2})[c.kind]}));
 if(!buys.length||difficulty==='easy'&&random()<.5)return null;
 buys.sort((a,b)=>b.score-a.score);return difficulty==='easy'?buys[Math.floor(random()*buys.length)]:buys[0];
}
