import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,legalMoves,applyMove,rollTurn,passTurn,adjustRoll,chooseMove,chooseCommand,validSave} from '../engine.js';
import {TURN_LIMIT,linearCamp as camp} from '../linear.js';
function setup(side=0,roll=3){const s=initialState('classic');s.turn=side;s.roll=roll;return s;}
for(const side of [0,1]){
 const flip=p=>side===0?p:25-p;
 test(`Classic/${side}: six identical pieces, three health and two Commands`,()=>{const s=initialState('classic');assert.deepEqual(s.pieces,[Array(6).fill(25),Array(6).fill(0)]);assert.deepEqual(s.health,[3,3]);assert.deepEqual(s.commands,[2,2]);assert.equal(s.cardVersion,undefined);assert.ok(validSave(s));});
 test(`Classic/${side}: every die permits forward-by-roll or retreat-one only`,()=>{
  for(let roll=1;roll<=6;roll++){const s=setup(side,roll);s.pieces[side][0]=flip(19);const moves=legalMoves(s).filter(m=>m.from===flip(19));assert.deepEqual([...new Set(moves.map(m=>m.kind))].sort(),['advance','retreat']);assert.ok(moves.some(m=>m.kind==='advance'&&m.steps===roll));assert.ok(moves.some(m=>m.kind==='retreat'&&m.steps===-1));assert.ok(!moves.some(m=>['sidestep','strike','recall','stride','sweep'].includes(m.kind)));}
 });
 test(`Classic/${side}: no checkpoints, objectives or healing`,()=>{
  const s=setup(side,4);s.pieces[side][0]=flip(17);s.pieces[1-side][0]=flip(13);assert.ok(legalMoves(s).some(m=>m.from===flip(17)&&m.to===flip(9)));
  s.roll=6;s.health[side]=1;assert.ok(!legalMoves(s).some(m=>m.kind==='repair'));s.pieces[side][0]=flip(7);s.turn=1-side;const n=passTurn(s);assert.deepEqual(n.intel,[0,0]);assert.equal(n.health[side],1);
 });
 test(`Classic/${side}: retreat consumes one full turn and can capture an invader`,()=>{
  const s=setup(side,6);s.pieces[side][0]=flip(19);s.pieces[1-side][0]=flip(21);const m=legalMoves(s).find(m=>m.kind==='retreat'&&m.from===flip(19));const n=applyMove(s,m);assert.equal(n.pieces[side][0],flip(21));assert.equal(n.pieces[1-side][0],-1);assert.equal(n.ply,1);assert.equal(n.turn,1-side);assert.ok(validSave(n));
 });
 test(`Classic/${side}: base entry needs exact distance and returns home; Commands can secure the hit`,()=>{
  let s=setup(side,2);s.pieces[side][0]=flip(1);s.health[1-side]=1;assert.ok(!legalMoves(s).some(m=>m.from===flip(1)&&m.to===camp(1-side)));s=adjustRoll(s,-1);const m=legalMoves(s).find(m=>m.from===flip(1)&&m.to===camp(1-side));assert.ok(m);const n=applyMove(s,m);assert.equal(n.winner,side);assert.equal(n.pieces[side][0],camp(side));assert.equal(n.commands[side],1);assert.ok(validSave(n));
 });
}
test('Classic skips before or after any roll and draws at the turn limit without intelligence',()=>{
 for(const roll of [null,1,2,3,4,5,6]){const s=setup(0,roll),n=passTurn(s);assert.deepEqual(n.pieces,s.pieces);assert.equal(n.turn,1);assert.ok(validSave(n));}
 const s=initialState('classic');s.ply=TURN_LIMIT-1;const n=passTurn(s);assert.equal(n.winner,null);assert.equal(n.draw,true);assert.ok(validSave(n));assert.ok(!validSave({...s,intel:[1,0]}));
});
test('Classic rejects invented specials and a seventh piece',()=>{
 const s=setup();s.pieces[0][0]=19;s.pieces[1][0]=17;assert.throws(()=>applyMove(s,{piece:0,from:19,to:19,target:17,kind:'strike',action:'special'}));assert.ok(!validSave({...s,pieces:[[...s.pieces[0],25],s.pieces[1]]}));
});
test('all difficulties complete Classic campaigns with legal moves and valid saved games',()=>{
 let seed=133;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(const d of ['easy','medium','hard'])for(let g=0;g<2;g++){let s=initialState('classic');while(s.winner===null&&!s.draw){s=rollTurn(s,1+Math.floor(random()*6));const delta=chooseCommand(s,d);if(delta!==null)s=adjustRoll(s,delta);const m=chooseMove(s,d,random);s=m?applyMove(s,m):passTurn(s);assert.ok(validSave(s));assert.deepEqual(s.intel,[0,0]);}assert.ok(s.ply<=TURN_LIMIT);}
});
