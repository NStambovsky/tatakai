import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,legalMoves,applyMove,passTurn,rollTurn,validSave,chooseMove} from '../engine.js';
function capture(s){const m=legalMoves(s).find(m=>m.kind==='capture');assert.ok(m,'capture ready');return applyMove(s,m);}
function approach(mode,home,pos=19){const flip=p=>home===0?p:25-p;const s=initialState(mode);s.turn=1-home;s.roll=1;s.pieces[home][0]=flip(pos);s.pieces[1-home][0]=flip(pos-2);const m=legalMoves(s).find(m=>m.from===flip(pos-2)&&m.to===flip(pos)&&m.kind==='advance');assert.ok(m?.contest);return applyMove(s,m);}
for(const mode of ['linear','ultra'])for(const home of [0,1]){
 test(`${mode}/${home}: defender captures first without rolling; invader survives arrival`,()=>{
  const s=approach(mode,home);assert.equal(s.turn,home);assert.equal(s.pieces[0][0],s.pieces[1][0]);assert.equal(s.pendingCaptures[0].ready,false);assert.ok(validSave(s));assert.ok(validSave(JSON.parse(JSON.stringify(s))));
  const n=capture(s);assert.equal(n.pieces[1-home][0],-1);assert.notEqual(n.pieces[home][0],-1);assert.deepEqual(n.pendingCaptures,[]);assert.ok(validSave(n));
 });
 test(`${mode}/${home}: every roll permits defender capture; skipping grants invader capture`,()=>{
  for(let roll=1;roll<=6;roll++){const s=rollTurn(approach(mode,home),roll);assert.equal(capture(s).pieces[1-home][0],-1);}
  let s=passTurn(approach(mode,home));assert.equal(s.turn,1-home);assert.equal(s.pendingCaptures[0].ready,true);
  for(let roll=1;roll<=6;roll++){const rolled=rollTurn(s,roll);assert.equal(capture(rolled).pieces[home][0],-1);}
  s=capture(s);assert.equal(s.pieces[home][0],-1);assert.ok(validSave(s));
 });
 test(`${mode}/${home}: moving either agent clears the face-off`,()=>{
  const s=rollTurn(approach(mode,home),1);const from=s.pieces[home][0];const m=legalMoves(s).find(m=>m.from===from&&m.kind==='advance');assert.ok(m);const n=applyMove(s,m);assert.deepEqual(n.pendingCaptures,[]);assert.ok(!legalMoves(n).some(m=>m.kind==='capture'));assert.ok(validSave(n));
  const a=rollTurn(passTurn(approach(mode,home)),1),p=a.pieces[1-home][0];const step=legalMoves(a).find(m=>m.from===p&&m.kind==='advance');assert.ok(step);assert.deepEqual(applyMove(a,step).pendingCaptures,[]);
 });
 test(`${mode}/${home}: every home space grants the response; remote strike cannot bypass it`,()=>{
  for(let p=13;p<=24;p++){const s=approach(mode,home,p);assert.ok(legalMoves(s).some(m=>m.kind==='capture'));assert.ok(validSave(s));}
  const flip=p=>home===0?p:25-p,s=initialState(mode);s.turn=1-home;s.roll=3;s.pieces[home][0]=flip(19);s.pieces[1-home][0]=flip(17);assert.ok(!legalMoves(s).some(m=>m.kind==='strike'&&m.target===flip(19)));
 });
 test(`${mode}/${home}: computer can use the ready capture`,()=>{
  const s=approach(mode,home);s.pieces[1-home].fill(-1);s.pieces[1-home][0]=s.pieces[home][0];
  for(const d of ['easy','medium','hard'])assert.equal(applyMove(s,chooseMove(s,d,()=>0)).winner,home);
 });
}
test('Ultra extra actions do not unlock a newly approached defender before a full response',()=>{
 const s=initialState('ultra');s.turn=1;s.roll=1;s.extraActions=1;s.extraUsed=true;s.pieces[0][0]=19;s.pieces[1][0]=17;
 const m=legalMoves(s).find(m=>m.from===17&&m.to===19);const n=applyMove(s,m);assert.equal(n.turn,1);assert.equal(n.pendingCaptures[0].ready,false);assert.ok(!legalMoves(n).some(m=>m.kind==='capture'));assert.ok(validSave(n));
 const home=passTurn(n);assert.equal(home.turn,0);assert.equal(home.pendingCaptures[0].ready,false);assert.ok(legalMoves(home).some(m=>m.kind==='capture'));
 const ready=passTurn(home);assert.equal(ready.pendingCaptures[0].ready,true);assert.ok(legalMoves(ready).some(m=>m.kind==='capture'));
});
test('saves reject untracked overlaps, duplicate friendly pieces and forged response records',()=>{
 const s=approach('linear',0);assert.equal(validSave({...s,pendingCaptures:[]}),false);
 assert.equal(validSave({...s,pendingCaptures:[{...s.pendingCaptures[0],attacker:0}]}),false);
 assert.equal(validSave({...s,pendingCaptures:[...s.pendingCaptures,...s.pendingCaptures]}),false);
 const n=structuredClone(s);n.pieces[0][1]=n.pieces[0][0];assert.equal(validSave(n),false);
});
