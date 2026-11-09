// 洋館の地形と進行。描画環境に依存しないため、移動と脱出条件を個別に検証できる。
export const SIZE = 32;
export const START = { x: 15.5, z: 25.7, yaw: -Math.PI / 2 };
export const EXIT = { x: 15.5, z: 28.55 };
export const ENEMY_START = { x: 26.4, z: 8.5 };
export const ROOMS = [
  { name: '玄関ホール', x: 11, z: 18, w: 9, h: 11, style: 1 },
  { name: '図書室', x: 2, z: 12, w: 8, h: 9, style: 2 },
  { name: '食堂', x: 2, z: 2, w: 9, h: 8, style: 3 },
  { name: '北の回廊', x: 11, z: 5, w: 12, h: 4, style: 1 },
  { name: '東の回廊', x: 23, z: 5, w: 7, h: 16, style: 4 },
  { name: '肖像画の間', x: 12, z: 11, w: 7, h: 6, style: 1 },
  { name: '礼拝室', x: 23, z: 24, w: 7, h: 5, style: 5 }
];
export const CRESTS = [
  { id: 'moon', name: '月の紋章', room: '図書室', x: 5.5, z: 15.5, color: '#d7e4ec', symbol: '☾' },
  { id: 'rose', name: '薔薇の紋章', room: '食堂', x: 5.5, z: 5.5, color: '#d68a82', symbol: '✥' },
  { id: 'bird', name: '鳥の紋章', room: '東の回廊', x: 26.5, z: 17.5, color: '#dec58e', symbol: '♜' }
];
export const NOTES = [
  { id: 'entrance', x: 14.5, z: 22.5, title: '管理人の置き手紙', text: '玄関の錠は、三つの紋章で開く。\n\n月は図書室。薔薇は食堂。鳥は東の回廊。\n\n東のガラスに近づいてはいけない。あの鳥は、まだ館にいる。\n\n追われたら走れ。礼拝室の灯りの中なら、あいつは入ってこられない。' },
  { id: 'library', x: 3.6, z: 18.5, title: '破れた観察記録', text: '被検体の名は、プリモドリ。\n\n甘い匂いのする胴体と、鳥の脚。眠っているような顔のまま、突然走り出す。\n\n大きな翼が開いたら、もう振り返らないこと。\n\n「プリンにしちゃうぞ」\n\n……あの声が、壁の向こうから聞こえる。' },
  { id: 'chapel', x: 27.4, z: 26.5, title: '礼拝室の祈り', text: 'この小さな部屋にいる間、プリモドリは追ってこない。\n\n立ち止まって息を整えるといい。時間に追われることはない。\n\n三つの紋章がそろったら、玄関へ戻ろう。' }
];

export function createWorld() {
  const cells = Array.from({ length: SIZE }, () => Array(SIZE).fill(1));
  const styles = Array.from({ length: SIZE }, () => Array(SIZE).fill(1));
  const carve = (x, z, w, h, style = 1) => {
    for (let j = z; j < z + h; j++) for (let i = x; i < x + w; i++) {
      cells[j][i] = 0; styles[j][i] = style;
    }
  };
  for (const r of ROOMS) carve(r.x, r.z, r.w, r.h, r.style);
  // 幅のある出入口。全室が一つの経路につながる。
  carve(9, 18, 3, 2, 2); carve(5, 9, 2, 4, 2);
  carve(10, 6, 2, 2); carve(19, 18, 5, 2);
  carve(15, 16, 2, 3); carve(19, 25, 5, 2, 5);
  // 食卓、書架、ホールの柱は壁と同じ衝突判定を使う。
  for (const [x, z, w, h] of [[6, 4, 2, 4], [3, 13, 1, 4], [8, 13, 1, 4], [13, 20, 1, 1], [17, 20, 1, 1], [13, 25, 1, 1], [17, 25, 1, 1], [25, 6, 1, 2]]) {
    for (let j = z; j < z + h; j++) for (let i = x; i < x + w; i++) cells[j][i] = 2;
  }
  // 壁面装飾は座標から固定し、再開しても変化しない。
  const wallType = (x, z) => {
    if (cells[z]?.[x] === 2) return 6;
    if (z === 29 && x >= 14 && x <= 16) return 7;
    if (x === 30 && z >= 8 && z <= 19) return z % 3 === 0 ? 4 : 1;
    if (x <= 10 && z >= 11 && z <= 21) return (x + z) % 3 ? 2 : 1;
    if ((x * 3 + z * 7) % 11 === 0) return 3;
    if ((x * 5 + z) % 13 === 0) return 4;
    return 1;
  };
  return { cells, styles, wallType };
}

export function isWall(world, x, z) {
  return (world.cells[Math.floor(z)]?.[Math.floor(x)] ?? 1) !== 0;
}
export function isSafe(x, z) { return x >= 23 && x < 30 && z >= 24 && z < 29; }
export function roomName(x, z) {
  return ROOMS.find(r => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.h)?.name || '連絡通路';
}
export function isTrigger(x, z) { return x > 23.1 && z < 19.2 && z > 11.1; }
export function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
export function canStand(world, x, z, radius = .2) {
  for (const [dx, dz] of [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]]) {
    if (isWall(world, x + dx, z + dz)) return false;
  }
  return true;
}
export function moveBody(world, body, dx, dz, radius = .2) {
  // 長いフレームでも薄い壁をすり抜けないよう、移動を小さく区切る。
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .12));
  for (let i = 0; i < count; i++) {
    if (canStand(world, body.x + dx / count, body.z, radius)) body.x += dx / count;
    if (canStand(world, body.x, body.z + dz / count, radius)) body.z += dz / count;
  }
}
export function lineOfSight(world, a, b) {
  const d = distance(a, b), steps = Math.ceil(d * 12);
  for (let i = 1; i < steps; i++) if (isWall(world, a.x + (b.x - a.x) * i / steps, a.z + (b.z - a.z) * i / steps)) return false;
  return true;
}
export function findPath(world, from, to, avoidSafe = false) {
  const sx = Math.floor(from.x), sz = Math.floor(from.z), tx = Math.floor(to.x), tz = Math.floor(to.z);
  if (isWall(world, sx, sz) || isWall(world, tx, tz) || (avoidSafe && isSafe(tx + .5, tz + .5))) return [];
  const start = sz * SIZE + sx, goal = tz * SIZE + tx;
  const previous = new Int32Array(SIZE * SIZE).fill(-1), queue = [start]; previous[start] = start;
  for (let head = 0; head < queue.length && previous[goal] < 0; head++) {
    const current = queue[head], x = current % SIZE, z = Math.floor(current / SIZE);
    for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, nz = z + dz, n = nz * SIZE + nx;
      if (nx < 0 || nz < 0 || nx >= SIZE || nz >= SIZE || previous[n] >= 0 || isWall(world, nx, nz) || (avoidSafe && isSafe(nx + .5, nz + .5))) continue;
      previous[n] = current; queue.push(n);
    }
  }
  if (previous[goal] < 0) return [];
  const result = [];
  for (let n = goal; n !== start; n = previous[n]) result.push({ x: n % SIZE + .5, z: Math.floor(n / SIZE) + .5 });
  return result.reverse();
}

export function createState() {
  return {
    player: { ...START, pitch: 0 }, enemy: { ...ENEMY_START, yaw: 0 },
    mode: 'title', phase: 'explore', collected: new Set(), read: new Set(),
    flashlight: true, sprinting: false, elapsed: 0, triggeredAt: -1,
    danger: 0, steps: 0, path: [], pathAt: -1, voiceAt: -100, shotAt: -100,
    shake: 0, near: null, checkpoint: null
  };
}
export function nearbyInteraction(state) {
  const p = state.player;
  const targets = [
    ...CRESTS.filter(c => !state.collected.has(c.id)).map(c => ({ ...c, kind: 'crest', label: c.name + 'を取る' })),
    ...NOTES.map(n => ({ ...n, kind: 'note', label: n.title + 'を読む' })),
    { ...EXIT, id: 'exit', kind: 'exit', label: state.collected.size === 3 ? '紋章をはめて脱出する' : '玄関の錠を調べる' }
  ];
  return targets.filter(t => distance(p, t) < (t.kind === 'exit' ? 1.55 : 1.2)).sort((a, b) => distance(p, a) - distance(p, b))[0] || null;
}
export function canEscape(state) { return state.collected.size === 3 && distance(state.player, EXIT) < 1.55; }
