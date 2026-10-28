import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,rollTurn,legalMoves,applyMove,passTurn,validSave,chooseMove} from '../engine.js';
import {ARMY_ROLES,pieceRole,extremePos as pos,extremeCamp as camp,selectExtremeDie,upgradeExtreme} from '../extreme.js';
function setup(side=0,dice=[4,5,2]){const s=initialState('extreme');s.turn=side;return rollTurn(s,dice);}
for(const side of [0,1]){
 const p=(r,lane=0,route=0)=>pos(side===0?r:11-r,route,lane);
 test(`roles/${side}: fixed army and all roles are deployable`,()=>{
  const s=setup(side);assert.equal(ARMY_ROLES.filter(r=>r==='agent').length,6);assert.equal(ARMY_ROLES.filter(r=>r==='guard').length,2);assert.equal(ARMY_ROLES.filter(r=>r==='runner').length,2);assert.deepEqual(s.repairsRemaining,[2,2]);
  for(const role of ['agent','guard','runner']){const m=legalMoves(s).find(m=>m.action==='move'&&pieceRole(s,side,m.piece)===role);assert.ok(m);const n=applyMove(s,m);assert.equal(n.pieces[side][m.piece],m.to);assert.ok(validSave(n));}
 });
 test(`roles/${side}: Runner chooses any forward distance but cannot reuse its movement die`,()=>{
  let s=setup(side);s.pieces[side][8]=p(9);
  assert.deepEqual([...new Set(legalMoves(s).filter(m=>m.piece===8&&m.action==='move').map(m=>m.steps))],[1,2,3,4]);
  const m=legalMoves(s).find(m=>m.piece===8&&m.steps===2);s=applyMove(s,m);assert.ok(s.movedAgents.includes(8));assert.ok(!legalMoves(s).some(m=>m.piece===8&&m.action==='move'));assert.ok(validSave(s));
 });
 test(`roles/${side}: Runner cannot capture by movement, reverse, switch, strike or Vault`,()=>{
  const s=setup(side,[3,5,2]);s.pieces[side][8]=p(9);s.pieces[1-side][0]=p(8);s.pieces[1-side][1]=p(9,0,1);
  for(let i=0;i<3;i++)assert.ok(legalMoves(selectExtremeDie(s,i)).filter(m=>m.piece===8).every(m=>m.target===undefined));
  const r=setup(side,[1,2,3]);r.pieces[side][8]=p(8);r.pieces[1-side][0]=p(10);assert.ok(legalMoves(r).filter(m=>m.piece===8).every(m=>m.target===undefined));
 });
 test(`roles/${side}: Runner supports an Agent but cannot lead an assault`,()=>{
  const s=setup(side,[1,2,3]);s.pieces[side][0]=p(9);s.pieces[side][8]=p(9,1);s.pieces[1-side][0]=p(8);s.pieces[1-side][1]=p(8,1);
  assert.ok(!legalMoves(s).some(m=>m.piece===8&&m.kind==='assault'));const m=legalMoves(s).find(m=>m.piece===0&&m.kind==='assault');assert.ok(m);const n=applyMove(s,m);assert.equal(n.pieces[1-side][0],-1);assert.equal(n.pieces[side][8],p(9,1));assert.ok(validSave(n));
 });
 test(`roles/${side}: Guard blockades stop Vault for either team; ordinary pairs can be vaulted`,()=>{
  for(const owner of [side,1-side]){const s=setup(side,[5,1,2]);s.pieces[side][0]=p(9);s.pieces[owner][6]=p(8);s.pieces[owner][1]=p(8,1);assert.ok(!legalMoves(s).some(m=>m.piece===0&&m.kind==='vault'&&m.to===p(6)));s.pieces[owner][6]=camp(owner);s.pieces[owner][2]=p(8);assert.ok(legalMoves(s).some(m=>m.piece===0&&m.kind==='vault'&&m.to===p(6)));}
 });
 test(`roles/${side}: Guard cannot enter enemy base, but Runner can score and return home`,()=>{
  const s=setup(side,[1,5,2]);s.pieces[side][6]=p(0);assert.ok(!legalMoves(s).some(m=>m.piece===6&&m.to===camp(1-side)));assert.ok(!legalMoves(selectExtremeDie(s,1)).some(m=>m.piece===6&&m.to===camp(1-side)));
  s.pieces[side][6]=camp(side);s.pieces[side][8]=p(0);const m=legalMoves(s).find(m=>m.piece===8&&m.to===camp(1-side));assert.ok(m);const n=applyMove(s,m);assert.equal(n.health[1-side],4);assert.equal(n.pieces[side][8],camp(side));assert.ok(n.movedAgents.includes(8));
 });
 test(`roles/${side}: two repair tokens cap healing and persist through turns and saves`,()=>{
  let s=setup(side,[6,6,6]);s.health[side]=2;for(let i=0;i<2;i++){const m=legalMoves(s).find(m=>m.kind==='repair');assert.ok(m);s=applyMove(s,m);}assert.equal(s.health[side],4);assert.equal(s.repairsRemaining[side],0);assert.ok(!legalMoves(s).some(m=>m.kind==='repair'));assert.equal(passTurn(s).repairsRemaining[side],0);assert.ok(validSave(JSON.parse(JSON.stringify(s))));
 });
 test(`roles/${side}: AI can score with a Runner and never score with a Guard`,()=>{
  const s=setup(side,[1,1,1]);s.pieces[side][6]=p(0);s.pieces[side][8]=p(0,1);s.health[1-side]=1;
  for(const d of ['easy','medium','hard']){const m=chooseMove(s,d,()=>0);assert.equal(m.piece,8);assert.equal(applyMove(s,m).winner,side);}
 });
}
test('role saves reject corrupted tokens and migrate previous Extreme armies without changing positions',()=>{
 const s=initialState('extreme');for(const repairsRemaining of [[3,2],[-1,2],[1.5,2],[2],null])assert.ok(!validSave({...s,repairsRemaining}));
 const old=structuredClone(s);delete old.armyVersion;delete old.repairsRemaining;old.pieces[0][8]=13;old.pieces[1][0]=9;old.pieces[1][1]=10;old.pendingAttacks=[{attacker:0,piece:8,from:13,target:9,targetPiece:0,type:'strike',ready:false}];
 const upgraded=upgradeExtreme(old);assert.deepEqual(upgraded.pieces,old.pieces);assert.deepEqual(upgraded.repairsRemaining,[2,2]);assert.deepEqual(upgraded.pendingAttacks,[]);assert.ok(validSave(upgraded));assert.deepEqual(upgradeExtreme(upgraded),upgraded);
});
