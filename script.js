/* ═══════════════════════════════════════════════════════════════
   E-GENIUS FINAL — script.js
   Complete dual-screen quiz competition system

   SECTIONS:
   1. STATE         — global application state
   2. AUDIENCE WIN  — build + open the projector popup window
   3. SCORE LOGIC   — add/undo scores
   4. TURN LOGIC    — set / switch current turn
   5. ROUND LOGIC   — round switching, speed question, R4
   6. TIMER         — countdown timer
   7. WHEEL LOGIC   — canvas wheels with easing animation
   8. IMAGE SYSTEM  — upload / show / hide images on audience
   9. SOUND EFFECTS — Web Audio API synthesised tones
   10. QUESTION BOARD — tracker with 3-state cycling
   11. INIT         — startup wiring
   ═══════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════
   1. STATE — single source of truth
   The audience window reads this object via
   window.opener.SHARED_STATE every 100ms.
   ══════════════════════════════════════════ */
const STATE = {
  scores:      { a: 0, b: 0 },
  names:       { a: 'Team A', b: 'Team B' },
  turn:        'a',                  // 'a' | 'b'
  round:       'speed',
  roundLabel:  '⚡ Speed Question',
  timerVal:    40,
  timerDefault:40,
  timerRunning:false,
  wheelResults: { team: '—', cat: '—' },
  wheelAngles:  { team: 0, cat: 0 },
  wheelSpinning:{ team: false, cat: false },
  showWheelBanner: false,
  showWheels:      true,   // toggle wheel visibility on audience
  lastWheelType:   'team',
  logoLeft:        null,   // base64 for left logo
  logoRight:       null,   // base64 for right logo
  audienceImage:   null,
  scoreHistory:    [],
  questionStates:  {},
  players:         { a: [], b: [] },   // player rosters per team
  scoreEvent:      null,               // { player, delta, team, ts } shown on audience
};

// CRITICAL FIX: expose STATE on the admin window so audience can read
// it via window.opener.SHARED_STATE (the audience polls its opener)
window.SHARED_STATE = STATE;

const ROUND_LABELS = {
  speed: '⚡ Speed Question',
  1: 'Round 1 – العلم',
  2: 'Round 2 – المعرفة',
  3: 'Round 3 – الفنون',
  4: 'Round 4 – تحت الضغط',
  5: 'Round 5 – ضربات الجزاء',
  6: 'Round 6 – عجلة الحظ',
};

const QUESTION_DATA = [
  { id:1, title:'R1 – العلم', questions:[
      'جغرافيا – س1','جغرافيا – س2',
      'تاريخ – س1','تاريخ – س2',
      'أدب – س1','أدب – س2',
      'علوم – س1','علوم – س2',
  ]},
  { id:2, title:'R2 – المعرفة', questions:[
      'معلومات عامة – س1','معلومات عامة – س2',
      'رياضة – س1','رياضة – س2',
      'تكنولوجيا – س1','تكنولوجيا – س2',
      'قدرات ذهنية – س1','قدرات ذهنية – س2',
  ]},
  { id:3, title:'R3 – الفنون', questions:[
      'سينما ومسرح – س1','سينما ومسرح – س2',
      'اغاني وموسيقي – س1','اغاني وموسيقي – س2',
      'لوحات ومعالم – س1','لوحات ومعالم – س2',
      'سرعة بديهة – س1','سرعة بديهة – س2',
  ]},
];

let audienceWin   = null;   // reference to popup window
let timerInterval = null;   // setInterval handle


/* ══════════════════════════════════════════
   2. AUDIENCE WINDOW
   Opens a new popup and writes the full
   audience HTML into it. The audience polls
   window.opener.SHARED_STATE every 100ms.
   ══════════════════════════════════════════ */

function openAudienceWindow() {
  if (audienceWin && !audienceWin.closed) { audienceWin.focus(); return; }

  audienceWin = window.open('', 'EGeniusAudience',
    'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,scrollbars=no'
  );

  if (!audienceWin) {
    alert('Popup was blocked. Please allow popups for this page, then try again.');
    return;
  }

  audienceWin.document.open();
  audienceWin.document.write(AUDIENCE_HTML);
  audienceWin.document.close();
  audienceWin.SHARED_STATE = STATE;

  document.getElementById('btn-open-audience').textContent = '🖥 Audience Screen Open';
}

/* ── Full audience HTML template ──
   Written as a template literal so it's
   self-contained in a single JS file.       */
const AUDIENCE_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>E-GENIUS FINAL</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700;900&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
<style>
:root{--gold:#FFD700;--gold2:#FFA500;--accent:#00E5FF;--accent2:#7B2FFF;--green:#00E676;--red:#FF3D00;--bg:#06080F;--card:#0F1225;--text:#E8EAFF;--dim:#5A6080;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{width:100%;height:100%;overflow:hidden;}
body{font-family:'Tajawal',sans-serif;background:var(--bg);color:var(--text);display:flex;flex-direction:column;direction:rtl;}
body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse at 20% 50%,rgba(123,47,255,.07) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(0,229,255,.05) 0%,transparent 50%);pointer-events:none;z-index:0;}

/* HEADER */
.aud-header{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:12px 28px;background:linear-gradient(135deg,#08091A,#0D1035);border-bottom:2px solid var(--accent);box-shadow:0 4px 30px rgba(0,229,255,.12);flex-shrink:0;}
.aud-logo{height:90px;object-fit:contain;filter:drop-shadow(0 0 8px rgba(0,229,255,.3));}
.aud-title{font-family:'Orbitron',sans-serif;font-size:clamp(18px,3vw,40px);font-weight:900;color:var(--gold);text-shadow:0 0 30px var(--gold2),0 0 60px rgba(255,165,0,.3);letter-spacing:3px;text-align:center;}

/* MAIN */
.aud-main{flex:1;position:relative;z-index:1;display:grid;grid-template-rows:auto auto 1fr auto;align-items:center;justify-items:center;padding:14px 36px 10px;gap:12px;overflow:hidden;}

/* Round label */
.round-label{font-family:'Orbitron',sans-serif;font-size:clamp(16px,2.6vw,38px);font-weight:900;color:var(--accent);text-shadow:0 0 30px rgba(0,229,255,.6);text-align:center;letter-spacing:2px;width:100%;}

/* TIMER — always visible, large */
.aud-timer-wrap{display:flex;flex-direction:column;align-items:center;gap:2px;}
.aud-timer-label{font-size:11px;letter-spacing:3px;color:var(--dim);text-transform:uppercase;font-family:'Orbitron',sans-serif;}
.aud-timer{font-family:'Orbitron',sans-serif;font-size:clamp(50px,9vw,120px);font-weight:900;color:var(--accent);text-shadow:0 0 40px rgba(0,229,255,.7);line-height:1;transition:color .3s,text-shadow .3s;}
.aud-timer.danger{color:var(--red);text-shadow:0 0 40px rgba(255,61,0,.8);animation:blinkT .5s step-end infinite;}
.aud-timer.idle{color:#1E2A3A;text-shadow:none;}

/* Scoreboard */
.scoreboard{display:flex;gap:24px;align-items:stretch;width:100%;max-width:1100px;}
.team-card{flex:1;background:var(--card);border:2px solid #1E2445;border-radius:18px;padding:16px 22px;text-align:center;transition:all .4s cubic-bezier(.34,1.56,.64,1);position:relative;overflow:hidden;}
.team-card::before{content:'';position:absolute;inset:0;border-radius:16px;opacity:0;transition:opacity .4s;}
.team-card.team-a::before{background:linear-gradient(135deg,rgba(0,229,255,.07),transparent 70%);}
.team-card.team-b::before{background:linear-gradient(135deg,rgba(255,215,0,.07),transparent 70%);}
.team-card.active-turn{transform:scale(1.03);}
.team-card.team-a.active-turn{border-color:var(--accent);box-shadow:0 0 40px rgba(0,229,255,.35);}
.team-card.team-b.active-turn{border-color:var(--gold);box-shadow:0 0 40px rgba(255,215,0,.35);}
.team-card.active-turn::before{opacity:1;}
.aud-team-name{font-size:clamp(14px,2.2vw,30px);font-weight:900;margin-bottom:6px;}
.team-a .aud-team-name{color:var(--accent);}
.team-b .aud-team-name{color:var(--gold);}
.aud-score{font-family:'Orbitron',sans-serif;font-size:clamp(44px,7.5vw,96px);font-weight:900;line-height:1;}
.team-a .aud-score{color:var(--accent);text-shadow:0 0 30px rgba(0,229,255,.5);}
.team-b .aud-score{color:var(--gold);text-shadow:0 0 30px rgba(255,215,0,.5);}
.active-tag{display:inline-block;margin-top:6px;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;opacity:0;transition:opacity .3s;background:rgba(255,255,255,.1);color:#fff;}
.active-turn .active-tag{opacity:1;}
.vs-divider{font-family:'Orbitron',sans-serif;font-size:clamp(14px,2vw,28px);font-weight:900;color:var(--dim);align-self:center;flex-shrink:0;}

/* BOTTOM ROW: wheels + wheel banner side by side */
.bottom-row{display:flex;gap:30px;align-items:center;justify-content:center;width:100%;}

/* Wheel canvases on audience */
.aud-wheel-wrap{display:flex;flex-direction:column;align-items:center;gap:6px;opacity:0;transition:opacity .4s;}
.aud-wheel-wrap.visible{opacity:1;}
.aud-wheel-label-top{font-family:'Orbitron',sans-serif;font-size:11px;color:var(--dim);letter-spacing:2px;text-transform:uppercase;}
.aud-wheel-canvas{border-radius:50%;border:3px solid var(--accent);box-shadow:0 0 20px rgba(0,229,255,.3);}
.aud-wheel-result-tag{font-family:'Orbitron',sans-serif;font-size:15px;font-weight:900;color:var(--gold);background:rgba(0,0,0,.5);border:1px solid var(--gold2);border-radius:8px;padding:3px 12px;min-width:100px;text-align:center;}

/* Wheel result big banner */
.wheel-banner{background:linear-gradient(135deg,var(--accent2),#1A0855);border:1px solid var(--accent);border-radius:14px;padding:12px 30px;text-align:center;display:none;}
.wheel-banner.show{display:block;animation:bannerPop .6s cubic-bezier(.34,1.56,.64,1);}
.wheel-banner-label{font-size:12px;color:var(--accent);letter-spacing:2px;text-transform:uppercase;}
.wheel-banner-result{font-family:'Orbitron',sans-serif;font-size:clamp(24px,3.5vw,50px);font-weight:900;color:var(--gold);text-shadow:0 0 20px var(--gold2);margin-top:3px;}

/* Audience image */
#aud-image-container{position:fixed;inset:0;align-items:center;justify-content:center;background:rgba(6,8,15,.92);z-index:50;display:none;}
#aud-image-container.show{display:flex;animation:fadeInA .3s ease;}
#aud-image-el{max-width:90vw;max-height:88vh;object-fit:contain;border-radius:12px;box-shadow:0 0 60px rgba(0,0,0,.8);border:2px solid var(--accent);}

@keyframes blinkT{50%{opacity:.15;}}
@keyframes bannerPop{from{opacity:0;transform:scale(.7);}to{opacity:1;transform:scale(1);}}
@keyframes fadeInA{from{opacity:0;}to{opacity:1;}}
@keyframes scoreFlash{0%,100%{transform:scale(1);}50%{transform:scale(1.18);}}
.score-flash{animation:scoreFlash .35s ease;}
#hint{position:fixed;bottom:10px;left:12px;font-size:10px;color:var(--dim);z-index:200;}

/* Score event notification */
#score-notify{
  position:fixed;
  top:50%;left:50%;
  transform:translate(-50%,-50%) scale(0.6);
  background:rgba(10,12,20,0.95);
  border-radius:20px;
  padding:22px 44px;
  text-align:center;
  z-index:100;
  opacity:0;
  pointer-events:none;
  transition:opacity .25s, transform .25s;
  border:2px solid transparent;
  box-shadow:0 0 60px rgba(0,0,0,.8);
  min-width:280px;
}
#score-notify.show{
  opacity:1;
  transform:translate(-50%,-50%) scale(1);
}
#score-notify.pos{ border-color:var(--green); box-shadow:0 0 50px rgba(0,230,118,.3); }
#score-notify.neg{ border-color:var(--red);   box-shadow:0 0 50px rgba(255,61,0,.3); }
.sn-player{
  font-family:'Tajawal',sans-serif;
  font-size:clamp(22px,3.5vw,44px);
  font-weight:900;
  color:var(--text);
  line-height:1.1;
  margin-bottom:6px;
}
.sn-delta{
  font-family:'Orbitron',sans-serif;
  font-size:clamp(38px,6vw,80px);
  font-weight:900;
  line-height:1;
}
.sn-delta.pos{ color:var(--green); text-shadow:0 0 30px rgba(0,230,118,.7); }
.sn-delta.neg{ color:var(--red);   text-shadow:0 0 30px rgba(255,61,0,.7); }
.sn-team{
  font-size:13px;
  color:var(--dim);
  margin-top:4px;
  font-family:'Tajawal',sans-serif;
}
@keyframes notifyPop{
  0%  {transform:translate(-50%,-50%) scale(0.5); opacity:0;}
  60% {transform:translate(-50%,-50%) scale(1.08);}
  100%{transform:translate(-50%,-50%) scale(1);   opacity:1;}
}
#score-notify.show{ animation:notifyPop .35s cubic-bezier(.34,1.56,.64,1) forwards; }
</style>
</head>
<body>
<header class="aud-header">
  <img class="aud-logo" id="aud-logo-left"  src="TEDxEJUST.png" alt="TEDxEJUST" onerror="this.style.visibility='hidden'">
  <div class="aud-title">E-GENIUS FINAL</div>
  <img class="aud-logo" id="aud-logo-right" src="eGenius.png"    alt="eGenius"    onerror="this.style.visibility='hidden'">
</header>
<main class="aud-main">

  <!-- Row 1: Round label -->
  <div class="round-label" id="aud-round-label">Speed Question</div>

  <!-- Row 2: Scoreboard -->
  <div class="scoreboard">
    <div class="team-card team-a active-turn" id="aud-card-a">
      <div class="aud-team-name" id="aud-name-a">Team A</div>
      <div class="aud-score"     id="aud-score-a">0</div>
      <div class="active-tag">&#9654; دور الفريق</div>
    </div>
    <div class="vs-divider">VS</div>
    <div class="team-card team-b" id="aud-card-b">
      <div class="aud-team-name" id="aud-name-b">Team B</div>
      <div class="aud-score"     id="aud-score-b">0</div>
      <div class="active-tag">&#9654; دور الفريق</div>
    </div>
  </div>

  <!-- Row 3: Timer (always visible) -->
  <div class="aud-timer-wrap">
    <div class="aud-timer-label">&#9201; TIMER</div>
    <div class="aud-timer idle" id="aud-timer">00</div>
  </div>

  <!-- Row 4: Bottom row — wheels + result banner -->
  <div class="bottom-row">
    <!-- Wheel 1: Team -->
    <div class="aud-wheel-wrap" id="aud-wheel-team-wrap">
      <div class="aud-wheel-label-top">Team Selector</div>
      <canvas class="aud-wheel-canvas" id="aud-wheel-team" width="200" height="200"></canvas>
      <div class="aud-wheel-result-tag" id="aud-wresult-team">&#8212;</div>
    </div>

    <!-- Wheel result banner (centre) -->
    <div class="wheel-banner" id="aud-wheel-banner">
      <div class="wheel-banner-label" id="aud-wheel-label">&#1606;&#1578;&#1610;&#1580;&#1577; &#1575;&#1604;&#1593;&#1580;&#1604;&#1577;</div>
      <div class="wheel-banner-result" id="aud-wheel-result">&#8212;</div>
    </div>

    <!-- Wheel 2: Category -->
    <div class="aud-wheel-wrap" id="aud-wheel-cat-wrap">
      <div class="aud-wheel-label-top">Category</div>
      <canvas class="aud-wheel-canvas" id="aud-wheel-cat" width="200" height="200"></canvas>
      <div class="aud-wheel-result-tag" id="aud-wresult-cat">&#8212;</div>
    </div>
  </div>

</main>
<div id="aud-image-container"><img id="aud-image-el" src="" alt=""></div>
<div id="hint">F = Fullscreen</div>

<!-- Score event notification overlay -->
<div id="score-notify">
  <div class="sn-player" id="sn-player"></div>
  <div class="sn-delta"  id="sn-delta"></div>
  <div class="sn-team"   id="sn-team"></div>
</div>

<script>
// ── Wheel section definitions (must match admin) ──
var WHEEL_TEAM=[{label:'1',color:'#00E5FF',weight:2},{label:'2',color:'#FFD700',weight:2}];
var WHEEL_CAT=[
  {label:'Joker',       color:'#FF3D00',weight:2},
  {label:'Switch',      color:'#7B2FFF',weight:2},
  {label:'\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0639\u0627\u0645\u0629',color:'#00E676',weight:2},
  {label:'\u0642\u062f\u0631\u0627\u062a \u0630\u0647\u0646\u064a\u0629',color:'#00B0FF',weight:2},
  {label:'\u062c\u063a\u0631\u0627\u0641\u064a\u0627',color:'#FF6D00',weight:1},
  {label:'\u062a\u0627\u0631\u064a\u062e',       color:'#E65100',weight:1},
  {label:'\u0631\u064a\u0627\u0636\u0629',        color:'#1B5E20',weight:1},
  {label:'\u0641\u0646\u0648\u0646',              color:'#FFD600',weight:1},
  {label:'\u0639\u0644\u0648\u0645',              color:'#880E4F',weight:1},
  {label:'\u0623\u062f\u0628',                   color:'#4A148C',weight:1},
];

function drawAudWheel(canvasId, sections, angle) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height, cx = W/2, cy = H/2, r = W/2 - 3;
  var totalW = sections.reduce(function(s,sec){return s+(sec.weight||1);},0);
  var arcs = []; var cursor = angle;
  sections.forEach(function(sec){
    var arc = (sec.weight||1)/totalW*(Math.PI*2);
    arcs.push({start:cursor, arc:arc, mid:cursor+arc/2});
    cursor += arc;
  });
  ctx.clearRect(0,0,W,H);
  sections.forEach(function(sec,i){
    var a = arcs[i];
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,a.start,a.start+a.arc); ctx.closePath();
    ctx.fillStyle = sec.color; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    var isHalf = (sec.weight||1) < 2;
    var fs = isHalf ? 9 : 11;
    var lr = isHalf ? r-12 : r-8;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(a.mid);
    ctx.textAlign='right'; ctx.fillStyle='#fff';
    ctx.font='bold '+fs+'px Tajawal,sans-serif';
    ctx.shadowColor='rgba(0,0,0,.9)'; ctx.shadowBlur=3;
    ctx.fillText(sec.label, lr, isHalf?3:4);
    ctx.restore();
  });
  ctx.beginPath(); ctx.arc(cx,cy,8,0,Math.PI*2);
  ctx.fillStyle='#0A0C12'; ctx.fill();
  ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-8,3); ctx.lineTo(cx+8,3); ctx.lineTo(cx,18);
  ctx.closePath(); ctx.fillStyle='#FF3D00'; ctx.fill();
}

// ── Polling loop ──
var prevSA=0,prevSB=0,prevTurn='a',prevRound='',prevImg=null;
var prevWheelA=0,prevWheelB=0,prevBanner=false,prevTimer=-1;
var prevScoreEventTs=0;
var notifyTimeout=null;

function poll(){
  var opener = window.opener;
  if(!opener) return;
  // Try both locations for the state object
  var S = opener.SHARED_STATE || opener.STATE;
  if(!S) return;

  // Names
  document.getElementById('aud-name-a').textContent = S.names.a;
  document.getElementById('aud-name-b').textContent = S.names.b;

  // Embedded logos (base64 set by admin via logo upload)
  if(S.logoLeft){  var ll=document.getElementById('aud-logo-left');  if(ll){ll.src=S.logoLeft;  ll.style.visibility='visible';}}
  if(S.logoRight){ var lr=document.getElementById('aud-logo-right'); if(lr){lr.src=S.logoRight; lr.style.visibility='visible';}}

  // Scores
  var sa = document.getElementById('aud-score-a');
  var sb = document.getElementById('aud-score-b');
  if(S.scores.a !== prevSA){ sa.textContent=S.scores.a; flash(sa); prevSA=S.scores.a; }
  if(S.scores.b !== prevSB){ sb.textContent=S.scores.b; flash(sb); prevSB=S.scores.b; }

  // Turn
  if(S.turn !== prevTurn){
    document.getElementById('aud-card-a').classList.toggle('active-turn', S.turn==='a');
    document.getElementById('aud-card-b').classList.toggle('active-turn', S.turn==='b');
    prevTurn = S.turn;
  }

  // Round label
  if(S.roundLabel !== prevRound){
    var lbl = document.getElementById('aud-round-label');
    lbl.textContent = S.roundLabel;
    lbl.style.animation='none'; void lbl.offsetWidth; lbl.style.animation='';
    prevRound = S.roundLabel;
  }

  // Timer — always show, format as MM:SS when >= 60 else just seconds
  var tEl = document.getElementById('aud-timer');
  var tv = S.timerVal || 0;
  if(tv !== prevTimer){
    if(tv >= 60){
      var m = Math.floor(tv/60), s2 = tv%60;
      tEl.textContent = m + ':' + (s2<10?'0':'')+s2;
    } else {
      tEl.textContent = tv < 10 ? '0'+tv : tv;
    }
    prevTimer = tv;
  }
  tEl.classList.toggle('danger', tv<=10 && !!S.timerRunning);
  tEl.classList.toggle('idle',   !S.timerRunning);

  // Wheel canvases — always draw latest angle
  var wa = S.wheelAngles || {team:0,cat:0};
  if(wa.team !== prevWheelA){
    drawAudWheel('aud-wheel-team', WHEEL_TEAM, wa.team);
    prevWheelA = wa.team;
  }
  if(wa.cat !== prevWheelC){
    drawAudWheel('aud-wheel-cat', WHEEL_CAT, wa.cat);
    prevWheelC = wa.cat;
  }

  // Show wheel wraps when spinning or has result
  var showW = (S.showWheels !== false);
  document.getElementById('aud-wheel-team-wrap').classList.toggle('visible', showW);
  document.getElementById('aud-wheel-cat-wrap').classList.toggle('visible',  showW);

  // Wheel result tags
  document.getElementById('aud-wresult-team').textContent = S.wheelResults.team;
  document.getElementById('aud-wresult-cat').textContent  = S.wheelResults.cat;

  // Wheel banner
  var banner = document.getElementById('aud-wheel-banner');
  var showB = !!S.showWheelBanner;
  if(showB !== prevBanner){
    banner.classList.toggle('show', showB);
    if(showB){
      if(S.lastWheelType==='team'){
        document.getElementById('aud-wheel-label').textContent='\u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0641\u0631\u064a\u0642';
        document.getElementById('aud-wheel-result').textContent=S.wheelResults.team;
      } else {
        document.getElementById('aud-wheel-label').textContent='\u0627\u0644\u0641\u0626\u0629 \u0627\u0644\u0645\u062e\u062a\u0627\u0631\u0629';
        document.getElementById('aud-wheel-result').textContent=S.wheelResults.cat;
      }
    }
    prevBanner = showB;
  }

  // Score event notification
  if(S.scoreEvent && S.scoreEvent.ts !== prevScoreEventTs){
    prevScoreEventTs = S.scoreEvent.ts;
    showScoreNotify(S.scoreEvent, S);
  }

  // Audience image
  if(S.audienceImage !== prevImg){
    var cont = document.getElementById('aud-image-container');
    var img  = document.getElementById('aud-image-el');
    if(S.audienceImage){ img.src=S.audienceImage; cont.style.display='flex'; cont.classList.add('show'); }
    else { cont.style.display='none'; cont.classList.remove('show'); }
    prevImg = S.audienceImage;
  }
}

var prevWheelC = 0;

function flash(el){ el.classList.remove('score-flash'); void el.offsetWidth; el.classList.add('score-flash'); }

function showScoreNotify(ev, S) {
  var ntf = document.getElementById('score-notify');
  var snp = document.getElementById('sn-player');
  var snd = document.getElementById('sn-delta');
  var snt = document.getElementById('sn-team');
  if(!ntf) return;

  var isPos  = ev.delta > 0;
  var sign   = isPos ? '+' : '';
  var teamNm = ev.team === 'a' ? (S.names.a||'Team A') : (S.names.b||'Team B');

  snp.textContent = ev.player || '';
  snp.style.display = ev.player ? 'block' : 'none';
  snd.textContent = sign + ev.delta;
  snd.className = 'sn-delta ' + (isPos ? 'pos' : 'neg');
  snt.textContent = teamNm;

  ntf.classList.remove('show','pos','neg');
  void ntf.offsetWidth;
  ntf.classList.add('show', isPos ? 'pos' : 'neg');

  clearTimeout(notifyTimeout);
  notifyTimeout = setTimeout(function(){
    ntf.classList.remove('show','pos','neg');
  }, 2800);
}

// Draw wheels at angle 0 on load
drawAudWheel('aud-wheel-team', WHEEL_TEAM, 0);
drawAudWheel('aud-wheel-cat',  WHEEL_CAT,  0);

// Poll every 80ms for smooth wheel animation
setInterval(poll, 80);
poll();

document.addEventListener('keydown', function(e){
  if(e.key==='f'||e.key==='F'){
    if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(function(){});
    else document.exitFullscreen();
  }
});
</script>
</body>
</html>`;




/* ══════════════════════════════════════════
   3. SCORE LOGIC
   Push snapshot → update → sync to audience
   ══════════════════════════════════════════ */

/* addScore — if players exist for this team, show picker first.
   applyScore() is called after player is chosen (or skipped).     */
function addScore(team, delta) {
  const players = STATE.players[team];
  if (players && players.length > 0) {
    openPlayerPicker(team, delta);
  } else {
    applyScore(team, delta, null);
  }
}

function applyScore(team, delta, playerName) {
  STATE.scoreHistory.push({ a: STATE.scores.a, b: STATE.scores.b, turn: STATE.turn });
  if (STATE.scoreHistory.length > 50) STATE.scoreHistory.shift();
  STATE.scores[team] = Math.max(0, STATE.scores[team] + delta);
  playSound(delta > 0 ? 'correct' : 'wrong');

  // Fire a scoreEvent so audience shows the player notification
  STATE.scoreEvent = {
    player: playerName || null,
    delta:  delta,
    team:   team,
    ts:     Date.now()        // unique timestamp triggers audience re-render
  };

  syncState();
}

function undoScore() {
  if (!STATE.scoreHistory.length) return;
  const snap = STATE.scoreHistory.pop();
  STATE.scores.a = snap.a;
  STATE.scores.b = snap.b;
  STATE.turn = snap.turn;
  syncState();
}

/* syncState: update admin UI + expose STATE to audience window */
function syncState() {
  STATE.names.a = document.getElementById('name-a').value || 'Team A';
  STATE.names.b = document.getElementById('name-b').value || 'Team B';

  document.getElementById('score-a-display').textContent = STATE.scores.a;
  document.getElementById('score-b-display').textContent = STATE.scores.b;

  document.getElementById('admin-team-a').classList.toggle('active-turn', STATE.turn === 'a');
  document.getElementById('admin-team-b').classList.toggle('active-turn', STATE.turn === 'b');

  const tName = STATE.turn === 'a' ? STATE.names.a : STATE.names.b;
  document.getElementById('current-turn-badge').textContent = 'Current Turn: ' + tName;

  // SHARED_STATE is already window.SHARED_STATE = STATE (same object reference).
  // Re-assign so the audience window always gets the latest reference.
  window.SHARED_STATE = STATE;
  if (audienceWin && !audienceWin.closed) audienceWin.opener_state_ready = true;
}


/* ══════════════════════════════════════════
   4. TURN LOGIC
   ══════════════════════════════════════════ */

function setTurn(team) { STATE.turn = team; syncState(); }
function switchTurn()   { STATE.turn = STATE.turn === 'a' ? 'b' : 'a'; syncState(); }


/* ══════════════════════════════════════════
   5. ROUND LOGIC
   ══════════════════════════════════════════ */

function setRound(r) {
  STATE.round      = r;
  STATE.roundLabel = ROUND_LABELS[r] || ('Round ' + r);

  document.getElementById('speed-q-section').style.display = r === 'speed' ? '' : 'none';
  document.getElementById('r4-section').style.display       = r === 4       ? '' : 'none';

  document.querySelectorAll('.btn-round').forEach(b => b.classList.remove('active'));
  const btns = document.querySelectorAll('.btn-round');
  const idx  = r === 'speed' ? 0 : (typeof r === 'number' ? r : 0);
  if (btns[idx]) btns[idx].classList.add('active');

  if (r === 4) {
    STATE.timerVal     = 40;
    STATE.timerDefault = 40;
    document.getElementById('timer-set').value = 40;
    renderAdminTimer();
  }

  playSound('win');
  syncState();
}

/* Speed question — no points, determines starting team */
function speedWin(team) {
  STATE.turn = team;
  const n = team === 'a' ? STATE.names.a : STATE.names.b;
  alert('✔ ' + n + ' answered correctly!\nThey will start Round 1.');
  syncState();
}

/* Round 4 scoring: +5 per correct, +10 bonus for winner */
function calcR4() {
  const ac = parseInt(document.getElementById('r4-a').value) || 0;
  const bc = parseInt(document.getElementById('r4-b').value) || 0;
  addScore('a', ac * 5);
  addScore('b', bc * 5);
  if      (ac > bc) addScore('a', 10);
  else if (bc > ac) addScore('b', 10);
  const msg = 'Round 4:\n'
    + STATE.names.a + ': ' + ac + ' correct → +' + (ac * 5) + (ac > bc ? ' + 10 bonus' : '') + '\n'
    + STATE.names.b + ': ' + bc + ' correct → +' + (bc * 5) + (bc > ac ? ' + 10 bonus' : '') + '\n'
    + (ac === bc ? 'Tie — no bonus.' : '');
  alert(msg);
}


/* ══════════════════════════════════════════
   6. TIMER
   ══════════════════════════════════════════ */

function setTimerVal() {
  const v = parseInt(document.getElementById('timer-set').value);
  if (isNaN(v) || v < 1) return;
  clearInterval(timerInterval);
  STATE.timerRunning = false;
  STATE.timerVal     = v;
  STATE.timerDefault = v;
  renderAdminTimer();
  syncState();
}

function startTimer() {
  if (STATE.timerRunning) return;
  STATE.timerRunning = true;
  timerInterval = setInterval(() => {
    if (STATE.timerVal <= 0) {
      clearInterval(timerInterval);
      STATE.timerRunning = false;
      playSound('wrong');
      syncState();
      return;
    }
    STATE.timerVal--;
    renderAdminTimer();
    syncState();
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  STATE.timerRunning = false;
  syncState();
}

function resetTimer() {
  clearInterval(timerInterval);
  STATE.timerRunning = false;
  const v = parseInt(document.getElementById('timer-set').value) || 40;
  STATE.timerVal     = v;
  STATE.timerDefault = v;
  renderAdminTimer();
  syncState();
}

function renderAdminTimer() {
  const el = document.getElementById('admin-timer-display');
  el.textContent = STATE.timerVal;
  el.classList.toggle('danger', STATE.timerVal <= 10 && STATE.timerRunning);
}


/* ══════════════════════════════════════════
   7. WHEEL LOGIC
   Two canvas wheels with easing spin animation.
   Result determined by which section lands
   under the top pointer after spin stops.
   ══════════════════════════════════════════ */

const WHEEL_TEAM = [
  { label:'1', color:'#00E5FF' },
  { label:'2', color:'#FFD700' },
];

// weight:2 = full slice, weight:1 = half slice
const WHEEL_CAT = [
  { label:'Joker',        color:'#FF3D00', weight:2 },
  { label:'Switch',       color:'#7B2FFF', weight:2 },
  { label:'معلومات عامة', color:'#00E676', weight:2 },
  { label:'قدرات ذهنية',  color:'#00B0FF', weight:2 },
  { label:'جغرافيا',      color:'#FF6D00', weight:1 },
  { label:'تاريخ',        color:'#E65100', weight:1 },
  { label:'رياضة',        color:'#1B5E20', weight:1 },
  { label:'فنون',         color:'#FFD600', weight:1 },
  { label:'علوم',         color:'#880E4F', weight:1 },
  { label:'أدب',          color:'#4A148C', weight:1 },
];

const wState = {
  team:{ angle:0, spinning:false },
  cat: { angle:0, spinning:false },
};

/* drawWheel supports weighted sections via sec.weight (default 1).
   Sections with weight:2 get double the arc of weight:1 sections.  */
function drawWheel(canvasId, sections, angle) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2, r = W/2 - 4;

  // Build arc sizes from weights
  const totalWeight = sections.reduce((s, sec) => s + (sec.weight || 1), 0);
  const fullArc = (Math.PI * 2);
  // Pre-calculate start angle for each section
  const arcs = [];
  let cursor = angle;
  sections.forEach(sec => {
    const arc = (sec.weight || 1) / totalWeight * fullArc;
    arcs.push({ start: cursor, arc, mid: cursor + arc / 2 });
    cursor += arc;
  });

  ctx.clearRect(0, 0, W, H);

  sections.forEach((sec, i) => {
    const { start, arc, mid } = arcs[i];
    // Slice
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + arc);
    ctx.closePath();
    ctx.fillStyle = sec.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label — scale font by weight
    const isHalf = (sec.weight || 1) < 2;
    const fontSize = isHalf ? 10 : 13;
    const labelR   = isHalf ? r - 14 : r - 12;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(mid);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + fontSize + 'px Tajawal,sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,.9)';
    ctx.shadowBlur = 3;
    ctx.fillText(sec.label, labelR, isHalf ? 3 : 5);
    ctx.restore();
  });

  // Centre dot
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#0A0C12';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top pointer triangle
  ctx.beginPath();
  ctx.moveTo(cx - 10, 4);
  ctx.lineTo(cx + 10, 4);
  ctx.lineTo(cx, 22);
  ctx.closePath();
  ctx.fillStyle = '#FF3D00';
  ctx.fill();
}

function spinWheel(type) {
  const ws       = type === 'team' ? wState.team : wState.cat;
  const sections = type === 'team' ? WHEEL_TEAM : WHEEL_CAT;
  const canvasId = type === 'team' ? 'wheel-team-canvas' : 'wheel-cat-canvas';
  const resultId = type === 'team' ? 'result-team' : 'result-cat';
  const spinBtns = document.querySelectorAll('.btn-spin');
  const btnIdx   = type === 'team' ? 0 : 1;

  if (ws.spinning) return;
  ws.spinning = true;
  spinBtns[btnIdx].disabled = true;
  playSound('spin');

  const totalRot = Math.PI * 2 * (5 + Math.random() * 5) + Math.random() * Math.PI * 2;
  const duration = 3000 + Math.random() * 1000;
  const startAngle = ws.angle;
  const t0 = performance.now();

  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

  function frame(now) {
    const p = Math.min((now - t0) / duration, 1);
    ws.angle = startAngle + totalRot * easeOut(p);
    // Mirror angle to STATE so audience canvas can sync
    STATE.wheelAngles[type] = ws.angle;
    STATE.wheelSpinning[type] = true;
    drawWheel(canvasId, sections, ws.angle);

    if (p < 1) { requestAnimationFrame(frame); return; }

    // Determine winning section for weighted wheel (pointer at top)
    const norm = ((ws.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    // Pointer is at top (π/2 from 0 in canvas terms = angle 0 from our draw start)
    // The section whose arc range contains (2π - norm) is the winner
    const totalW2 = sections.reduce((s, sec) => s + (sec.weight || 1), 0);
    const pointerPos = ((Math.PI * 2) - norm + Math.PI * 2) % (Math.PI * 2);
    let cumulative = 0, idx = 0;
    for (let k = 0; k < sections.length; k++) {
      const arc = (sections[k].weight || 1) / totalW2 * (Math.PI * 2);
      if (pointerPos >= cumulative && pointerPos < cumulative + arc) { idx = k; break; }
      cumulative += arc;
    }
    const result = sections[idx].label;

    document.getElementById(resultId).textContent = result;

    if (type === 'team') STATE.wheelResults.team = result;
    else                  STATE.wheelResults.cat  = result;
    STATE.showWheelBanner = true;
    STATE.lastWheelType   = type;
    syncState();

    // Auto-hide banner after 8 seconds
    setTimeout(() => { STATE.showWheelBanner = false; syncState(); }, 8000);

    STATE.wheelSpinning[type] = false;
    ws.spinning = false;
    spinBtns[btnIdx].disabled = false;
  }

  requestAnimationFrame(frame);
}

function initWheels() {
  drawWheel('wheel-team-canvas', WHEEL_TEAM, 0);
  drawWheel('wheel-cat-canvas',  WHEEL_CAT,  0);
}


/* ══════════════════════════════════════════
   7b. PLAYER MANAGEMENT
   Add/remove players per team. Player names
   are stored in STATE.players.a / .b arrays.
   Displayed as clickable roster in admin panel.
   ══════════════════════════════════════════ */

function addPlayer(team) {
  const input = document.getElementById('player-input-' + team);
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;
  if (STATE.players[team].includes(name)) {
    fsToast('⚠ Player already exists', 'warn'); return;
  }
  STATE.players[team].push(name);
  input.value = '';
  renderRoster(team);
  syncState();
}

function removePlayer(team, idx) {
  STATE.players[team].splice(idx, 1);
  renderRoster(team);
  syncState();
}

function renderRoster(team) {
  const el = document.getElementById('roster-' + team);
  if (!el) return;
  el.innerHTML = '';
  STATE.players[team].forEach((name, i) => {
    const pill = document.createElement('div');
    pill.className = 'player-pill';
    // Use data attributes to avoid quote-escaping issues in onclick
    pill.innerHTML =
      '<span class="player-pill-name">' + name + '</span>' +
      '<button class="player-pill-remove" data-team="' + team + '" data-idx="' + i + '">&#xD7;</button>';
    pill.querySelector('button').addEventListener('click', function() {
      removePlayer(this.dataset.team, parseInt(this.dataset.idx));
    });
    el.appendChild(pill);
  });
}

/* ── Player Picker Modal ──
   Shown when a score button is pressed and
   the team has players. Host picks a player
   or clicks "No Player" to skip attribution. */
function openPlayerPicker(team, delta) {
  const modal = document.getElementById('player-picker-modal');
  const title = document.getElementById('pp-title');
  const list  = document.getElementById('pp-list');
  if (!modal) return;

  const teamName = STATE.names[team];
  const sign     = delta > 0 ? '+' : '';
  title.textContent = teamName + ' — ' + sign + delta + ' نقطة';

  list.innerHTML = '';

  // "No Player" option
  const noneBtn = document.createElement('button');
  noneBtn.className = 'pp-player-btn pp-none';
  noneBtn.textContent = '— بدون لاعب —';
  noneBtn.onclick = () => { closePP(); applyScore(team, delta, null); };
  list.appendChild(noneBtn);

  // One button per player
  STATE.players[team].forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'pp-player-btn';
    btn.innerHTML = '<span class="pp-player-name">' + name + '</span>' +
                    '<span class="pp-player-delta ' + (delta > 0 ? 'pos' : 'neg') + '">' + sign + delta + '</span>';
    btn.onclick = () => { closePP(); applyScore(team, delta, name); };
    list.appendChild(btn);
  });

  modal.style.display = 'flex';
  modal.classList.add('pp-open');
}

function closePP() {
  const modal = document.getElementById('player-picker-modal');
  if (modal) { modal.style.display = 'none'; modal.classList.remove('pp-open'); }
}


/* ══════════════════════════════════════════
   8. IMAGE SYSTEM
   Files are read as base64 DataURLs and stored
   in uploadedImages[]. Showing an image pushes
   its DataURL into STATE.audienceImage which
   the audience window renders in an overlay.

   Also handles:
   - Logo upload (embedded base64 → STATE.logoLeft/Right)
   - Wheel visibility toggle (STATE.showWheels)
   ══════════════════════════════════════════ */

const uploadedImages = [];

/* ── Logo Upload ──
   Reads logo file as base64, stores in STATE,
   and syncs to audience so it appears without
   needing external image files.               */
function uploadLogo(event, side) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    if (side === 'left') {
      STATE.logoLeft = dataUrl;
      const prev = document.getElementById('logo-preview-left');
      if (prev) { prev.src = dataUrl; prev.style.display = 'inline-block'; }
    } else {
      STATE.logoRight = dataUrl;
      const prev = document.getElementById('logo-preview-right');
      if (prev) { prev.src = dataUrl; prev.style.display = 'inline-block'; }
    }
    syncState();
    fsToast('✔ Logo embedded: ' + file.name, 'ok');
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

/* ── Wheel visibility toggle ── */
function setWheelVisibility(show) {
  STATE.showWheels = show;
  const status = document.getElementById('wheel-vis-status');
  if (status) status.textContent = show ? 'Wheels: Visible ✔' : 'Wheels: Hidden ✕';
  document.getElementById('btn-show-wheels').style.opacity = show ? '1'   : '0.5';
  document.getElementById('btn-hide-wheels').style.opacity = show ? '0.5' : '1';
  syncState();
  fsToast(show ? '👁 Wheels shown on audience' : '🙈 Wheels hidden from audience', show ? 'ok' : 'warn');
}

function uploadImages(event) {
  Array.from(event.target.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      uploadedImages.push({ name: file.name, dataUrl: e.target.result });
      renderImageList();
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

function renderImageList() {
  const list = document.getElementById('img-list');
  list.innerHTML = '';
  uploadedImages.forEach((img, i) => {
    const item = document.createElement('div');
    item.className = 'img-item';
    item.innerHTML =
      '<img src="' + img.dataUrl + '" alt="">' +
      '<span title="' + img.name + '">' + img.name + '</span>' +
      '<button class="btn-show-img" onclick="showAudienceImage(' + i + ')">👁 Show</button>' +
      '<button class="btn-hide-img" onclick="hideAudienceImage()">✕ Hide</button>';
    list.appendChild(item);
  });
}

function showAudienceImage(i) {
  STATE.audienceImage = uploadedImages[i].dataUrl;
  syncState();
}

function hideAudienceImage() {
  STATE.audienceImage = null;
  syncState();
}


/* ══════════════════════════════════════════
   9. SOUND EFFECTS
   Synthesised with Web Audio API — no audio
   files needed, runs entirely offline.
   4 sounds: correct, wrong, spin, win
   ══════════════════════════════════════════ */

let audioCtx = null;
function getACtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound(type) {
  if (!document.getElementById('sound-enabled').checked) return;
  const vol = parseFloat(document.getElementById('volume-ctrl').value);
  const ctx = getACtx();

  if (type === 'correct') {
    // Rising arpeggio: C5 → E5 → G5
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(vol * 0.6, ctx.currentTime + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.18);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.1);
      o.stop(ctx.currentTime + i * 0.1 + 0.2);
    });

  } else if (type === 'wrong') {
    // Falling buzz
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.45);
    g.gain.setValueAtTime(vol * 0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.5);

  } else if (type === 'spin') {
    // Ratchet ticks decelerating over 3 seconds
    for (let i = 0; i < 22; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = 280 + Math.random() * 180;
      g.gain.setValueAtTime(vol * 0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * (0.04 + i * 0.007);
      o.start(t); o.stop(t + 0.035);
    }

  } else if (type === 'win') {
    // Triumphant fanfare
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.14;
      g.gain.setValueAtTime(vol * 0.55, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.38);
    });
  }
}


/* ══════════════════════════════════════════
   10. QUESTION BOARD
   Renders question tracker for Rounds 1-3.
   Click cycles: pending → answered → skipped → pending.
   Visual colour-coding for quick status at a glance.
   ══════════════════════════════════════════ */

function buildQuestionBoard() {
  const board = document.getElementById('question-board');
  board.innerHTML = '';

  QUESTION_DATA.forEach(round => {
    round.questions.forEach((q, qi) => {
      const key = 'r' + round.id + '-q' + qi;
      if (!STATE.questionStates[key]) STATE.questionStates[key] = 'pending';
    });

    const col = document.createElement('div');
    col.className = 'qboard-round';
    const title = document.createElement('h4');
    title.textContent = round.title;
    col.appendChild(title);

    round.questions.forEach((q, qi) => {
      const key  = 'r' + round.id + '-q' + qi;
      const item = document.createElement('div');
      item.className = 'q-item ' + STATE.questionStates[key];
      item.id = 'qitem-' + key;

      const dot = document.createElement('div');
      dot.className = 'q-status-dot';
      const lbl = document.createElement('span');
      lbl.textContent = q;

      item.appendChild(dot);
      item.appendChild(lbl);
      item.addEventListener('click', () => cycleQuestion(key));
      col.appendChild(item);
    });

    board.appendChild(col);
  });
}

function cycleQuestion(key) {
  const order = ['pending', 'answered', 'skipped'];
  const cur   = STATE.questionStates[key] || 'pending';
  const next  = order[(order.indexOf(cur) + 1) % order.length];
  STATE.questionStates[key] = next;
  const el = document.getElementById('qitem-' + key);
  if (el) el.className = 'q-item ' + next;
}


/* ══════════════════════════════════════════
   11. FAIL-SAFE CONTROL SYSTEM
   All functions here are admin-only.
   They operate on STATE directly and call
   syncState() to push changes to the audience.
   ══════════════════════════════════════════ */

/* ── Action History Log ──
   A richer log than scoreHistory — stores
   labelled snapshots of the full scoreline
   and turn for the undo log display.          */
const ACTION_LOG = [];   // { label, scoreA, scoreB, turn }
const MAX_LOG = 20;

function logAction(label) {
  ACTION_LOG.push({
    label,
    scoreA: STATE.scores.a,
    scoreB: STATE.scores.b,
    turn:   STATE.turn,
    round:  STATE.round,
    roundLabel: STATE.roundLabel,
  });
  if (ACTION_LOG.length > MAX_LOG) ACTION_LOG.shift();
  renderUndoLog();
}

function renderUndoLog() {
  const el = document.getElementById('fs-undo-log');
  if (!el) return;
  if (!ACTION_LOG.length) { el.innerHTML = 'No actions yet.'; return; }
  // Show last 5 in reverse order
  const recent = ACTION_LOG.slice(-5).reverse();
  el.innerHTML = recent.map((a, i) =>
    '<div class="undo-entry' + (i === 0 ? '' : ' reverted') + '">'
    + (i === 0 ? '► ' : '   ')
    + a.label + ' <span style="color:#555;font-size:9px">A:' + a.scoreA + ' B:' + a.scoreB + '</span>'
    + '</div>'
  ).join('');
}

/* ── 1. Manual Score Override ── */
function fsApplyScore() {
  const a = parseInt(document.getElementById('fs-score-a').value);
  const b = parseInt(document.getElementById('fs-score-b').value);
  if (isNaN(a) || isNaN(b)) { fsToast('⚠ Enter valid numbers for both scores.', 'warn'); return; }
  logAction('Manual override → A:' + a + ' B:' + b);
  STATE.scores.a = Math.max(0, a);
  STATE.scores.b = Math.max(0, b);
  syncState();
  fsToast('✔ Scores updated: A=' + STATE.scores.a + '  B=' + STATE.scores.b, 'ok');
}

/* Sync override inputs when scores change elsewhere */
function syncOverrideInputs() {
  const fa = document.getElementById('fs-score-a');
  const fb = document.getElementById('fs-score-b');
  if (fa) fa.value = STATE.scores.a;
  if (fb) fb.value = STATE.scores.b;
  const la = document.getElementById('fs-label-a');
  const lb = document.getElementById('fs-label-b');
  if (la) la.textContent = STATE.names.a || 'Team A';
  if (lb) lb.textContent = STATE.names.b || 'Team B';
}

/* ── 2. Enhanced Undo ── */
function fsUndo() {
  if (!ACTION_LOG.length) { fsToast('Nothing to undo.', 'warn'); return; }
  const snap = ACTION_LOG.pop();
  STATE.scores.a = snap.scoreA;
  STATE.scores.b = snap.scoreB;
  STATE.turn     = snap.turn;
  // Also restore round if it was changed
  if (snap.round !== undefined) {
    STATE.round      = snap.round;
    STATE.roundLabel = snap.roundLabel;
  }
  syncState();
  syncOverrideInputs();
  renderUndoLog();
  fsToast('↩ Undone: ' + snap.label, 'ok');
}

function fsUndoMultiple(n) {
  if (!ACTION_LOG.length) { fsToast('Nothing to undo.', 'warn'); return; }
  let snap;
  for (let i = 0; i < n && ACTION_LOG.length; i++) snap = ACTION_LOG.pop();
  if (!snap) return;
  STATE.scores.a = snap.scoreA;
  STATE.scores.b = snap.scoreB;
  STATE.turn     = snap.turn;
  syncState();
  syncOverrideInputs();
  renderUndoLog();
  fsToast('↩ Undone ' + n + ' actions → A:' + snap.scoreA + ' B:' + snap.scoreB, 'ok');
}

/* Override addScore to also log to ACTION_LOG */
const _origAddScore = addScore;
window.addScore = function(team, delta) {
  const label = (delta > 0 ? '+' : '') + delta + ' → Team ' + team.toUpperCase();
  logAction(label);
  _origAddScore(team, delta);
  syncOverrideInputs();
};

/* ── 3. Emergency Round Override ── */
function fsForceRound() {
  const val = document.getElementById('fs-round-select').value;
  const r   = isNaN(val) ? val : parseInt(val);
  logAction('Force round → ' + (ROUND_LABELS[r] || r));
  setRound(r);
  fsToast('🎬 Round forced: ' + STATE.roundLabel, 'ok');
}

/* ── 4. Timer Emergency ── */
function fsSetTimer() {
  const v = parseInt(document.getElementById('fs-timer-val').value);
  if (isNaN(v) || v < 1) { fsToast('⚠ Invalid timer value.', 'warn'); return; }
  clearInterval(timerInterval);
  STATE.timerRunning = false;
  STATE.timerVal     = v;
  STATE.timerDefault = v;
  document.getElementById('timer-set').value = v;
  renderAdminTimer();
  syncState();
  fsToast('⏱ Timer set to ' + v + 's', 'ok');
}

function fsPauseTimer() {
  pauseTimer();
  fsToast('⏸ Timer force-paused', 'warn');
}

function fsAddTime(seconds) {
  logAction('+' + seconds + 's added to timer');
  STATE.timerVal = Math.max(1, STATE.timerVal + seconds);
  renderAdminTimer();
  syncState();
  fsToast('+' + seconds + 's added → ' + STATE.timerVal + 's remaining', 'ok');
}

/* ── 5. Image Emergency ── */
function fsRefreshImageSelect() {
  const sel = document.getElementById('fs-img-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select uploaded image —</option>';
  uploadedImages.forEach((img, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = img.name;
    sel.appendChild(opt);
  });
}

function fsShowImage() {
  const sel = document.getElementById('fs-img-select');
  if (!sel || sel.value === '') { fsToast('⚠ Select an image first.', 'warn'); return; }
  showAudienceImage(parseInt(sel.value));
  fsToast('👁 Image shown on audience screen', 'ok');
}

function fsHideImage() {
  hideAudienceImage();
  fsToast('🚫 Image hidden', 'warn');
}

function fsClearScreen() {
  STATE.audienceImage   = null;
  STATE.showWheelBanner = false;
  syncState();
  fsToast('🧹 Audience screen cleared', 'ok');
}

/* ── 6. Reload Audience Screen ──
   Closes the popup and re-opens it, re-injecting
   the current STATE so nothing is lost.           */
function fsReloadAudience() {
  safeConfirm(
    'Reload Audience Screen?',
    'The projector window will briefly flash. Scores and state will be preserved.',
    () => {
      if (audienceWin && !audienceWin.closed) audienceWin.close();
      audienceWin = null;
      setTimeout(() => {
        openAudienceWindow();
        fsToast('🔄 Audience screen reloaded', 'ok');
      }, 300);
    }
  );
}

/* ── Hide wheel banner emergency ── */
function fsHideWheelBanner() {
  STATE.showWheelBanner = false;
  syncState();
  fsToast('🌀 Wheel banner hidden', 'warn');
}

/* ── Reset ALL scores (requires confirmation) ── */
function fsResetScores() {
  safeConfirm(
    '💣 RESET ALL SCORES?',
    'This will set both team scores to 0 and cannot be undone via the undo system.',
    () => {
      logAction('FULL SCORE RESET');
      STATE.scores.a = 0;
      STATE.scores.b = 0;
      syncState();
      syncOverrideInputs();
      fsToast('💣 All scores reset to 0', 'warn');
    }
  );
}

/* ══════════════════════════════════════════
   FAIL-SAFE UTILITIES
   ══════════════════════════════════════════ */

/* ── Custom confirmation modal ──
   Shows an inline modal instead of browser confirm().
   cb is called only on confirm.                      */
function safeConfirm(title, message, cb) {
  const overlay  = document.getElementById('fs-modal-overlay');
  const titleEl  = document.getElementById('fs-modal-title');
  const msgEl    = document.getElementById('fs-modal-msg');
  const confirmBtn = document.getElementById('fs-modal-confirm');
  const cancelBtn  = document.getElementById('fs-modal-cancel');

  titleEl.textContent = title;
  msgEl.textContent   = message;
  overlay.style.display = 'flex';

  // Clean up any old listeners
  const newConfirm = confirmBtn.cloneNode(true);
  const newCancel  = cancelBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

  newConfirm.addEventListener('click', () => {
    overlay.style.display = 'none';
    cb();
  });
  newCancel.addEventListener('click', () => {
    overlay.style.display = 'none';
    fsToast('✕ Action cancelled', 'cancel');
  });

  // Close on overlay click (outside modal)
  overlay.onclick = e => { if (e.target === overlay) { overlay.style.display = 'none'; } };
}

/* ── Toast notification ──
   Small non-blocking notification for the admin.
   Never appears on the audience screen.           */
let toastTimer = null;
function fsToast(msg, type) {
  let el = document.getElementById('fs-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fs-toast';
    el.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9998',
      'padding:10px 20px', 'border-radius:10px', 'font-size:13px',
      'font-family:Tajawal,sans-serif', 'font-weight:700',
      'box-shadow:0 4px 24px rgba(0,0,0,0.6)',
      'transition:opacity 0.3s,transform 0.3s',
      'pointer-events:none', 'max-width:340px',
    ].join(';');
    document.body.appendChild(el);
  }

  const styles = {
    ok:     'background:#003D12;color:#00E676;border:1px solid #00E676',
    warn:   'background:#3A1800;color:#FF9D45;border:1px solid #FF6D00',
    cancel: 'background:#1A1F38;color:#8892B0;border:1px solid #2A2F55',
  };
  el.style.cssText += ';' + (styles[type] || styles.ok);
  el.textContent = msg;
  el.style.opacity = '1';
  el.style.transform = 'translateY(0)';

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
  }, 2800);
}


/* ══════════════════════════════════════════
   12. INIT
   ══════════════════════════════════════════ */

window.addEventListener('DOMContentLoaded', () => {
  buildQuestionBoard();
  initWheels();

  // Init wheel visibility button states
  document.getElementById('btn-show-wheels').style.opacity = '1';
  document.getElementById('btn-hide-wheels').style.opacity = '0.5';

  // Init player rosters
  renderRoster('a');
  renderRoster('b');

  // Enter key on player input fields
  ['a','b'].forEach(t => {
    const inp = document.getElementById('player-input-' + t);
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer(t); });
  });

  // Close player picker on overlay click
  const ppModal = document.getElementById('player-picker-modal');
  if (ppModal) ppModal.addEventListener('click', e => { if (e.target === ppModal) closePP(); });

  STATE.timerDefault = STATE.timerVal;
  syncState();
  syncOverrideInputs();
  renderUndoLog();

  // Show speed section by default
  document.getElementById('speed-q-section').style.display = '';
  document.getElementById('r4-section').style.display = 'none';
  const firstBtn = document.querySelector('.btn-round');
  if (firstBtn) firstBtn.classList.add('active');

  // Name inputs → auto sync + update fail-safe labels
  document.getElementById('name-a').addEventListener('input', () => { syncState(); syncOverrideInputs(); });
  document.getElementById('name-b').addEventListener('input', () => { syncState(); syncOverrideInputs(); });

  // Keyboard shortcuts (admin window)
  document.addEventListener('keydown', e => {
    // Escape = close modal
    if (e.key === 'Escape') {
      const overlay = document.getElementById('fs-modal-overlay');
      if (overlay) overlay.style.display = 'none';
    }
    // Space = toggle timer (not when typing in an input)
    if (e.key === ' ' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      STATE.timerRunning ? pauseTimer() : startTimer();
    }
    // Ctrl+Z = undo
    if (e.key === 'z' && e.ctrlKey) { e.preventDefault(); fsUndo(); }
    // F = fullscreen on audience
    if ((e.key === 'f' || e.key === 'F') && audienceWin && !audienceWin.closed) {
      audienceWin.document.documentElement.requestFullscreen().catch(() => {});
    }
  });

  // Patch uploadImages to refresh image select in fail-safe panel
  const _origUploadImages = uploadImages;
  window.uploadImages = function(event) {
    _origUploadImages(event);
    // Refresh fail-safe image select after files load
    setTimeout(fsRefreshImageSelect, 300);
  };
});

/* Expose all fail-safe functions globally */
window.fsApplyScore      = fsApplyScore;
window.fsUndo            = fsUndo;
window.fsUndoMultiple    = fsUndoMultiple;
window.fsForceRound      = fsForceRound;
window.fsSetTimer        = fsSetTimer;
window.fsPauseTimer      = fsPauseTimer;
window.fsAddTime         = fsAddTime;
window.fsShowImage       = fsShowImage;
window.fsHideImage       = fsHideImage;
window.fsClearScreen     = fsClearScreen;
window.fsReloadAudience  = fsReloadAudience;
window.fsHideWheelBanner = fsHideWheelBanner;
window.fsResetScores     = fsResetScores;
window.uploadLogo          = uploadLogo;
window.setWheelVisibility  = setWheelVisibility;
window.addPlayer           = addPlayer;
window.removePlayer        = removePlayer;
window.closePP             = closePP;
