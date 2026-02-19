// ===== BLOCK DEFINITIONS =====
// Each block: { id, category, shape, label, inputs, fields }
// shapes: 'stack' | 'hat' | 'c-block' | 'reporter' | 'boolean' | 'terminator'

const CATEGORIES = [
  { id: 'motion',    label: 'Motion',    color: '#4c97ff' },
  { id: 'looks',     label: 'Looks',     color: '#9966ff' },
  { id: 'sound',     label: 'Sound',     color: '#cf63cf' },
  { id: 'events',    label: 'Events',    color: '#ffab19' },
  { id: 'control',   label: 'Control',   color: '#ffab19' },
  { id: 'sensing',   label: 'Sensing',   color: '#5cb1d6' },
  { id: 'operators', label: 'Operators', color: '#59c059' },
  { id: 'variables', label: 'Variables', color: '#ff8c1a' },
  { id: 'myblocks',  label: 'My Blocks', color: '#ff6680' },
];

const BLOCK_DEFS = {
  // ===== MOTION =====
  'move_steps':        { cat:'motion', shape:'stack',    parts:['move', {type:'num',val:'10'}, 'steps'] },
  'turn_right':        { cat:'motion', shape:'stack',    parts:['turn ↻', {type:'num',val:'15'}, 'degrees'] },
  'turn_left':         { cat:'motion', shape:'stack',    parts:['turn ↺', {type:'num',val:'15'}, 'degrees'] },
  'goto_xy':           { cat:'motion', shape:'stack',    parts:['go to x:', {type:'num',val:'0'}, 'y:', {type:'num',val:'0'}] },
  'goto_random':       { cat:'motion', shape:'stack',    parts:['go to', {type:'dropdown',val:'random position',opts:['random position','mouse-pointer']}] },
  'glide_secs_xy':     { cat:'motion', shape:'stack',    parts:['glide', {type:'num',val:'1'}, 'secs to x:', {type:'num',val:'0'}, 'y:', {type:'num',val:'0'}] },
  'point_direction':   { cat:'motion', shape:'stack',    parts:['point in direction', {type:'num',val:'90'}] },
  'point_towards':     { cat:'motion', shape:'stack',    parts:['point towards', {type:'dropdown',val:'mouse-pointer',opts:['mouse-pointer']}] },
  'change_x':          { cat:'motion', shape:'stack',    parts:['change x by', {type:'num',val:'10'}] },
  'set_x':             { cat:'motion', shape:'stack',    parts:['set x to', {type:'num',val:'0'}] },
  'change_y':          { cat:'motion', shape:'stack',    parts:['change y by', {type:'num',val:'10'}] },
  'set_y':             { cat:'motion', shape:'stack',    parts:['set y to', {type:'num',val:'0'}] },
  'if_on_edge_bounce': { cat:'motion', shape:'stack',    parts:['if on edge, bounce'] },
  'set_rotation_style':{ cat:'motion', shape:'stack',    parts:['set rotation style', {type:'dropdown',val:'left-right',opts:['left-right','don\'t rotate','all around']}] },
  'x_pos':             { cat:'motion', shape:'reporter', parts:['x position'] },
  'y_pos':             { cat:'motion', shape:'reporter', parts:['y position'] },
  'direction_rep':     { cat:'motion', shape:'reporter', parts:['direction'] },

  // ===== LOOKS =====
  'say_timed':         { cat:'looks',  shape:'stack',    parts:['say', {type:'str',val:'Hello!'}, 'for', {type:'num',val:'2'}, 'seconds'] },
  'say':               { cat:'looks',  shape:'stack',    parts:['say', {type:'str',val:'Hello!'}] },
  'think_timed':       { cat:'looks',  shape:'stack',    parts:['think', {type:'str',val:'Hmm...'}, 'for', {type:'num',val:'2'}, 'seconds'] },
  'think':             { cat:'looks',  shape:'stack',    parts:['think', {type:'str',val:'Hmm...'}] },
  'switch_costume':    { cat:'looks',  shape:'stack',    parts:['switch costume to', {type:'dropdown',val:'costume1',opts:['costume1','costume2']}] },
  'next_costume':      { cat:'looks',  shape:'stack',    parts:['next costume'] },
  'switch_backdrop':   { cat:'looks',  shape:'stack',    parts:['switch backdrop to', {type:'dropdown',val:'backdrop1',opts:['backdrop1']}] },
  'next_backdrop':     { cat:'looks',  shape:'stack',    parts:['next backdrop'] },
  'change_size':       { cat:'looks',  shape:'stack',    parts:['change size by', {type:'num',val:'10'}] },
  'set_size':          { cat:'looks',  shape:'stack',    parts:['set size to', {type:'num',val:'100'}, '%'] },
  'set_effect':        { cat:'looks',  shape:'stack',    parts:['set', {type:'dropdown',val:'color',opts:['color','fisheye','whirl','pixelate','mosaic','brightness','ghost']}, 'effect to', {type:'num',val:'0'}] },
  'change_effect':     { cat:'looks',  shape:'stack',    parts:['change', {type:'dropdown',val:'color',opts:['color','fisheye','whirl','pixelate','mosaic','brightness','ghost']}, 'effect by', {type:'num',val:'25'}] },
  'clear_effects':     { cat:'looks',  shape:'stack',    parts:['clear graphic effects'] },
  'show':              { cat:'looks',  shape:'stack',    parts:['show'] },
  'hide':              { cat:'looks',  shape:'stack',    parts:['hide'] },
  'go_to_layer':       { cat:'looks',  shape:'stack',    parts:['go to', {type:'dropdown',val:'front',opts:['front','back']}, 'layer'] },
  'go_layers':         { cat:'looks',  shape:'stack',    parts:['go', {type:'dropdown',val:'forward',opts:['forward','backward']}, {type:'num',val:'1'}, 'layers'] },
  'costume_num':       { cat:'looks',  shape:'reporter', parts:['costume number'] },
  'backdrop_name':     { cat:'looks',  shape:'reporter', parts:['backdrop name'] },
  'size_rep':          { cat:'looks',  shape:'reporter', parts:['size'] },

  // ===== SOUND =====
  'play_sound_until':  { cat:'sound',  shape:'stack',    parts:['play sound', {type:'dropdown',val:'pop',opts:['pop']}, 'until done'] },
  'play_sound':        { cat:'sound',  shape:'stack',    parts:['start sound', {type:'dropdown',val:'pop',opts:['pop']}] },
  'stop_sounds':       { cat:'sound',  shape:'stack',    parts:['stop all sounds'] },
  'change_volume':     { cat:'sound',  shape:'stack',    parts:['change volume by', {type:'num',val:'-10'}] },
  'set_volume':        { cat:'sound',  shape:'stack',    parts:['set volume to', {type:'num',val:'100'}, '%'] },
  'volume_rep':        { cat:'sound',  shape:'reporter', parts:['volume'] },

  // ===== EVENTS =====
  'when_flag':         { cat:'events', shape:'hat',      parts:['when 🚀 clicked'] },
  'when_key':          { cat:'events', shape:'hat',      parts:['when', {type:'dropdown',val:'space',opts:['space','left arrow','right arrow','up arrow','down arrow','any','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','0','1','2','3','4','5','6','7','8','9']}, 'key pressed'] },
  'when_sprite_clicked':{ cat:'events',shape:'hat',      parts:['when this sprite clicked'] },
  'when_backdrop':     { cat:'events', shape:'hat',      parts:['when backdrop switches to', {type:'dropdown',val:'backdrop1',opts:['backdrop1']}] },
  'when_gt':           { cat:'events', shape:'hat',      parts:['when', {type:'dropdown',val:'loudness',opts:['loudness','timer']}, '>', {type:'num',val:'10'}] },
  'when_msg':          { cat:'events', shape:'hat',      parts:['when I receive', {type:'dropdown',val:'message1',opts:['message1']}] },
  'broadcast':         { cat:'events', shape:'stack',    parts:['broadcast', {type:'dropdown',val:'message1',opts:['message1']}] },
  'broadcast_wait':    { cat:'events', shape:'stack',    parts:['broadcast', {type:'dropdown',val:'message1',opts:['message1']}, 'and wait'] },

  // ===== CONTROL =====
  'wait_secs':         { cat:'control',shape:'stack',    parts:['wait', {type:'num',val:'1'}, 'seconds'] },
  'repeat':            { cat:'control',shape:'c-block',  parts:['repeat', {type:'num',val:'10'}] },
  'forever':           { cat:'control',shape:'c-block',  parts:['forever'], terminator:true },
  'if':                { cat:'control',shape:'c-block',  parts:['if', {type:'bool'}] },
  'if_else':           { cat:'control',shape:'c-block',  parts:['if', {type:'bool'}, 'then'], hasElse:true },
  'wait_until':        { cat:'control',shape:'stack',    parts:['wait until', {type:'bool'}] },
  'repeat_until':      { cat:'control',shape:'c-block',  parts:['repeat until', {type:'bool'}] },
  'stop':              { cat:'control',shape:'terminator',parts:['stop', {type:'dropdown',val:'all',opts:['all','this script','other scripts in sprite']}] },
  'when_clone_start':  { cat:'control',shape:'hat',      parts:['when I start as a clone'] },
  'create_clone':      { cat:'control',shape:'stack',    parts:['create clone of', {type:'dropdown',val:'myself',opts:['myself']}] },
  'delete_clone':      { cat:'control',shape:'terminator',parts:['delete this clone'] },

  // ===== SENSING =====
  'touching':          { cat:'sensing',shape:'boolean',  parts:['touching', {type:'dropdown',val:'mouse-pointer',opts:['mouse-pointer','edge']}] },
  'touching_color':    { cat:'sensing',shape:'boolean',  parts:['touching color', {type:'color',val:'#00ff00'}] },
  'color_touching':    { cat:'sensing',shape:'boolean',  parts:['color', {type:'color',val:'#ff0000'}, 'is touching', {type:'color',val:'#0000ff'}] },
  'distance_to':       { cat:'sensing',shape:'reporter', parts:['distance to', {type:'dropdown',val:'mouse-pointer',opts:['mouse-pointer']}] },
  'ask_wait':          { cat:'sensing',shape:'stack',    parts:['ask', {type:'str',val:"What's your name?"}, 'and wait'] },
  'answer':            { cat:'sensing',shape:'reporter', parts:['answer'] },
  'key_pressed':       { cat:'sensing',shape:'boolean',  parts:['key', {type:'dropdown',val:'space',opts:['space','left arrow','right arrow','up arrow','down arrow','any']}, 'pressed?'] },
  'mouse_down':        { cat:'sensing',shape:'boolean',  parts:['mouse down?'] },
  'mouse_x':           { cat:'sensing',shape:'reporter', parts:['mouse x'] },
  'mouse_y':           { cat:'sensing',shape:'reporter', parts:['mouse y'] },
  'set_drag':          { cat:'sensing',shape:'stack',    parts:['set drag mode', {type:'dropdown',val:'draggable',opts:['draggable','not draggable']}] },
  'loudness':          { cat:'sensing',shape:'reporter', parts:['loudness'] },
  'timer':             { cat:'sensing',shape:'reporter', parts:['timer'] },
  'reset_timer':       { cat:'sensing',shape:'stack',    parts:['reset timer'] },
  'current_time':      { cat:'sensing',shape:'reporter', parts:['current', {type:'dropdown',val:'year',opts:['year','month','date','day of week','hour','minute','second']}] },
  'days_since_2000':   { cat:'sensing',shape:'reporter', parts:['days since 2000'] },
  'username':          { cat:'sensing',shape:'reporter', parts:['username'] },

  // ===== OPERATORS =====
  'add':               { cat:'operators',shape:'reporter', parts:[{type:'num',val:''}, '+', {type:'num',val:''}] },
  'subtract':          { cat:'operators',shape:'reporter', parts:[{type:'num',val:''}, '-', {type:'num',val:''}] },
  'multiply':          { cat:'operators',shape:'reporter', parts:[{type:'num',val:''}, '*', {type:'num',val:''}] },
  'divide':            { cat:'operators',shape:'reporter', parts:[{type:'num',val:''}, '/', {type:'num',val:''}] },
  'random':            { cat:'operators',shape:'reporter', parts:['pick random', {type:'num',val:'1'}, 'to', {type:'num',val:'10'}] },
  'gt':                { cat:'operators',shape:'boolean',  parts:[{type:'num',val:''}, '>', {type:'num',val:'50'}] },
  'lt':                { cat:'operators',shape:'boolean',  parts:[{type:'num',val:''}, '<', {type:'num',val:'50'}] },
  'eq':                { cat:'operators',shape:'boolean',  parts:[{type:'any',val:''}, '=', {type:'any',val:'50'}] },
  'and':               { cat:'operators',shape:'boolean',  parts:[{type:'bool'}, 'and', {type:'bool'}] },
  'or':                { cat:'operators',shape:'boolean',  parts:[{type:'bool'}, 'or', {type:'bool'}] },
  'not':               { cat:'operators',shape:'boolean',  parts:['not', {type:'bool'}] },
  'join':              { cat:'operators',shape:'reporter', parts:['join', {type:'str',val:'apple'}, {type:'str',val:'banana'}] },
  'letter_of':         { cat:'operators',shape:'reporter', parts:['letter', {type:'num',val:'1'}, 'of', {type:'str',val:'apple'}] },
  'length_of':         { cat:'operators',shape:'reporter', parts:['length of', {type:'str',val:'apple'}] },
  'contains':          { cat:'operators',shape:'boolean',  parts:[{type:'str',val:'apple'}, 'contains', {type:'str',val:'a'}] },
  'mod':               { cat:'operators',shape:'reporter', parts:[{type:'num',val:''}, 'mod', {type:'num',val:''}] },
  'round':             { cat:'operators',shape:'reporter', parts:['round', {type:'num',val:''}] },
  'math_op':           { cat:'operators',shape:'reporter', parts:[{type:'dropdown',val:'abs',opts:['abs','floor','ceiling','sqrt','sin','cos','tan','asin','acos','atan','ln','log','e^','10^']}, 'of', {type:'num',val:''}] },

  // ===== VARIABLES =====
  'set_var':           { cat:'variables',shape:'stack',   parts:['set', {type:'varname'}, 'to', {type:'any',val:'0'}] },
  'change_var':        { cat:'variables',shape:'stack',   parts:['change', {type:'varname'}, 'by', {type:'num',val:'1'}] },
  'show_var':          { cat:'variables',shape:'stack',   parts:['show variable', {type:'varname'}] },
  'hide_var':          { cat:'variables',shape:'stack',   parts:['hide variable', {type:'varname'}] },
};

// ===== Block DOM Builder =====
function buildBlockEl(id, def, values = {}) {
  const el = document.createElement('div');
  el.className = `block ${def.cat} ${def.shape}`;
  el.dataset.blockId = id;

  if (def.shape === 'c-block') {
    // Top row
    const top = document.createElement('div');
    top.className = 'block-top';
    def.parts.forEach((p, i) => top.appendChild(buildPart(p, id, i, values)));
    el.appendChild(top);

    // Mouth (inner drop zone)
    const mouth = document.createElement('div');
    mouth.className = 'block-mouth drop-zone';
    mouth.dataset.dropType = 'inner';
    el.appendChild(mouth);

    // Bottom cap
    const bottom = document.createElement('div');
    bottom.className = 'block-bottom';
    if (!def.terminator) {
      const cap = document.createElement('span');
      cap.textContent = def.hasElse ? 'end' : '';
      bottom.appendChild(cap);
    }
    el.appendChild(bottom);
  } else {
    def.parts.forEach((p, i) => el.appendChild(buildPart(p, id, i, values)));
  }

  return el;
}

function buildPart(p, blockId, idx, values) {
  if (typeof p === 'string') {
    const span = document.createElement('span');
    span.textContent = p;
    return span;
  }

  const key = `${blockId}_${idx}`;
  const val = values[key] !== undefined ? values[key] : p.val;

  if (p.type === 'num' || p.type === 'str' || p.type === 'any') {
    const inp = document.createElement('input');
    inp.type = p.type === 'num' ? 'number' : 'text';
    inp.className = 'block-input' + (p.type === 'str' ? ' wide' : '');
    inp.value = val ?? '';
    inp.dataset.inputKey = key;
    inp.addEventListener('mousedown', e => e.stopPropagation());
    return inp;
  }

  if (p.type === 'dropdown') {
    const sel = document.createElement('select');
    sel.className = 'block-dropdown';
    sel.dataset.inputKey = key;
    (p.opts || []).forEach(o => {
      const opt = document.createElement('option');
      opt.value = o; opt.textContent = o;
      if (o === val) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('mousedown', e => e.stopPropagation());
    return sel;
  }

  if (p.type === 'bool') {
    const slot = document.createElement('div');
    slot.className = 'bool-slot drop-zone';
    slot.dataset.dropType = 'bool';
    slot.style.cssText = 'display:inline-block;min-width:40px;height:20px;background:rgba(0,0,0,0.2);border-radius:10px;vertical-align:middle;';
    return slot;
  }

  if (p.type === 'varname') {
    const sel = document.createElement('select');
    sel.className = 'block-dropdown var-select';
    sel.dataset.inputKey = key;
    // populated dynamically
    return sel;
  }

  if (p.type === 'color') {
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.value = val || '#ff0000';
    inp.dataset.inputKey = key;
    inp.style.cssText = 'width:28px;height:20px;border:none;border-radius:3px;cursor:pointer;';
    inp.addEventListener('mousedown', e => e.stopPropagation());
    return inp;
  }

  const span = document.createElement('span');
  span.textContent = JSON.stringify(p);
  return span;
}

// ===== Read inputs from a block element =====
function readInputs(el) {
  const vals = {};
  el.querySelectorAll('[data-input-key]').forEach(inp => {
    vals[inp.dataset.inputKey] = inp.tagName === 'SELECT' ? inp.value : inp.value;
  });
  return vals;
}

// ===== Serialize a stack of blocks to JSON =====
function serializeStack(stackEl) {
  const blocks = [];
  stackEl.querySelectorAll(':scope > .block, :scope > .block-top > .block').forEach(b => {
    // simplified — full nesting handled elsewhere
  });
  return blocks;
}

// ===== Palette Renderer =====
function renderPalette(categoryId) {
  const palette = document.getElementById('block-palette');
  palette.innerHTML = '';
  Object.entries(BLOCK_DEFS).forEach(([id, def]) => {
    if (def.cat !== categoryId) return;
    const el = buildBlockEl(id, def);
    el.style.marginBottom = '4px';
    el.dataset.fromPalette = '1';
    palette.appendChild(el);
  });
}

function renderCategoryTabs() {
  const tabs = document.getElementById('category-tabs');
  tabs.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-tab';
    btn.dataset.cat = cat.id;
    btn.innerHTML = `<span class="cat-dot" style="background:${cat.color}"></span>${cat.label}`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPalette(cat.id);
    });
    tabs.appendChild(btn);
  });
  // Auto-select first
  tabs.firstChild.classList.add('active');
  renderPalette(CATEGORIES[0].id);
}
