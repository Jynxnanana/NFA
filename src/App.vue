<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Activity, ArrowRight, Braces, Check, ChevronDown, CircleHelp, CirclePlus, Code2, Copy, Download, FileJson2, GitBranch, Keyboard, Layers2, Maximize2, Minimize2, MoreHorizontal, Moon, Play, Plus, RotateCcw, Settings2, Sparkles, Sun, Trash2, X, Zap } from 'lucide-vue-next'

const states = ref([
  { id: 'q0', x: 180, y: 206 }, { id: 'q1', x: 445, y: 135 }, { id: 'q2', x: 445, y: 285 }, { id: 'q3', x: 710, y: 206 },
])
const alphabet = ref(['0', '1'])
const transitions = ref([
  { from: 'q0', to: 'q1', symbol: '0' }, { from: 'q0', to: 'q2', symbol: 'ε' },
  { from: 'q1', to: 'q1', symbol: '1' }, { from: 'q1', to: 'q3', symbol: '1' },
  { from: 'q2', to: 'q3', symbol: '0' }, { from: 'q3', to: 'q3', symbol: '1' },
])
const start = ref('q0'), finals = ref(['q3']), activeTab = ref('Simulator')
const inputString = ref('0101'), result = ref(null), stepTrace = ref([]), selectedState = ref(null)
const showAddTransition = ref(false), newTransition = ref({ from: 'q0', to: 'q1', symbol: '0' })
const showAlphabetInput = ref(false), alphabetInput = ref('')
const showSettings = ref(false)
const dragging = ref(null), diagram = ref(null), diagramCard = ref(null), diagramExpanded = ref(false), zoom = ref(1), toast = ref('')
const isDark = ref(localStorage.getItem('orbit-theme') === 'dark')
const showDiagramGrid = ref(localStorage.getItem('orbit-show-grid') !== 'false')
const highlightActiveStates = ref(localStorage.getItem('orbit-highlight-active') !== 'false')
watch(isDark, value => {
  localStorage.setItem('orbit-theme', value ? 'dark' : 'light')
  document.documentElement.style.colorScheme = value ? 'dark' : 'light'
}, { immediate: true })
watch(showDiagramGrid, value => localStorage.setItem('orbit-show-grid', String(value)))
watch(highlightActiveStates, value => localStorage.setItem('orbit-highlight-active', String(value)))
const label = id => states.value.find(s => s.id === id)?.id ?? id
const edgePath = (t) => {
  const a = states.value.find(s => s.id === t.from), b = states.value.find(s => s.id === t.to)
  if (!a || !b) return ''
  if (a.id === b.id) return `M ${a.x - 19} ${a.y - 20} C ${a.x - 72} ${a.y - 91}, ${a.x + 72} ${a.y - 91}, ${a.x + 19} ${a.y - 20}`
  const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1, ux=dx/d, uy=dy/d
  const sx=a.x+ux*37-uy*12, sy=a.y+uy*37+ux*12, ex=b.x-ux*39-uy*12, ey=b.y-uy*39+ux*12
  const parallel=transitions.value.filter(e=>e.from===t.from&&e.to===t.to)
  const bend=parallel.length>1 ? (parallel.indexOf(t)===0?-26:26) : 0
  const mx=(sx+ex)/2-uy*bend, my=(sy+ey)/2+ux*bend
  return `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`
}
const edgeLabel = t => {
  const a=states.value.find(s=>s.id===t.from), b=states.value.find(s=>s.id===t.to)
  if (!a||!b) return {x:0,y:0}
  if(a.id===b.id) return {x:a.x,y:a.y-77}
  const p=transitions.value.filter(e=>e.from===t.from&&e.to===t.to), bend=p.length>1?(p.indexOf(t)===0?-26:26):0
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1
  return {x:(a.x+b.x)/2-dy/d*bend,y:(a.y+b.y)/2+dx/d*bend-12}
}
const table = computed(() => states.value.map(s => ({ state:s.id, cells:[...alphabet.value,'ε'].map(sym => transitions.value.filter(t=>t.from===s.id&&t.symbol===sym).map(t=>t.to)) })))
const tuple = computed(() => `M = (Q, Σ, δ, q₀, F)\nQ = {${states.value.map(s=>s.id).join(', ')}}\nΣ = {${alphabet.value.join(', ')}}\nq₀ = ${start.value}\nF = {${finals.value.join(', ')}}\nδ = Transition function`)
const statusColor = computed(() => result.value === 'ACCEPTED' ? 'accept' : 'reject')

function closure(input) {
  const seen = new Set(input), stack = [...input]
  while(stack.length){ const s=stack.pop(); for(const t of transitions.value) if(t.from===s&&t.symbol==='ε'&&!seen.has(t.to)){seen.add(t.to);stack.push(t.to)} }
  return [...seen]
}
function simulate() {
  let current=closure([start.value]); const trace=[{index:0,symbol:'ε',states:[...current]}]
  for(let i=0;i<inputString.value.length;i++){
    const symbol=inputString.value[i]
    if(!alphabet.value.includes(symbol)){result.value='INVALID';stepTrace.value=[{index:i,symbol,states:current,error:`“${symbol}” is not in the input alphabet`}];return}
    const next=new Set(); for(const s of current) for(const t of transitions.value) if(t.from===s&&t.symbol===symbol) next.add(t.to)
    current=closure([...next]); trace.push({index:i+1,symbol,states:[...current]})
  }
  stepTrace.value=trace; result.value=current.some(s=>finals.value.includes(s))?'ACCEPTED':'REJECTED'
}
function addState(){ const n=states.value.length; const id=`q${n}`; states.value.push({id,x:250+(n%3)*190,y:110+Math.floor(n/3)*120}); notify(`Added ${id}`) }
function deleteState(id){ if(states.value.length<=1)return notify('Keep at least one state'); states.value=states.value.filter(s=>s.id!==id);transitions.value=transitions.value.filter(t=>t.from!==id&&t.to!==id);finals.value=finals.value.filter(f=>f!==id);if(start.value===id)start.value=states.value[0].id;selectedState.value=null;notify(`Deleted ${id}`) }
function addTransition(){ if(!alphabet.value.includes(newTransition.value.symbol)&&newTransition.value.symbol!=='ε')return notify('Choose a symbol from the alphabet');transitions.value.push({...newTransition.value});showAddTransition.value=false;notify('Transition added') }
function addSymbol(){const s=alphabetInput.value.trim();if(!s||s.length!==1||s==='ε'||alphabet.value.includes(s))return notify('Enter one unique character');alphabet.value.push(s);alphabetInput.value='';showAlphabetInput.value=false}
function notify(msg){toast.value=msg;setTimeout(()=>toast.value='',2200)}
function toggleFinal(id){finals.value=finals.value.includes(id)?finals.value.filter(x=>x!==id):[...finals.value,id]}
function startDrag(e,s){dragging.value={id:s.id,offsetX:e.clientX,offsetY:e.clientY,originX:s.x,originY:s.y};selectedState.value=s.id;window.addEventListener('pointermove',moveDrag);window.addEventListener('pointerup',stopDrag,{once:true})}
function moveDrag(e){if(!dragging.value||!diagram.value)return;const box=diagram.value.getBoundingClientRect(),scaleX=800/box.width,scaleY=410/box.height;const s=states.value.find(s=>s.id===dragging.value.id);if(s){s.x=Math.max(42,Math.min(758,dragging.value.originX+(e.clientX-dragging.value.offsetX)*scaleX));s.y=Math.max(42,Math.min(368,dragging.value.originY+(e.clientY-dragging.value.offsetY)*scaleY))}}
function stopDrag(){dragging.value=null;window.removeEventListener('pointermove',moveDrag)}
function exportJson(){const blob=new Blob([JSON.stringify({states:states.value,alphabet:alphabet.value,transitions:transitions.value,start:start.value,finals:finals.value},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='my-nfa.json';a.click();URL.revokeObjectURL(a.href);notify('NFA exported')}
function reset(){result.value=null;stepTrace.value=[]}
async function expandDiagram(){
  diagramExpanded.value=true
  if(window.matchMedia('(max-width: 640px)').matches){
    try {
      await diagramCard.value?.requestFullscreen?.()
      await screen.orientation?.lock?.('landscape')
    } catch { notify('Turn your phone sideways for landscape view') }
  }
}
async function collapseDiagram(){
  diagramExpanded.value=false
  try { screen.orientation?.unlock?.() } catch {}
  if(document.fullscreenElement){try { await document.exitFullscreen() } catch {}}
}
function onFullscreenChange(){
  if(!document.fullscreenElement && diagramExpanded.value){
    diagramExpanded.value=false
    try { screen.orientation?.unlock?.() } catch {}
  }
}
onMounted(()=>document.addEventListener('fullscreenchange',onFullscreenChange))
onBeforeUnmount(()=>document.removeEventListener('fullscreenchange',onFullscreenChange))
</script>

<template>
  <div class="app-shell" :class="{'dark-mode':isDark}">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark"><GitBranch :size="18" /></div><div><div class="brand-name">orbit<span>.</span></div><div class="brand-caption">AUTOMATA STUDIO</div></div></div>
      <div class="workspace-label">WORKSPACE</div>
      <button class="workspace-select"><div class="workspace-avatar">A</div><span>Automata Lab</span><ChevronDown :size="14" /></button>
      <div class="nav-heading">BUILD</div>
      <button class="nav-item active"><Braces :size="17"/><span>NFA Builder</span><span class="nav-dot"></span></button>
      <button class="nav-item" @click="activeTab='Transition Table'"><Layers2 :size="17"/><span>Transition table</span></button>
      <button class="nav-item" @click="activeTab='Formal Definition'"><Code2 :size="17"/><span>Formal definition</span></button>
      <div class="nav-heading tools-heading">TOOLS</div>
      <button class="nav-item" @click="activeTab='Simulator'"><Play :size="16"/><span>String simulator</span><span class="side-badge">NEW</span></button>
      <button class="nav-item" @click="exportJson"><FileJson2 :size="17"/><span>Export as JSON</span></button>
      <div class="sidebar-bottom"><div class="help-card"><div class="help-icon"><CircleHelp :size="17"/></div><div><strong>New to NFAs?</strong><p>Read the quick guide and get started.</p><button @click="notify('An NFA accepts a string when at least one path ends in a final state.')">Explore guide <ArrowRight :size="12"/></button></div></div><div class="user-row"><div class="user-avatar">M</div><div class="user-meta"><strong>My workspace</strong><span>Free plan</span></div><MoreHorizontal :size="18" class="user-more"/></div></div>
    </aside>

    <main class="main-content">
      <header class="topbar"><div class="breadcrumbs"><span>Projects</span><span class="crumb-slash">/</span><span class="crumb-current">NFA Builder</span><span class="saved-dot"></span><span class="saved-label">All changes saved</span></div><div class="top-actions"><button class="icon-button" :title="isDark?'Switch to light mode':'Switch to dark mode'" :aria-label="isDark?'Switch to light mode':'Switch to dark mode'" @click="isDark=!isDark"><Sun v-if="isDark" :size="16"/><Moon v-else :size="16"/></button><button class="icon-button" title="Keyboard shortcuts" @click="notify('Drag states to reposition · Click a state to select')"><Keyboard :size="16"/></button><button class="icon-button" title="Settings" @click="showSettings=true"><Settings2 :size="16"/></button><button class="share-button" @click="exportJson"><Download :size="14"/> Export <ChevronDown :size="13"/></button><div class="profile-avatar">M</div></div></header>
      <div class="page-content">
        <div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-icon"><Sparkles :size="12"/></span> YOUR AUTOMATA WORKSPACE</div><h1>NFA Builder</h1><p class="subtitle">Design, visualize, and test your nondeterministic finite automata.</p></div><button class="new-state-button" @click="addState"><Plus :size="16"/> Add state</button></div>
        <div class="editor-layout">
          <section id="diagram-card" ref="diagramCard" class="card diagram-card" :class="{'diagram-expanded':diagramExpanded}">
            <div class="card-top"><div><div class="section-title">State diagram <span class="live-indicator"><i></i> LIVE</span></div><div class="section-subtitle">Drag states to arrange your automaton</div></div><div class="diagram-head-tools"><button v-if="diagramExpanded" class="diagram-theme-button" :aria-label="isDark?'Switch to light mode':'Switch to dark mode'" :title="isDark?'Switch to light mode':'Switch to dark mode'" @click="isDark=!isDark"><Sun v-if="isDark" :size="16"/><Moon v-else :size="16"/></button><button v-if="diagramExpanded" class="diagram-theme-button" aria-label="Settings" title="Settings" @click="showSettings=true"><Settings2 :size="16"/></button><button class="diagram-expand-button" :aria-label="diagramExpanded?'Minimize diagram':'Maximize diagram'" :title="diagramExpanded?'Minimize diagram':'Maximize diagram'" @click="diagramExpanded?collapseDiagram():expandDiagram()"><Minimize2 v-if="diagramExpanded" :size="16"/><Maximize2 v-else :size="16"/></button><button class="dots-button" title="Export NFA" @click="exportJson"><MoreHorizontal :size="18"/></button></div></div>
            <div class="diagram-wrap" ref="diagram">
              <div v-if="showDiagramGrid" class="diagram-grid"></div>
              <button class="diagram-add-state" @click="addState"><Plus :size="15"/> Add state</button>
              <svg class="diagram-svg" viewBox="0 0 800 410" preserveAspectRatio="xMidYMid meet" :style="{transform:`scale(${zoom})`}">
                <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#9aa3b3"/></marker><marker id="startArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#ff805f"/></marker></defs>
                <g v-for="(t,i) in transitions" :key="i"><path class="edge-path" :d="edgePath(t)" marker-end="url(#arrow)"/><g class="edge-label" :transform="`translate(${edgeLabel(t).x},${edgeLabel(t).y})`"><rect x="-13" y="-12" width="26" height="23" rx="7"/><text text-anchor="middle" dominant-baseline="central">{{t.symbol}}</text></g></g>
                <g v-for="s in states" :key="s.id" class="state-group" :class="{'state-selected':selectedState===s.id,'state-active':highlightActiveStates&&stepTrace.length&&stepTrace.at(-1)?.states.includes(s.id)}" @pointerdown.stop="startDrag($event,s)" @click.stop="selectedState=s.id">
                  <line v-if="s.id===start" :x1="s.x-76" :y1="s.y" :x2="s.x-43" :y2="s.y" class="start-line" marker-end="url(#startArrow)"/>
                  <circle v-if="finals.includes(s.id)" :cx="s.x" :cy="s.y" r="37" class="final-ring"/><circle :cx="s.x" :cy="s.y" r="31" class="state-circle"/><text :x="s.x" :y="s.y+5" text-anchor="middle" class="state-label">{{s.id}}</text>
                  <foreignObject :x="s.x-45" :y="s.y-59" width="90" height="25" class="state-controls"><div xmlns="http://www.w3.org/1999/xhtml" class="state-control-row"><button @pointerdown.stop @click.stop="start=s.id;notify(`${s.id} is now the start state`)">→ start</button><button @pointerdown.stop @click.stop="toggleFinal(s.id);notify('Final state updated')">{{finals.includes(s.id)?'★ final':'☆ final'}}</button><button class="delete-state" @pointerdown.stop @click.stop="deleteState(s.id)"><Trash2 :size="11"/></button></div></foreignObject>
                </g>
              </svg>
              <div v-if="states.length===0" class="empty-diagram">Add a state to start building your NFA</div>
              <div class="zoom-controls"><button @click="zoom=Math.min(1.3,zoom+.1)">+</button><span>{{Math.round(zoom*100)}}%</span><button @click="zoom=Math.max(.7,zoom-.1)">−</button><button title="Reset zoom" @click="zoom=1"><RotateCcw :size="12"/></button></div>
              <div class="diagram-hint"><span class="hint-dot"></span> {{states.length}} states <span class="hint-sep">·</span> {{transitions.length}} transitions</div>
            </div>
            <div class="diagram-footer"><div class="legend-item"><span class="legend-start">→</span><span>Start state</span></div><div class="legend-item"><span class="legend-final"></span><span>Accepting state</span></div><div class="legend-item"><span class="legend-edge">→</span><span>Transition</span></div><button class="add-transition-link" @click="showAddTransition=true"><CirclePlus :size="14"/> Add transition</button></div>
          </section>

          <section class="card simulator-card"><div class="card-top"><div><div class="section-title"><span class="sim-title-icon"><Activity :size="15"/></span> String simulator</div><div class="section-subtitle">Run an input through your NFA</div></div><button class="dots-button" @click="reset"><RotateCcw :size="15"/></button></div>
            <label class="field-label" for="input-string">INPUT STRING <span class="optional-label">(use 0 and 1)</span></label><div class="input-row"><div class="input-prefix"><span class="tiny-braces">{ }</span></div><input id="input-string" v-model="inputString" placeholder="Type a string..." @keyup.enter="simulate" @input="reset"/><button class="clear-input" v-if="inputString" @click="inputString='';reset()"><X :size="14"/></button></div>
            <div class="sample-row"><span>TRY</span><button v-for="s in ['0101','110','001']" :key="s" @click="inputString=s;reset()">{{s}}</button></div>
            <button class="run-button" @click="simulate"><Play :size="14" fill="currentColor"/> Run simulation <span class="run-shortcut">↵</span></button>
            <div class="result-panel" :class="result?statusColor:''"><div class="result-top"><div class="result-icon"><Check v-if="result==='ACCEPTED'" :size="15"/><X v-else-if="result==='REJECTED'||result==='INVALID'" :size="15"/><Zap v-else :size="14"/></div><div><div class="result-heading">{{result==='ACCEPTED'?'String accepted':result==='REJECTED'?'String rejected':result==='INVALID'?'Invalid input':'Ready to simulate'}}</div><div class="result-copy">{{result==='ACCEPTED'?'At least one path reached a final state.':result==='REJECTED'?'No computation path reached a final state.':result==='INVALID'?'Check the input against your alphabet.':'Enter an input string and run the simulation.'}}</div></div></div>
              <div v-if="stepTrace.length" class="trace-list"><div v-for="(step,i) in stepTrace" :key="i" class="trace-row"><span class="trace-step">{{i===0?'START':`STEP ${i}`}}</span><span class="trace-symbol">{{step.symbol==='ε'?'ε':`“${step.symbol}”`}}</span><ArrowRight :size="12" class="trace-arrow"/><span class="trace-states">{{step.error||`{ ${step.states.join(', ')||'∅'} }`}}</span></div></div><div v-else class="result-bottom"><span>Current states</span><div class="state-chips"><span>{{start}}</span></div></div>
            </div>
            <div class="sim-footnote"><CircleHelp :size="13"/> An NFA accepts if <strong>any path</strong> reaches a final state.</div>
          </section>
        </div>

        <section class="card data-card"><div class="data-tabs"><button v-for="tab in ['Transition Table','Formal Definition']" :key="tab" :class="{'tab-active':activeTab===tab}" @click="activeTab=tab">{{tab==='Transition Table'? '▦':'{ }'}} <span>{{tab}}</span></button><div class="data-actions" v-if="activeTab==='Transition Table'"><button @click="showAlphabetInput=true"><Plus :size="13"/> Add symbol</button><button @click="showAddTransition=true"><Plus :size="13"/> Add transition</button></div><button v-else class="copy-button" @click="navigator.clipboard?.writeText(tuple);notify('Definition copied')"><Copy :size="13"/> Copy</button></div>
          <div v-if="activeTab==='Transition Table'" class="table-scroll"><table class="transition-table"><thead><tr><th class="state-column">STATE</th><th v-for="sym in [...alphabet,'ε']" :key="sym">{{sym}}</th><th class="table-empty"></th></tr></thead><tbody><tr v-for="row in table" :key="row.state"><td class="state-cell"><span v-if="start===row.state" class="start-marker">→</span><span v-if="finals.includes(row.state)" class="final-marker">*</span><span>{{row.state}}</span><span class="state-tags"><span v-if="start===row.state" class="mini-tag start-tag">START</span><span v-if="finals.includes(row.state)" class="mini-tag final-tag">FINAL</span></span></td><td v-for="(dest,j) in row.cells" :key="j" class="dest-cell"><span v-if="dest.length" class="dest-pill">{ {{dest.join(', ')}} }</span><span v-else class="empty-set">∅</span></td><td class="row-delete"><button title="Delete state" @click="deleteState(row.state)"><Trash2 :size="13"/></button></td></tr></tbody></table></div>
          <div v-else class="tuple-content"><div class="tuple-badge"><Braces :size="16"/> NFA 5-TUPLE</div><pre>{{tuple}}</pre><div class="tuple-note">The formal definition updates automatically as you edit the diagram.</div></div>
          <div v-if="activeTab==='Transition Table'" class="table-footer"><span><span class="table-info">i</span> Empty cells represent the empty set (∅)</span><span>{{states.length}} states <span class="hint-sep">·</span> {{alphabet.length}} input symbols <span class="hint-sep">·</span> ε-transitions enabled</span></div>
        </section>
        <footer class="page-footer"><span>Built for learning automata theory <span class="footer-sparkle">✳</span></span><span>ORBIT NFA STUDIO <span class="footer-version">v1.0</span></span></footer>
      </div>
    </main>

    <Teleport :to="diagramExpanded ? '#diagram-card' : 'body'">
      <div v-if="showSettings" class="modal-overlay" @click.self="showSettings=false"><div class="modal-card small-modal settings-modal"><div class="modal-heading"><div><h2>Workspace settings</h2><p>Adjust the diagram to your preference.</p></div><button class="modal-close" aria-label="Close settings" @click="showSettings=false"><X :size="17"/></button></div><div class="settings-options"><label class="settings-option"><span><strong>Diagram grid</strong><small>Show the dotted background behind the states.</small></span><input v-model="showDiagramGrid" type="checkbox" class="setting-checkbox"/></label><label class="settings-option"><span><strong>Highlight active states</strong><small>Emphasize states reached by the last simulation.</small></span><input v-model="highlightActiveStates" type="checkbox" class="setting-checkbox"/></label></div><div class="modal-actions"><button class="confirm-button" @click="showSettings=false">Done</button></div></div></div>
      <div v-if="showAddTransition" class="modal-overlay" @click.self="showAddTransition=false"><div class="modal-card"><div class="modal-heading"><div><h2>Add a transition</h2><p>Define how your automaton moves between states.</p></div><button class="modal-close" @click="showAddTransition=false"><X :size="17"/></button></div><div class="modal-fields"><label>FROM STATE<select v-model="newTransition.from"><option v-for="s in states" :key="s.id">{{s.id}}</option></select></label><label>INPUT SYMBOL<select v-model="newTransition.symbol"><option v-for="sym in [...alphabet,'ε']" :key="sym">{{sym}}</option></select></label><label>TO STATE<select v-model="newTransition.to"><option v-for="s in states" :key="s.id">{{s.id}}</option></select></label></div><div class="modal-actions"><button class="cancel-button" @click="showAddTransition=false">Cancel</button><button class="confirm-button" @click="addTransition"><Plus :size="14"/> Add transition</button></div></div></div>
      <div v-if="showAlphabetInput" class="modal-overlay" @click.self="showAlphabetInput=false"><div class="modal-card small-modal"><div class="modal-heading"><div><h2>Add an input symbol</h2><p>Enter one character for your alphabet Σ.</p></div><button class="modal-close" @click="showAlphabetInput=false"><X :size="17"/></button></div><input class="symbol-input" v-model="alphabetInput" maxlength="1" placeholder="e.g. a" @keyup.enter="addSymbol"/><div class="modal-actions"><button class="cancel-button" @click="showAlphabetInput=false">Cancel</button><button class="confirm-button" @click="addSymbol"><Plus :size="14"/> Add symbol</button></div></div></div>
    </Teleport>
    <Transition name="toast"><div v-if="toast" class="toast-message"><Check :size="14"/> {{toast}}</div></Transition>
  </div>
</template>
