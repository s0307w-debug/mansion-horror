import { SIZE, CRESTS, NOTES } from './world.mjs';
import { makeCrest, makeLamp, makeNote } from './textures.mjs';

export class CanvasRenderer {
  constructor(container, world, textures, enemyImage, quality = 'auto') {
    this.world = world; this.textures = textures; this.enemyImage = enemyImage; this.quality = quality;
    this.canvas = document.createElement('canvas'); this.canvas.setAttribute('aria-label', '洋館の一人称画面'); container.append(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('このブラウザで描画画面を作れませんでした。');
    this.floor = document.createElement('canvas'); this.floorCtx = this.floor.getContext('2d', { alpha: false });
    this.crestImages = new Map(CRESTS.map(c => [c.id, makeCrest(c.symbol, c.color)]));
    this.lamp = makeLamp(); this.note = makeNote();
    this.lamps = [[12.4, 22.5], [18.5, 22.5], [12.4, 27.5], [18.5, 27.5], [3.5, 19.5], [8.5, 19.5], [3.5, 3.5], [9.5, 8.5], [13.5, 6.5], [21.5, 7.5], [24.5, 13.5], [28.5, 19.5], [24.5, 26.5], [28.5, 26.5], [13.5, 13.5], [17.5, 13.5]];
    this.texData = {};
    for (const key of ['floor', 'rug', 6]) {
      const t = textures[key]; this.texData[key] = { data: t.getContext('2d').getImageData(0, 0, t.width, t.height).data, width: t.width };
    }
    this.resize(); this.label = '互換描画';
  }
  resize() {
    const ratio = innerWidth / innerHeight;
    const limit = this.quality === 'high' ? 1440 : this.quality === 'low' ? 740 : 1120;
    this.canvas.width = Math.round(Math.min(innerWidth * Math.min(devicePixelRatio || 1, 1.3), limit));
    this.canvas.height = Math.round(this.canvas.width / ratio);
    this.w = this.canvas.width; this.h = this.canvas.height;
    this.depth = new Float32Array(this.w);
    this.floor.width = Math.ceil(this.w / 2); this.floor.height = Math.ceil(this.h / 2);
    this.floorData = this.floorCtx.createImageData(this.floor.width, this.floor.height);
  }
  setQuality(value) { this.quality = value; this.resize(); }
  render(state, t) {
    const { ctx: c, w, h, world } = this, p = state.player;
    const dirX = Math.cos(p.yaw), dirZ = Math.sin(p.yaw), fov = Math.tan(Math.PI / 5) * w / h, planeX = -dirZ * fov, planeZ = dirX * fov;
    const moving = state.moving || false;
    const bob = moving ? Math.sin(t * (state.sprinting ? 13 : 8)) * h * .003 : 0;
    const horizon = h * (.48 + p.pitch * .27) + bob;
    const ceiling = c.createLinearGradient(0, 0, 0, Math.max(horizon, 1));
    ceiling.addColorStop(0, '#111b19'); ceiling.addColorStop(.8, '#242c25'); ceiling.addColorStop(1, '#30382b');
    c.fillStyle = ceiling; c.fillRect(0, 0, w, h);
    const projection = w / (2 * fov), wallHeight = 1.9;
    this.drawFloor(state, horizon, dirX, dirZ, planeX, planeZ, projection);
    const step = this.quality === 'low' ? 3 : this.quality === 'high' ? 1 : 2;
    for (let x = 0; x < w; x += step) {
      const cameraX = 2 * (x + step / 2) / w - 1, rx = dirX + planeX * cameraX, rz = dirZ + planeZ * cameraX;
      let mx = Math.floor(p.x), mz = Math.floor(p.z);
      const dx = Math.abs(1 / rx), dz = Math.abs(1 / rz), sx = rx < 0 ? -1 : 1, sz = rz < 0 ? -1 : 1;
      let xx = (rx < 0 ? p.x - mx : mx + 1 - p.x) * dx, zz = (rz < 0 ? p.z - mz : mz + 1 - p.z) * dz, side = 0;
      for (let i = 0; i < 100; i++) {
        if (xx < zz) { xx += dx; mx += sx; side = 0; } else { zz += dz; mz += sz; side = 1; }
        if (mz < 0 || mx < 0 || mx >= SIZE || mz >= SIZE || world.cells[mz][mx]) break;
      }
      const depth = Math.max(.04, side ? zz - dz : xx - dx);
      for (let i = x; i < Math.min(w, x + step); i++) this.depth[i] = depth;
      let u = side ? p.x + depth * rx : p.z + depth * rz; u -= Math.floor(u);
      if ((!side && rx > 0) || (side && rz < 0)) u = 1 - u;
      const type = world.wallType(mx, mz), texture = this.textures[type] || this.textures[1];
      const wallTop = horizon - projection * (wallHeight - .75) / depth, lineHeight = projection * wallHeight / depth;
      c.drawImage(texture, Math.min(510, Math.floor(u * 512)), 0, 1, 512, x, wallTop, step, lineHeight);
      const torch = state.flashlight ? Math.exp(-cameraX * cameraX * 3.6) * .45 / (1 + depth * .022) : .05;
      const light = Math.min(.97, (.56 + torch) / (1 + depth * .045) * (side ? .89 : 1));
      c.fillStyle = `rgba(3,11,10,${1 - light})`; c.fillRect(x, wallTop, step, lineHeight);
      // 壁から天井へ延びる暗い梁。
      c.fillStyle = '#0c171630'; c.fillRect(x, wallTop - 3, step, 4);
    }
    const sprites = [];
    for (const crest of CRESTS) if (!state.collected.has(crest.id)) sprites.push({ ...crest, image: this.crestImages.get(crest.id), height: .7, elevation: .25 + Math.sin(t * 2) * .045, glow: true });
    for (const n of NOTES) sprites.push({ ...n, image: this.note, height: .42, elevation: .15 });
    for (const [x, z] of this.lamps) sprites.push({ x, z, image: this.lamp, height: 1.25, elevation: 0 });
    if (state.phase === 'chase') sprites.push({ ...state.enemy, image: this.enemyImage, height: 1.9, elevation: Math.abs(Math.sin(t * 10)) * .045, enemy: true });
    // ガラスは壊れる前だけ、回廊の奥に描く。
    if (state.phase !== 'chase') this.drawGlass(state, horizon, projection, dirX, dirZ, planeX, planeZ);
    sprites.sort((a, b) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(p.x - a.x, p.z - a.z));
    for (const sprite of sprites) this.drawSprite(sprite, state, horizon, projection, dirX, dirZ, planeX, planeZ, t);
    // 静かな埃。追跡の視認性を妨げない密度にする。
    c.fillStyle = '#cdd4aa28';
    for (let i = 0; i < 25; i++) { const x = (i * 151.3 + Math.sin(t * .15 + i) * 25) % w, y = (i * 81.7 + t * (2 + i % 4)) % h; c.fillRect(x, y, 1, 1); }
    if (state.shake > .01 && state.phase === 'chase') this.drawShards(state.shake, t);
  }
  drawFloor(state, horizon, dx, dz, px, pz, cameraProjection) {
    const { floor, floorCtx, floorData, w, h } = this, data = floorData.data, fw = floor.width, fh = floor.height;
    const horizonSmall = horizon / 2, projection = cameraProjection / 2;
    for (let y = 0; y < fh; y++) {
      const pos = y - horizonSmall;
      if (pos <= 0) continue;
      const depth = .75 * projection / Math.max(1, pos), xStep = depth * 2 * px / fw, zStep = depth * 2 * pz / fw;
      let wx = state.player.x + depth * (dx - px), wz = state.player.z + depth * (dz - pz);
      const light = Math.min(.95, (state.flashlight ? .84 : .5) / (1 + depth * .038));
      for (let x = 0; x < fw; x++, wx += xStep, wz += zStep) {
        const cx = Math.floor(wx), cz = Math.floor(wz);
        const isRug = ((cx >= 14 && cx <= 16 && cz >= 18 && cz <= 28) || (cz >= 6 && cz <= 7 && cx >= 10 && cx < 24));
        const style = this.world.styles[cz]?.[cx];
        const tex = isRug ? this.texData.rug : style === 2 || style === 3 ? this.texData[6] : this.texData.floor;
        const u = (((wx * (tex.width === 512 ? 128 : 64)) | 0) % tex.width + tex.width) % tex.width;
        const v = (((wz * (tex.width === 512 ? 128 : 64)) | 0) % tex.width + tex.width) % tex.width;
        const a = (v * tex.width + u) * 4, k = (y * fw + x) * 4;
        data[k] = tex.data[a] * light; data[k + 1] = tex.data[a + 1] * light; data[k + 2] = tex.data[a + 2] * light; data[k + 3] = 255;
      }
    }
    floorCtx.putImageData(floorData, 0, 0);
    const sy = Math.max(0, Math.ceil(horizonSmall)), sh = fh - sy;
    if (sh > 0) this.ctx.drawImage(floor, 0, sy, fw, sh, 0, sy * 2, w, sh * 2);
  }
  project(x, z, state, dx, dz, px, pz) {
    const rx = x - state.player.x, rz = z - state.player.z, inverse = 1 / (px * dz - dx * pz);
    return { side: inverse * (dz * rx - dx * rz), depth: inverse * (-pz * rx + px * rz) };
  }
  drawSprite(sprite, state, horizon, projection, dx, dz, px, pz, t) {
    const pos = this.project(sprite.x, sprite.z, state, dx, dz, px, pz);
    if (pos.depth <= .08 || pos.depth > 25) return;
    const height = projection * sprite.height / pos.depth, width = height * (sprite.image.width / sprite.image.height);
    const center = this.w / 2 * (1 + pos.side / pos.depth), left = center - width / 2;
    const bottom = horizon + projection * (.75 - sprite.elevation) / pos.depth, top = bottom - height;
    if (left > this.w || left + width < 0) return;
    const c = this.ctx;
    c.globalAlpha = sprite.enemy ? Math.max(.7, 1 - pos.depth * .012) : 1;
    let begin = -1;
    const end = Math.min(this.w, Math.ceil(left + width)), start = Math.max(0, Math.floor(left));
    for (let x = start; x <= end; x++) {
      const visible = x < end && pos.depth < this.depth[x] + .05;
      if (visible && begin < 0) begin = x;
      if (!visible && begin >= 0) {
        const from = (begin - left) / width * sprite.image.width, span = (x - begin) / width * sprite.image.width;
        c.drawImage(sprite.image, Math.max(0, from), 0, Math.max(.01, span), sprite.image.height, begin, top, x - begin, height);
        begin = -1;
      }
    }
    c.globalAlpha = 1;
  }
  drawGlass(state, horizon, projection, dx, dz, px, pz) {
    const p = this.project(26.5, 10.8, state, dx, dz, px, pz);
    if (p.depth < .5 || p.depth > 18) return;
    const width = projection * 3.3 / p.depth, height = projection * 1.9 / p.depth;
    const x = this.w / 2 * (1 + p.side / p.depth) - width / 2, y = horizon - projection * 1.15 / p.depth;
    if (p.depth > this.depth[Math.max(0, Math.min(this.w - 1, Math.floor(x + width / 2)))]) return;
    const c = this.ctx; c.fillStyle = '#7aa1ad22'; c.fillRect(x, y, width, height); c.strokeStyle = '#a9b3a969'; c.lineWidth = 3;
    c.strokeRect(x, y, width, height); for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + width * i / 4, y); c.lineTo(x + width * i / 4, y + height); c.stroke(); }
  }
  drawShards(amount, t) {
    const c = this.ctx; c.strokeStyle = `rgba(195,218,223,${Math.min(.6, amount * .4)})`; c.lineWidth = 1;
    for (let i = 0; i < 16; i++) { const x = (i * 193) % this.w, y = (i * 97 + t * 120) % this.h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 12, y + 6); c.lineTo(x + 3, y + 23); c.closePath(); c.stroke(); }
  }
  dispose() { this.canvas.remove(); }
}
