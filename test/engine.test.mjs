import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,legalMoves,applyMove,passTurn,rollTurn,adjustRoll,chooseCommand,validSave,chooseMove,chooseCard,playCard,buyCard} from '../engine.js';
import {TURN_LIMIT,linearCamp} from '../linear.js';
const move=(s,from,to,kind='advance')=>{const m=legalMoves(s).find(m=>m.from===from&&m.to===to&&m.kind===kind);assert.ok(m,`${from} -> ${to}: ${kind}`);return applyMove(s,m);};
test('Linear and Ultra remain supported; default is Linear',()=>{assert.equal(initialState().mode,'linear');assert.throws(()=>initialState('unknown'));assert.ok(validSave(initialState('classic')));for(const mode of ['linear','ultra'])assert.ok(validSave(initialState(mode)));});
for(const mode of ['linear','ultra'])for(const side of [0,1]){
 const flip=p=>side===0?p:25-p;
 test(`${mode}/${side}: checkpoint blocks jumps, not capture landings; other enemies may be jumped`,()=>{
  let s=initialState(mode);s.turn=side;s.roll=4;s.pieces[side][0]=flip(17);s.pieces[1-side][0]=flip(13);
  assert.ok(!legalMoves(s).some(m=>m.from===flip(17)&&m.to===flip(9)));
  s.roll=2;const n=move(s,flip(17),flip(13));assert.equal(n.pieces[1-side][0],-1);assert.ok(validSave(n));
  s.roll=4;s.pieces[1-side][0]=flip(15);assert.ok(legalMoves(s).some(m=>m.from===flip(17)&&m.to===flip(9)));
 });
 test(`${mode}/${side}: checkpoint also blocks short advances`,()=>{const s=initialState(mode);s.turn=side;s.roll=5;s.pieces[side][0]=flip(17);s.pieces[1-side][0]=flip(13);assert.ok(!legalMoves(s).some(m=>m.kind==='stride'&&m.from===flip(17)&&m.to===flip(11)));});
 test(`${mode}/${side}: intel waits for response and scores only once`,()=>{
  let s=initialState(mode);s.turn=side;s.roll=1;s.pieces[side][0]=flip(9);s=move(s,flip(9),flip(7));assert.equal(s.intel[side],0);
  s=passTurn(s);assert.equal(s.intel[side],1);s=passTurn(passTurn(s));assert.equal(s.intel[side],1);assert.ok(validSave(s));
 });
 test(`${mode}/${side}: contested objective and captured courier do not score`,()=>{
  let s=initialState(mode);s.turn=1-side;s.pieces[side][0]=flip(7);s.pieces[1-side][0]=flip(8);assert.equal(passTurn(s).intel[side],0);
  s.pieces[side][0]=-1;assert.equal(passTurn(s).intel[side],0);
 });
 test(`${mode}/${side}: Command tokens obey bounds, supply and turn state`,()=>{
  let s=initialState(mode);s.turn=side;assert.throws(()=>adjustRoll(s,1));s=rollTurn(s,1);assert.throws(()=>adjustRoll(s,-1));
  s=adjustRoll(s,1);assert.equal(s.roll,2);assert.equal(s.commands[side],1);s=adjustRoll(s,1);assert.equal(s.commands[side],0);assert.throws(()=>adjustRoll(s,1));assert.ok(validSave(s));assert.equal(passTurn(s).commands[side],0);
 });
}
test('timer resolves intelligence and otherwise draws; damage still takes precedence',()=>{
 for(const intel of [[0,0],[1,1],[1,0],[0,1]]){const s=initialState();s.ply=TURN_LIMIT-1;s.intel=intel;const n=passTurn(s);assert.equal(n.winner,intel[0]===intel[1]?null:intel[0]>intel[1]?0:1);assert.equal(n.draw,intel[0]===intel[1]);assert.ok(validSave(n));}
 const s=initialState();s.ply=TURN_LIMIT-1;s.roll=1;s.pieces[0][0]=1;s.health[1]=1;s.intel=[0,1];const n=move(s,1,0);assert.equal(n.winner,0);assert.ok(validSave(n));
});
test('invalid saves are rejected without throwing',()=>{
 const s=initialState();for(const bad of [null,{}, {...s,version:4},{...s,mode:'unknown'},{...s,commands:null},{...s,intel:null},{...s,pieces:[{},[]]},{...s,pieces:null},{...s,health:[0,0]},{...s,commands:[3,0]},{...s,intel:[2,0]}])assert.equal(validSave(bad),false);
});
test('AI uses a Command for an immediate win',()=>{const s=initialState();s.roll=2;s.pieces[0][0]=1;s.health[1]=1;assert.equal(chooseCommand(s,'medium'),-1);});
test('both modes have identical board actions and effects',()=>{
 for(let roll=1;roll<=6;roll++){let a=initialState('linear'),b=initialState('ultra');for(const s of [a,b]){s.roll=roll;s.pieces[0][0]=19;s.pieces[1][0]=17;}assert.deepEqual(legalMoves(a),legalMoves(b));for(const m of legalMoves(a)){const x=applyMove(a,m),y=applyMove(b,m);for(const key of ['pieces','health','turn','ply','intel','commands','winner','draw'])assert.deepEqual(x[key],y[key]);}}
});
test('full AI campaigns preserve valid state in both modes and every difficulty',()=>{
 let seed=713;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const mode of ['linear','ultra'])for(const difficulty of ['easy','medium','hard'])for(let game=0;game<2;game++){
  let s=initialState(mode,random),steps=0;
  while(s.winner===null&&!s.draw){assert.ok(++steps<4000,'finite campaign');if(s.roll===null)s=rollTurn(s,1+Math.floor(random()*6));const c=chooseCard(s,difficulty,random);
   if(c)s=c.type==='buy'?buyCard(s,c.id):playCard(s,c.id,c.value??(1+Math.floor(random()*6)));
   else{const d=chooseCommand(s,difficulty);if(d!==null)s=adjustRoll(s,d);const m=chooseMove(s,difficulty,random);s=m?applyMove(s,m):passTurn(s);}
   assert.ok(validSave(s),`${mode}/${difficulty} step ${steps}`);assert.ok(validSave(JSON.parse(JSON.stringify(s))));
  }
  assert.ok(s.ply<=TURN_LIMIT);
 }
});

test('no intelligence is awarded for a turn that never starts after the limit',()=>{const s=initialState();s.ply=TURN_LIMIT-1;s.turn=1;s.pieces[0][0]=7;const n=passTurn(s);assert.deepEqual(n.intel,[0,0]);assert.equal(n.draw,true);assert.ok(validSave(n));});
