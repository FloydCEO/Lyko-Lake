// ===== STAGE =====
// Handles the stage canvas: drawing sprites, backgrounds, costume rendering

const Stage = (() => {
  let canvas, ctx;
  let sprites = [];
  let selectedSpriteId = null;
  let animFrame = null;
  let keys = {};
  let mousePos = { x: 0, y: 0 };
  let mouseDown = false;

  // Stage is 480x360 logical, scaled to fit container
  const W = 480, H = 360;

  function init() {
    canvas = document.getElementById('stage-canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');

    // Key tracking
    window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; keys[e.code.toLowerCase()] = true; });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; keys[e.code.toLowerCase()] = false; });

    // Mouse tracking (relative to stage)
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      // Scratch coords: center origin, y inverted
      mousePos.x = Math.round((e.clientX - rect.left) * scaleX - W/2);
      mousePos.y = Math.round(H/2 - (e.clientY - rect.top) * scaleY);
    });
    canvas.addEventListener('mousedown', () => mouseDown = true);
    canvas.addEventListener('mouseup', () => mouseDown = false);
    canvas.addEventListener('click', e => {
      // Trigger sprite click events
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;
      sprites.forEach(sp => {
        if (sp.visible && pointInSprite(cx, cy, sp)) {
          Runtime.triggerEvent('when_sprite_clicked', sp.id);
        }
      });
    });

    // Add default sprite
    addSprite('Sprite1');
    render();
  }

  function pointInSprite(cx, cy, sp) {
    const sx = stageToCanvasX(sp.x);
    const sy = stageToCanvasY(sp.y);
    const hw = (sp.size / 100) * 48;
    const hh = (sp.size / 100) * 48;
    return cx >= sx - hw && cx <= sx + hw && cy >= sy - hh && cy <= sy + hh;
  }

  function stageToCanvasX(x) { return x + W / 2; }
  function stageToCanvasY(y) { return H / 2 - y; }

  function addSprite(name) {
    const id = 'sprite_' + Date.now();
    const sp = {
      id, name,
      x: 0, y: 0,
      direction: 90, // Scratch: 90 = right
      size: 100,
      visible: true,
      rotationStyle: 'all around',
      costumes: [createDefaultCostume()],
      currentCostume: 0,
      sayText: null, sayTimeout: null,
      thinkText: null,
      effects: { color:0, fisheye:0, whirl:0, pixelate:0, brightness:0, ghost:0 },
      variables: {},
      scripts: [], // runtime script threads
    };
    sprites.push(sp);
    if (!selectedSpriteId) selectedSpriteId = id;
    updateSpriteList();
    return sp;
  }

  function createDefaultCostume() {
    // Draw Scratch cat-style sprite on an offscreen canvas
    const oc = document.createElement('canvas');
    oc.width = 96; oc.height = 96;
    const c = oc.getContext('2d');

    // Body
    c.fillStyle = '#f5a623';
    c.beginPath();
    c.ellipse(48, 58, 26, 30, 0, 0, Math.PI*2);
    c.fill();

    // Head
    c.beginPath();
    c.ellipse(48, 30, 22, 20, 0, 0, Math.PI*2);
    c.fill();

    // Ears
    c.fillStyle = '#e8951f';
    c.beginPath(); c.moveTo(30,16); c.lineTo(22,4); c.lineTo(38,14); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(66,16); c.lineTo(74,4); c.lineTo(58,14); c.closePath(); c.fill();

    // Eyes
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(41,28,5,6,0,0,Math.PI*2); c.fill();
    c.beginPath(); c.ellipse(55,28,5,6,0,0,Math.PI*2); c.fill();
    c.fillStyle = '#333';
    c.beginPath(); c.ellipse(41,29,3,4,0,0,Math.PI*2); c.fill();
    c.beginPath(); c.ellipse(55,29,3,4,0,0,Math.PI*2); c.fill();

    // Nose
    c.fillStyle = '#ff8888';
    c.beginPath(); c.ellipse(48,35,3,2,0,0,Math.PI*2); c.fill();

    // Whiskers
    c.strokeStyle = '#aaa'; c.lineWidth = 1;
    [[28,34,42,35],[24,37,41,37],[27,40,41,39]].forEach(([x1,y1,x2,y2]) => {
      c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
      c.beginPath(); c.moveTo(W-x1+W/4,y1); c.lineTo(W-x2+W/4,y2); c.stroke();
    });

    // Arms
    c.fillStyle = '#f5a623';
    c.beginPath(); c.ellipse(26,65,8,18,-0.4,0,Math.PI*2); c.fill();
    c.beginPath(); c.ellipse(70,65,8,18,0.4,0,Math.PI*2); c.fill();

    // Legs
    c.fillStyle = '#e8951f';
    c.beginPath(); c.ellipse(38,85,10,10,0,0,Math.PI*2); c.fill();
    c.beginPath(); c.ellipse(58,85,10,10,0,0,Math.PI*2); c.fill();

    // Tail
    c.strokeStyle = '#f5a623'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(72,72); c.quadraticCurveTo(90,60,85,45);
    c.stroke();

    return { name: 'costume1', canvas: oc };
  }

  function getSprite(id) { return sprites.find(s => s.id === id); }
  function getSelected() { return getSprite(selectedSpriteId); }
  function getAllSprites() { return sprites; }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Draw each sprite
    sprites.forEach(sp => {
      if (!sp.visible) return;
      const costume = sp.costumes[sp.currentCostume] || sp.costumes[0];
      if (!costume) return;

      ctx.save();
      const cx = stageToCanvasX(sp.x);
      const cy = stageToCanvasY(sp.y);
      ctx.translate(cx, cy);

      // Rotation
      if (sp.rotationStyle === 'all around') {
        ctx.rotate(((sp.direction - 90) * Math.PI) / 180);
      } else if (sp.rotationStyle === 'left-right') {
        if (sp.direction < 0 || sp.direction > 180) ctx.scale(-1, 1);
      }

      const scale = sp.size / 100;
      ctx.scale(scale, scale);

      // Ghost effect
      ctx.globalAlpha = Math.max(0, 1 - (sp.effects.ghost || 0) / 100);

      // Draw costume canvas
      const cw = costume.canvas.width;
      const ch = costume.canvas.height;
      ctx.drawImage(costume.canvas, -cw/2, -ch/2);

      ctx.restore();

      // Speech bubble
      if (sp.sayText) {
        drawSpeechBubble(ctx, sp.sayText, stageToCanvasX(sp.x) + 30, stageToCanvasY(sp.y) - 50);
      }
      if (sp.thinkText) {
        drawThinkBubble(ctx, sp.thinkText, stageToCanvasX(sp.x) + 30, stageToCanvasY(sp.y) - 50);
      }
    });

    animFrame = requestAnimationFrame(render);
  }

  function drawSpeechBubble(ctx, text, x, y) {
    ctx.save();
    ctx.font = '12px sans-serif';
    const tw = Math.min(ctx.measureText(text).width + 16, 150);
    const th = 28;
    x = Math.min(x, W - tw - 4);
    y = Math.max(y, 4);

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, tw, th, 6);
    ctx.fill(); ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(x + 10, y + th);
    ctx.lineTo(x + 6, y + th + 8);
    ctx.lineTo(x + 18, y + th);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.fillText(text.slice(0, 20), x + 8, y + 18);
    ctx.restore();
  }

  function drawThinkBubble(ctx, text, x, y) {
    ctx.save();
    ctx.font = '12px sans-serif';
    const tw = Math.min(ctx.measureText(text).width + 16, 150);
    const th = 28;
    x = Math.min(x, W - tw - 4);
    y = Math.max(y, 4);

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, tw, th, 14);
    ctx.fill(); ctx.stroke();

    // Dots
    [0,1,2].forEach(i => {
      ctx.beginPath();
      ctx.arc(x+10+i*8, y+th+4+i*3, 3-i*0.5, 0, Math.PI*2);
      ctx.fillStyle='#fff'; ctx.fill(); ctx.stroke();
    });

    ctx.fillStyle = '#333';
    ctx.fillText(text.slice(0, 20), x + 8, y + 18);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
    ctx.closePath();
  }

  function updateSpriteList() {
    const list = document.getElementById('sprite-list');
    if (!list) return;
    list.innerHTML = '';
    sprites.forEach(sp => {
      const thumb = document.createElement('div');
      thumb.className = 'sprite-thumb' + (sp.id === selectedSpriteId ? ' selected' : '');
      thumb.dataset.spriteId = sp.id;

      const tc = document.createElement('canvas');
      tc.width = 54; tc.height = 54;
      const costume = sp.costumes[sp.currentCostume] || sp.costumes[0];
      if (costume) {
        tc.getContext('2d').drawImage(costume.canvas, 0,0,54,54);
      }

      const name = document.createElement('div');
      name.className = 'sprite-thumb-name';
      name.textContent = sp.name;

      thumb.appendChild(tc);
      thumb.appendChild(name);
      thumb.addEventListener('click', () => {
        selectedSpriteId = sp.id;
        updateSpriteList();
        updateSpriteProps();
        Editor.loadSpriteScripts(sp.id);
      });
      list.appendChild(thumb);
    });

    updateSpriteProps();
  }

  function updateSpriteProps() {
    const sp = getSelected();
    const panel = document.getElementById('sprite-props');
    if (!sp || !panel) return;
    panel.style.display = 'flex';
    document.getElementById('prop-name').value = sp.name;
    document.getElementById('prop-x').value = sp.x;
    document.getElementById('prop-y').value = sp.y;
    document.getElementById('prop-size').value = sp.size;
    document.getElementById('prop-dir').value = sp.direction;
  }

  function bindSpriteProps() {
    const bind = (id, prop, parse = v => v) => {
      document.getElementById(id)?.addEventListener('change', e => {
        const sp = getSelected();
        if (sp) { sp[prop] = parse(e.target.value); }
      });
    };
    bind('prop-name', 'name');
    bind('prop-x', 'x', Number);
    bind('prop-y', 'y', Number);
    bind('prop-size', 'size', Number);
    bind('prop-dir', 'direction', Number);
  }

  function stopAll() {
    sprites.forEach(sp => {
      sp.sayText = null; sp.thinkText = null;
      if (sp.sayTimeout) clearTimeout(sp.sayTimeout);
    });
  }

  return {
    init, addSprite, getSprite, getSelected, getAllSprites,
    updateSpriteList, updateSpriteProps, bindSpriteProps,
    stopAll,
    get mousePos() { return mousePos; },
    get mouseDown() { return mouseDown; },
    get keys() { return keys; },
    stageToCanvasX, stageToCanvasY,
    W, H
  };
})();
