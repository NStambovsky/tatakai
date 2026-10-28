import {EXTREME_SPECIALS,extremeCamp,extremeRank,extremeRoute,extremePair,fullRow,selectExtremeDie,skipExtremeDie} from './extreme.js?v=18';
import {LINEAR_SPECIALS,linearCamp,linearRank,CHECKPOINTS,INTEL_ROWS,TURN_LIMIT} from './linear.js?v=18';
import { initialState, legalMoves, applyMove, passTurn, canPass, chooseMove, validSave, adjustRoll, chooseCommand, rollTurn, CARDS, upgradeCards, canBuyCard, buyCard, cardBlock, playCard, chooseCard } from './engine.js?v=18';
const $ = id => document.getElementById(id);
const KEY = 'crosscamp-v5';
let state = initialState(), difficulty = 'medium', selected = null, busy = false, lastMove = null, timer = null, generation = 0;
let linearAction='move';
let cardTab='hand', rivalCard=null, revealDone=null;
let log = ['The camps are quiet. You move first.'];
const notes = {easy:'Explores freely. A gentle opponent for learning the board.',medium:'Looks for captures and keeps an eye on camp.',hard:'Plans around your best reply across all six possible rolls.'};
const dice = ['?', '⚀','⚁','⚂','⚃','⚄','⚅'];
function save() {
  try { localStorage.setItem(KEY,JSON.stringify({state,difficulty,log,lastMove,rivalCard})); }
  catch { $('save-note').textContent='Saving is unavailable. Keep this tab open to continue.'; }
}
try {
  const data = JSON.parse(localStorage.getItem(KEY));

  if(data?.state?.mode==='extreme'&&data.state.movedAgents===undefined){data.state.movedAgents=data.state.dice?.length?data.state.pieces[data.state.turn].map((p,i)=>p>0&&p<49?i:null).filter(i=>i!==null):[];}
  if (data && validSave(data.state)) {
    state=upgradeCards(data.state,random);
    if (Object.hasOwn(notes,data.difficulty)) difficulty=data.difficulty;
    if (Array.isArray(data.log)) log=data.log.filter(x=>typeof x==='string').slice(0,6);
    if (data.lastMove && Number.isInteger(data.lastMove.to) && data.lastMove.to>=0 && data.lastMove.to<=(state.mode==='extreme'?49:25)) lastMove=data.lastMove;
    if(data.rivalCard&&Object.hasOwn(CARDS,data.rivalCard.kind)&&typeof data.rivalCard.effect==='string')rivalCard=data.rivalCard;
    save();
  }
} catch { /* Start fresh if storage is unavailable or a saved game is invalid. */ }
function random() { const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); return bytes[0]/4294967296; }
function rollDie() {
  // Rejection sampling gives each face exactly the same probability.
  const a=new Uint32Array(1); do { crypto.getRandomValues(a); } while(a[0]>=4294967292);
  return a[0]%6+1;
}
function base(side){return state.mode==='extreme'?extremeCamp(side):linearCamp(side);}
function specials(){return state.mode==='extreme'?EXTREME_SPECIALS:LINEAR_SPECIALS;}
function healthMax(){return state.mode==='extreme'?5:3;}
function turnDice(){return state.mode==='extreme'?[rollDie(),rollDie(),rollDie()]:rollDie();}
function displayMoves(){return legalMoves(state).filter(m=>m.action===linearAction);}
function textPos(pos){if(state.mode==='extreme')return pos===49?'your base':pos===0?'rival base':`${extremeRank(pos)<6?'rival':'your'} ${Math.min(extremeRank(pos)+1,12-extremeRank(pos))}, ${extremeRoute(pos)===0?'upper':'lower'} route, track ${(pos-1)%2+1}`;return pos===25?'your base':pos===0?'rival base':`${pos<=12?'rival':'your'} ${Math.min(linearRank(pos)+1,12-linearRank(pos))}, ${pos%2?'upper':'lower'} route`;}
function counts(pos,side) { return state.pieces[side].filter(p=>p===pos).length; }
function addLog(message) { log.unshift(message); log=log.slice(0,6); }
function active() { return state.winner===null && !state.draw; }
function render() {
  document.querySelector('.intro .eyebrow').textContent=state.mode==='extreme'?'TEN AGENTS. THREE DICE.':'SIX AGENTS. ONE OPENING.';
  $('difficulty').value=difficulty;
  $('rival-card-summary').hidden=!rivalCard;
  $('rival-card-summary').textContent=rivalCard?`Last rival card: ${CARDS[rivalCard.kind].name} · ${rivalCard.effect}`:'';
  $('mode-label').textContent=state.mode==='extreme'?'EXTREME · Three dice & blockades':state.mode==='ultra'?'ULTRA · Routes, cards & coins':'LINEAR · Routes & commands';
  $('difficulty-note').textContent=notes[difficulty];
  $('rival-info').textContent=`Computer · ${difficulty[0].toUpperCase()+difficulty.slice(1)}`;
  const moves = state.turn===0 && !busy ? displayMoves() : [];
  renderLinear(moves);
  const destinations = selected===null ? [] : moves.filter(m=>m.from===selected).map(m=>m.to);
  const board=$('board'); board.classList.add('linear-board');board.classList.toggle('extreme-board',state.mode==='extreme');board.replaceChildren();
  function cell(pos) {
    const isCamp=pos===0||pos===base(0), own=counts(pos,0), rival=counts(pos,1);
    const b=document.createElement('button');
    b.type='button'; b.dataset.pos=pos;
    b.className=isCamp?`camp ${pos===0?'enemy':''}`:'space';
    if(destinations.includes(pos)) b.classList.add('available');
    if(selected===pos) b.classList.add('selected');
    if(lastMove?.to===pos) b.classList.add('last-move');
    const canSelect=moves.some(m=>m.from===pos);
    if(canSelect)b.classList.add('selectable');
    b.disabled=!active() || state.turn!==0 || busy || (!canSelect && !destinations.includes(pos));
    b.setAttribute('aria-label',`${textPos(pos)}, ${own} Ivory, ${rival} rival${destinations.includes(pos)?', legal destination':''}${moves.some(m=>m.from===pos&&m.kind==='capture')?', capture available: select and tap again':''}${canSelect?', select agent':''}`);
    b.setAttribute('aria-pressed',String(selected===pos));
    const num=document.createElement('span');num.className='number';num.textContent=isCamp?'⌂':state.mode==='extreme'?Math.min(extremeRank(pos)+1,12-extremeRank(pos)):Math.min(linearRank(pos)+1,12-linearRank(pos));b.append(num);
    if(isCamp){const label=document.createElement('span');label.className='camp-label';label.textContent=pos===0?'RIVAL CAMP':'YOUR CAMP';b.append(label);}
    const tokens=document.createElement('span');tokens.className='tokens';
    for(const s of [1,0])for(let i=0;i<counts(pos,s);i++){const token=document.createElement('span');token.className=`token ${s===1?'black':''}`;tokens.append(token);}
    b.append(tokens);
    b.addEventListener('click',()=>handleCell(pos));
    return b;
  }
  if(state.mode==='extreme'){
    for(let pos=0;pos<=49;pos++){
      const tile=cell(pos),rank=extremeRank(pos),route=extremeRoute(pos),lane=(pos-1)%2;
      let row,col;
      if(pos===0){row=1;col=9;}else if(pos===49){row=9;col=1;}
      else if(route===0){row=rank<6?1+lane:rank-3;col=rank<6?8-rank:1+lane;}
      else{row=rank<6?rank+3:9+lane;col=rank<6?9+lane:14-rank;}
      tile.style.gridRow=pos===0||pos===49?`${row} / span 2`:row;
      tile.style.gridColumn=pos===0||pos===49?`${col} / span 2`:col;
      if(pos>0&&pos<25)tile.classList.add('enemy');
      if(pos===0||pos===49){tile.querySelector('.camp-label').textContent=pos===0?'RIVAL':'YOU';tile.querySelector('.number').textContent=`${state.health[pos===0?1:0]}♥`;tile.setAttribute('aria-label',tile.getAttribute('aria-label')+`, ${state.health[pos===0?1:0]} of 5 base health`);}
      else if(fullRow(state,rank,route)){tile.classList.add('blockade');tile.setAttribute('aria-label',tile.getAttribute('aria-label')+', full row: blocks passage');}
      board.append(tile);
    }
    const center=document.createElement('div');center.className='linear-center';center.innerHTML='<strong>EXTREME</strong><span>Two tracks per route</span><span>Pairs block passage</span><span>Two attackers break a pair</span><span>3 dice · 10 agents · 5 health</span>';board.append(center);
    for(const corner of ['near','far']){const bend=document.createElement('span');bend.className='linear-bend '+corner;bend.textContent='6 ↔ 6';board.append(bend);}
  }else{
    for(let pos=0;pos<=25;pos++){
      const tile=cell(pos), rank=linearRank(pos), lane=(pos-1)%2;
      let row,col;
      if(pos===0){row=1;col=8;}else if(pos===25){row=8;col=1;}
      else if(lane===0){row=rank<6?1:rank-4;col=rank<6?7-rank:1;}
      else {row=rank<6?rank+2:8;col=rank<6?8:13-rank;}
      tile.style.gridRow=row;tile.style.gridColumn=col;
      if(pos>0&&pos<13)tile.classList.add('enemy');
      if(pos===0||pos===25){
        tile.querySelector('.camp-label').textContent=pos===0?'RIVAL':'YOU';
        tile.querySelector('.number').textContent=`${state.health[pos===0?1:0]}♥`;
        tile.setAttribute('aria-label',tile.getAttribute('aria-label')+`, base health ${state.health[pos===0?1:0]} of 3`);
        const invaders=counts(pos,pos===0?0:1);
        if(invaders){const badge=document.createElement('span');badge.className='infiltrator-count';badge.textContent=`+${invaders} enemy`;tile.append(badge);}
      }
      if(CHECKPOINTS.includes(pos)){tile.classList.add('checkpoint');tile.setAttribute('aria-label',tile.getAttribute('aria-label')+', checkpoint: blocks enemy jumps');}
      for(const side of [0,1])if(!state.intel[side]&&INTEL_ROWS[side].includes(pos)){tile.classList.add('intel-space');const mark=document.createElement('span');mark.className='objective-marker';mark.textContent='◆';mark.setAttribute('aria-hidden','true');tile.append(mark);tile.setAttribute('aria-label',tile.getAttribute('aria-label')+`, intelligence for ${side===0?'you':'rival'}`);}
      for(const side of [0,1])if(state.mode==='ultra'&&state.bounties[side]!==null&&state.pieces[1-side][state.bounties[side]]===pos){tile.classList.add('marked-agent');tile.setAttribute('aria-label',tile.getAttribute('aria-label')+', bounty target');}
      board.append(tile);
    }
    const center=document.createElement('div');center.className='linear-center';
    center.innerHTML=`<strong>${state.mode.toUpperCase()}</strong><span>◆ Intel: you ${state.intel[0]} · rival ${state.intel[1]}</span><span>Commands: you ${(state.commands?.[0]??0)} · rival ${state.commands[1]}</span><span>Turn ${Math.min(state.ply+1,TURN_LIMIT)} / ${TURN_LIMIT}</span>`;
    board.append(center);
    for(const corner of ['near','far']){const bend=document.createElement('span');bend.className='linear-bend '+corner;bend.textContent='6 ↔ 6';board.append(bend);}
  }
  $('rival-count').textContent=`${state.pieces[1].filter(p=>p>=0).length} agents · ${state.health[1]}/${healthMax()} health`;
  $('your-count').textContent=`${state.pieces[0].filter(p=>p>=0).length} agents · ${state.health[0]}/${healthMax()} health`;
  $('turn-number').textContent=String(state.ply+1).padStart(2,'0');
  renderExtremeDice();
  $('board-key-linear').lastElementChild.textContent=state.mode==='extreme'?'Outlined pairs block passage · Tracks are interchangeable':'◆ Intelligence · Outlined checkpoints block jumps';
  $('roll').textContent=state.mode==='extreme'?'Roll 3 dice ↗':'Roll the die ↗';
  $('die').textContent=dice[state.roll??0];
  $('die').setAttribute('aria-label',state.roll?`Rolled ${state.roll}`:'Die not rolled');
  $('roll').disabled=!active()||state.turn!==0||state.roll!==null||busy;
  $('roll').hidden=active() && state.turn===0 && state.roll!==null && !busy && moves.length===0;
  $('pass').hidden=!(state.turn===0 && !busy && canPass(state));
  $('pass').textContent=state.mode==='extreme'?'End turn · skip remaining dice':state.extraActions?'End turn · forfeit extra actions':'Skip turn →';
  renderActions(moves);
  $('log').replaceChildren(...log.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
  let title,detail,instruction;
  if(!active()) {
    $('turn-label').textContent='CAMPAIGN COMPLETE';
    title=state.draw?'A watchful stalemate.':state.winner===0?'Their camp is yours.':'Your camp has fallen.';
    detail=state.draw?'160 turns. Intelligence is tied.':state.winner===0?'Victory. Your rival has no way to hold the camp.':'The rival found an opening. Try a different plan.';
    instruction='Start a new game for another campaign.';
  } else if(state.turn===1 || busy) {
    $('turn-label').textContent=state.turn===1?'RIVAL’S TURN':'YOUR TURN';title=busy&&state.turn===0?'The die is cast…':'The rival is thinking…';detail=state.roll?`Rolled a ${state.roll}. Choosing a position.`:'A quiet moment before the next move.';instruction='Watch the camps. Every agent matters.';
  } else {
    $('turn-label').textContent='YOUR TURN';
    title=state.roll===null?'Make your move.':moves.length===0?'No opening this turn.':selected===null?'Choose your agent.':'Choose a destination.';
    detail='Roll, advance, use a special, or skip.';
    instruction=moves.length===0&&state.roll!==null?'No agent can use this roll. Pass to the rival.':selected===null?'Tap one of your agents, then a highlighted space.':`Selected: ${textPos(selected)}. Tap a gold destination. Choose a highlighted destination.`;
  }
  if(state.turn===0&&!busy&&active()){detail=state.roll===null?'Roll for forward distance and a special action, or skip.':`Roll ${state.roll}: advance ${state.roll}, use ${specials()[state.roll].name}, or skip.`;instruction=linearAction==='special'?'Choose an agent, then a special destination or the action button below.':'Select an agent, then a highlighted destination. Land on an enemy to capture it.';}
  if(!active()&&!state.draw&&(state.ply<TURN_LIMIT||state.health.includes(0)||state.pieces.some(a=>a.every(p=>p===-1)))){title=state.winner===0?'Victory.':'Defeat.';detail=state.health.includes(0)?'The enemy base has fallen. The base has no health left.':'All opposing agents have been captured.';if(state.winner===1)detail=state.health[0]===0?'Your base lost all its health.':'All your agents have been captured.';}
  if(state.mode!=='extreme'&&!active()&&state.ply>=TURN_LIMIT&&!state.health.includes(0)&&!state.pieces.some(a=>a.every(p=>p===-1))){title=state.draw?'Intelligence tied.':state.winner===0?'Victory on intelligence.':'Rival wins on intelligence.';detail=`Turn limit reached. Intelligence: you ${state.intel[0]}, rival ${state.intel[1]}.`;}
  if(state.mode==='extreme'){if(active()&&state.turn===0&&!busy){detail=state.dice.length?`${state.dice.filter(Boolean).length} dice left. Choose a die, then move, use its special, attack with a pair, or skip that die.`:'Roll all three dice, then spend them separately in any order.';instruction='Pairs resist movement, route switches and Vault landings. Break them with Strike Ahead or two attackers. Each agent gets one movement die; actions can stack.';}if(state.draw)detail='160 turns completed. Start a new campaign.';}
  $('status-title').textContent=title;$('status-detail').textContent=detail;$('selection').textContent=instruction;
}
function handleCell(pos) {
  if(!active()||busy||state.turn!==0)return;
  const moves=displayMoves();
  if(selected!==null){const m=moves.find(m=>m.from===selected&&m.to===pos&&m.kind!=='reverse');if(m){execute(m);return;}}
  selected=selected===pos?null:moves.some(m=>m.from===pos)?pos:null;
  render();
  if(selected!==null){const dest=document.querySelector('.available');dest?.focus({preventScroll:true});}
}
function execute(move) {
  const side=state.turn, rolled=state.mode==='extreme'?state.dice[move.dieIndex]:state.roll, beforeCoins=state.mode==='ultra'?state.coins[state.turn]:0, before=state.pieces[1-side].filter(p=>p>=0).length;
  state=applyMove(state,move);linearAction='move';lastMove={from:move.from,to:move.to};selected=null;
  const captured=state.pieces[1-side].filter(p=>p>=0).length<before;
  addLog(`${side===0?'You':'Rival'} rolled ${rolled}: ${move.kind==='reverse'?`reverse + ${rolled===1?'die '+(move.movementDie+1):''} (${Math.abs(move.steps)} backward)`:move.kind==='assault'?'coordinated attack':move.action==='special'?specials()[rolled].name:'advance '+rolled} · ${textPos(move.from)}${move.from!==move.to?' → '+textPos(move.to):''}${captured?' · enemy captured':''}.`);
  if(move.kind==='repair')addLog(`${side===0?'You':'Rival'} repaired 1 base health · ${state.health[side]}/5 health.`);
  if(state.mode==='ultra'&&state.coins[side]>beforeCoins)addLog(`${side===0?'You':'Rival'} earned ${state.coins[side]-beforeCoins} coins.`);
  if(move.to===base(1-side))addLog(`${side===0?'You':'Rival'} dealt 1 base damage and returned home.`);
  save();render();
  if(active() && state.turn===1)scheduleAI();
  else if(state.turn===0 && active())$('roll').focus({preventScroll:true});
}
function scheduleAI() {
  busy=true;render(); const token=generation;
  timer=setTimeout(()=>{
    if(token!==generation)return;
    if(state.roll===null){state=rollTurn(state,turnDice());save();}render();
    timer=setTimeout(()=>{
      if(token!==generation)return;
      const decision=chooseCard(state,difficulty,random);
      if(decision){
        const card=(decision.type==='buy'?state.offers[1]:state.hands[1]).find(c=>c.id===decision.id);
        if(decision.type==='buy'){
          state=buyCard(state,card.id);addLog(`Rival bought ${CARDS[card.kind].name}.`);
          busy=false;save();render();if(active()&&state.turn===1)scheduleAI();return;
        }
        const value=card.kind==='reroll'?rollDie():decision.value;
        state=playCard(state,card.id,value);
        rivalCard={kind:card.kind,effect:cardEffect(card.kind,value)};
        addLog(`Rival played ${CARDS[card.kind].name}: ${rivalCard.effect}`);
        save();render();showRivalCard(token);return;
      }
      const command=chooseCommand(state,difficulty);if(command!==null){state=adjustRoll(state,command);addLog(`Rival spent a Command token: roll ${state.roll}.`);}
      const move=chooseMove(state,difficulty,random);busy=false;
      if(move)execute(move);
      else{addLog(`Rival rolled ${state.roll}: skipped the turn.`);state=passTurn(state);selected=null;save();render();}
    },650);
  },500);
}
$('roll').addEventListener('click',()=>{
  if(busy || state.turn!==0 || state.roll!==null || !active())return;
  busy=true;render();$('die').classList.add('rolling');const token=generation;
  timer=setTimeout(()=>{if(token!==generation)return;state=rollTurn(state,turnDice());linearAction='move';busy=false;$('die').classList.remove('rolling');save();render();},400);
});
$('pass').addEventListener('click',()=>{if(state.turn!==0||busy||!canPass(state))return;addLog(`You skipped the turn${state.roll===null?' without rolling':` after rolling ${state.roll}`}.`);state=passTurn(state);selected=null;save();render();if(active())scheduleAI();});
$('difficulty').addEventListener('change',()=>{difficulty=$('difficulty').value;save();render();});
$('help').addEventListener('click',()=>$('rules').showModal());
$('close-rules').addEventListener('click',()=>$('rules').close());
$('restart').addEventListener('click',()=>{$('game-mode').value=state.mode||'linear';$('new-game').showModal();});
$('cancel-new').addEventListener('click',()=>$('new-game').close());
$('confirm-new').addEventListener('click',()=>{$('new-game').close();restart();});
function restart(){linearAction='move';generation++;clearTimeout(timer);revealDone=null;$('card-reveal').close();rivalCard=null;cardTab='hand';state=initialState($('game-mode').value,random);selected=null;lastMove=null;busy=false;log=['The camps are quiet. You move first.'];$('die').classList.remove('rolling');save();render();$('roll').focus({preventScroll:true});}
function renderActions(){
  const ready=active()&&state.turn===0&&!busy;
  const ultra=state.mode==='ultra';$('ultra-panel').hidden=!ultra;
  if(!ultra)return;
  $('wallet').textContent=`You: ${state.coins[0]} coins · Rival: ${state.coins[1]} coins`;
  $('hand-tab').textContent=`Your hand (${state.hands[0].length}/8)`;
  $('market-tab').textContent=`Market (${state.offers[0].length})`;
  $('rival-cards').textContent=`Rival holds ${state.hands[1].length} card${state.hands[1].length===1?'':'s'}`;
  $('action-count').textContent=`${state.turn===1?'Rival: ':''}${1+state.extraActions} action${state.extraActions?'s':''} available${state.bounties[0]!==null?` · marked agent: ${textPos(state.pieces[1][state.bounties[0]])}`:''}`;
  renderCardTabs();
  renderCards('hand-cards',state.hands[0],false,ready);
  renderCards('shop-cards',state.offers[0],true,ready);
  const queued=state.forcedRolls.map((r,s)=>r?`${s===0?'Your':'Rival’s'} next roll is set to ${r}.`:null).filter(Boolean).join(' ');
  $('power-note').textContent=[queued,state.rollLocked?'This roll is locked by the rival.':'Loaded Die and False Orders use the chosen die face.'].filter(Boolean).join(' ');

}
function renderExtremeDice(){
 const tray=$('extreme-dice'),on=state.mode==='extreme';tray.hidden=!on;$('skip-die').hidden=!on;$('die').hidden=on;tray.replaceChildren();
 if(!on)return;
 for(let i=0;i<3;i++){const value=state.dice[i],button=document.createElement('button');button.className='extreme-die';button.textContent=value?dice[value]:state.dice.length?'✓':'?';button.setAttribute('aria-label',value?`Die ${i+1}: ${value}`:state.dice.length?`Die ${i+1} used`:`Die ${i+1} not rolled`);button.setAttribute('aria-pressed',String(i===state.dieIndex));button.disabled=!active()||busy||state.turn!==0||!value;button.addEventListener('click',()=>{state=selectExtremeDie(state,i);selected=null;save();render();});tray.append(button);}
 $('skip-die').disabled=!active()||busy||state.turn!==0||state.roll===null;
}
$('skip-die').addEventListener('click',()=>{if(!active()||busy||state.turn!==0||state.roll===null)return;addLog(`You skipped die ${state.dieIndex+1} (${state.roll}).`);state=skipExtremeDie(state);selected=null;save();render();if(active()&&state.turn===1)scheduleAI();});
function renderLinear(moves){
  $('linear-controls').hidden=false;$('extreme-assault').hidden=state.mode!=='extreme';
  const ready=active()&&state.turn===0&&!busy&&state.roll!==null;
  $('linear-move').textContent=state.roll?`Move forward ${state.roll}`:'Move forward';
  $('linear-special').textContent=state.roll?`Special: ${specials()[state.roll].name}`:'Special action';
  for(const [id,action] of [['linear-move','move'],['linear-special','special'],['extreme-assault','assault']]){$(id).disabled=!ready;$(id).setAttribute('aria-pressed',String(linearAction===action));}
  $('linear-note').textContent=state.roll?specials()[state.roll].text:state.mode==='extreme'?'Roll three dice. Each die buys one move, special, or coordinated attack.':'Each die face has its own optional special. Choose one action per turn.';
  $('command-status').hidden=state.mode==='extreme';$('command-controls').hidden=state.mode==='extreme';
  $('command-status').textContent=`Command tokens: ${(state.commands?.[0]??0)} · adjust your die by one`;
  for(const [id,delta] of [['command-down',-1],['command-up',1]])$(id).disabled=!ready||state.rollLocked||!(state.commands?.[0]??0)||state.roll+delta<1||state.roll+delta>6;
  $('linear-options').replaceChildren();
  if(linearAction==='assault')$('linear-note').textContent='Two of your agents must stand side by side immediately before an enemy pair. One captures a blocker; the other stays. Uses the selected die.';
  if(ready&&['special','assault'].includes(linearAction)){
    const candidates=moves.filter(m=>selected===null?moves.length<=2:m.from===selected);
    if(!moves.length)$('linear-note').textContent+=' No eligible agent right now; move forward or skip instead.';
    for(const m of candidates){const b=document.createElement('button');b.className='secondary';b.textContent=m.kind==='repair'?`Repair base · +1 health (${state.health[state.turn]}/5)`:(m.kind==='reverse'?`Reverse + die ${m.movementDie+1} (${Math.abs(m.steps)}) · `:'')+(m.target!==undefined?`Capture enemy at ${textPos(m.target)}`:`${textPos(m.from)} → ${textPos(m.to)}`);b.addEventListener('click',()=>execute(m));$('linear-options').append(b);}
  }
}
for(const [id,action] of [['linear-move','move'],['linear-special','special'],['extreme-assault','assault']])$(id).addEventListener('click',()=>{if(busy||state.turn!==0||state.roll===null||!active())return;linearAction=action;selected=null;render();});
for(const [id,delta] of [['command-down',-1],['command-up',1]])$(id).addEventListener('click',()=>{if(busy||state.turn!==0||!active())return;state=adjustRoll(state,delta);selected=null;addLog(`You spent a Command token: roll ${state.roll}.`);save();render();});
function renderCards(target,cards,shop,ready){
  const container=$(target),scroll=container.scrollLeft;container.replaceChildren();
  if(!cards.length){const p=document.createElement('p');p.className='action-note';p.textContent=shop?'All offers purchased. Three new offers arrive on your next turn.':'No cards in hand. Buy a card below, or keep playing.';container.append(p);return;}
  for(const card of cards){
    const info=CARDS[card.kind],el=document.createElement('article');el.className=`tactic-card card-${card.kind}`;el.dataset.cardId=card.id;
    const top=document.createElement('div');top.className='card-top';
    const type=document.createElement('span');type.textContent=info.type;
    const price=document.createElement('span');price.textContent=shop?`${info.cost} ◈`:'IN HAND';top.append(type,price);
    const icon=document.createElement('div');icon.className='card-icon';icon.textContent=info.icon;icon.setAttribute('aria-hidden','true');
    const name=document.createElement('h4');name.textContent=info.name;
    const desc=document.createElement('p');desc.textContent=info.text;
    let targetPicker;
    if(card.kind==='bounty'&&!shop){targetPicker=document.createElement('select');targetPicker.setAttribute('aria-label','Marked Target enemy');state.pieces[1].forEach((pos,index)=>{if(pos>0&&pos<25){const option=document.createElement('option');option.value=index;option.textContent=textPos(pos);targetPicker.append(option);}});el.append(targetPicker);}
    const button=document.createElement('button');button.className='card-action';button.textContent=shop?`Buy ${info.name} · ${info.cost}`:`Play ${info.name}`;
    const reason=!ready?'Wait for your turn':shop?(state.hands[0].length>=8?'Hand full':state.coins[0]<info.cost?'Not enough coins':''):cardBlock(state,card.id);
    button.disabled=!!reason;
    button.addEventListener('click',()=>{
      if(!active()||busy||state.turn!==0)return;
      if(shop){if(!canBuyCard(state,card.id))return;state=buyCard(state,card.id);addLog(`You bought ${info.name} for ${info.cost} coins.`);}
      else {
        if(cardBlock(state,card.id))return;
        const value=card.kind==='bounty'?Number(targetPicker.value):card.kind==='reroll'?rollDie():Number($('power-face').value);
        state=playCard(state,card.id,value);selected=null;
        addLog(`You played ${info.name}${['set','sabotage','reroll'].includes(card.kind)?` (${value})`:''}.`);
      }
      save();render();if(active()&&state.turn===1)scheduleAI();
    });
    const note=document.createElement('span');note.className='card-reason';note.textContent=reason||(['set','sabotage'].includes(card.kind)?'Uses the chosen die face':'');
    el.append(top,icon,name,desc,button,note);container.append(el);
  }
  container.scrollLeft=scroll;
}
function renderCardTabs(){
  for(const name of ['hand','market']){const on=cardTab===name;$(name+'-tab').setAttribute('aria-selected',String(on));$(name+'-tab').tabIndex=on?0:-1;$(name+'-panel').hidden=!on;}
  $('card-help').textContent=cardTab==='hand'?'Play any number of cards. More cards →':'Three offers per turn. Buy now, play or hold. More cards →';
}
for(const name of ['hand','market']){
  $(name+'-tab').addEventListener('click',()=>{cardTab=name;renderCardTabs();});
  $(name+'-tab').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();cardTab=e.key==='Home'?'hand':e.key==='End'?'market':cardTab==='hand'?'market':'hand';renderCardTabs();$(cardTab+'-tab').focus();}});
}
for(const [id,direction] of [['cards-prev',-1],['cards-next',1]])$(id).addEventListener('click',()=>{
  const rack=$(cardTab==='hand'?'hand-cards':'shop-cards');rack.scrollBy({left:direction*Math.max(180,rack.clientWidth*.8),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
});
function cardEffect(kind,value){return {
  grant:'Rival spent an action to gain 3 coins.',extra:'Rival gained one extra action.',bounty:`Rival marked your agent at ${textPos(state.pieces[0][value])} for 3 bonus coins.`,
  draw:'Rival drew 2 cards.',recruit:'A new rival agent arrived in their camp.',
  reroll:`Rival rerolled to ${value}.`,set:`Rival set their die to ${value}.`,sabotage:`Your next roll is locked to ${value}.`
}[kind];}
function showRivalCard(token){
  busy=true;
  const info=CARDS[rivalCard.kind];$('reveal-icon').textContent=info.icon;$('reveal-title').textContent=info.name;
  $('reveal-description').textContent=info.text;$('reveal-effect').textContent=rivalCard.effect;
  const dialog=$('card-reveal');if(!dialog.open)dialog.showModal();
  revealDone=()=>{if(token!==generation)return;revealDone=null;clearTimeout(timer);dialog.close();busy=false;render();if(active()&&state.turn===1)scheduleAI();else $('roll').focus({preventScroll:true});};
  timer=setTimeout(()=>revealDone?.(),3200);
}
$('reveal-continue').addEventListener('click',()=>revealDone?.());
$('card-reveal').addEventListener('cancel',e=>{e.preventDefault();revealDone?.();});
render();if(active()&&state.turn===1)scheduleAI();
