// 実際のゲームモジュールに画面イベントを送り、一時停止の誤表示とキーの残留を検証する。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as world from '../source/world.mjs';

async function createGame(file) {
  const elements = new Map();
  let clock = 0, nextFrame, lastState;
  class Element extends EventTarget {
    constructor(tagName = 'DIV') {
      super(); this.tagName = tagName; this.children = []; this.style = {}; this.dataset = {};
      this.hidden = false; this.textContent = ''; this.title = '';
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    setAttribute() {}
    append(element) { this.children.push(element); }
    replaceChildren(...children) { this.children = children; }
    querySelector() { return this.children[0] || null; }
    focus() {}
    getContext() { return null; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 120, height: 120 }; }
  }
  const document = new EventTarget();
  document.tagName = 'DOCUMENT'; document.hidden = false;
  document.getElementById = id => {
    if (!elements.has(id)) {
      const element = new Element();
      element.hidden = ['modal', 'hud', 'caught', 'fatal'].includes(id);
      elements.set(id, element);
    }
    return elements.get(id);
  };
  document.querySelectorAll = () => [];
  document.createElement = name => new Element(name.toUpperCase());
  const window = new EventTarget();
  class Image {
    width = 1536; height = 1024;
    set src(value) { queueMicrotask(() => this.onload?.()); }
  }
  class Sound {
    setVolume() {} setMuted() {} collect() {} creak() {} step() {} enemyStep() {}
    shatter() {} voice() {} shot() {} win() {} death() {} tone() {}
    async unlock() {} async pause() {} async resume() {}
  }
  class Renderer {
    constructor() { this.canvas = new Element('CANVAS'); }
    render(state) { lastState = state; }
    resize() {} setQuality() {}
  }
  const context = vm.createContext({
    document, window, Image, URL, Event, EventTarget,
    performance: { now: () => clock },
    localStorage: { getItem: () => null, setItem() {} },
    setTimeout, clearTimeout, queueMicrotask,
    requestAnimationFrame: fn => { nextFrame = fn; },
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 2, console
  });
  const url = new URL('../source/' + file, import.meta.url);
  const module = new vm.SourceTextModule(await readFile(url, 'utf8'), {
    context, identifier: url.href, initializeImportMeta(meta) { meta.url = url.href; }
  });
  const dependencies = {
    './world.mjs': world,
    './textures.mjs': { makeTextures: () => ({}) },
    './render-canvas.mjs': { CanvasRenderer: Renderer },
    './audio.mjs': { Soundscape: Sound }
  };
  await module.link(specifier => {
    const exports = dependencies[specifier];
    assert.ok(exports, '想定外の依存モジュールがある：' + specifier);
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  await new Promise(resolve => setImmediate(resolve));
  await elements.get('start').onclick();
  const frame = (milliseconds = 16) => { clock += milliseconds; nextFrame(clock); };
  frame();
  return {
    document, window, elements, frame,
    state: () => lastState,
    blur: () => window.dispatchEvent(new Event('blur')),
    visibility(hidden) { document.hidden = hidden; document.dispatchEvent(new Event('visibilitychange')); },
    key(code, repeat = false) {
      const event = new Event('keydown', { cancelable: true });
      Object.defineProperties(event, { code: { value: code }, repeat: { value: repeat } });
      document.dispatchEvent(event);
    },
    resume() { elements.get('modal-actions').children[0].onclick(); }
  };
}

if (process.argv.includes('--reproduce-original')) {
  const old = await createGame('game.mjs');
  old.blur(); old.frame();
  assert.equal(old.state().mode, 'paused');
  assert.equal(old.elements.get('modal').hidden, false);
  console.log('旧版で、表示中の画面からフォーカスが外れただけで停止する挙動を再現');
}

const game = await createGame('game-v3.1.mjs');
for (let i = 0; i < 20; i++) game.blur();
game.frame();
assert.equal(game.state().mode, 'playing');
assert.equal(game.elements.get('modal').hidden, true);
console.log('一時的なフォーカス変化が続いても、停止画面が出ないことを確認');

game.key('KeyW'); game.frame(32);
const position = { ...game.state().player };
game.blur(); game.frame(32);
assert.equal(game.state().player.x, position.x);
assert.equal(game.state().player.z, position.z);
assert.equal(game.state().mode, 'playing');
console.log('フォーカスが外れた後に、移動キーが押しっぱなしにならないことを確認');

game.visibility(false); game.frame();
assert.equal(game.state().mode, 'playing');
const elapsed = game.state().elapsed;
game.visibility(true); game.frame(500);
assert.equal(game.state().mode, 'paused');
assert.equal(game.state().elapsed, elapsed);
game.visibility(false); game.resume(); game.frame();
assert.equal(game.state().mode, 'playing');
game.blur(); game.frame();
assert.equal(game.elements.get('modal').hidden, true);
console.log('別画面への移動では停止し、戻って再開した後も停止が再発しないことを確認');

game.elements.get('pause-button').onclick(); game.frame();
assert.equal(game.state().mode, 'paused');
game.resume(); game.frame();
game.key('Escape'); game.frame();
assert.equal(game.state().mode, 'paused');
for (let i = 0; i < 5; i++) game.key('Escape', true);
game.frame();
assert.equal(game.state().mode, 'paused');
game.resume(); game.frame();
assert.equal(game.state().mode, 'playing');
console.log('手動停止と再開、停止キー長押し時の連続切り替え防止を確認');
