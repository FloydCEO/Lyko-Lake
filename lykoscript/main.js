// ===== MAIN =====
// Initializes the app and wires everything together

document.addEventListener('DOMContentLoaded', () => {
  // Init subsystems
  renderCategoryTabs();
  Stage.init();
  Editor.init();
  Stage.bindSpriteProps();

  // Set first sprite as active in editor
  const sprites = Stage.getAllSprites();
  if (sprites.length > 0) {
    Editor.loadSpriteScripts(sprites[0].id);
  }

  // Green flag
  document.getElementById('btn-flag').addEventListener('click', () => {
    // Save any pending script changes first
    Editor.saveScripts();
    Runtime.start();
  });

  // Stop button
  document.getElementById('btn-stop').addEventListener('click', () => {
    Runtime.stopAll();
  });

  // Add sprite button
  document.getElementById('btn-add-sprite').addEventListener('click', () => {
    const name = prompt('Sprite name:', 'Sprite' + (Stage.getAllSprites().length + 1));
    if (name) {
      Stage.addSprite(name);
    }
  });

  // Keyboard shortcut: Enter/Space to run
  document.addEventListener('keydown', e => {
    if (e.key === 'F5') { e.preventDefault(); Runtime.start(); }
    if (e.key === 'F6') { e.preventDefault(); Runtime.stopAll(); }
  });

  // Workspace panning (middle mouse or right-click drag)
  const workspace = document.getElementById('script-area');
  let panning = false, panStart = null, panOrigin = null;
  let panX = 0, panY = 0;

  workspace.addEventListener('mousedown', e => {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      panning = true;
      panStart = { x: e.clientX, y: e.clientY };
      panOrigin = { x: panX, y: panY };
      workspace.style.cursor = 'grabbing';
    }
  });

  document.addEventListener('mousemove', e => {
    if (!panning) return;
    panX = panOrigin.x + (e.clientX - panStart.x);
    panY = panOrigin.y + (e.clientY - panStart.y);
    workspace.style.setProperty('--pan-x', panX + 'px');
    workspace.style.setProperty('--pan-y', panY + 'px');
  });

  document.addEventListener('mouseup', e => {
    if (e.button === 1 || e.button === 2) {
      panning = false;
      workspace.style.cursor = '';
    }
  });

  workspace.addEventListener('contextmenu', e => e.preventDefault());

  // Toast helper (available globally)
  window.toast = function(msg, duration = 2000) {
    let tc = document.getElementById('toast-container');
    if (!tc) {
      tc = document.createElement('div');
      tc.id = 'toast-container';
      document.body.appendChild(tc);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    tc.appendChild(t);
    setTimeout(() => t.remove(), duration);
  };

  // Variable name dropdowns - populate with sprite variables
  document.addEventListener('click', e => {
    const sel = e.target.closest('select.var-select');
    if (!sel) return;
    const sp = Stage.getSelected();
    const vars = sp ? Object.keys(sp.variables || {}) : [];
    const existing = Array.from(sel.options).map(o => o.value);
    vars.forEach(v => {
      if (!existing.includes(v)) {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        sel.appendChild(opt);
      }
    });
  });

  // Right-click on workspace block to delete
  document.getElementById('script-area').addEventListener('contextmenu', e => {
    e.preventDefault();
    const block = e.target.closest('.block');
    const stack = e.target.closest('.script-stack');
    if (block && !block.dataset.fromPalette) {
      if (confirm('Delete this block?')) {
        block.remove();
        if (stack && stack.children.length === 0) stack.remove();
        Editor.saveScripts();
      }
    }
  });

  console.log('%cLykoScript loaded ✓', 'color:#00ffe1;font-family:monospace;font-size:14px');
});
