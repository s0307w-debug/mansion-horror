// 外部画像に依存しない壁紙・木目・石床。高解像度のまま繰り返す。
let seed = 71871;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const canvas = (w = 512, h = w) => Object.assign(document.createElement('canvas'), { width: w, height: h });
function grain(c, strength = 12) {
  const ctx = c.getContext('2d'), data = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (random() - .5) * strength;
    for (let j = 0; j < 3; j++) data.data[i + j] += n;
  }
  ctx.putImageData(data, 0, 0);
}
export function makeTextures() {
  const maps = {};
  const base = canvas(), c = base.getContext('2d');
  c.fillStyle = '#444641'; c.fillRect(0, 0, 512, 512);
  // 織物風の退色したダマスク壁紙。
  for (let y = -36; y < 344; y += 72) for (let x = -32; x < 560; x += 64) {
    const cx = x + (Math.floor(y / 72) % 2 ? 32 : 0);
    c.save(); c.translate(cx, y); c.strokeStyle = '#77735c'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -26); c.bezierCurveTo(32, -6, 28, 18, 0, 29); c.bezierCurveTo(-28, 18, -32, -6, 0, -26); c.stroke();
    c.strokeStyle = '#646351'; c.beginPath(); c.ellipse(0, 1, 8, 18, 0, 0, Math.PI * 2); c.stroke(); c.restore();
  }
  c.fillStyle = '#28231f'; c.fillRect(0, 322, 512, 190);
  for (let x = 0; x < 512; x += 128) {
    const g = c.createLinearGradient(x, 0, x + 128, 0); g.addColorStop(0, '#24201d'); g.addColorStop(.4, '#4b3930'); g.addColorStop(1, '#302720');
    c.fillStyle = g; c.fillRect(x + 4, 338, 120, 154);
    c.strokeStyle = '#72604a'; c.lineWidth = 3; c.strokeRect(x + 12, 349, 103, 129);
    c.strokeStyle = '#171715'; c.strokeRect(x + 17, 354, 94, 119);
  }
  for (const [y, h, col] of [[0, 11, '#6d6554'], [13, 4, '#2c2821'], [314, 6, '#736550'], [321, 7, '#211c18'], [329, 4, '#827258'], [498, 14, '#201b18']]) {
    c.fillStyle = col; c.fillRect(0, y, 512, h);
  }
  for (let i = 0; i < 90; i++) {
    c.fillStyle = `rgba(14,17,15,${random() * .14})`; c.fillRect(random() * 512, random() * 314, random() * 12, random() * 85);
  }
  grain(base, 11); maps[1] = base;
  const books = canvas(), b = books.getContext('2d'); b.drawImage(base, 0, 0);
  b.fillStyle = '#201b18'; b.fillRect(14, 26, 484, 454);
  for (let row = 0; row < 4; row++) {
    const y = 36 + row * 109;
    let x = 23;
    while (x < 490) {
      const w = 11 + random() * 18, h = 68 + random() * 25;
      b.fillStyle = ['#5d2928', '#424c3f', '#70583e', '#313e48', '#4e3342'][Math.floor(random() * 5)]; b.fillRect(x, y + 94 - h, w, h);
      b.fillStyle = '#b39761'; b.fillRect(x + 2, y + 100 - h, w - 4, 2); b.fillRect(x + 2, y + 81, w - 4, 2);
      b.fillStyle = '#171512'; b.fillRect(x + w - 2, y + 94 - h, 2, h); x += w + 2;
    }
    b.fillStyle = '#816348'; b.fillRect(12, y + 95, 488, 6); b.fillStyle = '#37281d'; b.fillRect(12, y + 101, 488, 8);
  }
  grain(books, 6); maps[2] = books;
  const portrait = canvas(), p = portrait.getContext('2d'); p.drawImage(base, 0, 0);
  const pg = p.createRadialGradient(256, 146, 4, 256, 160, 130); pg.addColorStop(0, '#6d6554'); pg.addColorStop(.65, '#363b33'); pg.addColorStop(1, '#171c1c');
  p.fillStyle = '#171610'; p.fillRect(106, 49, 300, 257);
  for (let i = 0; i < 7; i++) { p.strokeStyle = ['#8e7249', '#392b1a', '#b59a64'][i % 3]; p.lineWidth = 3; p.strokeRect(106 + i * 4, 49 + i * 4, 300 - i * 8, 257 - i * 8); }
  p.fillStyle = pg; p.fillRect(135, 78, 242, 200);
  p.fillStyle = '#181d1b'; p.beginPath(); p.ellipse(256, 173, 40, 65, 0, 0, 7); p.fill();
  p.beginPath(); p.ellipse(256, 271, 86, 71, 0, 0, 7); p.fill();
  p.fillStyle = '#9b9172'; p.fillRect(236, 157, 7, 2); p.fillRect(271, 157, 7, 2);
  grain(portrait, 13); maps[3] = portrait;
  const window = canvas(), w = window.getContext('2d'); w.drawImage(base, 0, 0);
  w.fillStyle = '#1d2120'; w.fillRect(61, 29, 390, 287);
  const wg = w.createLinearGradient(0, 40, 0, 307); wg.addColorStop(0, '#2c4c60'); wg.addColorStop(1, '#13212b');
  w.fillStyle = wg; w.fillRect(77, 41, 358, 260);
  w.fillStyle = '#d4e5e1'; w.shadowColor = '#a3e4ff'; w.shadowBlur = 20; w.beginPath(); w.arc(347, 86, 25, 0, 7); w.fill(); w.shadowBlur = 0;
  w.strokeStyle = '#0d191b'; w.lineWidth = 6;
  for (let i = 0; i < 12; i++) { const x = random() * 390 + 65; w.beginPath(); w.moveTo(x, 310); w.lineTo(x + random() * 130 - 60, 40); w.stroke(); }
  for (const x of [76, 251, 426]) { w.fillStyle = '#766f5b'; w.fillRect(x, 38, 9, 269); }
  for (const y of [40, 167, 298]) { w.fillStyle = '#766f5b'; w.fillRect(76, y, 359, 9); }
  grain(window, 6); maps[4] = window;
  const stone = canvas(), s = stone.getContext('2d'); s.fillStyle = '#55574f'; s.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 128) for (let x = -128; x < 512; x += 256) {
    const xx = x + (y / 128 % 2) * 128; s.strokeStyle = '#313b39'; s.lineWidth = 5; s.strokeRect(xx, y, 256, 128);
    s.strokeStyle = '#838273'; s.lineWidth = 1; s.strokeRect(xx + 4, y + 4, 248, 120);
  }
  grain(stone, 22); maps[5] = stone;
  const wood = canvas(), v = wood.getContext('2d'); v.fillStyle = '#48372b'; v.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 500; i++) { v.strokeStyle = `rgba(${random() > .5 ? '118,91,59' : '23,19,17'},${random() * .4})`; v.lineWidth = random() * 2; v.beginPath(); v.moveTo(random() * 512, 0); v.bezierCurveTo(random() * 512, 160, random() * 512, 330, random() * 512, 512); v.stroke(); }
  for (let x = 0; x < 512; x += 128) { v.fillStyle = '#1e1915'; v.fillRect(x, 0, 3, 512); }
  grain(wood, 8); maps[6] = wood;
  const door = canvas(), d = door.getContext('2d'); d.drawImage(wood, 0, 0);
  for (const x of [25, 274]) for (const y of [35, 271]) { d.strokeStyle = '#9c8054'; d.lineWidth = 8; d.strokeRect(x, y, 211, 202); d.strokeStyle = '#231c17'; d.lineWidth = 4; d.strokeRect(x + 12, y + 12, 187, 178); }
  d.fillStyle = '#bd9e59'; for (const x of [232, 271]) { d.beginPath(); d.arc(x, 262, 8, 0, 7); d.fill(); }
  maps[7] = door;
  const floor = canvas(256), f = floor.getContext('2d');
  f.fillStyle = '#35362f'; f.fillRect(0, 0, 256, 256);
  for (let z = 0; z < 4; z++) for (let x = 0; x < 4; x++) {
    f.fillStyle = (x + z) % 2 ? '#77776b' : '#313e3d'; f.fillRect(x * 64 + 1, z * 64 + 1, 62, 62);
    f.strokeStyle = (x + z) % 2 ? '#a29a81' : '#53625b'; f.lineWidth = 1; f.strokeRect(x * 64 + 3, z * 64 + 3, 58, 58);
  }
  for (let i = 0; i < 35; i++) { f.strokeStyle = '#26333230'; f.beginPath(); let x = random() * 256, y = random() * 256; f.moveTo(x, y); for (let j = 0; j < 4; j++) { x += random() * 20 - 8; y += random() * 15; f.lineTo(x, y); } f.stroke(); }
  grain(floor, 13); maps.floor = floor;
  const rug = canvas(256), r = rug.getContext('2d'); r.fillStyle = '#50272d'; r.fillRect(0, 0, 256, 256);
  for (let x = 8; x < 252; x += 12) { r.fillStyle = '#b6925c'; r.fillRect(x, 7, 5, 3); r.fillRect(x, 246, 5, 3); }
  for (const y of [18, 237]) { r.fillStyle = '#987d4d'; r.fillRect(0, y, 256, 2); }
  r.strokeStyle = '#9b7146'; r.lineWidth = 2;
  for (let x = -20; x < 276; x += 64) { r.beginPath(); r.moveTo(x, 128); r.lineTo(x + 32, 78); r.lineTo(x + 64, 128); r.lineTo(x + 32, 178); r.closePath(); r.stroke(); }
  grain(rug, 17); maps.rug = rug;
  return maps;
}
export function makeCrest(symbol, color) {
  const c = canvas(128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 8, 64, 64, 64); g.addColorStop(0, color + '80'); g.addColorStop(1, color + '00'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = color; x.lineWidth = 3; x.beginPath(); x.arc(64, 64, 28, 0, 7); x.stroke(); x.beginPath(); x.arc(64, 64, 23, 0, 7); x.stroke();
  x.fillStyle = color; x.font = '32px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(symbol, 64, 66);
  return c;
}
export function makeNote() {
  const c = canvas(128), x = c.getContext('2d'); x.translate(64, 64); x.rotate(-.12);
  x.shadowBlur = 20; x.shadowColor = '#e1c185'; x.fillStyle = '#c7b992'; x.fillRect(-21, -27, 42, 54); x.shadowBlur = 0;
  x.fillStyle = '#625342'; for (let y = -17; y <= 16; y += 6) x.fillRect(-14, y, 24 - y % 5, 1);
  return c;
}
export function makeLamp() {
  const c = canvas(128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 50, 1, 64, 50, 60); g.addColorStop(0, '#fff1bdff'); g.addColorStop(.13, '#ffdf8ad0'); g.addColorStop(.45, '#d18a3b30'); g.addColorStop(1, '#d18a3b00'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#b59457'; x.fillRect(58, 50, 12, 49); x.fillRect(42, 98, 44, 5); x.fillStyle = '#e2d1a9'; x.fillRect(60, 32, 8, 27); x.fillStyle = '#fff5d2'; x.beginPath(); x.ellipse(64, 29, 4, 9, 0, 0, 7); x.fill();
  return c;
}
