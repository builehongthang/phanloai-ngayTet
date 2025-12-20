/* Muôn tâu Bệ Hạ: bản này bỏ HTML5 drag-drop để có "hiệu ứng kéo di chuyển" rõ ràng.
   - PointerDown: tạo ghost bay theo tay
   - PointerMove: ghost bám theo con trỏ + highlight bin
   - PointerUp: ghost bay vào dropzone (animate) + item biến mất
   - Background: pháo hoa bắn liên tục bằng canvas
*/

const BINS = [
  { id:"food",  name:"Đồ ăn ngày Tết", icon:"🍱", hint:"Bánh, mứt, hạt..." },
  { id:"decor", name:"Đồ trang trí",   icon:"🏮", hint:"Đèn lồng, câu đối, dây treo..." },
];

const ITEMS = [
  { id:"thanTai",   label:"Thần Tài",   cat:"decor", img:"assets/items/than-tai.png" },
  { id:"phaohoa",   label:"Pháo hoa",   cat:"decor", img:"assets/items/phao-hoa.png" },
  { id:"denlong",   label:"Lồng Đèn",   cat:"decor", img:"assets/items/long-den.png" },
  { id:"mutTet",    label:"Mứt Tết",    cat:"food",  img:"assets/items/mut-tet.png" },
  { id:"banhchung", label:"Bánh chưng", cat:"food",  img:"assets/items/banh-chung.png" },
  { id:"banhtet",   label:"Bánh tét",   cat:"food",  img:"assets/items/banh-tet.png" },
  { id:"daytreo",   label:"Cây quất",   cat:"decor", img:"assets/items/cay-quat.png" },
  { id:"baolixi",   label:"Bao lì xì",  cat:"decor", img:"assets/items/bao-li-xi.png" },
  { id:"vang",      label:"Vàng tài lộc",cat:"decor",img:"assets/items/vang.png" },
  { id:"caudoi",    label:"Câu đối",    cat:"decor", img:"assets/items/cau-doi.png" },
  { id:"hatdua",    label:"Hạt dưa",    cat:"food",  img:"assets/items/hat-dua.png" },
  { id:"hoadao",    label:"Hoa đào",    cat:"decor", img:"assets/items/hoa-dao.png" },
];

const $ = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];

const els = {
  itemsGrid: $("#itemsGrid"),
  bins: $("#bins"),
  score: $("#score"),
  combo: $("#combo"),
  correct: $("#correct"),
  total: $("#total"),
  toast: $("#toast"),

  shuffleBtn: $("#shuffleBtn"),
  resetBtn: $("#resetBtn"),
  hintBtn: $("#hintBtn"),

  winModal: $("#winModal"),
  mScore: $("#mScore"),
  mCombo: $("#mCombo"),
  playAgainBtn: $("#playAgainBtn"),
  closeModalBtn: $("#closeModalBtn"),

  bgFx: $("#bgFx")
};

let state;
let dragging = null; // { item, itemEl, ghostEl, startX, startY }
let rafMove = null;
let lastOverBin = null;

function initState(){
  state = {
    score: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    total: ITEMS.length,
    placed: new Set(),
  };
  els.total.textContent = state.total;
  renderHud();
  buildBins();
  buildItems();
}

function renderHud(){
  els.score.textContent = state.score;
  els.combo.textContent = state.combo;
  els.correct.textContent = state.correct;
}

function showToast(msg){
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>els.toast.classList.remove("show"), 1050);
}

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function buildBins(){
  els.bins.innerHTML = "";
  for(const b of BINS){
    const div = document.createElement("div");
    div.className = "bin";
    div.dataset.bin = b.id;
    div.innerHTML = `
      <div class="row">
        <h3>${b.icon} ${b.name}</h3>
        <div class="hint">${b.hint}</div>
      </div>
      <div class="dropzone"></div>
    `;
    els.bins.appendChild(div);
  }
}

function makeItemEl(item){
  const div = document.createElement("div");
  div.className = "item";
  div.dataset.item = item.id;
  div.dataset.cat = item.cat;

  const hasImg = item.img && item.img.trim().length>0;
  div.innerHTML = `
    <div class="badge">Tết</div>
    <div class="thumb">
      ${hasImg ? `<img src="${item.img}" alt="${item.label}">` : `<div class="emoji">${item.emoji}</div>`}
    </div>
    <div class="label">${item.label}</div>
  `;

  div.addEventListener("pointerdown", (e)=>startDrag(e, item, div));
  return div;
}

function buildItems(){
  els.itemsGrid.innerHTML = "";
  const list = shuffle(ITEMS).filter(it=>!state.placed.has(it.id));
  for(const it of list){
    els.itemsGrid.appendChild(makeItemEl(it));
  }
}

function startDrag(e, item, itemEl){
    e.preventDefault();            // chặn select xanh
  e.stopPropagation();
  if(state.placed.has(item.id)) return;

  itemEl.setPointerCapture?.(e.pointerId);
  itemEl.classList.add("picked");

  // create ghost
  const ghostWrap = document.createElement("div");
  ghostWrap.className = "drag-ghost";
  const clone = itemEl.cloneNode(true);
  clone.classList.remove("picked");
  ghostWrap.appendChild(clone);
  document.body.appendChild(ghostWrap);

  dragging = {
    item, itemEl,
    ghostEl: ghostWrap,
    x: e.clientX,
    y: e.clientY
  };

  moveGhost(e.clientX, e.clientY);
  showToast(`🖐️ Đang cầm: ${item.label}`);

  window.addEventListener("pointermove", onMove, { passive:true });
  window.addEventListener("pointerup", onUp, { passive:true, once:true });
}

function onMove(e){
  if(!dragging) return;
  dragging.x = e.clientX;
  dragging.y = e.clientY;

  if(!rafMove){
    rafMove = requestAnimationFrame(()=>{
      rafMove = null;
      moveGhost(dragging.x, dragging.y);
      updateOverBin(dragging.x, dragging.y);
    });
  }
}

function moveGhost(x,y){
  if(!dragging) return;
  dragging.ghostEl.style.left = x + "px";
  dragging.ghostEl.style.top  = y + "px";
}

function updateOverBin(x,y){
  const el = document.elementFromPoint(x,y);
  const bin = el?.closest?.(".bin") || null;

  if(lastOverBin && lastOverBin !== bin){
    lastOverBin.classList.remove("over");
  }
  if(bin){
    bin.classList.add("over");
  }
  lastOverBin = bin;
}

function onUp(e){
  window.removeEventListener("pointermove", onMove);

  if(!dragging) return;

  const { item, itemEl, ghostEl } = dragging;
  itemEl.classList.remove("picked");

  if(lastOverBin) lastOverBin.classList.remove("over");

  const dropTarget = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".bin");
  if(!dropTarget){
    // fail -> return animation (small snap back)
    ghostEl.style.transition = "transform .12s ease, opacity .12s ease";
    ghostEl.style.transform = "translate(-50%,-50%) scale(.94)";
    ghostEl.style.opacity = "0";
    setTimeout(()=>ghostEl.remove(), 140);
    dragging = null;
    showToast("Thả vào khung bên phải nha 😼");
    return;
  }

  const binId = dropTarget.dataset.bin;
  handleDropWithAnimation(item, itemEl, ghostEl, dropTarget, binId);
  dragging = null;
}

function handleDropWithAnimation(item, itemEl, ghostEl, binEl, binId){
  if(item.cat !== binId){
    state.combo = 0;
    state.score = Math.max(0, state.score - 3);
    renderHud();
    binEl.classList.add("bad");
    setTimeout(()=>binEl.classList.remove("bad"), 450);

    ghostEl.style.transition = "transform .12s ease, opacity .12s ease";
    ghostEl.style.transform = "translate(-50%,-50%) rotate(-6deg) scale(.92)";
    ghostEl.style.opacity = "0";
    setTimeout(()=>ghostEl.remove(), 140);

    showToast("❌ Sai nhóm rồi, thử lại!");
    return;
  }

  // correct
  state.placed.add(item.id);
  state.correct += 1;

  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  const gain = 10 + Math.min(10, state.combo);
  state.score += gain;
  renderHud();

  binEl.classList.add("ok");
  setTimeout(()=>binEl.classList.remove("ok"), 380);

  // animate ghost flying into dropzone
  const dz = binEl.querySelector(".dropzone");
  const dzRect = dz.getBoundingClientRect();
  const tx = dzRect.left + 26 + (dz.children.length % 7) * 54; // nice packing
  const ty = dzRect.top + 30 + Math.floor(dz.children.length / 7) * 54;

  ghostEl.style.transition = "left .18s ease, top .18s ease, transform .18s ease, opacity .18s ease";
  ghostEl.style.left = tx + "px";
  ghostEl.style.top  = ty + "px";
  ghostEl.style.transform = "translate(-50%,-50%) scale(.6)";
  ghostEl.style.opacity = "0.15";

  // remove original item with fade
  itemEl.classList.add("disabled");
  itemEl.style.opacity = "0";
  itemEl.style.transform = "scale(.9)";
  setTimeout(()=> itemEl.remove(), 180);

  setTimeout(()=>{
    ghostEl.remove();
    addMiniToBin(item, dz);
    showToast(`✅ Chuẩn! +${gain} điểm`);
    buildItems(); // reflow remaining

    if(state.correct === state.total){
      win();
    }
  }, 190);
}

function addMiniToBin(item, dz){
  const mini = document.createElement("div");
  mini.className = "mini";
  const hasImg = item.img && item.img.trim().length>0;
  mini.innerHTML = hasImg
    ? `<img src="${item.img}" alt="${item.label}">`
    : `<div class="emoji" style="font-size:28px">${item.emoji}</div>`;
  mini.title = item.label;
  dz.appendChild(mini);
}

function hint(){
  const left = ITEMS.filter(it=>!state.placed.has(it.id));
  if(!left.length){ showToast("Hết đồ để gợi ý 😎"); return; }
  const pick = left[Math.floor(Math.random()*left.length)];
  const bin = $(`.bin[data-bin="${pick.cat}"]`);
  bin?.classList.add("over");
  showToast(`Gợi ý: "${pick.label}" thuộc nhóm "${BINS.find(b=>b.id===pick.cat).name}"`);
  setTimeout(()=>bin?.classList.remove("over"), 900);
}

function win(){
  els.mScore.textContent = state.score;
  els.mCombo.textContent = state.bestCombo;
  els.winModal.classList.add("show");
  els.winModal.setAttribute("aria-hidden","false");
  // fireworks already running -> add a burst
  bgFireworks.burst(14);
}

function closeModal(){
  els.winModal.classList.remove("show");
  els.winModal.setAttribute("aria-hidden","true");
}

els.shuffleBtn.addEventListener("click", ()=>buildItems());
els.resetBtn.addEventListener("click", ()=>initState());
els.hintBtn.addEventListener("click", hint);
els.playAgainBtn.addEventListener("click", ()=>{ closeModal(); initState(); });
els.closeModalBtn.addEventListener("click", closeModal);

/* ------------------- FIREWORKS BACKGROUND ------------------- */
function makeFireworks(canvas){
  const ctx = canvas.getContext("2d");
  let W=0,H=0,dpr=1;
  function resize(){
    dpr = window.devicePixelRatio || 1;
    W = canvas.width  = Math.floor(window.innerWidth * dpr);
    H = canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  }
  window.addEventListener("resize", resize);
  resize();

  const sparks = [];
  const rockets = [];

  function rand(a,b){ return a + Math.random()*(b-a); }

  function launch(){
  const count = Math.floor(rand(1, 3)); // 👈 mỗi lần bắn 1–3 quả
  for(let i=0;i<count;i++){
    rockets.push({
      x: rand(0, W),
      y: H + rand(20, 120)*dpr,
      vx: rand(-1.2, 1.2)*dpr,
      vy: rand(-14, -22)*dpr,
      targetY: rand(H*0.12, H*0.6),
      hue: Math.floor(rand(0,360)),
      boom: false
    });
  }
}




  function explode(r){
  const n = Math.floor(rand(80, 130)); // 🔥 TIA NHIỀU HƠN
  for(let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2;
    const sp = rand(3.2, 9.5)*dpr;     // 🔥 BAY XA HƠN
    sparks.push({
      x: r.x, y: r.y,
      vx: Math.cos(a)*sp,
      vy: Math.sin(a)*sp,
      g: rand(0.06, 0.12)*dpr,
      drag: 0.985,
      life: rand(70, 120),             // 🔥 SỐNG LÂU HƠN
      hue: (r.hue + rand(-20,20) + 360) % 360,
      a: 1
    });
  }
}


  function burst(times=4){
    for(let i=0;i<times;i++){
      const r = {
        x: rand(W*0.2, W*0.8),
        y: rand(H*0.15, H*0.5),
        hue: Math.floor(rand(0,360))
      };
      explode(r);
    }
  }

  let t=0;
  function tick(){
    requestAnimationFrame(tick);

    // subtle trail
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillRect(0,0,W,H);

    // auto launch
    t++;
    if(t % 10 === 0) launch();

    // rockets
    for(let i=rockets.length-1;i>=0;i--){
      const r = rockets[i];
      r.life -= 1;
      r.x += r.vx;
      r.y += r.vy;
      r.vy += 0.18*dpr;

      // rocket glow
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = `hsla(${r.hue} 95% 62% / 0.95)`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2.2*dpr, 0, Math.PI*2);
      ctx.fill();

      if((r.y <= r.targetY || r.vy >= 0) && !r.boom){
  r.boom = true;
  explode(r);
  rockets.splice(i,1);
}
    }

    // sparks
    for(let i=sparks.length-1;i>=0;i--){
      const p = sparks[i];
      p.life -= 1;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.a = Math.max(0, p.life/70);

      ctx.globalAlpha = p.a;
      ctx.save();
ctx.globalAlpha = p.a;

// 🔥 HALO ÁNH SÁNG – PHÁO HOA TO & RỰC
ctx.shadowBlur = 18 * dpr;
ctx.shadowColor = `hsla(${p.hue},100%,65%,0.8)`;

ctx.fillStyle = `hsla(${p.hue},100%,65%,1)`;
ctx.beginPath();
ctx.arc(p.x, p.y, 2.6 * dpr, 0, Math.PI * 2);
ctx.fill();

ctx.restore();


      if(p.life <= 0) sparks.splice(i,1);
    }

    ctx.globalAlpha = 1;
  }

  // start with transparent base so gradient still visible
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0,0,W,H);
  tick();

  return { burst };
}

const bgFireworks = makeFireworks(els.bgFx);

/* start */
initState();
