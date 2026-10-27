import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,legalMoves,applyMove,chooseMove,passTurn,validSave,numberOf,camp,sideOf} from '../engine.js';
function setup(white,black,roll=4){const s=initialState();s.pieces=[white,black];s.roll=roll;return s;}
function move(s,from,to){const m=legalMoves(s).find(m=>m.from===from&&m.to===to);assert.ok(m,`expected move ${from} → ${to}`);return applyMove(s,m);}
test('original board has four spaces for each number and two camps',()=>{for(let n=1;n<=5;n++)assert.equal(Array.from({length:22},(_,i)=>i).filter(i=>numberOf(i)===n).length,4);assert.equal(numberOf(0),6);assert.equal(numberOf(21),6);});
test('opening deploys an agent only to the two home-side matching spaces',()=>{const s=initialState();s.roll=4;assert.deepEqual(legalMoves(s).map(m=>m.to),[17,18]);assert.equal(s.pieces[0].filter(p=>p===21).length,6);});
test('home approach leaves the invader alive and preserves the input',()=>{const s=setup([21,21,21,21,21,11],[0,0,0,0,0,18]);const n=move(s,11,17);assert.equal(n.pieces[1][5],18);assert.equal(s.pieces[1][5],18);assert.equal(n.turn,1);assert.equal(n.roll,null);});
test('both spaces of a same-color row protect each other',()=>{const s=setup([21,21,21,21,21,17],[0,0,0,0,3,4]);assert.ok(!legalMoves(s).some(m=>m.to===3||m.to===4));assert.ok(legalMoves(s).some(m=>m.to===18));});
test('cannot enter occupied numbered squares',()=>{const s=setup([21,21,21,21,17,18],[0,0,0,0,0,0]);assert.ok(!legalMoves(s).some(m=>m.to===17||m.to===18));});
test('a six enters a guarded camp from the field without capturing defenders',()=>{const s=initialState();s.pieces[0][0]=7;s.roll=6;const n=move(s,7,0);assert.equal(n.winner,null);assert.equal(n.pieces[1].filter(p=>p===0).length,6);assert.equal(n.pieces[0][0],0);});
test('returning defender captures an infiltrator',()=>{const s=setup([0,21,21,21,21,21],[3,0,0,0,0,0],6);s.turn=1;const n=move(s,3,0);assert.equal(n.pieces[0][0],-1);assert.equal(n.winner,null);});
test('infiltration of undefended camp wins immediately',()=>{const s=setup([21,21,21,21,21,7],[1,2,3,4,5,6],6);assert.equal(move(s,7,0).winner,0);});
test('moving the last defender out loses to an infiltrator',()=>{const s=setup([21,11,12,13,14,15],[21,0,0,0,0,0],4);assert.equal(move(s,21,17).winner,1);});
test('can skip a playable roll but cannot make an illegal move',()=>{const s=initialState();s.roll=4;assert.equal(passTurn(s).turn,1);assert.throws(()=>applyMove(s,{piece:0,from:21,to:1}));});
test('passes when all four numbered spaces are protected or occupied',()=>{const s=setup([21,21,21,21,17,18],[0,0,0,0,3,4],4);assert.equal(legalMoves(s).length,0);assert.equal(passTurn(s).turn,1);});
test('each difficulty takes a forced immediate win',()=>{const s=setup([21,21,21,21,21,7],[1,2,3,4,5,6],6);for(const d of ['easy','medium','hard'])assert.equal(applyMove(s,chooseMove(s,d,()=>0)).winner,0);});
test('medium and hard preserve the last defender against an infiltrator',()=>{const s=setup([21,11,12,13,14,15],[21,0,0,0,0,0],4);for(const d of ['medium','hard'])assert.notEqual(chooseMove(s,d,()=>0).from,21);});
test('save validation rejects corrupt and overlapping positions',()=>{assert.ok(validSave(initialState()));const s=initialState();s.pieces[0][0]=99;assert.ok(!validSave(s));const n=initialState();n.pieces[0][0]=1;n.pieces[1][0]=1;assert.ok(!validSave(n));});
test('simulated full games preserve rules and terminate across difficulty levels',()=>{let seed=103;const rng=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};for(const diff of ['easy','medium','hard'])for(let game=0;game<8;game++){let s=initialState();while(s.winner===null&&!s.draw){s.roll=1+Math.floor(rng()*6);const m=chooseMove(s,diff,rng);s=m?applyMove(s,m):passTurn(s);assert.ok(validSave(s));}assert.ok(s.ply<=300);}});

test('capture is across the pair, never onto an occupied enemy square',()=>{const s=setup([21,21,21,21,21,17],[0,0,0,0,0,4]);assert.ok(!legalMoves(s).some(m=>m.to===4));const n=move(s,17,3);assert.equal(n.pieces[0][5],3);assert.equal(n.pieces[1][5],4);});
test('resident defender spends a six to remove a camp infiltrator without relocating',()=>{const s=setup([21,21,21,21,21,21],[21,0,0,0,0,0],6);const n=move(s,21,21);assert.equal(n.pieces[1][0],-1);assert.deepEqual(n.pieces[0],s.pieces[0]);assert.equal(n.turn,1);});
test('a camp sweep is unavailable without both a defender and an infiltrator',()=>{const s=initialState();s.roll=6;assert.ok(!legalMoves(s).some(m=>m.from===m.to));const n=setup([11,12,13,14,15,16],[21,0,0,0,0,0],6);assert.ok(!legalMoves(n).some(m=>m.from===21&&m.to===21));});
test('sweep removes exactly one of multiple infiltrators',()=>{const s=setup([21,21,21,21,21,21],[21,21,0,0,0,0],6);const n=move(s,21,21);assert.equal(n.pieces[1].filter(p=>p===21).length,1);});

test('home-side deployment is required before crossing',()=>{const s=initialState();s.roll=4;assert.ok(legalMoves(s).every(m=>m.to===17||m.to===18));let n=move(s,21,17);n.turn=0;n.roll=2;const crossing=legalMoves(n).filter(m=>m.to===7||m.to===8);assert.equal(crossing.length,2);assert.ok(crossing.every(m=>m.from===17));});
test('a six cannot send an undeployed agent directly into the rival camp',()=>{const s=initialState();s.roll=6;assert.equal(legalMoves(s).length,0);assert.equal(passTurn(s).turn,1);s.pieces[0][0]=11;assert.ok(!legalMoves(s).some(m=>m.from===11&&m.to===0));assert.ok(!legalMoves(s).some(m=>m.from===21&&m.to===0));});

for (const side of [0,1]) {
  const flip=p=>side===0?p:21-p;
  function scenario(roll=4) {
    const s=initialState();s.turn=1-side;s.roll=roll;
    s.pieces[side][0]=flip(17);s.pieces[1-side][0]=flip(7);
    return s;
  }
  test(`side ${side}: six requires the selected agent already across the border`,()=>{
    const s=initialState();s.turn=side;s.roll=6;
    s.pieces[side][0]=flip(17);s.pieces[side][1]=flip(7);
    assert.ok(!legalMoves(s).some(m=>m.from===flip(17)&&m.to===camp(1-side)));
    assert.ok(legalMoves(s).some(m=>m.from===flip(7)&&m.to===camp(1-side)));
    assert.ok(legalMoves(s).some(m=>m.from===flip(17)&&m.to===camp(side)));
  });
  test(`side ${side}: delayed capture gives home one response and consumes invader turn`,()=>{
    const s=scenario();const n=move(s,flip(7),flip(18));
    assert.equal(n.pieces[side][0],flip(17));assert.equal(n.turn,side);assert.ok(validSave(n));
    assert.ok(!legalMoves(n).some(m=>m.kind==='capture'));
    n.roll=2;const wait=move(n,camp(side),flip(13));
    const cap=legalMoves(wait).find(m=>m.kind==='capture');assert.ok(cap);
    const result=applyMove(wait,cap);assert.equal(result.pieces[side][0],-1);
    assert.equal(result.pieces[1-side][0],flip(18));assert.equal(result.ply,3);assert.equal(result.turn,side);assert.equal(result.roll,null);assert.ok(validSave(result));
  });
  test(`side ${side}: normal escape clears capture option`,()=>{
    const n=move(scenario(),flip(7),flip(18));n.roll=2;
    const escaped=move(n,flip(17),flip(13));
    for(const roll of [null,1,2,3,4,5,6])assert.ok(!legalMoves(escaped,roll).some(m=>m.kind==='capture'));
  });
  test(`side ${side}: matching roll countercaptures without moving`,()=>{
    const n=move(scenario(),flip(7),flip(18));
    for(const roll of [null,1,2,3,5,6])assert.ok(!legalMoves(n,roll).some(m=>m.kind==='capture'));
    n.roll=4;const result=move(n,flip(17),flip(17));
    assert.equal(result.pieces[1-side][0],-1);assert.equal(result.pieces[side][0],flip(17));assert.equal(result.turn,1-side);assert.ok(validSave(result));
  });
  test(`side ${side}: every number and lane delays capture symmetrically`,()=>{
    for(let pos=11;pos<=20;pos++){
      const s=initialState();s.turn=1-side;s.roll=numberOf(pos);
      s.pieces[side][0]=flip(pos);s.pieces[1-side][0]=flip(7);
      const n=move(s,flip(7),flip(pos%2?pos+1:pos-1));assert.equal(n.pieces[side][0],flip(pos));assert.ok(validSave(n));
    }
  });
}
test('pending capture is optional and every AI can use it on a nonmatching roll',()=>{
  const s=setup([21,21,21,21,21,3],[0,0,0,0,0,4],2);
  assert.equal(passTurn(s).turn,1);
  for(const d of ['easy','medium','hard']){
    const m=chooseMove(s,d,()=>.999999);assert.ok(m===null||legalMoves(s).some(x=>JSON.stringify(x)===JSON.stringify(m)));
    const only=structuredClone(s);only.roll=null;
    assert.equal(chooseMove(only,d,()=>0).kind,'capture');
  }
});
test('capture cannot be forged and ended games offer no captures',()=>{
  const s=setup([21,21,21,21,21,17],[0,0,0,0,0,18],2);
  assert.throws(()=>applyMove(s,{piece:5,from:17,to:17,kind:'capture'}));
  s.draw=true;assert.deepEqual(legalMoves(s),[]);
});

test('six skip keeps every piece in place and consumes exactly one turn',()=>{
 for(const side of [0,1]){const s=initialState();s.turn=side;s.roll=6;s.pieces[side][0]=side===0?17:3;
 assert.ok(legalMoves(s).length);const n=passTurn(s);assert.deepEqual(n.pieces,s.pieces);assert.equal(n.turn,1-side);assert.equal(n.roll,null);assert.equal(n.ply,1);assert.equal(s.ply,0);assert.ok(validSave(n));}
});
test('skip is available before rolling and on numbered rolls but not after game end',()=>{
 const s=initialState();assert.equal(passTurn(s).turn,1);s.roll=4;assert.equal(passTurn(s).turn,1);s.roll=6;s.draw=true;assert.throws(()=>passTurn(s));s.draw=false;s.winner=0;assert.throws(()=>passTurn(s));
});
test('AI can skip six rather than break a protected home pair',()=>{
 const s=setup([21,21,21,21,17,18],[0,0,0,0,0,0],6);
 for(const d of ['easy','medium','hard'])assert.equal(chooseMove(s,d,()=>.9999),null);
});
test('skipping a six retains adjacent threats and observes the turn limit',()=>{
 const s=setup([21,21,21,21,21,17],[0,0,0,0,0,18],6);s.ply=298;
 const n=passTurn(s);assert.ok(legalMoves(n).some(m=>m.kind==='capture'));assert.deepEqual(n.pieces,s.pieces);
 n.roll=6;const end=passTurn(n);assert.equal(end.ply,300);assert.equal(end.draw,true);assert.ok(validSave(end));
});

test('last agent can stay in enemy camp by skipping before or after every roll',()=>{
 for(const side of [0,1])for(const roll of [null,1,2,3,4,5,6]){
 const s=initialState();s.turn=side;s.roll=roll;s.pieces[side]=[-1,-1,-1,-1,-1,camp(1-side)];
 const n=passTurn(s);assert.deepEqual(n.pieces,s.pieces);assert.equal(n.turn,1-side);assert.equal(n.roll,null);assert.equal(n.ply,1);assert.ok(validSave(n));
 }
});
test('all difficulties can skip a playable numbered roll',()=>{
 const s=initialState();s.roll=4;
 assert.equal(chooseMove(s,'easy',()=>.9999),null);
 for(const d of ['medium','hard']){const m=chooseMove(s,d,()=>0);assert.ok(m===null||legalMoves(s).some(x=>JSON.stringify(x)===JSON.stringify(m)));}
});

for(const side of [0,1])test(`side ${side}: home approach, enemy response, then separate capture on every row`,()=>{
 for(let pos=11;pos<=20;pos++){
 const flip=p=>side===0?p:21-p;const target=flip(pos);const beside=flip(pos%2?pos+1:pos-1);
 const s=initialState();s.turn=side;s.roll=numberOf(target);s.pieces[1-side][0]=target;
 const n=move(s,camp(side),beside);assert.equal(n.pieces[1-side][0],target);assert.equal(n.turn,1-side);assert.ok(validSave(n));
 const response=passTurn(n);assert.ok(validSave(response));
 const captured=move(response,beside,beside);assert.equal(captured.pieces[1-side][0],-1);assert.equal(captured.ply,3);assert.equal(captured.turn,1-side);assert.ok(validSave(captured));
 }
});
test('home approach expires when threatened invader escapes and survives save round trip',()=>{
 const s=setup([21,21,21,21,21,21],[0,0,0,0,0,18]);
 const n=JSON.parse(JSON.stringify(move(s,21,17)));assert.ok(validSave(n));n.roll=2;
 const escaped=move(n,18,7);assert.equal(escaped.pendingCaptures.length,0);assert.ok(!legalMoves(escaped).some(m=>m.kind==='capture'));
});
test('save rejects forged approaches without an adjacent opponent',()=>{
 const s=initialState();s.pendingCaptures=[{side:0,from:17}];assert.ok(!validSave(s));
});
