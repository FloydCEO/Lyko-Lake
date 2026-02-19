// ===== RUNTIME =====
// Executes block scripts. Uses async generator threads per stack.

const Runtime = (() => {
  let threads = []; // active running threads
  let running = false;
  let globalVars = {};
  let answer = '';
  let timer = 0;
  let timerStart = Date.now();

  // ===== Start / Stop =====
  function start() {
    stopAll();
    running = true;
    timer = 0;
    timerStart = Date.now();
    document.getElementById('run-status').textContent = '▶ running';
    // Trigger green flag for all sprites
    Stage.getAllSprites().forEach(sp => {
      triggerEvent('when_flag', sp.id);
    });
    loop();
  }

  function stopAll() {
    running = false;
    threads = [];
    Stage.stopAll();
    document.getElementById('run-status').textContent = '';
  }

  function loop() {
    if (!running) return;
    // Tick all threads
    threads = threads.filter(t => !t.done);
    threads.forEach(t => { if (!t.waiting) tickThread(t); });
    requestAnimationFrame(loop);
  }

  async function tickThread(thread) {
    if (thread.done || thread.waiting) return;
    try {
      const result = await thread.gen.next();
      if (result.done) thread.done = true;
    } catch(e) {
      console.warn('Thread error:', e);
      thread.done = true;
    }
  }

  // ===== Event triggering =====
  function triggerEvent(eventType, spriteId, data = {}) {
    const scripts = Editor.getScripts(spriteId);
    const sprite = Stage.getSprite(spriteId);
    if (!sprite) return;

    scripts.forEach(sd => {
      const firstBlock = sd.blocks[0];
      if (!firstBlock) return;
      const matches = {
        'when_flag':           () => eventType === 'when_flag',
        'when_sprite_clicked': () => eventType === 'when_sprite_clicked',
        'when_key':            () => eventType === 'when_key' && data.key === getInput(firstBlock,'space',1),
        'when_clone_start':    () => eventType === 'when_clone_start',
        'when_msg':            () => eventType === 'broadcast' && data.msg === getInput(firstBlock,'message1',1),
      };
      const check = matches[firstBlock.id];
      if (check && check()) {
        const gen = executeScript(sd.blocks, sprite);
        threads.push({ gen, done: false, waiting: false, sprite });
      }
    });
  }

  function getInput(block, def, idx) {
    const key = `${block.id}_${idx}`;
    return block.inputs?.[key] ?? def;
  }

  // ===== Script execution =====
  async function* executeScript(blocks, sprite) {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      yield* executeBlock(block, sprite, blocks);
    }
  }

  async function* executeBlock(block, sprite, allBlocks) {
    const id = block.id;
    const inp = (key, def, idx) => {
      if (typeof key === 'number') {
        const k = `${id}_${key}`;
        const v = block.inputs?.[k];
        return v !== undefined ? v : def;
      }
      return def;
    };
    const n = (idx, def=0) => parseFloat(inp(idx,def,idx)) || 0;
    const s = (idx, def='') => String(inp(idx,def,idx) ?? def);

    switch(id) {
      // ===== MOTION =====
      case 'move_steps': {
        const steps = n(1, 10);
        const rad = ((sprite.direction - 90) * Math.PI) / 180;
        sprite.x += Math.cos(rad) * steps;
        sprite.y += Math.sin(rad) * steps;
        yield;
        break;
      }
      case 'turn_right': sprite.direction = (sprite.direction + n(1,15)) % 360; yield; break;
      case 'turn_left': sprite.direction = ((sprite.direction - n(1,15)) + 360) % 360; yield; break;
      case 'goto_xy': sprite.x = n(1,0); sprite.y = n(2,0); yield; break;
      case 'goto_random': {
        const target = s(1,'random position');
        if (target === 'random position') {
          sprite.x = Math.random()*480-240;
          sprite.y = Math.random()*360-180;
        } else if (target === 'mouse-pointer') {
          sprite.x = Stage.mousePos.x;
          sprite.y = Stage.mousePos.y;
        }
        yield; break;
      }
      case 'glide_secs_xy': {
        const dur = n(1,1) * 1000;
        const tx = n(2,0), ty = n(3,0);
        const sx = sprite.x, sy = sprite.y;
        const start = Date.now();
        while (Date.now() - start < dur) {
          const t = (Date.now() - start) / dur;
          sprite.x = sx + (tx-sx)*t;
          sprite.y = sy + (ty-sy)*t;
          yield;
        }
        sprite.x = tx; sprite.y = ty;
        break;
      }
      case 'point_direction': sprite.direction = n(1,90); yield; break;
      case 'point_towards': {
        const target = s(1,'mouse-pointer');
        let tx, ty;
        if (target === 'mouse-pointer') { tx = Stage.mousePos.x; ty = Stage.mousePos.y; }
        else { tx = 0; ty = 0; }
        const angle = Math.atan2(ty - sprite.y, tx - sprite.x);
        sprite.direction = (angle * 180 / Math.PI + 90 + 360) % 360;
        yield; break;
      }
      case 'change_x': sprite.x += n(1,10); yield; break;
      case 'set_x': sprite.x = n(1,0); yield; break;
      case 'change_y': sprite.y += n(1,10); yield; break;
      case 'set_y': sprite.y = n(1,0); yield; break;
      case 'if_on_edge_bounce': {
        const hw = (sprite.size/100)*48/2;
        if (sprite.x + hw > Stage.W/2) { sprite.x = Stage.W/2 - hw; sprite.direction = -sprite.direction; }
        if (sprite.x - hw < -Stage.W/2) { sprite.x = -Stage.W/2 + hw; sprite.direction = -sprite.direction; }
        if (sprite.y + hw > Stage.H/2) { sprite.y = Stage.H/2 - hw; sprite.direction = 180 - sprite.direction; }
        if (sprite.y - hw < -Stage.H/2) { sprite.y = -Stage.H/2 + hw; sprite.direction = 180 - sprite.direction; }
        sprite.direction = ((sprite.direction % 360) + 360) % 360;
        yield; break;
      }
      case 'set_rotation_style': sprite.rotationStyle = s(1,'all around'); yield; break;

      // ===== LOOKS =====
      case 'say': sprite.sayText = s(1,'Hello!'); sprite.thinkText=null; yield; break;
      case 'say_timed': {
        sprite.sayText = s(1,'Hello!'); sprite.thinkText=null;
        yield* waitSecs(n(2,2));
        sprite.sayText = null;
        break;
      }
      case 'think': sprite.thinkText = s(1,'Hmm...'); sprite.sayText=null; yield; break;
      case 'think_timed': {
        sprite.thinkText = s(1,'Hmm...'); sprite.sayText=null;
        yield* waitSecs(n(2,2));
        sprite.thinkText = null;
        break;
      }
      case 'switch_costume': sprite.currentCostume = 0; yield; break;
      case 'next_costume': sprite.currentCostume = (sprite.currentCostume+1)%sprite.costumes.length; yield; break;
      case 'change_size': sprite.size += n(1,10); yield; break;
      case 'set_size': sprite.size = n(1,100); yield; break;
      case 'set_effect': {
        const eff = s(1,'color');
        if (sprite.effects[eff] !== undefined) sprite.effects[eff] = n(2,0);
        yield; break;
      }
      case 'change_effect': {
        const eff = s(1,'color');
        if (sprite.effects[eff] !== undefined) sprite.effects[eff] += n(2,25);
        yield; break;
      }
      case 'clear_effects': Object.keys(sprite.effects).forEach(k => sprite.effects[k]=0); yield; break;
      case 'show': sprite.visible = true; yield; break;
      case 'hide': sprite.visible = false; yield; break;
      case 'go_to_layer': yield; break; // visual layering TODO
      case 'go_layers': yield; break;

      // ===== EVENTS =====
      case 'broadcast': {
        const msg = s(1,'message1');
        Stage.getAllSprites().forEach(sp => triggerEvent('broadcast', sp.id, {msg}));
        yield; break;
      }
      case 'broadcast_wait': {
        const msg = s(1,'message1');
        Stage.getAllSprites().forEach(sp => triggerEvent('broadcast', sp.id, {msg}));
        // Wait 2 frames
        yield; yield; break;
      }

      // ===== CONTROL =====
      case 'wait_secs': yield* waitSecs(n(1,1)); break;
      case 'repeat': {
        const times = n(1,10);
        for (let i=0; i<times; i++) {
          // execute inner blocks — captured from block.inner
          if (block.inner) yield* executeScript(block.inner, sprite);
          yield;
        }
        break;
      }
      case 'forever': {
        while (running) {
          if (block.inner) yield* executeScript(block.inner, sprite);
          yield;
        }
        break;
      }
      case 'if': {
        const cond = evalCondition(block.condition, sprite);
        if (cond && block.inner) yield* executeScript(block.inner, sprite);
        yield; break;
      }
      case 'if_else': {
        const cond = evalCondition(block.condition, sprite);
        if (cond && block.inner) yield* executeScript(block.inner, sprite);
        else if (!cond && block.else) yield* executeScript(block.else, sprite);
        yield; break;
      }
      case 'wait_until': {
        while (!evalCondition(block.condition, sprite)) yield;
        break;
      }
      case 'repeat_until': {
        while (!evalCondition(block.condition, sprite)) {
          if (block.inner) yield* executeScript(block.inner, sprite);
          yield;
        }
        break;
      }
      case 'stop': {
        const what = s(1,'all');
        if (what === 'all') stopAll();
        else if (what === 'this script') return;
        break;
      }
      case 'create_clone': {
        const original = Stage.getSprite(sprite.id) || sprite;
        const clone = Stage.addSprite(original.name + '_clone');
        clone.x = original.x; clone.y = original.y;
        clone.direction = original.direction; clone.size = original.size;
        clone.visible = original.visible;
        triggerEvent('when_clone_start', clone.id);
        yield; break;
      }
      case 'delete_clone': {
        const sprites = Stage.getAllSprites();
        const idx = sprites.indexOf(sprite);
        if (idx > -1) sprites.splice(idx, 1);
        Stage.updateSpriteList();
        return; // end thread
      }

      // ===== SENSING =====
      case 'ask_wait': {
        const question = s(1, "What's your name?");
        answer = await promptUser(question);
        yield; break;
      }
      case 'reset_timer': timerStart = Date.now(); yield; break;
      case 'set_drag': yield; break; // no-op in browser

      // ===== VARIABLES =====
      case 'set_var': {
        const varName = getVarName(block, sprite);
        const val = s(2,'0');
        setVar(sprite, varName, isNaN(val) ? val : parseFloat(val));
        yield; break;
      }
      case 'change_var': {
        const varName = getVarName(block, sprite);
        const cur = parseFloat(getVar(sprite, varName)) || 0;
        setVar(sprite, varName, cur + n(2,1));
        yield; break;
      }
      case 'show_var': yield; break; // TODO: on-stage variable display
      case 'hide_var': yield; break;

      // Hat blocks - skip (they're triggers, not run directly)
      case 'when_flag':
      case 'when_key':
      case 'when_sprite_clicked':
      case 'when_backdrop':
      case 'when_gt':
      case 'when_msg':
      case 'when_clone_start':
        break;

      default:
        yield;
    }
  }

  // ===== Helpers =====
  async function* waitSecs(secs) {
    const end = Date.now() + secs * 1000;
    while (Date.now() < end) yield;
  }

  function evalCondition(cond, sprite) {
    if (!cond) return false;
    const { id, inputs } = cond;
    const n2 = (idx, def=0) => parseFloat(inputs?.[`${id}_${idx}`] ?? def) || 0;
    const s2 = (idx, def='') => String(inputs?.[`${id}_${idx}`] ?? def);
    switch(id) {
      case 'touching': return s2(1,'mouse-pointer') === 'mouse-pointer' ? checkTouchingMouse(sprite) : false;
      case 'key_pressed': return isKeyPressed(s2(1,'space'));
      case 'mouse_down': return Stage.mouseDown;
      case 'gt': return n2(0) > n2(1,50);
      case 'lt': return n2(0) < n2(1,50);
      case 'eq': return String(n2(0)) === String(s2(1,'50'));
      case 'and': return evalCondition(cond.a, sprite) && evalCondition(cond.b, sprite);
      case 'or': return evalCondition(cond.a, sprite) || evalCondition(cond.b, sprite);
      case 'not': return !evalCondition(cond.a, sprite);
      case 'contains': return s2(0,'apple').toLowerCase().includes(s2(1,'a').toLowerCase());
      default: return false;
    }
  }

  function checkTouchingMouse(sprite) {
    const hw = (sprite.size/100)*48/2;
    return Math.abs(sprite.x - Stage.mousePos.x) < hw && Math.abs(sprite.y - Stage.mousePos.y) < hw;
  }

  function isKeyPressed(key) {
    const keys = Stage.keys;
    if (key === 'any') return Object.values(keys).some(v=>v);
    if (key === 'space') return keys['space'] || keys[' '];
    if (key === 'left arrow') return keys['arrowleft'];
    if (key === 'right arrow') return keys['arrowright'];
    if (key === 'up arrow') return keys['arrowup'];
    if (key === 'down arrow') return keys['arrowdown'];
    return keys[key.toLowerCase()];
  }

  function getVarName(block, sprite) {
    const key = `${block.id}_0`;
    return block.inputs?.[key] || 'my variable';
  }

  function setVar(sprite, name, val) {
    if (!sprite.variables) sprite.variables = {};
    sprite.variables[name] = val;
  }

  function getVar(sprite, name) {
    return sprite?.variables?.[name] ?? globalVars[name] ?? 0;
  }

  function promptUser(question) {
    return new Promise(resolve => {
      const ans = prompt(question) || '';
      resolve(ans);
    });
  }

  return { start, stopAll, triggerEvent, getVar, setVar };
})();
