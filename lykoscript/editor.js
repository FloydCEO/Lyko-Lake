// ===== EDITOR =====
// Handles workspace: block dragging from palette, snapping, script stacks per sprite

const Editor = (() => {
  // Map: spriteId -> array of script stack data
  const spriteScripts = {};
  let activeSpriteId = null;
  let dragging = null; // { el, fromStack, fromIndex, originX, originY, offsetX, offsetY }
  const ghost = document.getElementById('drag-ghost');

  function init() {
    const workspace = document.getElementById('script-area');

    // Drag start from palette
    document.getElementById('block-palette').addEventListener('mousedown', onPaletteMousedown);
    // Drag start from workspace
    workspace.addEventListener('mousedown', onWorkspaceMousedown);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // ===== Palette drag =====
  function onPaletteMousedown(e) {
    const blockEl = e.target.closest('.block[data-block-id]');
    if (!blockEl || !blockEl.dataset.fromPalette) return;
    e.preventDefault();

    const id = blockEl.dataset.blockId;
    const def = BLOCK_DEFS[id];
    if (!def) return;

    // Clone block for ghost
    const clone = buildBlockEl(id, def);
    clone.style.cssText = `display:block;pointer-events:none;`;
    ghost.innerHTML = '';
    ghost.appendChild(clone);
    ghost.style.display = 'block';

    const rect = blockEl.getBoundingClientRect();
    dragging = {
      blockId: id,
      def,
      fromPalette: true,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    positionGhost(e.clientX, e.clientY);
  }

  // ===== Workspace drag =====
  function onWorkspaceMousedown(e) {
    const blockEl = e.target.closest('.block[data-block-id]');
    const stackEl = e.target.closest('.script-stack');
    if (blockEl && blockEl.dataset.fromPalette) return;
    if (!stackEl && !blockEl) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    e.preventDefault();

    const target = stackEl || blockEl;
    const rect = target.getBoundingClientRect();

    // Clone for ghost
    const clone = target.cloneNode(true);
    clone.style.cssText = 'pointer-events:none;';
    ghost.innerHTML = '';
    ghost.appendChild(clone);
    ghost.style.display = 'block';

    dragging = {
      fromPalette: false,
      stackEl: target,
      originalParent: target.parentNode,
      originalLeft: parseInt(target.style.left) || 0,
      originalTop: parseInt(target.style.top) || 0,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };

    target.style.opacity = '0.4';
    positionGhost(e.clientX, e.clientY);
  }

  function onMouseMove(e) {
    if (!dragging) return;
    positionGhost(e.clientX, e.clientY);
  }

  function onMouseUp(e) {
    if (!dragging) return;
    ghost.style.display = 'none';

    const workspace = document.getElementById('script-area');
    const wsRect = workspace.getBoundingClientRect();
    const dropX = e.clientX - wsRect.left - dragging.offsetX;
    const dropY = e.clientY - wsRect.top - dragging.offsetY;

    const overWorkspace = e.clientX >= wsRect.left && e.clientX <= wsRect.right &&
                          e.clientY >= wsRect.top && e.clientY <= wsRect.bottom;

    if (dragging.fromPalette) {
      if (overWorkspace) {
        addBlockToWorkspace(dragging.blockId, dragging.def, dropX, dropY);
      }
    } else {
      const el = dragging.stackEl;
      el.style.opacity = '1';
      if (overWorkspace) {
        // Try snapping to nearby stack
        const snapped = trySnap(el, e.clientX, e.clientY);
        if (!snapped) {
          el.style.left = dropX + 'px';
          el.style.top = dropY + 'px';
          if (el.parentNode !== workspace) {
            workspace.appendChild(el);
          }
        }
      }
      saveScripts();
    }

    dragging = null;
  }

  function positionGhost(cx, cy) {
    ghost.style.left = (cx - (dragging?.offsetX||0)) + 'px';
    ghost.style.top = (cy - (dragging?.offsetY||0)) + 'px';
  }

  // ===== Add block to workspace as new stack =====
  function addBlockToWorkspace(id, def, x, y) {
    if (!activeSpriteId) return;
    const workspace = document.getElementById('script-area');

    const stack = document.createElement('div');
    stack.className = 'script-stack';
    stack.style.left = x + 'px';
    stack.style.top = y + 'px';

    const blockEl = buildBlockEl(id, def);
    stack.appendChild(blockEl);
    workspace.appendChild(stack);

    // Make stack itself draggable
    makeStackDraggable(stack);
    saveScripts();
    return stack;
  }

  function makeStackDraggable(stack) {
    stack.addEventListener('mousedown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      e.stopPropagation();
      // handled by workspace listener
    });
  }

  // ===== Snap logic =====
  function trySnap(draggedEl, mouseX, mouseY) {
    const workspace = document.getElementById('script-area');
    const stacks = Array.from(workspace.querySelectorAll('.script-stack'));
    const SNAP_DIST = 30;

    for (const stack of stacks) {
      if (stack === draggedEl) continue;
      const rect = stack.getBoundingClientRect();

      // Snap to bottom of stack
      const snapX = rect.left;
      const snapY = rect.bottom;
      const dist = Math.hypot(mouseX - snapX, mouseY - snapY);

      if (dist < SNAP_DIST * 2) {
        // Merge draggedEl blocks into this stack
        const blocks = Array.from(draggedEl.querySelectorAll(':scope > .block'));
        blocks.forEach(b => {
          b.remove();
          stack.appendChild(b);
        });
        draggedEl.remove();
        saveScripts();
        return true;
      }
    }
    return false;
  }

  // ===== Script persistence per sprite =====
  function saveScripts() {
    if (!activeSpriteId) return;
    const workspace = document.getElementById('script-area');
    const stacks = workspace.querySelectorAll('.script-stack');
    const data = Array.from(stacks).map(stack => {
      const blocks = Array.from(stack.querySelectorAll(':scope > .block')).map(b => ({
        id: b.dataset.blockId,
        inputs: readInputs(b),
      }));
      return { x: parseInt(stack.style.left)||0, y: parseInt(stack.style.top)||0, blocks };
    });
    spriteScripts[activeSpriteId] = data;
  }

  function loadSpriteScripts(spriteId) {
    activeSpriteId = spriteId;
    const workspace = document.getElementById('script-area');
    workspace.innerHTML = '';
    const scripts = spriteScripts[spriteId] || [];
    scripts.forEach(sd => {
      const stack = document.createElement('div');
      stack.className = 'script-stack';
      stack.style.left = sd.x + 'px';
      stack.style.top = sd.y + 'px';
      sd.blocks.forEach(bd => {
        const def = BLOCK_DEFS[bd.id];
        if (!def) return;
        const el = buildBlockEl(bd.id, def, bd.inputs);
        stack.appendChild(el);
      });
      workspace.appendChild(stack);
    });
  }

  function getScripts(spriteId) {
    return spriteScripts[spriteId] || [];
  }

  return { init, loadSpriteScripts, getScripts, saveScripts, addBlockToWorkspace };
})();
