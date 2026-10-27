import { initialState, legalMoves, applyMove, passTurn, chooseMove, validSave, camp, numberOf, sideOf, partner } from './engine.js?v=4';
const $ = id => document.getElementById(id);
const KEY = 'tatakai-v4';
let state = initialState(), difficulty = 'medium', selected = null, busy = false, lastMove = null, timer = null, generation = 0;
let log = ['The camps are quiet. You move first.'];
const notes = {easy:'Explores freely. A gentle opponent for learning the board.',medium:'Looks for captures and keeps an eye on camp.',hard:'Plans around your best reply across all six possible rolls.'};
const dice = ['?', '⚀','⚁','⚂','⚃','⚄','⚅'];
function save() {
  try { localStorage.setItem(KEY,JSON.stringify({state,difficulty,log,lastMove})); }
  catch { $('save-note').textContent='Saving is unavailable. Keep this tab open to continue.'; }
}
try {
  const data = JSON.parse(localStorage.getItem(KEY));
  if (data && validSave(data.state)) {
    state=data.state;
    if (Object.hasOwn(notes,data.difficulty)) difficulty=data.difficulty;
    if (Array.isArray(data.log)) log=data.log.filter(x=>typeof x==='string').slice(0,6);
    if (data.lastMove && Number.isInteger(data.lastMove.to) && data.lastMove.to>=0 && data.lastMove.to<=21) lastMove=data.lastMove;
  }
} catch { /* Start fresh if storage is unavailable or a saved game is invalid. */ }
function random() { const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); return bytes[0]/4294967296; }
function rollDie() {
  // Rejection sampling gives each face exactly the same probability.
  const a=new Uint32Array(1); do { crypto.getRandomValues(a); } while(a[0]>=4294967292);
  return a[0]%6+1;
}
function textPos(pos) { return pos===camp(0)?'Ivory camp':pos===camp(1)?'rival camp':`${sideOf(pos)===0?'Ivory':'rival'} ${numberOf(pos)} ${pos%2===1?'left':'right'}`; }
function counts(pos,side) { return state.pieces[side].filter(p=>p===pos).length; }
function addLog(message) { log.unshift(message); log=log.slice(0,6); }
function active() { return state.winner===null && !state.draw; }
function render() {
  $('difficulty').value=difficulty;
  $('difficulty-note').textContent=notes[difficulty];
  $('rival-info').textContent=`Computer · ${difficulty[0].toUpperCase()+difficulty.slice(1)}`;
  const moves = state.turn===0 && !busy ? legalMoves(state) : [];
  const destinations = selected===null ? [] : moves.filter(m=>m.from===selected).map(m=>m.to);
  const board=$('board'); board.replaceChildren();
  function cell(pos) {
    const isCamp=pos===0||pos===21, own=counts(pos,0), rival=counts(pos,1);
    const b=document.createElement('button');
    b.type='button'; b.dataset.pos=pos;
    b.className=isCamp?`camp ${pos===0?'enemy':''}`:'space';
    if(destinations.includes(pos)) b.classList.add('available');
    if(!isCamp && (own || rival) && counts(partner(pos),own?1:0)) b.classList.add('contested');
    if(selected===pos) b.classList.add('selected');
    if(lastMove?.to===pos) b.classList.add('last-move');
    const canSelect=moves.some(m=>m.from===pos);
    if(canSelect)b.classList.add('selectable');
    b.disabled=!active() || state.turn!==0 || busy || (!canSelect && !destinations.includes(pos));
    b.setAttribute('aria-label',`${textPos(pos)}, ${own} Ivory, ${rival} rival${destinations.includes(pos)?', legal destination':''}${moves.some(m=>m.from===pos&&m.kind==='capture')?', capture available: select and tap again':''}${canSelect?', select agent':''}`);
    b.setAttribute('aria-pressed',String(selected===pos));
    const num=document.createElement('span');num.className='number';num.textContent=numberOf(pos);b.append(num);
    if(isCamp){const label=document.createElement('span');label.className='camp-label';label.textContent=pos===0?'RIVAL CAMP':'YOUR CAMP';b.append(label);}
    const tokens=document.createElement('span');tokens.className='tokens';
    for(const s of [1,0])for(let i=0;i<counts(pos,s);i++){const token=document.createElement('span');token.className=`token ${s===1?'black':''}`;tokens.append(token);}
    b.append(tokens);
    if(!isCamp && ((own && counts(pos%2===1?pos+1:pos-1,0)) || (rival && counts(pos%2===1?pos+1:pos-1,1)))){const badge=document.createElement('span');badge.className='protected';badge.textContent='◈';b.append(badge);}
    b.addEventListener('click',()=>handleCell(pos));
    return b;
  }
  board.append(cell(0));
  for(const side of [1,0]){
    const ranks=document.createElement('div');ranks.className=`ranks ${side===1?'enemy':''}`;
    for(const pos of side===1?[1,2,3,4,5,6,7,8,9,10]:[11,12,13,14,15,16,17,18,19,20])ranks.append(cell(pos));
    board.append(ranks);
  }
  board.append(cell(21));
  $('rival-count').textContent=`${state.pieces[1].filter(p=>p>=0).length} agents`;
  $('your-count').textContent=`${state.pieces[0].filter(p=>p>=0).length} agents`;
  $('turn-number').textContent=String(state.ply+1).padStart(2,'0');
  $('die').textContent=dice[state.roll??0];
  $('die').setAttribute('aria-label',state.roll?`Rolled ${state.roll}`:'Die not rolled');
  $('roll').disabled=!active()||state.turn!==0||state.roll!==null||busy;
  $('roll').hidden=active() && state.turn===0 && state.roll!==null && !busy && moves.length===0;
  $('pass').hidden=!(active() && state.turn===0 && state.roll!==null && !busy && moves.length===0);
  $('log').replaceChildren(...log.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
  let title,detail,instruction;
  if(!active()) {
    $('turn-label').textContent='CAMPAIGN COMPLETE';
    title=state.draw?'A watchful stalemate.':state.winner===0?'Their camp is yours.':'Your camp has fallen.';
    detail=state.draw?'300 moves. Both sides live to fight another day.':state.winner===0?'Victory. Your rival has no way to hold the camp.':'The rival found an opening. Try a different plan.';
    instruction='Start a new game for another campaign.';
  } else if(state.turn===1 || busy) {
    $('turn-label').textContent=state.turn===1?'RIVAL’S TURN':'YOUR TURN';title=busy&&state.turn===0?'The die is cast…':'The rival is thinking…';detail=state.roll?`Rolled a ${state.roll}. Choosing a position.`:'A quiet moment before the next move.';instruction='Watch the camps. Every agent matters.';
  } else {
    $('turn-label').textContent='YOUR TURN';
    title=state.roll===null?'Make your move.':moves.length===0?'No opening this turn.':selected===null?'Choose your agent.':'Choose a destination.';
    detail=state.roll===null?moves.length?'Capture the adjacent home agent without rolling, or roll to move.':'Roll the die to see your options.':state.roll===6?'Six: return home, sweep an infiltrator, or enter their camp from their side.':`Rolled a ${state.roll}. Move to a ${state.roll} space on either side.`;
    instruction=moves.length===0&&state.roll!==null?'No agent can use this roll. Pass to the rival.':selected===null?'Tap one of your agents, then a highlighted space.':`Selected: ${textPos(selected)}. Tap a gold destination. Tap your selected agent again if highlighted to capture in place; this uses your turn.`;
  }
  $('status-title').textContent=title;$('status-detail').textContent=detail;$('selection').textContent=instruction;
}
function handleCell(pos) {
  if(!active()||busy||state.turn!==0)return;
  const moves=legalMoves(state);
  if(selected!==null){const m=moves.find(m=>m.from===selected&&m.to===pos);if(m){execute(m);return;}}
  selected=selected===pos?null:moves.some(m=>m.from===pos)?pos:null;
  render();
  if(selected!==null){const dest=document.querySelector('.available');dest?.focus({preventScroll:true});}
}
function execute(move) {
  const side=state.turn, rolled=state.roll, before=state.pieces[1-side].filter(p=>p>=0).length;
  state=applyMove(state,move);lastMove={from:move.from,to:move.to};selected=null;
  const captured=state.pieces[1-side].filter(p=>p>=0).length<before;
  addLog(move.kind==='capture' ? `${side===0?'You':'Rival'} captured the adjacent agent from ${textPos(move.from)} · turn used${rolled===null?' without rolling':''}.` : move.from===move.to ? `${side===0?'You':'Rival'} rolled 6: a home defender discovered and removed an infiltrator.` : `${side===0?'You':'Rival'} rolled ${rolled}: ${textPos(move.from)} → ${textPos(move.to)}${captured?' · captured an adjacent agent':move.to>0&&move.to<21&&state.pieces[1-side].includes(partner(move.to))?' · home agent threatened; may escape or countercapture':''}.`);
  save();render();
  if(active() && state.turn===1)scheduleAI();
  else if(state.turn===0 && active())$('roll').focus({preventScroll:true});
}
function scheduleAI() {
  busy=true;render(); const token=generation;
  timer=setTimeout(()=>{
    if(token!==generation)return;
    if(state.roll===null){state.roll=rollDie();save();}render();
    timer=setTimeout(()=>{
      if(token!==generation)return;
      const move=chooseMove(state,difficulty,random);busy=false;
      if(move)execute(move);
      else{addLog(`Rival rolled ${state.roll}: no legal move. Turn passed.`);state=passTurn(state);save();render();}
    },650);
  },500);
}
$('roll').addEventListener('click',()=>{
  if(busy || state.turn!==0 || state.roll!==null || !active())return;
  busy=true;render();$('die').classList.add('rolling');const token=generation;
  timer=setTimeout(()=>{if(token!==generation)return;state.roll=rollDie();busy=false;$('die').classList.remove('rolling');save();render();},400);
});
$('pass').addEventListener('click',()=>{if(state.turn!==0||busy||state.roll===null||legalMoves(state).length||!active())return;addLog(`You rolled ${state.roll}: no legal move. Turn passed.`);state=passTurn(state);save();render();if(active())scheduleAI();});
$('difficulty').addEventListener('change',()=>{difficulty=$('difficulty').value;save();render();});
$('help').addEventListener('click',()=>$('rules').showModal());
$('close-rules').addEventListener('click',()=>$('rules').close());
$('restart').addEventListener('click',()=>{if(active() && (state.ply>0 || state.roll!==null))$('new-game').showModal();else restart();});
$('cancel-new').addEventListener('click',()=>$('new-game').close());
$('confirm-new').addEventListener('click',()=>{$('new-game').close();restart();});
function restart(){generation++;clearTimeout(timer);state=initialState();selected=null;lastMove=null;busy=false;log=['The camps are quiet. You move first.'];$('die').classList.remove('rolling');save();render();$('roll').focus({preventScroll:true});}
render();if(active()&&state.turn===1)scheduleAI();
