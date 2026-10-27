import { initialState, legalMoves, applyMove, passTurn, canPass, chooseMove, validSave, camp, numberOf, sideOf, partner, rollTurn, canPower, usePower, choosePower } from './engine.js?v=8';
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
  $('mode-label').textContent=state.mode==='ultra'?'ULTRA · Coins & power-ups':'CLASSIC · No power-ups';
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
  $('pass').hidden=!(state.turn===0 && !busy && canPass(state));
  $('pass').textContent='Skip turn →';
  renderActions(moves);
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
    detail=state.roll===null?moves.length?'Capture an adjacent enemy, roll to move, or skip.':'Roll the die to see your options, or skip this turn.':state.roll===6?'Six: move, capture, or skip. Returning home is optional.':`Rolled a ${state.roll}. Move to a ${state.roll} space, capture if available, or skip.`;
    instruction=moves.length===0&&state.roll!==null?'No agent can use this roll. Pass to the rival.':selected===null?'Tap one of your agents, then a highlighted space.':`Selected: ${textPos(selected)}. Tap a gold destination. Use Capture enemy piece to capture in place; this uses your turn.`;
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
  const side=state.turn, rolled=state.roll, beforeCoins=state.mode==='ultra'?state.coins[state.turn]:0, before=state.pieces[1-side].filter(p=>p>=0).length;
  state=applyMove(state,move);lastMove={from:move.from,to:move.to};selected=null;
  const captured=state.pieces[1-side].filter(p=>p>=0).length<before;
  addLog(move.kind==='capture' ? `${side===0?'You':'Rival'} captured the adjacent agent from ${textPos(move.from)} · turn used${rolled===null?' without rolling':''}.` : move.from===move.to ? `${side===0?'You':'Rival'} rolled 6: a home defender discovered and removed an infiltrator.` : `${side===0?'You':'Rival'} rolled ${rolled}: ${textPos(move.from)} → ${textPos(move.to)}${captured?' · captured an adjacent agent':move.to>0&&move.to<21&&state.pieces[1-side].includes(partner(move.to))?' · enemy threatened; gets a response turn before capture':''}.`);
  if(state.mode==='ultra' && state.coins[side]>beforeCoins)addLog(`${side===0?'You':'Rival'} earned ${state.coins[side]-beforeCoins} coins${captured?' from capture':''}${state.pieces[side].includes(camp(1-side))?' · enemy-base income':''}.`);
  save();render();
  if(active() && state.turn===1)scheduleAI();
  else if(state.turn===0 && active())$('roll').focus({preventScroll:true});
}
function scheduleAI() {
  busy=true;render(); const token=generation;
  timer=setTimeout(()=>{
    if(token!==generation)return;
    if(state.roll===null){state=rollTurn(state,rollDie());save();}render();
    timer=setTimeout(()=>{
      if(token!==generation)return;
      const power=choosePower(state,difficulty,random);
      if(power){
        state=usePower(state,power.kind,power.kind==='reroll'?rollDie():power.value);
        addLog(`Rival used ${powerName(power.kind)}${power.value?` (${power.value})`:''}.`);save();
        if(state.turn===0){busy=false;render();return;}
      }
      const move=chooseMove(state,difficulty,random);busy=false;
      if(move)execute(move);
      else{addLog(`Rival rolled ${state.roll}: skipped the turn.`);state=passTurn(state);selected=null;save();render();}
    },650);
  },500);
}
$('roll').addEventListener('click',()=>{
  if(busy || state.turn!==0 || state.roll!==null || !active())return;
  busy=true;render();$('die').classList.add('rolling');const token=generation;
  timer=setTimeout(()=>{if(token!==generation)return;state=rollTurn(state,rollDie());busy=false;$('die').classList.remove('rolling');save();render();},400);
});
$('pass').addEventListener('click',()=>{if(state.turn!==0||busy||!canPass(state))return;addLog(`You skipped the turn${state.roll===null?' without rolling':` after rolling ${state.roll}`}.`);state=passTurn(state);selected=null;save();render();if(active())scheduleAI();});
$('difficulty').addEventListener('change',()=>{difficulty=$('difficulty').value;save();render();});
$('help').addEventListener('click',()=>$('rules').showModal());
$('close-rules').addEventListener('click',()=>$('rules').close());
$('restart').addEventListener('click',()=>{$('game-mode').value=state.mode||'classic';$('new-game').showModal();});
$('cancel-new').addEventListener('click',()=>$('new-game').close());
$('confirm-new').addEventListener('click',()=>{$('new-game').close();restart();});
function restart(){generation++;clearTimeout(timer);state=initialState($('game-mode').value);selected=null;lastMove=null;busy=false;log=['The camps are quiet. You move first.'];$('die').classList.remove('rolling');save();render();$('roll').focus({preventScroll:true});}
function captureMoves(moves=legalMoves(state)) {
  return moves.filter(m=>m.kind==='capture'||(m.from===m.to&&m.to===camp(state.turn)));
}
function powerName(kind){return {recruit:'Recruit agent',reroll:'Reroll',set:'Set your roll',sabotage:'Set enemy’s next roll'}[kind];}
function renderActions(moves){
  const captures=captureMoves(moves), chosen=captures.find(m=>m.from===selected);
  const ready=active()&&state.turn===0&&!busy;
  $('capture').disabled=!ready||captures.length===0;
  $('capture').textContent='Capture enemy piece';
  const faceoffs=state.pieces[0].filter(p=>p>0&&p<21&&state.pieces[1].includes(partner(p)));
  $('capture-note').textContent=!ready?'Captures use your turn.':captures.length?(chosen?`Ready at ${textPos(chosen.from)} · uses your turn.`:captures.length===1?`Ready at ${textPos(captures[0].from)} · uses your turn.`:'Choose which enemy to capture below, or select your agent.'):
    faceoffs.length?`Face-off: roll ${[...new Set(faceoffs.map(numberOf))].join(' or ')} to countercapture at home, or move away. Red outlines alone do not mean capture is ready.`:'No capture ready. Move beside an enemy first; they get a response turn.';
  $('capture-choices').replaceChildren();
  if(captures.length>1&&!chosen)for(const move of captures){const b=document.createElement('button');b.className='secondary';b.textContent=`Capture from ${textPos(move.from)}`;b.addEventListener('click',()=>execute(move));$('capture-choices').append(b);}
  const ultra=state.mode==='ultra';$('ultra-panel').hidden=!ultra;
  if(!ultra)return;
  $('wallet').textContent=`You: ${state.coins[0]} coins · Rival: ${state.coins[1]} coins`;
  for(const kind of ['recruit','reroll','set','sabotage'])$('power-'+kind).disabled=!ready||!canPower(state,kind);
  const queued=state.forcedRolls.map((r,s)=>r?`${s===0?'Your':'Rival’s'} next roll is set to ${r}.`:null).filter(Boolean).join(' ');
  $('power-note').textContent=[queued,state.rollLocked?'This roll is locked by the rival.':state.powerUsed?'Power used this turn. Move, capture, or skip.':state.roll===null?'Roll first to reroll or set your own die.':'Choose a power, or take your turn normally.'].filter(Boolean).join(' ');
}
$('capture').addEventListener('click',()=>{
  if(!active()||busy||state.turn!==0)return;
  const captures=captureMoves(), move=captures.find(m=>m.from===selected)||(captures.length===1?captures[0]:null);
  if(move)execute(move);else $('capture-choices').querySelector('button')?.focus();
});
for(const kind of ['recruit','reroll','set','sabotage'])$('power-'+kind).addEventListener('click',()=>{
  if(busy||state.turn!==0||!canPower(state,kind))return;
  const value=kind==='reroll'?rollDie():Number($('power-face').value);
  state=usePower(state,kind,value);selected=null;
  addLog(`You used ${powerName(kind)}${kind==='recruit'?' · turn used':` (${value})`}.`);save();render();
  if(active()&&state.turn===1)scheduleAI();
});
render();if(active()&&state.turn===1)scheduleAI();
