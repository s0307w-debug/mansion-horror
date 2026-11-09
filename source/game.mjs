import { createWorld, createState, CRESTS, NOTES, EXIT, SIZE, ROOMS, START, distance, isSafe, roomName, isTrigger, moveBody, findPath, lineOfSight, nearbyInteraction, canEscape } from './world.mjs';
import { makeTextures } from './textures.mjs';
import { CanvasRenderer } from './render-canvas.mjs';
import { Soundscape } from './audio.mjs';

const $ = id => document.getElementById(id);
const world = createWorld(), sound = new Soundscape();
let state = createState(), renderer, lastTime = 0, lastHUD = 0, lastStep = 0, lastEnemyStep = 0;
let subtitleUntil = 0, toastUntil = 0, mapFromTitle = false, previousMode = 'playing', sprintLock = false;
let settings = { quality: 'auto', sensitivity: 1, volume: .58, muted: false };
try { settings = { ...settings, ...JSON.parse(localStorage.getItem('primodori-settings-v3') || '{}') }; } catch {}
sound.setVolume(settings.volume); sound.setMuted(settings.muted);
const keys = new Set(), input = { x: 0, z: 0, stick: null, look: null, lx: 0, ly: 0 };
function saveSettings() { try { localStorage.setItem('primodori-settings-v3', JSON.stringify(settings)); } catch {} }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(text, seconds = 4) { $('toast').textContent = text; toastUntil = state.elapsed + seconds; }
function subtitle(text, seconds = 4) { $('subtitle').textContent = text; subtitleUntil = state.elapsed + seconds; }
function resetInput() {
  keys.clear(); input.x = input.z = 0; input.stick = input.look = null; sprintLock = false; state.sprinting = false; state.moving = false;
  $('stick-nub').style.transform = ''; $('run').setAttribute('aria-pressed', 'false');
}
function showModal(title, html, actions, kicker = '館の記録') {
  previousMode = state.mode; state.mode = 'paused'; resetInput(); void sound.pause();
  $('modal-title').textContent = title; $('modal-kicker').textContent = kicker; $('modal-content').innerHTML = html;
  const parent = $('modal-actions'); parent.replaceChildren();
  for (const [text, action] of actions) { const b = document.createElement('button'); b.textContent = text; b.onclick = action; parent.append(b); }
  $('modal').hidden = false; parent.querySelector('button')?.focus({ preventScroll: true });
}
function closeModal() {
  if (state.outcome) { titleGame(); return; }
  $('modal').hidden = true; resetInput(); state.mode = $('title-screen').hidden ? 'playing' : 'title';
  if (state.mode === 'playing') { void sound.resume(); lastTime = performance.now(); }
}
function pauseGame() {
  if (state.mode !== 'playing') return;
  showModal('一時停止', '<p>ゆっくり息を整えてください。\n止めている間、プリモドリも動きません。</p>', [
    ['探索に戻る', closeModal], ['操作と設定', () => showSettings(false)], ['最初から', () => confirmRestart()]
  ], '雨音だけが、聞こえる。');
}
function confirmRestart() { showModal('最初から探索する', '<p>集めた紋章を戻し、玄関ホールから始めます。</p>', [['やり直す', startGame], ['戻る', () => { closeModal(); pauseGame(); }]], 'もう一度、館の中へ'); }
async function startGame() {
  void sound.unlock();
  state = createState(); state.mode = 'playing'; lastStep = lastEnemyStep = lastHUD = 0; resetInput();
  $('title-screen').hidden = true; $('modal').hidden = true; $('caught').hidden = true; $('hud').hidden = false;
  $('glass-flash').classList.remove('active'); $('danger').style.opacity = '0';
  $('subtitle').textContent = ''; $('toast').textContent = ''; subtitleUntil = toastUntil = 0;
  $('flashlight').setAttribute('aria-pressed', 'true');
  lastTime = performance.now(); await sound.resume();
  toast('三つの紋章を探そう。玄関の置き手紙を調べると手がかりがある。', 7);
  updateHUD();
}
function readNote(note) {
  state.read.add(note.id);
  showModal(note.title, `<p class="note-body">${escapeHTML(note.text)}</p>`, [['手紙を閉じる', closeModal]], '古い紙に、震える文字');
}
function interact() {
  if (state.mode !== 'playing') return;
  const target = nearbyInteraction(state); if (!target) return;
  if (target.kind === 'crest') {
    state.collected.add(target.id); sound.collect(); toast(`${target.name}を手に入れた。${state.collected.size === 3 ? '玄関の錠を開けられる。' : `残り${3 - state.collected.size}つ。`}`, 5);
    if (state.collected.size === 3) subtitle('三つ、そろった。玄関へ戻れ。', 5);
    updateHUD();
  } else if (target.kind === 'note') readNote(target);
  else if (canEscape(state)) winGame();
  else {
    const remaining = CRESTS.filter(c => !state.collected.has(c.id)).map(c => `${c.symbol} ${c.name}：${c.room}`).join('\n');
    showModal('三つのくぼみがある錠', `<p>玄関には鍵穴がない。\n三つの紋章をはめる場所がある。\n\nまだ見つかっていない紋章\n${escapeHTML(remaining)}</p>`, [['館を調べる', closeModal]], '玄関の大扉');
  }
}
function triggerChase() {
  state.phase = 'chase'; state.triggeredAt = state.elapsed; state.voiceAt = state.elapsed + 1.1; state.shake = 1.1;
  sound.shatter(); $('glass-flash').classList.add('active');
  subtitle('ガラスが、割れた。', 1.6); toast('プリモドリが来る！ 走って距離を取れ。', 5);
}
function caughtGame() {
  state.mode = 'caught'; state.outcome = 'caught'; resetInput(); sound.death(); $('caught').hidden = false; $('subtitle').textContent = '';
  // ゲームの状態とともに進める演出時間。画面非表示で突然再開しない。
  state.caughtAt = performance.now();
}
function deathDialog() {
  $('caught').hidden = true;
  showModal('甘い悪夢に、捕まった。', '<p>プリモドリに捕まってしまった。\n走れば引き離せる。東の回廊を出て、礼拝室の灯りへ。</p>', [
    ['もう一度、館へ', startGame], ['操作と設定', () => showSettings(false)], ['タイトルへ', titleGame]
  ], 'プリンにしちゃうぞ。');
}
function winGame() {
  state.mode = 'won'; state.outcome = 'won'; resetInput();
  showModal('館の扉が、開いた。', `<p>三つの紋章が重なり、玄関の錠が外れた。\n雨の匂いがする。あなたは洋館を抜け出した。\n\nそれでも背後から、あの声が聞こえる。\n\n「……また、プリンにしちゃうぞ。」</p>`, [['もう一度、探索する', startGame], ['タイトルへ', titleGame]], '脱出成功');
  // 結末の和音だけ再開し、怪物の音は止めておく。
  void sound.resume(); sound.win();
}
function titleGame() {
  state = createState(); resetInput(); $('modal').hidden = true; $('caught').hidden = true; $('hud').hidden = true; $('title-screen').hidden = false;
  $('danger').style.opacity = '0'; $('glass-flash').classList.remove('active'); void sound.pause();
}
function showSettings(fromTitle = false) {
  const returnToDeath = state.outcome === 'caught';
  mapFromTitle = fromTitle;
  showModal('操作と設定', `
    <dl class="controls-list"><dt>スマートフォン</dt><dd>左のスティックで移動。画面右側をなぞると視点が動きます。</dd><dt>走る</dt><dd>「走る」を押すと切り替え。もう一度押すと歩きます。</dd><dt>調べる</dt><dd>紋章・手紙・玄関に近づき、表示されたボタンを押します。</dd><dt>パソコン</dt><dd>W A S Dで移動。ドラッグ・矢印で視点。Eで調べる。Shiftで走る。Fで電灯。Mで地図。Escで一時停止。</dd></dl>
    <label class="settings-row">画質<select id="quality"><option value="auto">標準</option><option value="high">高画質</option><option value="low">軽くする</option></select></label>
    <label class="settings-row">視点の速さ<input id="sensitivity" type="range" min="0.4" max="1.8" step="0.1" value="${settings.sensitivity}"></label>
    <label class="settings-row">音量<input id="volume" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></label>
    <label class="settings-row">消音<input id="mute" type="checkbox" ${settings.muted ? 'checked' : ''}></label>
    <p>横向きにすると館を広く見渡せます。時間制限はありません。手紙・地図・設定を開いている間は追跡も止まります。</p>
  `, [[fromTitle ? 'タイトルへ戻る' : '探索に戻る', () => {
    if (returnToDeath) { deathDialog(); return; }
    closeModal(); if (fromTitle) { state.mode = 'title'; void sound.pause(); }
    else if (!$('title-screen').hidden) state.mode = 'title';
  }]], '自分のペースで、探索する');
  $('quality').value = settings.quality;
  $('quality').onchange = e => { settings.quality = e.target.value; renderer?.setQuality(settings.quality); saveSettings(); };
  $('sensitivity').oninput = e => { settings.sensitivity = Number(e.target.value); saveSettings(); };
  $('volume').oninput = e => { settings.volume = Number(e.target.value); sound.setVolume(settings.volume); saveSettings(); };
  $('mute').onchange = e => { settings.muted = e.target.checked; sound.setMuted(settings.muted); saveSettings(); };
}
function showMap() {
  if (state.mode !== 'playing') return;
  showModal('洋館の見取り図', '<canvas id="map-canvas" width="640" height="640" aria-label="現在地と紋章の場所を示す洋館の地図"></canvas><div class="legend"><span>● あなた</span><span>✧ 残りの紋章</span><span>緑の部屋：安全</span></div>', [['地図を閉じる', closeModal]], '迷ったら、立ち止まれ');
  const canvas = $('map-canvas'), c = canvas.getContext('2d'), scale = 17, offset = 48;
  c.fillStyle = '#111b14'; c.fillRect(0, 0, 640, 640);
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) if (!world.cells[z][x]) {
    c.fillStyle = isSafe(x + .5, z + .5) ? '#3c5638' : '#4b5142'; c.fillRect(offset + x * scale, offset + z * scale, scale + .3, scale + .3);
  }
  c.font = '15px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ded8b8';
  for (const r of ROOMS) c.fillText(r.name, offset + (r.x + r.w / 2) * scale, offset + (r.z + r.h / 2) * scale);
  c.font = '23px serif';
  for (const crest of CRESTS) if (!state.collected.has(crest.id)) { c.fillStyle = crest.color; c.fillText('✧', offset + crest.x * scale, offset + crest.z * scale + 8); }
  const p = state.player, px = offset + p.x * scale, pz = offset + p.z * scale;
  c.fillStyle = '#e5e8b0'; c.beginPath(); c.arc(px, pz, 5, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#eff2bb'; c.lineWidth = 2; c.beginPath(); c.moveTo(px, pz); c.lineTo(px + Math.cos(p.yaw) * 18, pz + Math.sin(p.yaw) * 18); c.stroke();
  c.font = '12px sans-serif'; c.fillStyle = '#cbb782'; c.fillText('玄関・脱出口', offset + EXIT.x * scale, offset + 30.3 * scale);
}

// 同時タッチを別々のポインターとして管理し、視点操作で移動が途切れないようにする。
const stick = $('joystick');
function moveStick(e) {
  const rect = stick.getBoundingClientRect(), x = e.clientX - rect.left - rect.width / 2, z = e.clientY - rect.top - rect.height / 2;
  const max = rect.width * .32, len = Math.max(max, Math.hypot(x, z)); input.x = x / len; input.z = -z / len;
  $('stick-nub').style.transform = `translate(${input.x * max}px,${-input.z * max}px)`;
}
stick.addEventListener('pointerdown', e => {
  if (state.mode !== 'playing' || input.stick !== null) return;
  e.preventDefault(); input.stick = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e);
});
stick.addEventListener('pointermove', e => { if (e.pointerId === input.stick) { e.preventDefault(); moveStick(e); } });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(event, e => { if (e.pointerId === input.stick) { input.stick = null; input.x = input.z = 0; $('stick-nub').style.transform = ''; } });
$('viewport').addEventListener('pointerdown', e => {
  if (state.mode !== 'playing' || input.look !== null) return;
  e.preventDefault(); input.look = e.pointerId; input.lx = e.clientX; input.ly = e.clientY; $('viewport').setPointerCapture(e.pointerId);
});
$('viewport').addEventListener('pointermove', e => {
  if (e.pointerId !== input.look || state.mode !== 'playing') return;
  const scale = .004 * settings.sensitivity;
  state.player.yaw += (e.clientX - input.lx) * scale;
  state.player.pitch = Math.max(-.75, Math.min(.75, state.player.pitch - (e.clientY - input.ly) * scale));
  input.lx = e.clientX; input.ly = e.clientY;
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('viewport').addEventListener(event, e => { if (e.pointerId === input.look) input.look = null; });
$('run').onclick = () => { if (state.mode === 'playing') { sprintLock = !sprintLock; $('run').setAttribute('aria-pressed', String(sprintLock)); } };
$('flashlight').onclick = () => { if (state.mode === 'playing') { state.flashlight = !state.flashlight; $('flashlight').setAttribute('aria-pressed', String(state.flashlight)); sound.tone(900, 500, .05, .025, 'triangle'); } };
$('interact').onclick = interact; $('pause-button').onclick = pauseGame; $('map-button').onclick = showMap;
$('open-settings').onclick = () => showSettings(true); $('start').onclick = startGame;
document.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.code === 'Escape') { e.preventDefault(); if (!$('modal').hidden) closeModal(); else pauseGame(); return; }
  if (state.mode !== 'playing') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
  keys.add(e.code); if (e.repeat) return;
  if (e.code === 'KeyE' || e.code === 'Space') interact(); if (e.code === 'KeyF') $('flashlight').click(); if (e.code === 'KeyM') showMap();
});
document.addEventListener('keyup', e => keys.delete(e.code));
document.addEventListener('visibilitychange', () => { if (document.hidden) { resetInput(); if (state.mode === 'playing') pauseGame(); else void sound.pause(); } });
window.addEventListener('blur', () => { resetInput(); if (state.mode === 'playing') pauseGame(); });
window.addEventListener('resize', () => { resetInput(); renderer?.resize(); });
window.addEventListener('pagehide', () => { resetInput(); void sound.pause(); });
document.addEventListener('contextmenu', e => e.preventDefault());

function updateHUD() {
  $('room').textContent = roomName(state.player.x, state.player.z);
  const safe = isSafe(state.player.x, state.player.z);
  $('status').textContent = safe ? 'この部屋は安全' : state.phase === 'chase' ? 'プリモドリが追ってくる' : '館を探索中';
  $('status').className = 'status' + (safe ? ' safe-text' : state.phase === 'chase' ? ' danger-text' : '');
  $('objective').textContent = state.collected.size === 3 ? '三つの紋章がそろった。玄関へ戻れ。' : `三つの紋章を探し、玄関に戻る　${state.collected.size} / 3`;
  $('crest-count').textContent = `紋章 ${state.collected.size} / 3`;
  for (const element of document.querySelectorAll('[data-crest]')) {
    const found = state.collected.has(element.dataset.crest); element.classList.toggle('found', found); element.setAttribute('aria-label', element.title + (found ? ' 入手済み' : ' 未入手'));
  }
  const near = nearbyInteraction(state); state.near = near;
  $('interact').disabled = !near; $('interact').textContent = near ? near.label : '調べる';
}
function update(dt) {
  state.elapsed += dt;
  const p = state.player;
  let forward = input.z + (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), side = input.x + (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const magnitude = Math.max(1, Math.hypot(forward, side)); forward /= magnitude; side /= magnitude;
  p.yaw += ((keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)) * dt * 1.7 * settings.sensitivity;
  p.pitch = Math.max(-.75, Math.min(.75, p.pitch + ((keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0)) * dt * 1.1));
  state.sprinting = sprintLock || keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = state.sprinting ? 2.55 : 1.65, oldX = p.x, oldZ = p.z;
  moveBody(world, p, (Math.cos(p.yaw) * forward - Math.sin(p.yaw) * side) * speed * dt, (Math.sin(p.yaw) * forward + Math.cos(p.yaw) * side) * speed * dt);
  state.moving = Math.hypot(p.x - oldX, p.z - oldZ) > .0001;
  if (state.moving && state.elapsed - lastStep > (state.sprinting ? .29 : .46)) { sound.step(state.sprinting); lastStep = state.elapsed; }
  if (state.phase === 'explore' && isTrigger(p.x, p.z)) triggerChase();
  if (state.phase === 'chase') {
    const safe = isSafe(p.x, p.z), d = distance(p, state.enemy);
    if (state.elapsed - state.triggeredAt > 1.5) {
      const target = safe ? { x: 22.4, z: 25.5 } : p;
      if (state.elapsed - state.pathAt > .45) { state.path = findPath(world, state.enemy, target, true); state.pathAt = state.elapsed; }
      const direct = !safe && lineOfSight(world, state.enemy, p);
      const next = direct ? p : state.path[0];
      if (next && (!safe || distance(state.enemy, target) > .3)) {
        const dx = next.x - state.enemy.x, dz = next.z - state.enemy.z, len = Math.hypot(dx, dz);
        if (len < .16 && !direct) state.path.shift();
        else if (len > .01) { const speed = d > 10 ? 1.65 : 1.35; moveBody(world, state.enemy, dx / len * speed * dt, dz / len * speed * dt, .18); }
      }
      if (d < .52 && !safe && direct) { caughtGame(); return; }
      state.danger = safe ? 0 : Math.max(0, 1 - d / 7);
      if (d < 12 && !safe && state.elapsed - lastEnemyStep > .4) { sound.enemyStep(d); lastEnemyStep = state.elapsed; }
      if (!safe && d < 7 && direct && state.elapsed - state.shotAt > 8 && state.elapsed - state.triggeredAt > 8) { sound.shot(); state.shotAt = state.elapsed; state.shake = .2; toast('プリンの光が壁をかすめた。距離を取れ！', 2.5); }
    }
    if (state.elapsed >= state.voiceAt && !isSafe(p.x, p.z)) {
      const first = state.voiceAt < state.triggeredAt + 2;
      sound.voice(first ? 'threat' : d < 5 ? 'found' : 'name'); subtitle(first ? '「プリンにしちゃうぞ……！」' : d < 5 ? '「みいつけた。」' : '「プリモドリ……プリモドリ……」', 4.5);
      state.voiceAt = state.elapsed + 16;
    }
  } else if (state.elapsed > 9 && Math.floor(state.elapsed) % 21 === 9 && state.elapsed - (state.creakAt || 0) > 15) { sound.creak(); state.creakAt = state.elapsed; }
  state.shake = Math.max(0, state.shake - dt * .65);
  $('danger').style.opacity = (state.danger * .5).toFixed(2);
  if (state.elapsed - state.triggeredAt > .17) $('glass-flash').classList.remove('active');
  if (state.elapsed > subtitleUntil) $('subtitle').textContent = '';
  if (state.elapsed > toastUntil) $('toast').textContent = '';
  if (state.elapsed - lastHUD > .14) { updateHUD(); lastHUD = state.elapsed; }
}
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, Math.max(0, (t - lastTime) / 1000)); lastTime = t;
  if (state.mode === 'playing') update(dt);
  if (state.mode === 'caught' && t - state.caughtAt > 1700 && !document.hidden) deathDialog();
  if (renderer && !document.hidden) renderer.render(state, state.mode === 'playing' ? state.elapsed : state.mode === 'title' ? t / 1000 * .3 : state.elapsed);
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image(), timer = setTimeout(() => reject(new Error('敵の画像を読み込めませんでした。通信を確認して読み直してください。')), 20000);
    image.onload = () => { clearTimeout(timer); resolve(image); }; image.onerror = () => { clearTimeout(timer); reject(new Error('プリモドリの画像が見つかりません。')); }; image.src = url;
  });
}
function fallbackRenderer(image, textures) {
  $('viewport').replaceChildren(); renderer = new CanvasRenderer($('viewport'), world, textures, image, settings.quality);
}
async function boot() {
  try {
    const [image, textures] = await Promise.all([loadImage(new URL('../assets/primodori.png', import.meta.url)), Promise.resolve().then(makeTextures)]);
    let gl = null;
    try { const probe = document.createElement('canvas'); gl = probe.getContext('webgl2') || probe.getContext('webgl'); if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
    if (gl) {
      try {
        const { WebGLRenderer } = await import('./render-webgl.mjs'); renderer = new WebGLRenderer($('viewport'), world, textures, image, settings.quality);
        renderer.render(state, 0);
        renderer.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); pauseGame(); renderer.dispose(); fallbackRenderer(image, textures); toast('探索を再開できます。', 4); });
      } catch { fallbackRenderer(image, textures); }
    } else fallbackRenderer(image, textures);
    $('start').disabled = false; $('load-text').textContent = '館に入る'; $('loading-detail').textContent = '準備完了';
    lastTime = performance.now(); requestAnimationFrame(frame);
  } catch (error) { $('fatal').hidden = false; $('fatal-detail').textContent = error.message || 'ゲームの読み込みに失敗しました。ページを読み直してください。'; }
}
void boot();
