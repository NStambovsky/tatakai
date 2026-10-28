// Shared route rules for Linear and Ultra.
export const TURN_LIMIT=160;
export const CHECKPOINTS=[11,12,13,14];
export const INTEL_ROWS=[[7,8],[17,18]];
export function collectIntel(s){const side=s.turn,row=INTEL_ROWS[side];if(!s.intel[side]&&s.pieces[side].some(p=>row.includes(p))&&!s.pieces[1-side].some(p=>row.includes(p)))s.intel[side]=1;}
export const linearCamp=side=>side===0?25:0;
export const linearRank=pos=>pos===0?-1:pos===25?12:Math.floor((pos-1)/2);
export const LINEAR_SPECIALS={
 1:{name:'Step back',text:'Move one agent backward by exactly one space.'},
 2:{name:'Change routes',text:'Switch one field agent to the other route at the same distance from base.'},
 3:{name:'Strike ahead',text:'Capture one enemy immediately ahead along the same route. Your agent stays put.'},
 4:{name:'Return home',text:'Bring one field agent back home without capturing.'},
 5:{name:'Short advance',text:'Move one agent forward by 1, 2, 3, or 4 spaces instead of 5.'},
 6:{name:'Home defence',text:'Use an agent at home to capture one enemy on your half of either route.'}
};
export function initialLinear(){return {version:5,commands:[2,2],intel:[0,0],mode:'linear',health:[3,3],pieces:[Array(6).fill(25),Array(6).fill(0)],turn:0,roll:null,ply:0,winner:null,draw:false};}
export function linearOutcome(s){for(const side of [0,1]){const enemy=1-side;if(s.health?.[enemy]===0||!s.pieces[enemy].some(p=>p>=0))return side;}if(s.ply>=TURN_LIMIT&&s.intel[0]!==s.intel[1])return s.intel[0]>s.intel[1]?0:1;return null;}
export function linearMoves(s,roll=s.roll,side=s.turn){
 if(s.winner!==null||s.draw||!Number.isInteger(roll)||roll<1||roll>6)return [];
 const moves=[],enemy=1-side,direction=side===0?-1:1;
 const occupied=pos=>s.pieces[side].includes(pos);
 function walk(from,piece,steps,action,kind){
  const rank=linearRank(from)+direction*steps;
  if(rank< -1||rank>12)return;
  const destinations=rank===-1?[0]:rank===12?[25]:from===0||from===25?[rank*2+1,rank*2+2]:[rank*2+1+(from-1)%2];
  for(const to of destinations){const lane=to>0&&to<25?(to-1)%2:from>0&&from<25?(from-1)%2:null;const blocked=CHECKPOINTS.some(p=>(p-1)%2===lane&&s.pieces[enemy].includes(p)&&linearRank(p)>Math.min(linearRank(from),rank)&&linearRank(p)<Math.max(linearRank(from),rank));if(blocked)continue;if(to===from||to>0&&to<25&&occupied(to))continue;moves.push({piece,from,to,action,kind,steps,...(to>0&&to<25&&s.pieces[enemy].includes(to)?{target:to}:{})});}
 }
 for(const from of [...new Set(s.pieces[side].filter(p=>p>=0))]){
  const piece=s.pieces[side].indexOf(from),field=from>0&&from<25;
  if(from!==linearCamp(enemy))walk(from,piece,roll,'move','advance');
  if(roll===1&&from!==linearCamp(side))walk(from,piece,-1,'special','retreat');
  if(roll===2&&field){const to=from%2?from+1:from-1;if(!occupied(to))moves.push({piece,from,to,action:'special',kind:'sidestep',...(s.pieces[enemy].includes(to)?{target:to}:{})});}
  if(roll===3&&field){const target=from+direction*2;if(target>0&&target<25&&s.pieces[enemy].includes(target))moves.push({piece,from,to:from,target,action:'special',kind:'strike'});}
  if(roll===4&&from!==linearCamp(side))moves.push({piece,from,to:linearCamp(side),action:'special',kind:'recall'});
  if(roll===5&&from!==linearCamp(enemy))for(let steps=1;steps<5;steps++)walk(from,piece,steps,'special','stride');
  if(roll===6&&from===linearCamp(side))for(const target of s.pieces[enemy].filter(p=>p>0&&p<25&&(side===0?p>=13:p<=12)))moves.push({piece,from,to:from,target,action:'special',kind:'sweep'});
 }
 return moves;
}
export function applyLinear(s,move,roll=s.roll,finish=true){
 const m=linearMoves(s,roll).find(m=>m.piece===move.piece&&m.from===move.from&&m.to===move.to&&m.action===move.action&&m.kind===move.kind&&m.target===move.target);
 if(!m)throw new Error('Illegal Linear action');
 const n=structuredClone(s);n.pieces[s.turn][m.piece]=m.to;
 if(m.target!==undefined){const i=n.pieces[1-s.turn].indexOf(m.target);if(i>=0)n.pieces[1-s.turn][i]=-1;}
 if(m.to===linearCamp(1-s.turn)){n.health[1-s.turn]--;n.pieces[s.turn][m.piece]=linearCamp(s.turn);}
 if(finish){n.ply++;n.turn=1-s.turn;if(n.ply<TURN_LIMIT&&linearOutcome(n)===null)collectIntel(n);}
 n.winner=linearOutcome(n);n.draw=n.winner===null&&n.ply>=TURN_LIMIT;n.roll=null;return n;
}
export function evaluateLinear(s,side){
 const winner=s.winner??linearOutcome(s);if(winner!==null)return winner===side?10000:-10000;if(s.draw)return 0;
 const score=side=>{let value=s.pieces[side].filter(p=>p>=0).length*40;
 const home=s.pieces[side].filter(p=>p===linearCamp(side)).length;
 value+=s.health[side]*90+(home?5:0)+s.intel[side]*45+s.commands[side]*4;
 if(!s.intel[side]&&s.pieces[side].some(p=>INTEL_ROWS[side].includes(p))&&!s.pieces[1-side].some(p=>INTEL_ROWS[side].includes(p)))value+=30;
 for(const p of s.pieces[side])if(p>=0){const progress=side===0?12-linearRank(p):linearRank(p)+1;value+=progress*2;if(p===linearCamp(1-side))value+=20;}

 return value;};return score(side)-score(1-side);
}
export function validLinear(s){
 if(!s||s.version!==5||!['linear','ultra'].includes(s.mode)||![0,1].includes(s.turn))return false;
 if(!(s.roll===null||Number.isInteger(s.roll)&&s.roll>=1&&s.roll<=6)||!Number.isInteger(s.ply)||s.ply<0||s.ply>TURN_LIMIT)return false;
 if(![null,0,1].includes(s.winner)||typeof s.draw!=='boolean')return false;
 if(!Array.isArray(s.health)||s.health.length!==2||!s.health.every(h=>Number.isInteger(h)&&h>=0&&h<=3))return false;
 if(!Array.isArray(s.commands)||s.commands.length!==2||!s.commands.every(n=>Number.isInteger(n)&&n>=0&&n<=2))return false;
 if(!Array.isArray(s.intel)||s.intel.length!==2||!s.intel.every(n=>n===0||n===1))return false;
 if(!Array.isArray(s.pieces)||s.pieces.length!==2||!s.pieces.every(a=>Array.isArray(a)&&a.length>=6&&a.length<=(s.mode==='ultra'?8:6)&&a.every(p=>Number.isInteger(p)&&p>=-1&&p<=25)))return false;
 if(s.pieces[0].includes(0)||s.pieces[1].includes(25)||s.health.every(h=>h===0)||s.pieces.every(a=>a.every(p=>p===-1)))return false;
 if(Array.from({length:24},(_,i)=>i+1).some(p=>s.pieces.flat().filter(x=>x===p).length>1))return false;
 return s.winner===linearOutcome(s)&&s.draw===(s.winner===null&&s.ply>=TURN_LIMIT);
}
