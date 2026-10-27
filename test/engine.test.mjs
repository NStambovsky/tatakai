import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,legalMoves,applyMove,chooseMove,passTurn,validSave,numberOf} from '../engine.js';
function setup(white,black,roll=4){const s=initialState();s.pieces=[white,black];s.roll=roll;return s;}
function move(s,from,to){const m=legalMoves(s).find(m=>m.from===from&&m.to===to);assert.ok(m,`expected move ${from} → ${to}`);return applyMove(s,m);}
test('original board has four spaces for each number and two camps',()=>{for(let n=1;n<=5;n++)assert.equal(Array.from({length:22},(_,i)=>i).filter(i=>numberOf(i)===n).length,4);assert.equal(numberOf(0),6);assert.equal(numberOf(21),6);});
test('opening deploys an agent to any of the four matching spaces',()=>{const s=initialState();s.roll=4;assert.deepEqual(legalMoves(s).map(m=>m.to),[3,4,17,18]);assert.equal(s.pieces[0].filter(p=>p===21).length,6);});
test('capture removes a lone agent and preserves the input',()=>{const s=setup([21,21,21,21,21,17],[0,0,0,0,0,4]);const n=move(s,17,4);assert.equal(n.pieces[1][5],-1);assert.equal(s.pieces[1][5],4);assert.equal(n.turn,1);assert.equal(n.roll,null);});
test('both spaces of a same-color row protect each other',()=>{const s=setup([21,21,21,21,21,17],[0,0,0,0,3,4]);assert.ok(!legalMoves(s).some(m=>m.to===3||m.to===4));assert.ok(legalMoves(s).some(m=>m.to===18));});
test('cannot stack agents on numbered squares',()=>{const s=setup([21,21,21,21,17,18],[0,0,0,0,0,0]);assert.ok(!legalMoves(s).some(m=>m.to===17||m.to===18));});
test('a six enters a guarded camp without capturing its defenders',()=>{const s=initialState();s.roll=6;const n=move(s,21,0);assert.equal(n.winner,null);assert.equal(n.pieces[1].filter(p=>p===0).length,6);assert.equal(n.pieces[0][0],0);});
test('returning defender captures an infiltrator',()=>{const s=setup([0,21,21,21,21,21],[3,0,0,0,0,0],6);s.turn=1;const n=move(s,3,0);assert.equal(n.pieces[0][0],-1);assert.equal(n.winner,null);});
test('infiltration of undefended camp wins immediately',()=>{const s=setup([21,21,21,21,21,17],[1,2,3,4,5,6],6);assert.equal(move(s,17,0).winner,0);});
test('moving the last defender out loses to an infiltrator',()=>{const s=setup([21,11,12,13,14,15],[21,0,0,0,0,0],4);assert.equal(move(s,21,17).winner,1);});
test('cannot pass a playable roll or make an illegal move',()=>{const s=initialState();s.roll=4;assert.throws(()=>passTurn(s));assert.throws(()=>applyMove(s,{piece:0,from:21,to:1}));});
test('passes when all four numbered spaces are protected or occupied',()=>{const s=setup([21,21,21,21,17,18],[0,0,0,0,3,4],4);assert.equal(legalMoves(s).length,0);assert.equal(passTurn(s).turn,1);});
test('each difficulty takes a forced immediate win',()=>{const s=setup([21,21,21,21,21,17],[1,2,3,4,5,6],6);for(const d of ['easy','medium','hard'])assert.equal(applyMove(s,chooseMove(s,d,()=>0)).winner,0);});
test('medium and hard preserve the last defender against an infiltrator',()=>{const s=setup([21,11,12,13,14,15],[21,0,0,0,0,0],4);for(const d of ['medium','hard'])assert.notEqual(chooseMove(s,d,()=>0).from,21);});
test('save validation rejects corrupt and overlapping positions',()=>{assert.ok(validSave(initialState()));const s=initialState();s.pieces[0][0]=99;assert.ok(!validSave(s));const n=initialState();n.pieces[0][0]=1;n.pieces[1][0]=1;assert.ok(!validSave(n));});
test('simulated full games preserve rules and terminate across difficulty levels',()=>{let seed=103;const rng=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};for(const diff of ['easy','medium','hard'])for(let game=0;game<8;game++){let s=initialState();while(s.winner===null&&!s.draw){s.roll=1+Math.floor(rng()*6);const m=chooseMove(s,diff,rng);s=m?applyMove(s,m):passTurn(s);assert.ok(validSave(s));}assert.ok(s.ply<=300);}});
