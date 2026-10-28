import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,legalMoves,applyMove,passTurn,chooseMove,validSave,rollTurn} from '../engine.js';
import {linearRank,linearCamp,LINEAR_SPECIALS,upgradeLinear} from '../linear.js';
function setup(side,roll){const s=initialState('linear');s.turn=side;s.roll=roll;return s;}
function act(s,from,to,kind){const m=legalMoves(s).find(m=>m.from===from&&m.to===to&&m.kind===kind);assert.ok(m,`${from} -> ${to} ${kind}`);return applyMove(s,m);}
test('Linear has twelve two-column ranks and two distinct bases',()=>{
 const s=initialState('linear');assert.deepEqual(s.pieces,[Array(6).fill(25),Array(6).fill(0)]);assert.ok(validSave(s));
 for(let rank=0;rank<12;rank++)assert.equal(Array.from({length:24},(_,i)=>i+1).filter(p=>linearRank(p)===rank).length,2);
 assert.equal(Object.keys(LINEAR_SPECIALS).length,6);
});
for(const side of [0,1]){
 const flip=p=>side===0?p:25-p;
 test(`side ${side}: deploy by distance into either lane on every roll`,()=>{
 for(let roll=1;roll<=6;roll++){
 const s=setup(side,roll),moves=legalMoves(s).filter(m=>m.action==='move');assert.equal(moves.length,2);
 assert.deepEqual(moves.map(m=>m.to).sort((a,b)=>a-b),[flip(25-roll*2),flip(26-roll*2)].sort((a,b)=>a-b));
 }
 });
 test(`side ${side}: ordinary movement stays forward in its column, jumping over pieces`,()=>{
 const s=setup(side,3);s.pieces[side][0]=flip(19);s.pieces[1-side][0]=flip(17);
 const n=act(s,flip(19),flip(13),'advance');assert.equal(n.pieces[side][0],flip(13));assert.equal(n.pieces[1-side][0],flip(17));assert.equal(n.turn,1-side);assert.equal(n.roll,null);assert.ok(validSave(n));
 assert.ok(!legalMoves(s).some(m=>m.action==='move'&&m.from===flip(19)&&m.to===flip(14)));
 });
 test(`side ${side}: enemy landings capture while friendly landings block`,()=>{
 const s=setup(side,3);s.pieces[side][0]=flip(19);s.pieces[1-side][0]=flip(13);
 assert.equal(act(s,flip(19),flip(13),'advance').pieces[1-side][0],-1);
 s.pieces[1-side][0]=linearCamp(1-side);s.pieces[side][1]=flip(13);assert.ok(!legalMoves(s).some(m=>m.from===flip(19)&&m.to===flip(13)));
 });
 test(`side ${side}: exact base entry and no forward movement from enemy base`,()=>{
 const s=setup(side,2);s.pieces[side][0]=flip(3);
 assert.ok(legalMoves(s).some(m=>m.from===flip(3)&&m.to===linearCamp(1-side)&&m.action==='move'));
 assert.ok(!legalMoves(s,3).some(m=>m.from===flip(3)&&m.to===linearCamp(1-side)&&m.action==='move'));
 const n=act(s,flip(3),linearCamp(1-side),'advance');assert.equal(n.winner,null);assert.equal(n.health[1-side],2);assert.equal(n.pieces[side][0],linearCamp(side));n.turn=side;n.roll=6;assert.ok(!legalMoves(n).some(m=>m.from===linearCamp(1-side)&&m.action==='move'));
 });
 test(`side ${side}: one retreats one row, including out of enemy base`,()=>{
 const s=setup(side,1);s.pieces[side][0]=flip(19);const n=act(s,flip(19),flip(21),'retreat');assert.equal(n.turn,1-side);assert.equal(n.ply,1);
 s.pieces[side][0]=linearCamp(side);assert.equal(legalMoves(s).filter(m=>m.kind==='retreat').length,0);
 });
 test(`side ${side}: two switches routes and captures enemy landings`,()=>{
 const s=setup(side,2);s.pieces[side][0]=flip(19);act(s,flip(19),flip(20),'sidestep');s.pieces[1-side][0]=flip(20);assert.equal(act(s,flip(19),flip(20),'sidestep').pieces[1-side][0],-1);
 });
 test(`side ${side}: three captures exactly one field enemy immediately ahead`,()=>{
 const s=setup(side,3);s.pieces[side][0]=flip(19);s.pieces[1-side][0]=flip(17);s.pieces[1-side][1]=flip(18);
 const n=act(s,flip(19),flip(19),'strike');assert.equal(n.pieces[1-side][0],-1);assert.equal(n.pieces[1-side][1],flip(18));assert.equal(n.pieces[side][0],flip(19));assert.equal(n.ply,1);assert.ok(validSave(n));
 assert.ok(!legalMoves(s,2).some(m=>m.kind==='strike'));
 });
 test(`side ${side}: four recalls without damaging either base`,()=>{
 const s=setup(side,4);s.pieces[side][0]=flip(19);s.pieces[1-side][0]=flip(17);
 const n=act(s,flip(19),linearCamp(side),'recall');assert.equal(n.pieces[1-side][0],flip(17));assert.deepEqual(n.health,[3,3]);assert.equal(n.winner,null);assert.ok(validSave(n));
 });
 test(`side ${side}: five offers shorter forward distances as separate specials`,()=>{
 const s=setup(side,5);s.pieces[side][0]=flip(19);
 assert.deepEqual(legalMoves(s).filter(m=>m.from===flip(19)&&m.kind==='stride').map(m=>m.steps),[1,2,3,4]);
 assert.ok(legalMoves(s).some(m=>m.from===flip(19)&&m.kind==='advance'&&m.steps===5));
 });
 test(`side ${side}: six captures a chosen home-half enemy with a home defender`,()=>{
 const s=setup(side,6);s.pieces[1-side][0]=flip(19);s.pieces[1-side][1]=flip(17);
 assert.ok(legalMoves(s).some(m=>m.kind==='advance'));
 const n=act(s,linearCamp(side),linearCamp(side),'sweep');assert.equal(n.pieces[1-side].filter(p=>p===-1).length,1);assert.equal(n.turn,1-side);assert.ok(validSave(n));
 });
}
test('Linear win, loss, skip and corrupt save rules',()=>{
 const s=setup(0,1);s.pieces[0][0]=1;s.pieces[1]=[3,4,5,6,7,8];s.health[1]=1;assert.equal(act(s,1,0,'advance').winner,0);
 const n=setup(0,2);n.pieces[0]=[25,3,4,5,6,7];n.pieces[1][0]=23;assert.equal(act(n,25,21,'advance').winner,null);
 const initial=initialState('linear');assert.equal(passTurn(initial).turn,1);assert.deepEqual(passTurn(initial).pieces,initial.pieces);
 const bad=initialState('linear');bad.pieces[0][0]=26;assert.ok(!validSave(bad));bad.pieces[0][0]=1;bad.pieces[1][0]=1;assert.ok(!validSave(bad));
});
test('Linear actions cannot be forged or followed by a second action in the same turn',()=>{
 const s=setup(0,3);s.pieces[0][0]=19;s.pieces[1][0]=17;
 const m=legalMoves(s).find(m=>m.kind==='strike');assert.throws(()=>applyMove(s,{...m,target:18}));const n=applyMove(s,m);assert.throws(()=>applyMove(n,m));assert.ok(validSave(JSON.parse(JSON.stringify(n))));
});
test('every difficulty takes immediate Linear wins and completes full games',()=>{
 let seed=135;const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const d of ['easy','medium','hard']){
 const win=setup(0,1);win.pieces[0][0]=1;win.pieces[1]=[3,4,5,6,7,8];win.health[1]=1;assert.equal(applyMove(win,chooseMove(win,d,r)).winner,0);
 for(let game=0;game<4;game++){let s=initialState('linear');while(s.winner===null&&!s.draw){s=rollTurn(s,1+Math.floor(r()*6));const m=chooseMove(s,d,r);s=m?applyMove(s,m):passTurn(s);assert.ok(validSave(s));}assert.ok(s.ply<=300);}
 }
});

test('legacy Linear save migration returns infiltrators without dealing damage, once',()=>{
 const s=initialState('linear');delete s.health;s.pieces[0][0]=0;s.pieces[1][0]=25;
 const n=upgradeLinear(s);assert.deepEqual(n.health,[3,3]);assert.equal(n.pieces[0][0],25);assert.equal(n.pieces[1][0],0);assert.ok(validSave(n));assert.deepEqual(upgradeLinear(n),n);assert.equal(s.health,undefined);
});
test('base damage is independent of defenders and the attacker returns even on victory',()=>{
 let s=setup(0,1);s.health[1]=1;s.pieces[0][0]=1;
 const n=act(s,1,0,'advance');assert.equal(n.health[1],0);assert.equal(n.winner,0);assert.equal(n.pieces[0][0],25);assert.equal(n.pieces[1].filter(p=>p===0).length,6);assert.ok(validSave(n));
});
test('retreat captures, short advance scores, and invalid health is rejected',()=>{
 const s=setup(0,1);s.pieces[0][0]=19;s.pieces[1][0]=21;assert.equal(act(s,19,21,'retreat').pieces[1][0],-1);
 s.roll=5;s.pieces[0][0]=3;assert.equal(act(s,3,0,'stride').health[1],2);
 for(const health of [[-1,3],[4,3],[1.5,3],[3],null])assert.ok(!validSave({...initialState('linear'),health}));
});
test('home defence cannot target the other half or work without a home agent',()=>{
 const s=setup(0,6);s.pieces[1][0]=11;assert.ok(!legalMoves(s).some(m=>m.kind==='sweep'));
 s.pieces[1][0]=13;s.pieces[0]=[1,3,5,7,9,15];assert.ok(!legalMoves(s).some(m=>m.kind==='sweep'));
});
