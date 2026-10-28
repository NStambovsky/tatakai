import {LINEAR_SPECIALS,linearCamp,linearRank,upgradeLinear} from './linear.js?v=14';
import { initialState, legalMoves, applyMove, passTurn, canPass, chooseMove, validSave, camp, numberOf, sideOf, partner, rollTurn, CARDS, upgradeCards, canBuyCard, buyCard, cardBlock, playCard, chooseCard } from './engine.js?v=14';
const $ = id => document.getElementById(id);
const KEY = 'tatakai-v4';
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
  if(data)data.state=upgradeLinear(data.state);
  if (data && validSave(data.state)) {
    state=upgradeCards(data.state,random);
    if (Object.hasOwn(notes,data.difficulty)) difficulty=data.difficulty;
    if (Array.isArray(data.log)) log=data.log.filter(x=>typeof x==='string').slice(0,6);
    if (data.lastMove && Number.isInteger(data.lastMove.to) && data.lastMove.to>=0 && data.lastMove.to<=(state.mode==='linear'?25:21)) lastMove=data.lastMove;
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
function base(side){return state.mode==='linear'?linearCamp(side):camp(side);}
function displayMoves(){return legalMoves(state).filter(m=>state.mode!=='linear'||m.action===linearAction);}
function textPos(pos) { if(state.mode==='linear')return pos===25?'your base':pos===0?'rival base':`${pos<=12?"rival":"your"} ${Math.min(linearRank(pos)+1,12-linearRank(pos))}, ${pos%2?"upper":"lower"} route`; return pos===base(0)?'Ivory camp':pos===base(1)?'rival camp':`${sideOf(pos)===0?'Ivory':'rival'} ${numberOf(pos)} ${pos%2===1?'left':'right'}`; }
function counts(pos,side) { return state.pieces[side].filter(p=>p===pos).length; }
function addLog(message) { log.unshift(message); log=log.slice(0,6); }
function active() { return state.winner===null && !state.draw; }
function render() {
  $('difficulty').value=difficulty;
  $('rival-card-summary').hidden=!rivalCard;
  $('rival-card-summary').textContent=rivalCard?`Last rival card: ${CARDS[rivalCard.kind].name} · ${rivalCard.effect}`:'';
  $('mode-label').textContent=state.mode==='linear'?'LINEAR · Forward movement':state.mode==='ultra'?'ULTRA · Cards & coins':'CLASSIC · No power-ups';
  $('difficulty-note').textContent=notes[difficulty];
  $('rival-info').textContent=`Computer · ${difficulty[0].toUpperCase()+difficulty.slice(1)}`;
  const moves = state.turn===0 && !busy ? displayMoves() : [];
  renderLinear(moves);
  const destinations = selected===null ? [] : moves.filter(m=>m.from===selected).map(m=>m.to);
  const board=$('board'); board.classList.toggle('linear-board',state.mode==='linear');board.replaceChildren();
  function cell(pos) {
    const isCamp=pos===0||pos===base(0), own=counts(pos,0), rival=counts(pos,1);
    const b=document.createElement('button');
    b.type='button'; b.dataset.pos=pos;
    b.className=isCamp?`camp ${pos===0?'enemy':''}`:'space';
    if(destinations.includes(pos)) b.classList.add('available');
    if(state.mode!=='linear' && !isCamp && (own || rival) && counts(partner(pos),own?1:0)) b.classList.add('contested');
    if(selected===pos) b.classList.add('selected');
    if(lastMove?.to===pos) b.classList.add('last-move');
    const canSelect=moves.some(m=>m.from===pos);
    if(canSelect)b.classList.add('selectable');
    b.disabled=!active() || state.turn!==0 || busy || (!canSelect && !destinations.includes(pos));
    b.setAttribute('aria-label',`${textPos(pos)}, ${own} Ivory, ${rival} rival${destinations.includes(pos)?', legal destination':''}${moves.some(m=>m.from===pos&&m.kind==='capture')?', capture available: select and tap again':''}${canSelect?', select agent':''}`);
    b.setAttribute('aria-pressed',String(selected===pos));
    const num=document.createElement('span');num.className='number';num.textContent=state.mode==='linear'?(isCamp?'⌂':Math.min(linearRank(pos)+1,12-linearRank(pos))):numberOf(pos);b.append(num);
    if(isCamp){const label=document.createElement('span');label.className='camp-label';label.textContent=pos===0?'RIVAL CAMP':'YOUR CAMP';b.append(label);}
    const tokens=document.createElement('span');tokens.className='tokens';
    for(const s of [1,0])for(let i=0;i<counts(pos,s);i++){const token=document.createElement('span');token.className=`token ${s===1?'black':''}`;tokens.append(token);}
    b.append(tokens);
    if(state.mode!=='linear' && !isCamp && ((own && counts(pos%2===1?pos+1:pos-1,0)) || (rival && counts(pos%2===1?pos+1:pos-1,1)))){const badge=document.createElement('span');badge.className='protected';badge.textContent='◈';b.append(badge);}
    b.addEventListener('click',()=>handleCell(pos));
    return b;
  }
  if(state.mode==='linear'){
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
      board.append(tile);
    }
    const center=document.createElement('div');center.className='linear-center';
    center.innerHTML='<strong>LINEAR</strong><span>Two routes. One destination.</span><span>↗ Rival base</span><span>Your base ↙</span>';
    board.append(center);
    for(const corner of ['near','far']){const bend=document.createElement('span');bend.className='linear-bend '+corner;bend.textContent='6 ↔ 6';board.append(bend);}
  }else{
  board.append(cell(0));
  for(const side of [1,0]){
    const ranks=document.createElement('div');ranks.className=`ranks ${side===1?'enemy':''}`;
    for(const pos of state.mode==='linear'?Array.from({length:12},(_,i)=>i+1+(side===1?0:12)):side===1?[1,2,3,4,5,6,7,8,9,10]:[11,12,13,14,15,16,17,18,19,20])ranks.append(cell(pos));
    board.append(ranks);
  }
  board.append(cell(base(0)));
  }
  $('rival-count').textContent=`${state.pieces[1].filter(p=>p>=0).length} agents${state.mode==='linear'?` · ${state.health[1]}/3 health`:''}`;
  $('your-count').textContent=`${state.pieces[0].filter(p=>p>=0).length} agents${state.mode==='linear'?` · ${state.health[0]}/3 health`:''}`;
  $('turn-number').textContent=String(state.ply+1).padStart(2,'0');
  $('die').textContent=dice[state.roll??0];
  $('die').setAttribute('aria-label',state.roll?`Rolled ${state.roll}`:'Die not rolled');
  $('roll').disabled=!active()||state.turn!==0||state.roll!==null||busy;
  $('roll').hidden=active() && state.turn===0 && state.roll!==null && !busy && moves.length===0;
  $('pass').hidden=!(state.turn===0 && !busy && canPass(state));
  $('pass').textContent=state.extraActions?'End turn · forfeit extra actions':'Skip turn →';
  renderActions(moves);
  $('log').replaceChildren(...log.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
  let title,detail,instruction;
  if(!active()) {
    $('turn-label').textContent='CAMPAIGN COMPLETE';
    title=state.draw?'A watchful stalemate.':state.winner===0?'Their camp is yours.':'Your camp has fallen.';
    detail=state.draw?'300 turns. Both sides live to fight another day.':state.winner===0?'Victory. Your rival has no way to hold the camp.':'The rival found an opening. Try a different plan.';
    instruction='Start a new game for another campaign.';
  } else if(state.turn===1 || busy) {
    $('turn-label').textContent=state.turn===1?'RIVAL’S TURN':'YOUR TURN';title=busy&&state.turn===0?'The die is cast…':'The rival is thinking…';detail=state.roll?`Rolled a ${state.roll}. Choosing a position.`:'A quiet moment before the next move.';instruction='Watch the camps. Every agent matters.';
  } else {
    $('turn-label').textContent='YOUR TURN';
    title=state.roll===null?'Make your move.':moves.length===0?'No opening this turn.':selected===null?'Choose your agent.':'Choose a destination.';
    detail=state.roll===null?moves.length?'Capture an adjacent enemy, roll to move, or skip.':'Roll the die to see your options, or skip this turn.':state.roll===6?'Six: move, capture, or skip. Returning home is optional.':`Rolled a ${state.roll}. Move to a ${state.roll} space, capture if available, or skip.`;
    instruction=moves.length===0&&state.roll!==null?'No agent can use this roll. Pass to the rival.':selected===null?'Tap one of your agents, then a highlighted space.':`Selected: ${textPos(selected)}. Tap a gold destination. Use Capture enemy piece to capture in place; this uses one action.`;
  }
  if(state.mode==='linear'&&state.turn===0&&!busy&&active()){detail=state.roll===null?'Roll for forward distance and a special action, or skip.':`Roll ${state.roll}: advance ${state.roll}, use ${LINEAR_SPECIALS[state.roll].name}, or skip.`;instruction=linearAction==='special'?'Choose an agent, then a special destination or the action button below.':'Select an agent, then a highlighted destination. Land on an enemy to capture it.';}
  if(state.mode==='linear'&&!active()&&!state.draw){title=state.winner===0?'Victory.':'Defeat.';detail=state.health.includes(0)?'The enemy base has fallen. Three hits end the campaign.':'All opposing agents have been captured.';if(state.winner===1)detail=state.health[0]===0?'Your base lost all three health.':'All your agents have been captured.';}
  $('status-title').textContent=title;$('status-detail').textContent=detail;$('selection').textContent=instruction;
}
function handleCell(pos) {
  if(!active()||busy||state.turn!==0)return;
  const moves=displayMoves();
  if(selected!==null){const m=moves.find(m=>m.from===selected&&m.to===pos);if(m){execute(m);return;}}
  selected=selected===pos?null:moves.some(m=>m.from===pos)?pos:null;
  render();
  if(selected!==null){const dest=document.querySelector('.available');dest?.focus({preventScroll:true});}
}
function execute(move) {
  const side=state.turn, rolled=state.roll, beforeCoins=state.mode==='ultra'?state.coins[state.turn]:0, before=state.pieces[1-side].filter(p=>p>=0).length;
  state=applyMove(state,move);linearAction='move';lastMove={from:move.from,to:move.to};selected=null;
  const captured=state.pieces[1-side].filter(p=>p>=0).length<before;
  addLog(state.mode==='linear'?`${side===0?'You':'Rival'} rolled ${rolled}: ${move.action==='special'?LINEAR_SPECIALS[rolled].name:'advance '+rolled} · ${textPos(move.from)}${move.from!==move.to?' → '+textPos(move.to):''}${captured?' · enemy captured':''}.` : move.kind==='capture' ? `${side===0?'You':'Rival'} captured the adjacent agent from ${textPos(move.from)} · action used${rolled===null?' without rolling':''}.` : move.from===move.to ? `${side===0?'You':'Rival'} rolled 6: a home defender discovered and removed an infiltrator.` : `${side===0?'You':'Rival'} rolled ${rolled}: ${textPos(move.from)} → ${textPos(move.to)}${captured?' · captured an adjacent agent':move.to>0&&move.to<21&&state.pieces[1-side].includes(partner(move.to))?' · enemy threatened; gets a response turn before capture':''}.`);
  if(state.mode==='ultra' && state.coins[side]>beforeCoins)addLog(`${side===0?'You':'Rival'} earned ${state.coins[side]-beforeCoins} coins${captured?' from capture':''}${state.pieces[side].includes(base(1-side))?' · enemy-base income':''}.`);
  if(state.mode==='linear'&&move.to===base(1-side))addLog(`${side===0?'You':'Rival'} hit the enemy base for 1 damage. Agent returned home. Base health: ${state.health[1-side]}/3.`);
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
      const move=chooseMove(state,difficulty,random);busy=false;
      if(move)execute(move);
      else{addLog(`Rival rolled ${state.roll}: skipped the turn.`);state=passTurn(state);selected=null;save();render();}
    },650);
  },500);
}
$('roll').addEventListener('click',()=>{
  if(busy || state.turn!==0 || state.roll!==null || !active())return;
  busy=true;render();$('die').classList.add('rolling');const token=generation;
  timer=setTimeout(()=>{if(token!==generation)return;state=rollTurn(state,rollDie());linearAction='move';busy=false;$('die').classList.remove('rolling');save();render();},400);
});
$('pass').addEventListener('click',()=>{if(state.turn!==0||busy||!canPass(state))return;addLog(`You skipped the turn${state.roll===null?' without rolling':` after rolling ${state.roll}`}.`);state=passTurn(state);selected=null;save();render();if(active())scheduleAI();});
$('difficulty').addEventListener('change',()=>{difficulty=$('difficulty').value;save();render();});
$('help').addEventListener('click',()=>$('rules').showModal());
$('close-rules').addEventListener('click',()=>$('rules').close());
$('restart').addEventListener('click',()=>{$('game-mode').value=state.mode||'classic';$('new-game').showModal();});
$('cancel-new').addEventListener('click',()=>$('new-game').close());
$('confirm-new').addEventListener('click',()=>{$('new-game').close();restart();});
function restart(){linearAction='move';generation++;clearTimeout(timer);revealDone=null;$('card-reveal').close();rivalCard=null;cardTab='hand';state=initialState($('game-mode').value,random);selected=null;lastMove=null;busy=false;log=['The camps are quiet. You move first.'];$('die').classList.remove('rolling');save();render();$('roll').focus({preventScroll:true});}
function captureMoves(moves=legalMoves(state)) {
  if(state.mode==='linear')return [];
  return moves.filter(m=>m.kind==='capture'||(m.from===m.to&&m.to===base(state.turn)));
}
function renderActions(moves){
  const captures=captureMoves(moves), chosen=captures.find(m=>m.from===selected);
  const ready=active()&&state.turn===0&&!busy;
  $('capture').hidden=state.mode==='linear';$('capture-note').hidden=state.mode==='linear';
  $('capture').disabled=!ready||captures.length===0;
  $('capture').textContent='Capture enemy piece';
  const waiting=(state.pendingCaptures||[]).some(c=>c.side===0&&c.waiting);
  const faceoffs=state.pieces[0].filter(p=>p>0&&p<21&&state.pieces[1].includes(partner(p)));
  $('capture-note').textContent=!ready?'Captures use one action.':captures.length?(chosen?`Ready at ${textPos(chosen.from)} · uses one action.`:captures.length===1?`Ready at ${textPos(captures[0].from)} · uses one action.`:'Choose which enemy to capture below, or select your agent.'):
    waiting?'You just approached an enemy. They must get a response turn before you can capture—even with extra actions.':faceoffs.length?'The home agent gets first response without rolling. The arriving agent must wait until the opponent has had a turn.':'No capture ready. Move beside an enemy first; they get a response turn.';
  $('capture-choices').replaceChildren();
  if(captures.length>1&&!chosen)for(const move of captures){const b=document.createElement('button');b.className='secondary';b.textContent=`Capture from ${textPos(move.from)}`;b.addEventListener('click',()=>execute(move));$('capture-choices').append(b);}
  const ultra=state.mode==='ultra';$('ultra-panel').hidden=!ultra;
  if(!ultra)return;
  $('wallet').textContent=`You: ${state.coins[0]} coins · Rival: ${state.coins[1]} coins`;
  $('hand-tab').textContent=`Your hand (${state.hands[0].length}/8)`;
  $('market-tab').textContent=`Market (${state.offers[0].length})`;
  $('rival-cards').textContent=`Rival holds ${state.hands[1].length} card${state.hands[1].length===1?'':'s'}`;
  $('action-count').textContent=`${state.turn===1?'Rival: ':''}${1+state.extraActions} action${state.extraActions?'s':''} available${state.bounties[0]?` · next capture +${state.bounties[0]} bonus coins`:''}`;
  renderCardTabs();
  renderCards('hand-cards',state.hands[0],false,ready);
  renderCards('shop-cards',state.offers[0],true,ready);
  const queued=state.forcedRolls.map((r,s)=>r?`${s===0?'Your':'Rival’s'} next roll is set to ${r}.`:null).filter(Boolean).join(' ');
  $('power-note').textContent=[queued,state.rollLocked?'This roll is locked by the rival.':'Loaded Die and False Orders use the chosen die face.'].filter(Boolean).join(' ');

}
function renderLinear(moves){
  const linear=state.mode==='linear';$('linear-controls').hidden=!linear;
  $('board-key-classic').hidden=linear;$('board-key-linear').hidden=!linear;
  if(!linear)return;
  const ready=active()&&state.turn===0&&!busy&&state.roll!==null;
  $('linear-move').textContent=state.roll?`Move forward ${state.roll}`:'Move forward';
  $('linear-special').textContent=state.roll?`Special: ${LINEAR_SPECIALS[state.roll].name}`:'Special action';
  for(const [id,action] of [['linear-move','move'],['linear-special','special']]){$(id).disabled=!ready;$(id).setAttribute('aria-pressed',String(linearAction===action));}
  $('linear-note').textContent=state.roll?LINEAR_SPECIALS[state.roll].text:'Each die face has its own optional special. Choose one action per turn.';
  $('linear-options').replaceChildren();
  if(ready&&linearAction==='special'){
    const candidates=moves.filter(m=>selected===null?moves.length<=2:m.from===selected);
    if(!moves.length)$('linear-note').textContent+=' No eligible agent right now; move forward or skip instead.';
    for(const m of candidates){const b=document.createElement('button');b.className='secondary';b.textContent=m.target!==undefined?`Capture enemy at ${textPos(m.target)}`:`${textPos(m.from)} → ${textPos(m.to)}`;b.addEventListener('click',()=>execute(m));$('linear-options').append(b);}
  }
}
for(const [id,action] of [['linear-move','move'],['linear-special','special']])$(id).addEventListener('click',()=>{if(busy||state.turn!==0||state.roll===null||!active())return;linearAction=action;selected=null;render();});
$('capture').addEventListener('click',()=>{
  if(!active()||busy||state.turn!==0)return;
  const captures=captureMoves(), move=captures.find(m=>m.from===selected)||(captures.length===1?captures[0]:null);
  if(move)execute(move);else $('capture-choices').querySelector('button')?.focus();
});
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
    const button=document.createElement('button');button.className='card-action';button.textContent=shop?`Buy ${info.name} · ${info.cost}`:`Play ${info.name}`;
    const reason=!ready?'Wait for your turn':shop?(state.hands[0].length>=8?'Hand full':state.coins[0]<info.cost?'Not enough coins':''):cardBlock(state,card.id);
    button.disabled=!!reason;
    button.addEventListener('click',()=>{
      if(!active()||busy||state.turn!==0)return;
      if(shop){if(!canBuyCard(state,card.id))return;state=buyCard(state,card.id);addLog(`You bought ${info.name} for ${info.cost} coins.`);}
      else {
        if(cardBlock(state,card.id))return;
        const value=card.kind==='reroll'?rollDie():Number($('power-face').value);
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
  grant:'Rival gained 4 coins.',extra:'Rival gained one extra action.',bounty:'Their next capture earns 3 extra coins.',
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
