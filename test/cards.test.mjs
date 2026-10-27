import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,CARDS,upgradeCards,buyCard,canBuyCard,playCard,cardBlock,chooseCard,rollTurn,passTurn,applyMove,legalMoves,chooseMove,validSave,canPass,camp} from '../engine.js';
function setup(roll=null){const s=initialState('ultra',()=>.123);s.coins=[20,20];s.hands=[[],[]];s.roll=roll;return s;}
function give(s,kind,side=s.turn){const c={id:s.nextCardId++,kind};s.hands[side].push(c);return c.id;}
function move(s,from,to){const m=legalMoves(s).find(m=>m.from===from&&m.to===to);assert.ok(m,`${from} → ${to}`);return applyMove(s,m);}
test('both sides start with one random card and three distinct offers',()=>{
 const seen=new Set();for(let seed=0;seed<25;seed++){const s=initialState('ultra',()=>seed/25);assert.ok(validSave(s));for(const side of [0,1]){assert.equal(s.hands[side].length,1);assert.equal(s.offers[side].length,3);assert.equal(new Set(s.offers[side].map(c=>c.kind)).size,3);seen.add(s.hands[side][0].kind);}}
 assert.ok(seen.size>=6);assert.deepEqual(initialState('ultra',()=>.3),initialState('ultra',()=>.3));
});
test('purchase charges once, removes offer, and does not consume action or refresh market',()=>{
 const s=setup(),c=s.offers[0][0],n=buyCard(s,c.id);assert.equal(n.coins[0],20-CARDS[c.kind].cost);assert.equal(n.hands[0][0].id,c.id);assert.equal(n.offers[0].length,2);assert.equal(n.turn,0);assert.equal(n.ply,0);assert.throws(()=>buyCard(n,c.id));assert.equal(s.offers[0].length,3);assert.ok(validSave(n));
});
test('purchases reject insufficient money, full hands, wrong player, and finished games',()=>{
 const s=setup();s.coins[0]=0;assert.ok(!canBuyCard(s,s.offers[0][0].id));s.coins[0]=20;for(let i=0;i<8;i++)give(s,'extra');assert.throws(()=>buyCard(s,s.offers[0][0].id));s.hands[0]=[];assert.throws(()=>buyCard(s,s.offers[1][0].id));s.draw=true;assert.throws(()=>buyCard(s,s.offers[0][0].id));
});
test('cards are free to play, consumed once, and multiple cards can be chained',()=>{
 let s=setup(2);const a=give(s,'set'),b=give(s,'reroll'),c=give(s,'grant');s=playCard(s,a,5);s=playCard(s,b,3);s=playCard(s,c);assert.equal(s.roll,3);assert.equal(s.coins[0],24);assert.equal(s.ply,0);assert.equal(s.hands[0].length,0);assert.throws(()=>playCard(s,a,4));assert.ok(validSave(s));
});
test('extra action permits a second movement and fresh roll without extra income or refresh',()=>{
 let s=setup(4);s.pieces[0][0]=0;const offers=structuredClone(s.offers),id=give(s,'extra');s=playCard(s,id);s=move(s,21,17);assert.equal(s.turn,0);assert.equal(s.ply,0);assert.equal(s.roll,null);assert.equal(s.extraActions,0);assert.equal(s.coins[0],20);assert.deepEqual(s.offers,offers);
 s=rollTurn(s,2);s=move(s,17,7);assert.equal(s.turn,1);assert.equal(s.ply,1);assert.equal(s.coins[0],21);assert.notDeepEqual(s.offers[1],offers[1]);assert.ok(validSave(s));
});
test('extra actions stack, but skip forfeits them and completes just one turn',()=>{
 let s=setup();s=playCard(s,give(s,'extra'));s=playCard(s,give(s,'extra'));assert.equal(s.extraActions,2);s=passTurn(s);assert.equal(s.turn,1);assert.equal(s.extraActions,0);assert.equal(s.ply,1);assert.ok(validSave(s));
});
test('extra action cannot bypass opponent response window on either half',()=>{
 for(const side of [0,1])for(const home of [false,true]){
 let s=setup(4);s.turn=side;const flip=p=>side===0?p:21-p;const victim=flip(home?18:4),target=flip(home?17:3);s.pieces[1-side][0]=victim;s.pieces[side][0]=flip(11);
 s=playCard(s,give(s,'extra'));s=move(s,flip(11),target);assert.equal(s.turn,side);assert.ok(!legalMoves(s).some(m=>m.kind==='capture'&&m.from===target));s.roll=4;assert.ok(!legalMoves(s).some(m=>m.kind==='capture'&&m.from===target));s=passTurn(s);s=passTurn(s);assert.ok(legalMoves(s).some(m=>m.kind==='capture'&&m.from===target));assert.ok(validSave(s));
 }
});
test('recruit uses an action, reuses casualties, and does not sweep infiltrators',()=>{
 let s=setup();s.pieces[0][0]=-1;s.pieces[1][0]=21;s=playCard(s,give(s,'extra'));s=playCard(s,give(s,'recruit'));assert.equal(s.turn,0);assert.equal(s.pieces[0].length,6);assert.equal(s.pieces[0][0],21);assert.equal(s.pieces[1][0],21);assert.equal(s.coins[0],20);assert.equal(s.extraActions,0);assert.ok(validSave(s));
});
test('recruit stops at eight living agents',()=>{
 let s=setup();s.pieces[0].push(21,21);const id=give(s,'recruit');assert.match(cardBlock(s,id),/full/);assert.throws(()=>playCard(s,id));
});
test('bonus capture rewards stack and persist until a real capture',()=>{
 let s=setup(4);s.pieces[1][0]=18;s=playCard(s,give(s,'bounty'));s=playCard(s,give(s,'bounty'));s=move(s,21,17);assert.equal(s.bounties[0],6);assert.equal(s.coins[0],20);s=passTurn(s);s=move(s,17,17);assert.equal(s.coins[0],29);assert.equal(s.bounties[0],0);assert.ok(validSave(s));
});
test('Dead Drop draws two cards without recursive Dead Drops or exceeding hand limit',()=>{
 let s=setup();const id=give(s,'draw');s=playCard(s,id);assert.equal(s.hands[0].length,2);assert.ok(s.hands[0].every(c=>c.kind!=='draw'));assert.ok(validSave(s));
 const blocked=give(s,'draw');while(s.hands[0].length<8)give(s,'extra');assert.throws(()=>playCard(s,blocked));s.hands[0].pop();s=playCard(s,blocked);assert.equal(s.hands[0].length,8);
});
test('False Orders persists through skips and locks the affected roll',()=>{
 let s=setup();s=playCard(s,give(s,'sabotage'),5);s=passTurn(s);s=passTurn(s);s=passTurn(s);s=rollTurn(s,2);assert.equal(s.roll,5);assert.equal(s.forcedRolls[1],null);assert.throws(()=>playCard(s,give(s,'set'),3));assert.throws(()=>playCard(s,give(s,'reroll'),3));s=playCard(s,give(s,'extra'));s=move(s,0,1);s=rollTurn(s,3);assert.equal(s.roll,3);assert.ok(validSave(s));
});
test('die cards require a rolled die and valid face, and do not mutate on failure',()=>{
 const s=setup(),id=give(s,'set');assert.throws(()=>playCard(s,id,3));s.roll=1;const before=structuredClone(s);for(const value of [0,7,2.5,null])assert.throws(()=>playCard(s,id,value));assert.deepEqual(s,before);
});
test('shop and hand survive reload; refresh only at next turn, never on reload',()=>{
 let s=setup();s=buyCard(s,s.offers[0][0].id);const restored=upgradeCards(JSON.parse(JSON.stringify(s)),()=>.9);assert.deepEqual(restored,s);s=passTurn(s);s=passTurn(s);assert.equal(s.offers[0].length,3);assert.equal(s.hands[0].length,1);assert.ok(validSave(s));
});
test('legacy Ultra saves migrate once preserving board, coins and queued roll',()=>{
 const s=setup();for(const k of ['cardVersion','cardSeed','nextCardId','hands','offers','extraActions','bounties'])delete s[k];s.forcedRolls[1]=6;s.coins[0]=17;
 assert.ok(validSave(s));const n=upgradeCards(s,()=>.2);assert.deepEqual(n.pieces,s.pieces);assert.deepEqual(n.coins,s.coins);assert.deepEqual(n.forcedRolls,s.forcedRolls);assert.equal(n.hands[0].length,1);assert.ok(validSave(n));assert.deepEqual(upgradeCards(n),n);
 const classic=initialState();assert.deepEqual(upgradeCards(classic),classic);assert.throws(()=>buyCard(classic,1));
});
test('save validation rejects duplicate IDs, invented cards, bad seed and extra actions',()=>{
 for(const mutate of [s=>s.hands[0].push(s.offers[0][0]),s=>s.hands[0].push({id:s.nextCardId++,kind:'fake'}),s=>s.extraActions=-1,s=>s.cardSeed=-1,s=>s.bounties[0]=-1]){const s=setup();mutate(s);assert.ok(!validSave(s));}
});
test('winning capture ends immediately even with extra actions remaining',()=>{
 let s=setup();s.pieces[0][0]=3;s.pieces[1]=[4,-1,-1,-1,-1,-1];s=playCard(s,give(s,'extra'));s=move(s,3,3);assert.equal(s.winner,0);assert.equal(s.extraActions,0);assert.ok(validSave(s));
});
test('all AI levels complete card games with valid saves and bounded turns',()=>{
 let seed=876;const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const difficulty of ['easy','medium','hard']){
 let s=initialState('ultra',r),steps=0;
 while(canPass(s)&&steps++<2000){
 if(s.roll===null)s=rollTurn(s,1+Math.floor(r()*6));const c=chooseCard(s,difficulty,r);
 if(c){if(c.type==='buy')s=buyCard(s,c.id);else {const card=s.hands[s.turn].find(x=>x.id===c.id);s=playCard(s,c.id,card.kind==='reroll'?1+Math.floor(r()*6):c.value);}}
 else {const m=chooseMove(s,difficulty,r);s=m?applyMove(s,m):passTurn(s);}
 assert.ok(validSave(s));
 }
 assert.ok(!canPass(s),`${difficulty} did not finish within step budget`);assert.ok(s.ply<=300);
 }
});
