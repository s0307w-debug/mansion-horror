import * as THREE from '../vendor/three.module.min.js';
import { CRESTS, NOTES, SIZE } from './world.mjs';
import { makeCrest, makeNote, makeLamp } from './textures.mjs';

export class WebGLRenderer {
  constructor(container, world, textures, enemyImage, quality = 'auto') {
    this.world = world; this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.canvas = this.renderer.domElement; this.canvas.setAttribute('aria-label', '洋館の一人称画面'); container.append(this.canvas);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = quality !== 'low'; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x111b18); this.scene.fog = new THREE.FogExp2(0x111b18, .036);
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .04, 55); this.camera.rotation.order = 'YXZ'; this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xaebdb2, 0x4e4230, 1.5));
    const moon = new THREE.DirectionalLight(0x9bb7cd, .9); moon.position.set(28, 8, 10); this.scene.add(moon);
    this.materials = {};
    const textureOf = source => { const texture = new THREE.CanvasTexture(source); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy()); return texture; };
    for (let i = 1; i <= 7; i++) this.materials[i] = new THREE.MeshStandardMaterial({ map: textureOf(textures[i]), roughness: i === 4 ? .3 : .88, metalness: i === 4 ? .18 : 0 });
    const wallGroups = new Map();
    for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
      if (!world.cells[z][x] || world.cells[z][x] === 2) continue;
      if (![[0, 1], [0, -1], [-1, 0], [1, 0]].some(([dx, dz]) => world.cells[z + dz]?.[x + dx] === 0)) continue;
      const type = world.wallType(x, z); if (!wallGroups.has(type)) wallGroups.set(type, []); wallGroups.get(type).push([x, z]);
    }
    const transform = new THREE.Object3D();
    for (const [type, list] of wallGroups) {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.9, 1), this.materials[type], list.length);
      for (let i = 0; i < list.length; i++) { transform.position.set(list[i][0] + .5, .95, list[i][1] + .5); transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix); }
      mesh.receiveShadow = true; mesh.castShadow = true; this.scene.add(mesh);
    }
    const repeatMat = (source, repeat, roughness) => { const t = textureOf(source); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); return new THREE.MeshStandardMaterial({ map: t, roughness, metalness: .06 }); };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), repeatMat(textures.floor, SIZE / 4, .63));
    floor.rotation.x = -Math.PI / 2; floor.position.set(SIZE / 2, -.003, SIZE / 2); floor.receiveShadow = true; this.scene.add(floor);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshStandardMaterial({ color: 0x30382c, roughness: 1 }));
    ceiling.rotation.x = Math.PI / 2; ceiling.position.set(SIZE / 2, 1.91, SIZE / 2); this.scene.add(ceiling);
    this.box(15.5, .008, 23.5, 2.35, .014, 10, repeatMat(textures.rug, 4, 1));
    this.box(17, .008, 7, 14, .014, 1.25, repeatMat(textures.rug, 4, 1));
    const brass = new THREE.MeshStandardMaterial({ color: 0xb2a06a, roughness: .4, metalness: .65 });
    const darkWood = this.materials[6], stone = this.materials[5];
    // 食卓と木の椅子。衝突する家具は地形データと位置をそろえる。
    this.box(7, .57, 6, 2, .14, 4, darkWood);
    for (const x of [6.17, 7.83]) for (const z of [4.2, 7.8]) this.box(x, .25, z, .12, .55, .12, darkWood);
    for (const x of [5.55, 8.45]) for (const z of [4.7, 6, 7.3]) { this.box(x, .34, z, .48, .08, .48, darkWood); this.box(x < 6 ? x - .19 : x + .19, .65, z, .08, .65, .48, darkWood); }
    for (const [x, z] of [[3, 13], [8, 13]]) this.box(x + .5, .84, z + 2, 1, 1.68, 4, this.materials[2]);
    for (const [x, z] of [[13, 20], [17, 20], [13, 25], [17, 25]]) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(.22, .26, 1.9, 16), stone); column.position.set(x + .5, .95, z + .5); column.castShadow = true; this.scene.add(column);
      this.box(x + .5, .08, z + .5, .67, .16, .67, stone); this.box(x + .5, 1.8, z + .5, .66, .2, .66, stone);
    }
    this.box(25.5, .65, 7, 1, 1.3, 2, darkWood);
    // 燭台、額縁、天井の梁が奥行きをつくる。
    const lampTexture = textureOf(makeLamp());
    for (const [x, z] of [[12.5, 22.5], [18.5, 22.5], [12.5, 27.5], [18.5, 27.5], [3.5, 19.5], [9.5, 8.5], [13.5, 6.5], [21.5, 7.5], [24.5, 13.5], [28.5, 19.5], [24.5, 26.5], [28.5, 26.5]]) {
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampTexture, transparent: true, depthWrite: false, color: 0xffffff })); lamp.position.set(x, .65, z); lamp.scale.set(1.1, 1.3, 1); this.scene.add(lamp);
    }
    this.lights = [];
    for (const [x, z] of [[15.5, 23.5], [5.5, 17.5], [6, 6], [17, 7], [26.5, 17], [26.5, 26.5]]) {
      const light = new THREE.PointLight(z > 24 && x > 22 ? 0xe4edbd : 0xffc17a, 5.5, 10, 2); light.position.set(x, 1.5, z); this.scene.add(light); this.lights.push(light);
    }
    for (const z of [19, 24, 28]) this.box(15.5, 1.81, z, 9, .16, .14, darkWood);
    // 玄関のシャンデリア。
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.7, .025, 8, 32), brass); ring.rotation.x = Math.PI / 2; ring.position.set(15.5, 1.55, 23); this.scene.add(ring);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; this.box(15.5 + Math.cos(a) * .7, 1.67, 23 + Math.sin(a) * .7, .04, .18, .04, brass); }
    this.flash = new THREE.SpotLight(0xf2edce, 30, 19, .55, .65, 1.2);
    this.flash.position.set(.12, -.12, -.08); this.flash.target.position.set(0, -.03, -5); this.camera.add(this.flash, this.flash.target);
    this.flash.castShadow = quality !== 'low'; this.flash.shadow.mapSize.set(1024, 1024); this.flash.shadow.bias = -.002; this.flash.shadow.normalBias = .03;
    this.playerFill = new THREE.PointLight(0xc2c7ad, 1.3, 4); this.camera.add(this.playerFill);
    this.enemy = new THREE.Sprite(new THREE.SpriteMaterial({ map: textureOf(enemyImage), transparent: true, alphaTest: .1, depthWrite: false, color: 0xc7c5b2 }));
    this.enemy.scale.set(2.85, 1.9, 1); this.enemy.center.set(.5, 0); this.enemy.visible = false; this.scene.add(this.enemy);
    this.crestSprites = CRESTS.map(c => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textureOf(makeCrest(c.symbol, c.color)), transparent: true, depthWrite: false }));
      sprite.position.set(c.x, .55, c.z); sprite.scale.set(.8, .8, 1); this.scene.add(sprite); return { sprite, crest: c };
    });
    const noteTexture = textureOf(makeNote());
    for (const n of NOTES) { const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTexture, transparent: true, depthWrite: false })); sprite.position.set(n.x, .35, n.z); sprite.scale.set(.48, .48, 1); this.scene.add(sprite); }
    this.glass = new THREE.Group(); this.scene.add(this.glass);
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x8ba4ac, roughness: .12, transparent: true, opacity: .3, side: THREE.DoubleSide, metalness: .3 });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.65), glassMaterial); pane.position.set(26.5, .93, 10.8); this.glass.add(pane);
    for (let i = 0; i <= 4; i++) this.box(24.5 + i, .95, 10.8, .05, 1.9, .08, brass, this.glass);
    for (const y of [.08, .94, 1.82]) this.box(26.5, y, 10.8, 4.1, .055, .08, brass, this.glass);
    const shardGeometry = new THREE.BufferGeometry(); shardGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-.05, .06, 0, .07, .02, 0, -.02, -.1, 0], 3));
    this.shards = [];
    for (let i = 0; i < 28; i++) { const mesh = new THREE.Mesh(shardGeometry, new THREE.MeshStandardMaterial({ color: 0xc9e6e9, transparent: true, opacity: .65, side: THREE.DoubleSide })); mesh.visible = false; this.scene.add(mesh); this.shards.push(mesh); }
    this.label = '立体描画'; this.resize();
  }
  box(x, y, z, w, h, d, material, parent = this.scene) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }
  resize() { this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.quality === 'high' ? 2 : this.quality === 'low' ? 1 : 1.5)); this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
  setQuality(value) { this.quality = value; this.renderer.shadowMap.enabled = value !== 'low'; this.flash.castShadow = value !== 'low'; this.resize(); }
  render(state, t) {
    const p = state.player, bob = state.moving ? Math.sin(t * (state.sprinting ? 13 : 8)) * .014 : 0;
    this.camera.position.set(p.x, .75 + bob, p.z); this.camera.rotation.y = -p.yaw - Math.PI / 2; this.camera.rotation.x = p.pitch;
    this.camera.rotation.z = state.shake * Math.sin(t * 31) * .013;
    this.flash.visible = state.flashlight; this.playerFill.intensity = state.flashlight ? 1.3 : .45;
    this.enemy.visible = state.phase === 'chase'; this.enemy.position.set(state.enemy.x, Math.abs(Math.sin(t * 11)) * .04, state.enemy.z);
    this.enemy.material.rotation = Math.sin(t * 10) * .045;
    this.enemy.scale.set(2.85 * (1 + Math.sin(t * 10) * .02), 1.9, 1);
    for (const item of this.crestSprites) { item.sprite.visible = !state.collected.has(item.crest.id); item.sprite.position.y = .55 + Math.sin(t * 2) * .04; }
    for (let i = 0; i < this.lights.length; i++) this.lights[i].intensity = 5.5 * (1 + Math.sin(t * 4.1 + i * 13) * .025);
    this.glass.visible = state.phase !== 'chase';
    const since = state.elapsed - state.triggeredAt;
    for (let i = 0; i < this.shards.length; i++) {
      const shard = this.shards[i]; shard.visible = state.phase === 'chase' && since < 2;
      if (shard.visible) { shard.position.set(24.5 + i % 7 * .6 + Math.sin(i) * since, Math.max(.025, 1.6 - i % 4 * .3 + since * .4 - since * since), 10.8 + since * (i % 3 - 1.5)); shard.rotation.set(since * 3 + i, since * 4, i); }
    }
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this.renderer.dispose(); this.canvas.remove(); }
}
