// Extreme: two routes, each twelve rows long and two tracks wide.
export const EXTREME_LIMIT=160;
export const ARMY_ROLES=Object.freeze(['agent','agent','agent','agent','agent','agent','guard','guard','runner','runner']);
export const ROLE_INFO={agent:{name:'Agent',symbol:'●',text:'Moves, captures and attacks bases normally.'},guard:{name:'Guard',symbol:'◆',text:'A pair containing a Guard cannot be vaulted. Cannot enter the enemy base.'},runner:{name:'Runner',symbol:'➤',text:'Advance 1 up to the movement die. Cannot capture, but can support an Agent or Guard.'}};
export const pieceRole=(_s,_side,piece)=>ARMY_ROLES[piece];
export function guardBlockade(s,rank,route){return [0,1].some(side=>fullRow(s,rank,route,side)&&extremePair(rank,route).some(p=>pieceRole(s,side,s.pieces[side].indexOf(p))==='guard'));}
export function upgradeExtreme(s){if(s?.mode!=='extreme'||s.armyVersion!==undefined)return s;const n=structuredClone(s);n.armyVersion=1;n.repairsRemaining=[2,2];cleanAttacks(n);return n;}

export const extremeCamp=side=>side===0?49:0;
export const extremeRank=p=>p===0?-1:p===49?12:Math.floor((p-1)/4);
export const extremeRoute=p=>Math.floor(((p-1)%4)/2);
export const extremePos=(rank,route,lane)=>rank*4+route*2+lane+1;
export const extremePair=(rank,route)=>[extremePos(rank,route,0),extremePos(rank,route,1)];
export const EXTREME_SPECIALS={
 1:{name:'Reverse',text:'Step back one as an action, or combine this 1 with another unused die to move backward by that die’s value. Each agent can use only one movement die per turn.'},
 2:{name:'Change routes',text:'Switch to either track of the other route at the same distance from base. Can capture a lone enemy, but cannot land on an enemy pair.'},
 3:{name:'Strike ahead',text:'Capture either enemy in the row immediately ahead. Enemy pairs on your turf can be struck immediately. A pair on its own turf gets a full response turn before you finish the strike.'},
 4:{name:'Return home',text:'Recall one field agent to your base, passing all blockades.'},
 5:{name:'Vault',text:'Advance 1–5 rows on this route, jumping ordinary blockades. Guard pairs cannot be crossed. Can capture a lone enemy on landing, but cannot land on an enemy pair.'},
 6:{name:'Repair base',text:'Use an agent at home to restore 1 base health, up to 5. Spend one die and one repair token; only two repairs per game.'}
};
export function initialExtreme(){return {version:5,mode:'extreme',armyVersion:1,repairsRemaining:[2,2],pieces:[Array(10).fill(49),Array(10).fill(0)],health:[5,5],turn:0,roll:null,dice:[],dieIndex:null,movedAgents:[],pendingAttacks:[],ply:0,winner:null,draw:false};}
export function extremeOutcome(s){for(const side of [0,1])if(s.health[1-side]===0||s.pieces[1-side].every(p=>p===-1))return side;return null;}
const active=s=>s.winner===null&&!s.draw;
export function fullRow(s,rank,route,side=null){return extremePair(rank,route).every(p=>(side===null?s.pieces.flat():s.pieces[side]).includes(p));}
export const extremeHomeSide=p=>extremeRank(p)>=6?0:1;
function attackStillValid(s,a){
 if(!a||![0,1].includes(a.attacker)||!['assault','strike'].includes(a.type)||typeof a.ready!=='boolean'||!Number.isInteger(a.piece)||!Number.isInteger(a.targetPiece)||a.piece<0||a.piece>=10||a.targetPiece<0||a.targetPiece>=10)return false;
 if(!Number.isInteger(a.from)||!Number.isInteger(a.target)||a.from<1||a.from>48||a.target<1||a.target>48||s.pieces[a.attacker][a.piece]!==a.from||s.pieces[1-a.attacker][a.targetPiece]!==a.target)return false;
 if(pieceRole(s,a.attacker,a.piece)==='runner')return false;
 const rank=extremeRank(a.from),route=extremeRoute(a.from),ahead=rank+(a.attacker===0?-1:1);
 if(extremeRank(a.target)!==ahead||extremeRoute(a.target)!==route||extremeHomeSide(a.target)===a.attacker||!fullRow(s,ahead,route,1-a.attacker))return false;
 if(a.type==='assault')return Number.isInteger(a.supportPiece)&&a.supportPiece>=0&&a.supportPiece<10&&a.supportPiece!==a.piece&&s.pieces[a.attacker][a.supportPiece]===a.support&&a.support!==a.from&&extremePair(rank,route).includes(a.support);
 return a.support===undefined&&a.supportPiece===undefined;
}
export function cleanAttacks(s){s.pendingAttacks=(s.pendingAttacks??[]).filter(a=>attackStillValid(s,a));}
function endTurn(s){cleanAttacks(s);for(const a of s.pendingAttacks)if(a.attacker!==s.turn)a.ready=true;s.ply++;s.turn=1-s.turn;s.movedAgents=[];s.dice=[];s.dieIndex=null;s.roll=null;s.winner=extremeOutcome(s);s.draw=s.winner===null&&s.ply>=EXTREME_LIMIT;return s;}
export function passExtreme(s){if(!active(s))throw Error('Game complete');return endTurn(structuredClone(s));}
export function rollExtreme(s,values){if(!active(s)||s.dice.length||!Array.isArray(values)||values.length!==3||!values.every(v=>Number.isInteger(v)&&v>=1&&v<=6))throw Error('Roll exactly three dice once per turn');const n=structuredClone(s);n.dice=[...values];n.dieIndex=0;n.roll=n.dice[0];return n;}
export function selectExtremeDie(s,index){if(!active(s)||!Number.isInteger(index)||!s.dice[index])throw Error('Die unavailable');const n=structuredClone(s);n.dieIndex=index;n.roll=n.dice[index];return n;}
function consume(s){s.dice[s.dieIndex]=null;s.winner=extremeOutcome(s);if(s.winner!==null){s.dice=[];s.dieIndex=null;s.roll=null;s.movedAgents=[];return s;}const i=s.dice.findIndex(Boolean);if(i<0)return endTurn(s);s.dieIndex=i;s.roll=s.dice[i];return s;}
export function skipExtremeDie(s){if(!active(s)||s.roll===null)throw Error('Select a die first');return consume(structuredClone(s));}
export function extremeMoves(s){
 if(!active(s)||s.roll===null)return [];
 const moves=[],side=s.turn,enemy=1-side,dir=side===0?-1:1,roll=s.roll;
 let actingPiece=null;
 const own=p=>s.pieces[side].includes(p),enemyAt=p=>s.pieces[enemy].includes(p);
 function add(from,to,kind,action='move',target,extra={}){const piece=extra.piece??actingPiece??s.pieces[side].indexOf(from);if(target!==undefined&&pieceRole(s,side,piece)==='runner')return;moves.push({from,to,piece,kind,action,dieIndex:s.dieIndex,...(target===undefined?{}:{target}),...extra});}
 function attack(from,target,type,action,support){
  const protectedHome=extremeHomeSide(target)===enemy&&fullRow(s,extremeRank(target),extremeRoute(target),enemy);
  if(protectedHome){if(!(s.pendingAttacks??[]).some(a=>a.attacker===side&&a.from===from&&a.target===target&&a.type===type&&attackStillValid(s,a)))add(from,from,`prepare-${type}`,action,target,support===undefined?{}:{support});}
  else add(from,type==='assault'?target:from,type,action,target,support===undefined?{}:{support});
 }
 for(const a of s.pendingAttacks??[])if(a.attacker===side&&a.ready&&attackStillValid(s,a))add(a.from,a.type==='assault'?a.target:a.from,`finish-${a.type}`,'assault',a.target,{piece:a.piece,...(a.support===undefined?{}:{support:a.support})});
 function walk(from,steps,kind,action='move',bypass=false,movementDie=null){
  const usesMovement=action==='move'||movementDie!==null;
  const piece=actingPiece;if(piece===null||usesMovement&&s.movedAgents.includes(piece))return;
  const start=extremeRank(from),end=start+dir*steps;if(end< -1||end>12)return;
  const routes=from===extremeCamp(side)?[0,1]:[extremeRoute(from)];
  for(const route of routes){
   if(Array.from({length:12},(_,r)=>r).some(r=>r>Math.min(start,end)&&r<Math.max(start,end)&&(bypass?guardBlockade(s,r,route):fullRow(s,r,route))))continue;
   if(end>=0&&end<12&&fullRow(s,end,route,enemy))continue;
   const dest=end===-1?[0]:end===12?[49]:extremePair(end,route);
   for(const to of dest)if(!(to===extremeCamp(enemy)&&pieceRole(s,side,piece)==='guard')&&to!==from&&(!(to>0&&to<49)||!own(to)))add(from,to,kind,action,enemyAt(to)&&to>0&&to<49?to:undefined,{steps,piece,...(movementDie===null?{}:{movementDie})});
  }
 }
 for(const [piece,from] of s.pieces[side].entries()){
  if(from<0)continue;
  const role=pieceRole(s,side,piece);
  if((from===0||from===49)&&s.pieces[side].some((p,i)=>i<piece&&p===from&&pieceRole(s,side,i)===role&&s.movedAgents.includes(i)===s.movedAgents.includes(piece)))continue;
  actingPiece=piece;
  const field=from>0&&from<49,rank=extremeRank(from),route=field?extremeRoute(from):null;
  if(role==='runner')for(let steps=1;steps<=roll;steps++)walk(from,steps,'advance');else walk(from,roll,'advance');
  if(roll===1&&field){walk(from,-1,'retreat','special');for(let i=0;i<3;i++)if(i!==s.dieIndex&&s.dice[i])walk(from,-s.dice[i],'reverse','special',false,i);}
  if(roll===2&&field&&!fullRow(s,rank,1-route,enemy))for(const to of extremePair(rank,1-route))if(!own(to))add(from,to,'sidestep','special',enemyAt(to)?to:undefined);
  if(roll===3&&field&&rank+dir>=0&&rank+dir<12)for(const target of extremePair(rank+dir,route))if(enemyAt(target))attack(from,target,'strike','special');
  if(roll===4&&field)add(from,extremeCamp(side),'recall','special');
  if(roll===5)for(let steps=1;steps<=5;steps++)walk(from,steps,'vault','special',true);
  if(roll===6&&from===extremeCamp(side)&&s.health[side]<5&&s.repairsRemaining[side]>0)add(from,from,'repair','special');
  const ahead=rank+dir;
  if(field&&ahead>=0&&ahead<12&&fullRow(s,rank,route,side)&&fullRow(s,ahead,route,enemy)){
   const support=extremePair(rank,route).find(p=>p!==from);
   for(const target of extremePair(ahead,route))attack(from,target,'assault','assault',support);
  }
 }
 // Both deployment routes converge at the same base on a long vault; remove equivalent moves.
 return moves.filter((m,i,a)=>a.findIndex(x=>JSON.stringify(x)===JSON.stringify(m))===i);
}
export function applyExtreme(s,move){
 const selected=selectExtremeDie(s,move.dieIndex);
 const m=extremeMoves(selected).find(x=>['from','to','piece','kind','action','dieIndex','target','support','steps','movementDie'].every(k=>x[k]===move[k]));
 if(!m)throw Error('Illegal Extreme action');
 const n=structuredClone(selected);n.pieces[n.turn][m.piece]=m.to;
 if(m.kind==='repair'){n.health[n.turn]++;n.repairsRemaining[n.turn]--;}
 if(m.action==='move'||m.movementDie!==undefined)n.movedAgents.push(m.piece);
 if(m.movementDie!==undefined)n.dice[m.movementDie]=null;
 if(m.kind.startsWith('prepare-')){n.pendingAttacks??=[];n.pendingAttacks.push({attacker:n.turn,piece:m.piece,from:m.from,target:m.target,targetPiece:n.pieces[1-n.turn].indexOf(m.target),type:m.kind.slice(8),ready:false,...(m.support===undefined?{}:{support:m.support,supportPiece:n.pieces[n.turn].indexOf(m.support)})});}
 else if(m.target!==undefined)n.pieces[1-n.turn][n.pieces[1-n.turn].indexOf(m.target)]=-1;
 if(m.to===extremeCamp(1-n.turn)){n.health[1-n.turn]--;n.pieces[n.turn][m.piece]=extremeCamp(n.turn);}
 cleanAttacks(n);
 return consume(n);
}
export function evaluateExtreme(s,side){
 const win=extremeOutcome(s);if(win!==null)return win===side?10000:-10000;if(s.draw)return 0;
 const score=t=>{let v=s.health[t]*100+s.pieces[t].filter(p=>p>=0).length*35;
 for(const a of s.pendingAttacks??[])if(a.attacker===t&&attackStillValid(s,a))v+=a.ready?20:12;
 for(const [i,p] of s.pieces[t].entries())if(p>0&&p<49)v+=(t===0?12-extremeRank(p):extremeRank(p)+1)*(pieceRole(s,t,i)==='guard'?1.5:3);
 for(let r=0;r<12;r++)for(let route=0;route<2;route++)if(fullRow(s,r,route,t))v+=guardBlockade(s,r,route)?16:8;
 return v;};return score(side)-score(1-side);
}
export function chooseExtreme(s,difficulty='medium',random=Math.random){
 const moves=s.dice.flatMap((v,i)=>v?extremeMoves(selectExtremeDie(s,i)):[]);if(!moves.length)return null;
 const wins=moves.filter(m=>applyExtreme(s,m).winner===s.turn);if(wins.length)return wins[Math.floor(random()*wins.length)];
 if(difficulty==='easy')return moves[Math.floor(random()*moves.length)];
 const scored=moves.map(m=>({m,n:applyExtreme(s,m)})).map(x=>({...x,value:evaluateExtreme(x.n,s.turn)}));
 if(difficulty==='hard')for(const x of [...scored].sort((a,b)=>b.value-a.value).slice(0,8)){
  if(x.n.turn===s.turn&&active(x.n)){const follow=x.n.dice.flatMap((v,i)=>v?extremeMoves(selectExtremeDie(x.n,i)):[]);x.value+=.4*Math.max(0,...follow.map(m=>evaluateExtreme(applyExtreme(x.n,m),s.turn)-x.value));}
 }
 const best=Math.max(...scored.map(x=>x.value)),choices=scored.filter(x=>x.value===best);return choices[Math.floor(random()*choices.length)].m;
}
export function validExtreme(s){
 if(!s||s.armyVersion!==1||!Array.isArray(s.repairsRemaining)||s.repairsRemaining.length!==2||!s.repairsRemaining.every(n=>Number.isInteger(n)&&n>=0&&n<=2))return false;
 if(!s||s.version!==5||s.mode!=='extreme'||![0,1].includes(s.turn)||!Number.isInteger(s.ply)||s.ply<0||s.ply>EXTREME_LIMIT||![null,0,1].includes(s.winner)||typeof s.draw!=='boolean')return false;
 if(!Array.isArray(s.health)||s.health.length!==2||!s.health.every(h=>Number.isInteger(h)&&h>=0&&h<=5)||s.health.every(h=>h===0))return false;
 if(!Array.isArray(s.pieces)||s.pieces.length!==2||!s.pieces.every(a=>Array.isArray(a)&&a.length===10&&a.every(p=>Number.isInteger(p)&&p>=-1&&p<=49))||s.pieces[0].includes(0)||s.pieces[1].includes(49)||s.pieces.every(a=>a.every(p=>p===-1)))return false;
 const attacks=s.pendingAttacks??[];if(!Array.isArray(attacks)||attacks.some(a=>!attackStillValid(s,a))||new Set(attacks.map(a=>`${a.attacker}:${a.from}:${a.target}:${a.type}`)).size!==attacks.length)return false;
 const field=s.pieces.flat().filter(p=>p>0&&p<49);if(new Set(field).size!==field.length)return false;
 if(!Array.isArray(s.movedAgents)||s.movedAgents.some(i=>!Number.isInteger(i)||i<0||i>=10)||new Set(s.movedAgents).size!==s.movedAgents.length||(!s.dice?.length&&s.movedAgents.length))return false;
 if(!Array.isArray(s.dice)||![0,3].includes(s.dice.length))return false;
 if(s.dice.length){if(!s.dice.every(v=>v===null||Number.isInteger(v)&&v>=1&&v<=6)||!Number.isInteger(s.dieIndex)||s.dieIndex<0||s.dieIndex>2||!s.dice[s.dieIndex]||s.roll!==s.dice[s.dieIndex]||!active(s))return false;}
 else if(s.roll!==null||s.dieIndex!==null)return false;
 return s.winner===extremeOutcome(s)&&s.draw===(s.winner===null&&s.ply>=EXTREME_LIMIT)&&s.cardVersion===undefined;
}
