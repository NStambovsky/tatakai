import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,legalMoves,applyMove,rollTurn,passTurn,chooseMove,validSave} from '../engine.js';
import {extremePos as pos,extremeCamp as camp,selectExtremeDie,skipExtremeDie,fullRow,pieceRole} from '../extreme.js';
function setup(side=0,values=[2,3,6]){const s=initialState('extreme');s.turn=side;return rollTurn(s,values);}
function move(s,from,to,kind='advance'){const m=legalMoves(s).find(m=>m.from===from&&m.to===to&&m.kind===kind);assert.ok(m,`${from}→${to} ${kind}`);return applyMove(s,m);}
test('Extreme starts with ten agents, five health and exactly three independently selectable dice',()=>{
 const s=initialState('extreme');assert.equal(s.pieces[0].length,10);assert.deepEqual(s.health,[5,5]);assert.ok(validSave(s));
 const n=rollTurn(s,[2,2,6]);assert.deepEqual(n.dice,[2,2,6]);assert.equal(selectExtremeDie(n,2).roll,6);assert.throws(()=>rollTurn(n,[1,2,3]));assert.throws(()=>rollTurn(s,3));
});
for(const side of [0,1]){
 const rank=r=>side===0?r:11-r;
 const p=(r,route=0,lane=0)=>pos(rank(r),route,lane);
 test(`side ${side}: can deploy onto both tracks of both routes`,()=>{const s=setup(side);for(const [role,count] of [['agent',4],['guard',4],['runner',8]])assert.equal(legalMoves(s).filter(m=>m.kind==='advance'&&pieceRole(s,side,m.piece)===role).length,count);});
 test(`side ${side}: weaves around single agents and can choose either landing track`,()=>{
 const s=setup(side);s.pieces[side][0]=p(9);s.pieces[side][1]=p(8);s.pieces[1-side][0]=p(7,0,0);
 assert.equal(move(s,p(9),p(7,0,0)).pieces[1-side][0],-1);assert.ok(move(s,p(9),p(7,0,1)));s.pieces[1-side][0]=p(8,0,1);
 assert.ok(!legalMoves(s).some(m=>m.from===p(9)&&m.kind==='advance')); // mixed full row is also a wall
 });
 test(`side ${side}: a full friendly or enemy row cannot be jumped`,()=>{
 for(const owner of [side,1-side]){const s=setup(side,[3,1,1]);s.pieces[side][0]=p(9);s.pieces[owner][2]=p(8,0,0);s.pieces[owner][3]=p(8,0,1);assert.ok(fullRow(s,rank(8),0));assert.ok(!legalMoves(s).some(m=>m.from===p(9)&&m.kind==='advance'));}
 });
 test(`side ${side}: a lone attacker cannot land on a pair, but two can capture one blocker`,()=>{
 const s=setup(side,[1,4,4]);s.pieces[side][0]=p(9);s.pieces[1-side][0]=p(8,0,0);s.pieces[1-side][1]=p(8,0,1);
 assert.ok(!legalMoves(s).some(m=>m.from===p(9)&&m.kind==='advance'));s.pieces[side][1]=p(9,0,1);
 const n=move(s,p(9),p(8),'assault');assert.equal(n.pieces[1-side][0],-1);assert.equal(n.pieces[side][1],p(9,0,1));assert.equal(n.turn,side);assert.equal(n.dice.filter(Boolean).length,2);assert.ok(validSave(n));
 const m=legalMoves(s).find(m=>m.kind==='assault');assert.throws(()=>applyMove(s,{...m,support:camp(side)}));
 });
 test(`side ${side}: strike breaks a pair; vault jumps it without capturing it`,()=>{
 const s=setup(side,[3,5,2]);s.pieces[side][0]=p(9);s.pieces[1-side][0]=p(8);s.pieces[1-side][1]=p(8,0,1);
 assert.equal(move(s,p(9),p(9),'strike').pieces[1-side][0],-1);
 const v=selectExtremeDie(s,1);assert.ok(move(v,p(9),p(6),'vault'));assert.ok(!legalMoves(v).some(m=>m.kind==='vault'&&m.to===p(8)));assert.ok(!legalMoves(v).some(m=>m.kind==='vault'&&m.to===p(8,0,1)));
 s.pieces[1-side][1]=camp(1-side);assert.equal(move(selectExtremeDie(s,1),p(9),p(8),'vault').pieces[1-side][0],-1);
 });
 test(`side ${side}: switching routes respects pairs but can capture a lone enemy`,()=>{
 const s=setup(side);s.pieces[side][0]=p(9);s.pieces[1-side][0]=p(9,1,0);s.pieces[1-side][1]=p(9,1,1);
 assert.ok(!legalMoves(s).some(m=>m.from===p(9)&&m.kind==='advance'&&m.to===p(7,1,0)));
 assert.ok(!legalMoves(s).some(m=>m.kind==='sidestep'&&m.from===p(9)));
 s.pieces[1-side][1]=camp(1-side);assert.equal(move(s,p(9),p(9,1,0),'sidestep').pieces[1-side][0],-1);
 });
 test(`side ${side}: exact base hit returns attacker home and retains other dice`,()=>{
 const s=setup(side,[1,2,3]);s.pieces[side][0]=p(0);
 const n=move(s,p(0),camp(1-side));assert.equal(n.health[1-side],4);assert.equal(n.pieces[side][0],camp(side));assert.equal(n.turn,side);assert.ok(validSave(n));
 assert.ok(!legalMoves(selectExtremeDie(s,1)).some(m=>m.from===p(0)&&m.to===camp(1-side)));
 s.health[1-side]=1;const win=move(s,p(0),camp(1-side));assert.equal(win.winner,side);assert.deepEqual(win.dice,[]);assert.ok(validSave(win));assert.throws(()=>skipExtremeDie(win));
 });
}
test('spend dice in any order, skip each individually, and advance turn exactly once',()=>{
 let s=setup(0,[2,2,6]);s=selectExtremeDie(s,1);s=skipExtremeDie(s);assert.deepEqual(s.dice,[2,null,6]);assert.equal(s.turn,0);assert.equal(s.ply,0);assert.throws(()=>selectExtremeDie(s,1));
 s=skipExtremeDie(selectExtremeDie(s,2));assert.deepEqual(s.dice,[2,null,null]);s=move(s,49,pos(10,0,0));assert.equal(s.turn,1);assert.equal(s.ply,1);assert.deepEqual(s.dice,[]);assert.ok(validSave(s));
 assert.equal(passTurn(initialState('extreme')).turn,1);assert.equal(passTurn(setup()).ply,1);
});
test('used dice and forged actions cannot be replayed; saves preserve remaining dice',()=>{
 const s=setup();const m=legalMoves(s)[0],n=applyMove(s,m);assert.throws(()=>applyMove(n,m));assert.ok(validSave(JSON.parse(JSON.stringify(n))));
 for(const edit of [{dice:[6,6,6],roll:2},{dieIndex:3},{health:[6,5]},{pieces:[Array(10).fill(1),Array(10).fill(0)]}])assert.ok(!validSave({...s,...edit}));
});
test('all difficulties use all three dice and finish valid games',()=>{
 let seed=13;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(const difficulty of ['easy','medium','hard']){
  let s=initialState('extreme'),actions=0;
  while(s.winner===null&&!s.draw){if(!s.dice.length)s=rollTurn(s,Array.from({length:3},()=>1+Math.floor(random()*6)));const m=chooseMove(s,difficulty,random);s=m?applyMove(s,m):skipExtremeDie(s);assert.ok(validSave(s));assert.ok(++actions<=480);}
 }
});

test('one movement die per agent, including agents that score and return home',()=>{
 let s=setup(0,[1,2,3]);s.pieces[0][0]=pos(0,0,0);s=move(s,pos(0,0,0),0);
 assert.ok(s.movedAgents.includes(0));assert.ok(legalMoves(s).filter(m=>m.action==='move').every(m=>m.piece!==0));
 const next=legalMoves(s).find(m=>m.action==='move');assert.equal(next.piece,1);s=applyMove(s,next);assert.equal(s.movedAgents.length,2);
 assert.ok(!legalMoves(s).some(m=>m.action==='move'&&s.movedAgents.includes(m.piece)));
 assert.ok(validSave(s));
});
test('Reverse consumes its action die and the chosen distance die, and blocks a second movement die',()=>{
 let s=setup(0,[1,4,2]);s.pieces[0][0]=pos(6,0,0);
 const combo=legalMoves(s).find(m=>m.kind==='reverse'&&m.movementDie===1&&m.to===pos(10,0,1));assert.ok(combo);
 s=applyMove(s,combo);assert.equal(s.pieces[0][0],pos(10,0,1));assert.deepEqual(s.dice,[null,null,2]);assert.deepEqual(s.movedAgents,[0]);assert.equal(s.turn,0);assert.ok(validSave(s));
 assert.ok(!legalMoves(s).some(m=>m.action==='move'&&m.piece===0));
 assert.ok(legalMoves(s).some(m=>m.kind==='sidestep'&&m.piece===0)); // actions still stack
 assert.throws(()=>applyMove(s,combo));
});
test('movement followed by actions is allowed, but another reverse movement is not',()=>{
 let s=setup(0,[2,1,4]);s.pieces[0][0]=pos(8,0,0);s=move(s,pos(8,0,0),pos(6,0,1));
 assert.ok(legalMoves(s).some(m=>m.kind==='retreat'&&m.piece===0));assert.ok(!legalMoves(s).some(m=>m.kind==='reverse'&&m.piece===0));
 s=applyMove(s,legalMoves(s).find(m=>m.kind==='retreat'&&m.piece===0));s=move(s,s.pieces[0][0],49,'recall');assert.equal(s.turn,1);assert.deepEqual(s.movedAgents,[]);assert.ok(validSave(s));
});
test('reverse combination obeys walls and forged distance dice are rejected',()=>{
 const s=setup(0,[1,4,6]);s.pieces[0][0]=pos(5,0,0);s.pieces[1][0]=pos(7,0,0);s.pieces[1][1]=pos(7,0,1);
 assert.ok(!legalMoves(s).some(m=>m.kind==='reverse'&&m.piece===0));
 s.pieces[1][1]=0;const m=legalMoves(s).find(m=>m.kind==='reverse');assert.ok(m);assert.throws(()=>applyMove(s,{...m,movementDie:0}));
 assert.ok(!validSave({...s,movedAgents:[0,0]}));
});

for(const side of [0,1]){
 test(`side ${side}: six repairs one health, consumes one die and never captures`,()=>{
  let s=setup(side,[6,6,2]);s.health[side]=3;s.pieces[1-side][0]=pos(side===0?8:3,0,0);const before=structuredClone(s.pieces);
  const m=legalMoves(s).find(m=>m.kind==='repair');assert.ok(m);assert.ok(!legalMoves(s).some(m=>m.kind==='sweep'));
  s=applyMove(s,m);assert.equal(s.health[side],4);assert.deepEqual(s.pieces,before);assert.deepEqual(s.dice,[null,6,2]);assert.equal(s.turn,side);assert.ok(validSave(s));
  s=move(s,camp(side),camp(side),'repair');assert.equal(s.health[side],5);assert.ok(validSave(JSON.parse(JSON.stringify(s))));
  s=selectExtremeDie({...s,dice:[6,null,2]},0);assert.ok(!legalMoves(s).some(m=>m.kind==='repair'));
 });
 test(`side ${side}: repair requires an agent at home and cannot exceed five`,()=>{
  const s=setup(side,[6,1,2]);assert.ok(!legalMoves(s).some(m=>m.kind==='repair'));s.health[side]=4;
  s.pieces[side]=Array.from({length:10},(_,i)=>i+1);assert.ok(!legalMoves(s).some(m=>m.kind==='repair'));
 });
 test(`side ${side}: computer can choose repair under the same rules`,()=>{
  const s=setup(side,[6,6,6]);s.health[side]=1;
  for(const difficulty of ['medium','hard']){const m=chooseMove(s,difficulty,()=>0);assert.equal(m.kind,'repair');assert.equal(applyMove(s,m).health[side],2);}
 });
}

for(const side of [0,1]){
 const p=(rank,lane=0)=>pos(side===0?rank:11-rank,0,lane);
 function siege(type='assault'){
  const s=setup(side,[3,1,2]);s.pieces[side][0]=p(3);s.pieces[side][1]=p(3,1);s.pieces[1-side][0]=p(2);s.pieces[1-side][1]=p(2,1);
  const m=legalMoves(s).find(m=>m.from===p(3)&&m.target===p(2)&&m.kind===`prepare-${type}`);assert.ok(m);return applyMove(s,m);
 }
 test(`side ${side}: home-turf blockade needs preparation and a full defender response`,()=>{
  let s=siege();assert.equal(s.pieces[1-side][0],p(2));assert.equal(s.pieces[side][0],p(3));assert.equal(s.pendingAttacks[0].ready,false);assert.equal(s.dice.filter(Boolean).length,2);assert.ok(validSave(s));
  for(let i=1;i<3;i++)assert.ok(!legalMoves(selectExtremeDie(s,i)).some(m=>m.kind.startsWith('finish-')));
  s=passTurn(s);assert.equal(s.turn,1-side);assert.equal(s.pendingAttacks[0].ready,false);s=passTurn(s);assert.equal(s.turn,side);assert.equal(s.pendingAttacks[0].ready,true);assert.ok(validSave(JSON.parse(JSON.stringify(s))));
  for(let face=1;face<=6;face++){const rolled=rollTurn(s,[face,1,2]);const m=legalMoves(rolled).find(m=>m.kind==='finish-assault');assert.ok(m);const n=applyMove(rolled,m);assert.equal(n.pieces[1-side][0],-1);assert.equal(n.pieces[side][0],p(2));assert.equal(n.pieces[side][1],p(3,1));assert.equal(n.dice.filter(Boolean).length,2);assert.deepEqual(n.pendingAttacks,[]);assert.ok(validSave(n));}
 });
 test(`side ${side}: Strike Ahead also gives home pairs a response`,()=>{
  let s=siege('strike');assert.equal(s.pieces[1-side][0],p(2));assert.ok(!legalMoves(s).some(m=>m.kind==='finish-strike'));s=rollTurn(passTurn(passTurn(s)),[6,1,2]);const m=legalMoves(s).find(m=>m.kind==='finish-strike');assert.ok(m);const n=applyMove(s,m);assert.equal(n.pieces[1-side][0],-1);assert.equal(n.pieces[side][0],p(3));assert.ok(validSave(n));
 });
 test(`side ${side}: moving a defender, attacker or supporter cancels preparation`,()=>{
  const before=siege();for(const piece of [0,1]){let s=selectExtremeDie(rollTurn(passTurn(before),[1,2,4]),2);const m=legalMoves(s).find(m=>m.piece===piece&&m.kind==='recall');assert.ok(m);const n=applyMove(s,m);assert.deepEqual(n.pendingAttacks,[]);assert.ok(validSave(n));}
  for(const piece of [0,1]){const s=selectExtremeDie(siege(),2);const m=legalMoves(s).find(m=>m.piece===piece&&m.kind==='sidestep');assert.ok(m);const n=applyMove(s,m);assert.deepEqual(n.pendingAttacks,[]);assert.ok(validSave(n));}
 });
 test(`side ${side}: capture of an attacker cancels its queued attack`,()=>{
  let s=rollTurn(passTurn(siege()),[3,1,1]);
  const m=legalMoves(s).find(m=>m.kind==='strike'&&m.target===p(3));assert.ok(m);const n=applyMove(s,m);assert.equal(n.pieces[side][0],-1);assert.deepEqual(n.pendingAttacks,[]);assert.ok(validSave(n));
 });
 test(`side ${side}: enemy pairs invading my turf remain immediately attackable`,()=>{
  const s=setup(side,[3,1,2]);s.pieces[side][0]=p(9);s.pieces[side][1]=p(9,1);s.pieces[1-side][0]=p(8);s.pieces[1-side][1]=p(8,1);
  for(const kind of ['strike','assault']){const m=legalMoves(s).find(m=>m.from===p(9)&&m.target===p(8)&&m.kind===kind);assert.ok(m);assert.equal(applyMove(s,m).pieces[1-side][0],-1);}
 });
 test(`side ${side}: forged ready attacks and changed targets are rejected`,()=>{
  const s=siege(),a=s.pendingAttacks[0];assert.ok(!validSave({...s,pendingAttacks:[{...a,target:p(1)}]}));assert.ok(!validSave({...s,pendingAttacks:[a,a]}));assert.ok(!validSave({...s,pendingAttacks:[{...a,supportPiece:a.piece}]}));
  const m=legalMoves(s).find(m=>m.kind==='prepare-assault');assert.ok(m);assert.throws(()=>applyMove(s,{...m,kind:'finish-assault'}));
 });
}
