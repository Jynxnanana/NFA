<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Activity, ArrowRight, Braces, Check, ChevronDown, CircleHelp, CirclePlus, Code2, Copy, Download, FileJson2, GitBranch, Image, Keyboard, Layers2, Maximize2, Minimize2, MoreHorizontal, Moon, Pencil, Play, Plus, Redo2, RotateCcw, Settings2, Sparkles, Sun, Trash2, Undo2, Upload, X, Zap } from 'lucide-vue-next'
import { runNfa, validateMachine } from './nfa.js'

const MACHINE_STORAGE_KEY = 'orbit-nfa-machine-v1'
function readSavedMachine(){try{const raw=localStorage.getItem(MACHINE_STORAGE_KEY);return raw?validateMachine(JSON.parse(raw)):null}catch{return null}}
const restoredMachine = readSavedMachine()
const states = ref(restoredMachine?.states ?? [
  { id: 'q0', x: 180, y: 206 }, { id: 'q1', x: 445, y: 135 }, { id: 'q2', x: 445, y: 285 }, { id: 'q3', x: 710, y: 206 },
])
const alphabet = ref(restoredMachine?.alphabet ?? ['0', '1'])
const transitions = ref(restoredMachine?.transitions ?? [
  { from: 'q0', to: 'q1', symbol: '0' }, { from: 'q0', to: 'q2', symbol: 'ε' },
  { from: 'q1', to: 'q1', symbol: '1' }, { from: 'q1', to: 'q3', symbol: '1' },
  { from: 'q2', to: 'q3', symbol: '0' }, { from: 'q3', to: 'q3', symbol: '1' },
])
const start = ref(restoredMachine?.start ?? 'q0'), finals = ref(restoredMachine?.finals ?? ['q3']), activeTab = ref('Transition Table')
const inputString = ref('0101'), result = ref(null), stepTrace = ref([]), simulationStep = ref(0), selectedState = ref(null)
const showAddTransition = ref(false), newTransition = ref({ from: 'q0', to: 'q1', symbol: '0' })
const showTransitionEdit = ref(false), transitionEditIndex = ref(null), transitionEditValue = ref({ from: '', to: '', symbol: '' })
const editingTransitionIndex = ref(null), showRenameState = ref(false), renameTarget = ref(null), renameValue = ref('')
const showAlphabetInput = ref(false), alphabetInput = ref('')
const showSettings = ref(false)
const importInput = ref(null), saveStatus = ref(restoredMachine ? 'Restored from this device' : 'Auto-saves on this device')
const examplesOpen = ref(false), batchInput = ref('0101\n110\n001'), batchResults = ref([])
const activeTabOptions = ['Transition Table','Formal Definition','Batch Tests']
const dragging = ref(null), diagram = ref(null), diagramCard = ref(null), diagramExpanded = ref(false), zoom = ref(1), toast = ref('')
const focusMode = ref(null)
const pan = ref({x:0,y:0}), panning = ref(null)
const gesturePointers = new Map()
let pinchStart = null
const undoStack = ref([]), redoStack = ref([])
const isDark = ref(localStorage.getItem('orbit-theme') === 'dark')
const showDiagramGrid = ref(localStorage.getItem('orbit-show-grid') !== 'false')
const highlightActiveStates = ref(localStorage.getItem('orbit-highlight-active') !== 'false')
watch(isDark, value => {
  localStorage.setItem('orbit-theme', value ? 'dark' : 'light')
  document.documentElement.style.colorScheme = value ? 'dark' : 'light'
}, { immediate: true })
watch(showDiagramGrid, value => localStorage.setItem('orbit-show-grid', String(value)))
watch(highlightActiveStates, value => localStorage.setItem('orbit-highlight-active', String(value)))
watch([states,alphabet,transitions,start,finals],()=>{
  try{localStorage.setItem(MACHINE_STORAGE_KEY,JSON.stringify(machineSnapshot()));saveStatus.value='Auto-saved'}
  catch{saveStatus.value='Local save unavailable'}
},{deep:true})
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
const focusedStates = computed(() => focusMode.value === 'start' ? states.value.filter(s => s.id === start.value) : focusMode.value === 'accepting' ? states.value.filter(s => finals.value.includes(s.id)) : [])
const diagramViewBox = computed(() => {
  if (!focusMode.value || !focusedStates.value.length) return '0 0 800 410'
  const padding = 105
  let left = Math.min(...focusedStates.value.map(s => s.x)) - padding
  let right = Math.max(...focusedStates.value.map(s => s.x)) + padding
  let top = Math.min(...focusedStates.value.map(s => s.y)) - padding
  let bottom = Math.max(...focusedStates.value.map(s => s.y)) + padding
  let width = right - left, height = bottom - top
  const aspect = 800 / 410
  if (width / height < aspect) { const expanded = height * aspect; left -= (expanded-width)/2; width = expanded }
  else { const expanded = width / aspect; top -= (expanded-height)/2; height = expanded }
  return `${left} ${top} ${width} ${height}`
})
const tuple = computed(() => `M = (Q, Σ, δ, q₀, F)\nQ = {${states.value.map(s=>s.id).join(', ')}}\nΣ = {${alphabet.value.join(', ')}}\nq₀ = ${start.value}\nF = {${finals.value.join(', ')}}\nδ = Transition function`)
const statusColor = computed(() => result.value === 'ACCEPTED' ? 'accept' : 'reject')
const currentTraceStep = computed(() => stepTrace.value[simulationStep.value] ?? null)
const currentStates = computed(() => currentTraceStep.value?.states ?? [])
const simulationSamples = computed(() => {
  const symbols = alphabet.value
  if (symbols.length === 0) return []
  if (symbols.includes('0') && symbols.includes('1')) return ['0101','110','001']
  const first = symbols[0], second = symbols[1] ?? symbols[0]
  return [...new Set([`${first}${second}${first}${second}`,`${second}${second}${first}`,`${first}${first}${second}`])]
})
const alphabetHint = computed(() => alphabet.value.length ? `(symbols: ${alphabet.value.join(', ')})` : '(empty alphabet)')

function machineSnapshot(){return {states:states.value.map(s=>({...s})),alphabet:[...alphabet.value],transitions:transitions.value.map(t=>({...t})),start:start.value,finals:[...finals.value]}}
function rememberUndo(before){
  if(JSON.stringify(before)===JSON.stringify(machineSnapshot()))return
  undoStack.value.push(before)
  if(undoStack.value.length>100)undoStack.value.shift()
  redoStack.value=[]
}
function restoreMachine(snapshot){states.value=snapshot.states.map(s=>({...s}));alphabet.value=[...snapshot.alphabet];transitions.value=snapshot.transitions.map(t=>({...t}));start.value=snapshot.start;finals.value=[...snapshot.finals];selectedState.value=null;reset()}
function undo(){if(!undoStack.value.length)return;const current=machineSnapshot();const previous=undoStack.value.pop();redoStack.value.push(current);restoreMachine(previous)}
function redo(){if(!redoStack.value.length)return;const current=machineSnapshot();const next=redoStack.value.pop();undoStack.value.push(current);restoreMachine(next)}

function simulate() {
  const outcome=runNfa(machineSnapshot(),inputString.value)
  stepTrace.value=outcome.trace
  simulationStep.value=0
  batchResults.value=[]
  if(!outcome.valid){result.value='INVALID';stepTrace.value=[...outcome.trace,{position:outcome.errorIndex+1,symbol:outcome.invalidSymbol,states:outcome.endStates,error:`“${outcome.invalidSymbol}” is not in the input alphabet`}];simulationStep.value=stepTrace.value.length-1;return}
  result.value=outcome.trace.length===1?(outcome.accepted?'ACCEPTED':'REJECTED'):null
}
function advanceSimulation(){if(!stepTrace.value.length||simulationStep.value>=stepTrace.value.length-1)return;simulationStep.value+=1;if(simulationStep.value===stepTrace.value.length-1){const outcome=runNfa(machineSnapshot(),inputString.value);result.value=outcome.accepted?'ACCEPTED':'REJECTED'}}
function previousSimulationStep(){if(simulationStep.value>0){simulationStep.value-=1;result.value=null}}
function runBatchTests(){batchResults.value=batchInput.value.split(/\r?\n/).filter(value=>value.length>0).map(input=>({input,...runNfa(machineSnapshot(),input)}))}
function focusSimulator(){document.querySelector('.simulator-card')?.scrollIntoView({behavior:'smooth',block:'center'})}
function addState(){ const before=machineSnapshot();let n=0;while(states.value.some(s=>s.id===`q${n}`))n++;const id=`q${n}`;states.value.push({id,x:250+(n%3)*190,y:110+Math.floor(n/3)*120});rememberUndo(before);notify(`Added ${id}`) }
function deleteState(id){ if(states.value.length<=1)return notify('Keep at least one state');const before=machineSnapshot();states.value=states.value.filter(s=>s.id!==id);transitions.value=transitions.value.filter(t=>t.from!==id&&t.to!==id);finals.value=finals.value.filter(f=>f!==id);if(start.value===id)start.value=states.value[0].id;selectedState.value=null;rememberUndo(before);reset();notify(`Deleted ${id}`) }
function openTransitionEditor(index=null){editingTransitionIndex.value=index;newTransition.value=index===null?{from:states.value[0]?.id??'',to:states.value[0]?.id??'',symbol:alphabet.value[0]??'ε'}:{...transitions.value[index]};showAddTransition.value=true}
function addTransition(){ if(!alphabet.value.includes(newTransition.value.symbol)&&newTransition.value.symbol!=='ε')return notify('Choose a symbol from the alphabet');const before=machineSnapshot();const editing=editingTransitionIndex.value!==null;if(editing)transitions.value.splice(editingTransitionIndex.value,1,{...newTransition.value});else transitions.value.push({...newTransition.value});rememberUndo(before);showAddTransition.value=false;editingTransitionIndex.value=null;reset();notify(editing?'Transition updated':'Transition added') }
function deleteTransition(index){const before=machineSnapshot();transitions.value.splice(index,1);rememberUndo(before);reset();notify('Transition deleted')}
function openTransitionEdit(index){transitionEditIndex.value=index;transitionEditValue.value={...transitions.value[index]};showTransitionEdit.value=true}
function saveTransitionEdit(){const value=transitionEditValue.value;if(!states.value.some(s=>s.id===value.from)||!states.value.some(s=>s.id===value.to))return notify('Choose valid states');if(value.symbol!=='ε'&&!alphabet.value.includes(value.symbol))return notify('Choose a symbol from the alphabet');const before=machineSnapshot();transitions.value.splice(transitionEditIndex.value,1,{...value});rememberUndo(before);showTransitionEdit.value=false;reset();notify('Transition updated')}
function openRenameState(id){renameTarget.value=id;renameValue.value=id;showRenameState.value=true}
function renameState(){const next=renameValue.value.trim(),old=renameTarget.value;if(!next)return notify('State name cannot be empty');if(next!==old&&states.value.some(s=>s.id===next))return notify('A state with that name already exists');if(next!==old){const before=machineSnapshot();states.value=states.value.map(s=>s.id===old?{...s,id:next}:s);transitions.value=transitions.value.map(t=>({from:t.from===old?next:t.from,to:t.to===old?next:t.to,symbol:t.symbol}));if(start.value===old)start.value=next;finals.value=finals.value.map(id=>id===old?next:id);rememberUndo(before);reset()}showRenameState.value=false;notify('State updated')}
function addSymbol(){const s=alphabetInput.value.trim();if(!s||[...s].length!==1||s==='ε'||alphabet.value.includes(s))return notify('Enter one unique character');const before=machineSnapshot();alphabet.value.push(s);rememberUndo(before);alphabetInput.value='';showAlphabetInput.value=false;reset()}
function notify(msg){toast.value=msg;setTimeout(()=>toast.value='',2200)}
function toggleFinal(id){const before=machineSnapshot();finals.value=finals.value.includes(id)?finals.value.filter(x=>x!==id):[...finals.value,id];rememberUndo(before)}
function setStartState(id){const before=machineSnapshot();start.value=id;rememberUndo(before);notify(`${id} is now the start state`)}
function startDrag(e,s){if(e.pointerType==='touch'&&gesturePointers.size>=2)return;dragging.value={id:s.id,offsetX:e.clientX,offsetY:e.clientY,originX:s.x,originY:s.y,before:machineSnapshot()};selectedState.value=s.id;window.addEventListener('pointermove',moveDrag);window.addEventListener('pointerup',stopDrag,{once:true})}
function canPanFrom(e){return !e.target.closest?.('.state-group,button,.zoom-controls')}
function beginPan(e){panning.value={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,originX:pan.value.x,originY:pan.value.y}}
function onDiagramPointerDown(e){
  if(e.pointerType==='touch'){
    gesturePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,panEligible:canPanFrom(e)})
    if(gesturePointers.size>=2){dragging.value=null;panning.value=null;const points=[...gesturePointers.values()].slice(0,2);pinchStart={distance:Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),zoom:zoom.value}}
    else if(canPanFrom(e))beginPan(e)
    return
  }
  if(e.pointerType==='mouse'&&e.button===0&&canPanFrom(e)){beginPan(e);e.currentTarget.setPointerCapture?.(e.pointerId)}
}
function onDiagramPointerMove(e){
  if(e.pointerType==='touch'&&gesturePointers.has(e.pointerId))gesturePointers.set(e.pointerId,{...gesturePointers.get(e.pointerId),x:e.clientX,y:e.clientY})
  if(panning.value?.pointerId===e.pointerId&&gesturePointers.size<2){pan.value={x:panning.value.originX+e.clientX-panning.value.startX,y:panning.value.originY+e.clientY-panning.value.startY};e.preventDefault();return}
  if(e.pointerType!=='touch'||!gesturePointers.has(e.pointerId))return
  if(gesturePointers.size<2||!pinchStart)return
  e.preventDefault();const points=[...gesturePointers.values()].slice(0,2),distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);zoom.value=Math.max(.5,Math.min(2.5,pinchStart.zoom*distance/Math.max(pinchStart.distance,1)))
}
function onDiagramPointerEnd(e){
  if(panning.value?.pointerId===e.pointerId)panning.value=null
  if(e.pointerType!=='touch')return
  gesturePointers.delete(e.pointerId)
  if(gesturePointers.size<2)pinchStart=null
  if(gesturePointers.size===1){const [id,point]=[...gesturePointers.entries()][0];if(point.panEligible){panning.value={pointerId:id,startX:point.x,startY:point.y,originX:pan.value.x,originY:pan.value.y}}}
  if(gesturePointers.size===0)dragging.value=null
}
function onDiagramWheel(e){
  if(e.ctrlKey||e.metaKey){e.preventDefault();zoom.value=Math.max(.5,Math.min(2.5,zoom.value*Math.exp(-e.deltaY*.01)));return}
  if(e.deltaX||e.deltaY){e.preventDefault();pan.value={x:pan.value.x-e.deltaX,y:pan.value.y-e.deltaY}}
}
function moveDrag(e){if(gesturePointers.size>=2||!dragging.value||!diagram.value)return;const svgBox=diagram.value.querySelector('.diagram-svg')?.getBoundingClientRect(),bounds=diagramViewBox.value.split(' ').map(Number);if(!svgBox)return;const scaleX=bounds[2]/svgBox.width,scaleY=bounds[3]/svgBox.height;const s=states.value.find(s=>s.id===dragging.value.id);if(s){s.x=Math.max(42,Math.min(758,dragging.value.originX+(e.clientX-dragging.value.offsetX)*scaleX));s.y=Math.max(42,Math.min(368,dragging.value.originY+(e.clientY-dragging.value.offsetY)*scaleY))}}
function stopDrag(){const before=dragging.value?.before;dragging.value=null;window.removeEventListener('pointermove',moveDrag);if(before)rememberUndo(before)}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportJson(){downloadBlob(new Blob([JSON.stringify(machineSnapshot(),null,2)],{type:'application/json'}),'my-nfa.json');notify('NFA exported')}
function triggerImport(){importInput.value?.click()}
async function importMachine(event){const file=event.target.files?.[0];if(!file)return;try{const machine=validateMachine(JSON.parse(await file.text()));restoreMachine(machine);undoStack.value=[];redoStack.value=[];focusMode.value=null;zoom.value=1;pan.value={x:0,y:0};saveStatus.value='Imported and saved';notify('NFA imported')}catch(error){notify(error instanceof Error?error.message:'Could not import this NFA file')}finally{event.target.value=''}}
function loadExample(machine){restoreMachine(validateMachine(machine));undoStack.value=[];redoStack.value=[];focusMode.value=null;zoom.value=1;pan.value={x:0,y:0};examplesOpen.value=false;saveStatus.value='Example loaded and saved';notify('Example NFA loaded')}
function exampleMachine(type){
  if(type==='ends-01')return {states:[{id:'q0',x:150,y:205},{id:'q1',x:405,y:205},{id:'q2',x:660,y:205}],alphabet:['0','1'],transitions:[{from:'q0',to:'q0',symbol:'0'},{from:'q0',to:'q0',symbol:'1'},{from:'q0',to:'q1',symbol:'0'},{from:'q1',to:'q2',symbol:'1'}],start:'q0',finals:['q2']}
  if(type==='contains-101')return {states:[{id:'q0',x:120,y:205},{id:'q1',x:330,y:205},{id:'q2',x:540,y:205},{id:'q3',x:720,y:205}],alphabet:['0','1'],transitions:[{from:'q0',to:'q0',symbol:'0'},{from:'q0',to:'q0',symbol:'1'},{from:'q0',to:'q1',symbol:'1'},{from:'q1',to:'q2',symbol:'0'},{from:'q2',to:'q3',symbol:'1'},{from:'q3',to:'q3',symbol:'0'},{from:'q3',to:'q3',symbol:'1'}],start:'q0',finals:['q3']}
  if(type==='even-zeros')return {states:[{id:'qEven',x:260,y:205},{id:'qOdd',x:560,y:205}],alphabet:['0','1'],transitions:[{from:'qEven',to:'qOdd',symbol:'0'},{from:'qOdd',to:'qEven',symbol:'0'},{from:'qEven',to:'qEven',symbol:'1'},{from:'qOdd',to:'qOdd',symbol:'1'}],start:'qEven',finals:['qEven']}
  return {states:[{id:'q0',x:150,y:205},{id:'q1',x:405,y:205},{id:'q2',x:660,y:205}],alphabet:['a','b'],transitions:[{from:'q0',to:'q0',symbol:'a'},{from:'q0',to:'q0',symbol:'b'},{from:'q0',to:'q1',symbol:'a'},{from:'q1',to:'q2',symbol:'a'},{from:'q2',to:'q2',symbol:'a'},{from:'q2',to:'q2',symbol:'b'}],start:'q0',finals:['q2']}
}
function exportSvgBlob(){
  const source=diagram.value?.querySelector('.diagram-svg');if(!source){notify('Diagram is not ready to export');return null}
  const clone=source.cloneNode(true);clone.setAttributeNS('http://www.w3.org/2000/xmlns/','xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','1600');clone.setAttribute('height','820');clone.setAttribute('viewBox','0 0 800 410');clone.removeAttribute('style');clone.querySelectorAll('.state-controls').forEach(node=>node.remove())
  const css=document.createElementNS('http://www.w3.org/2000/svg','style');css.textContent='.edge-path{fill:none;stroke:#a6adba;stroke-width:1.6}.start-line{stroke:#ff805f;stroke-width:2}.state-circle{fill:#fff;stroke:#bcc3ce;stroke-width:2}.final-ring{fill:none;stroke:#7ab998;stroke-width:1.8}.state-label{font:600 14px sans-serif;fill:#3a4351}.edge-label rect{fill:#fff;stroke:#e9ebef}.edge-label text{font:600 12px sans-serif;fill:#6d7684}.state-legend-focus .state-circle{stroke:#ff805f;stroke-width:3}'
  clone.insertBefore(css,clone.firstChild);const background=document.createElementNS('http://www.w3.org/2000/svg','rect');background.setAttribute('width','800');background.setAttribute('height','410');background.setAttribute('fill',isDark.value?'#1c2028':'#fff');clone.insertBefore(background,clone.firstChild)
  return new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'})
}
function exportSvg(){const blob=exportSvgBlob();if(blob){downloadBlob(blob,'nfa-diagram.svg');notify('SVG diagram exported')}}
async function exportPng(){const svgBlob=exportSvgBlob();if(!svgBlob)return;const url=URL.createObjectURL(svgBlob);try{const image=new window.Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Could not read SVG'));image.src=url});const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=820;const context=canvas.getContext('2d');if(!context)throw new Error('Canvas is unavailable');context.drawImage(image,0,0,canvas.width,canvas.height);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw new Error('PNG export failed');downloadBlob(png,'nfa-diagram.png');notify('PNG diagram exported')}catch{notify('Could not export PNG in this browser')}finally{URL.revokeObjectURL(url)}}
function reset(){result.value=null;stepTrace.value=[];simulationStep.value=0;batchResults.value=[]}
function resetDiagramView(){zoom.value=1;pan.value={x:0,y:0};focusMode.value=null}
function toggleLegendFocus(mode){
  if (mode === 'accepting' && finals.value.length === 0) return notify('Mark a state as accepting first')
  focusMode.value = focusMode.value === mode ? null : mode
  zoom.value = 1
  pan.value = {x:0,y:0}
  selectedState.value = focusMode.value === 'start' ? start.value : null
}
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
      <button class="nav-item" @click="focusSimulator"><Play :size="16"/><span>String simulator</span><span class="side-badge">NEW</span></button>
      <button class="nav-item" @click="exportJson"><FileJson2 :size="17"/><span>Export as JSON</span></button>
      <div class="sidebar-bottom"><div class="help-card"><div class="help-icon"><CircleHelp :size="17"/></div><div><strong>New to NFAs?</strong><p>Read the quick guide and get started.</p><button @click="notify('An NFA accepts a string when at least one path ends in a final state.')">Explore guide <ArrowRight :size="12"/></button></div></div><div class="user-row"><div class="user-avatar">M</div><div class="user-meta"><strong>My workspace</strong><span>Free plan</span></div><MoreHorizontal :size="18" class="user-more"/></div></div>
    </aside>

    <main class="main-content">
      <input ref="importInput" class="file-input-hidden" type="file" accept=".json,application/json" @change="importMachine"/>
      <header class="topbar"><div class="breadcrumbs"><span>Projects</span><span class="crumb-slash">/</span><span class="crumb-current">NFA Builder</span><span class="saved-dot"></span><span class="saved-label">{{saveStatus}}</span></div><div class="top-actions"><button class="icon-button" title="Import NFA JSON" aria-label="Import NFA JSON" @click="triggerImport"><Upload :size="16"/></button><button class="icon-button" :title="isDark?'Switch to light mode':'Switch to dark mode'" :aria-label="isDark?'Switch to light mode':'Switch to dark mode'" @click="isDark=!isDark"><Sun v-if="isDark" :size="16"/><Moon v-else :size="16"/></button><button class="icon-button" title="Keyboard shortcuts" @click="notify('Drag states to reposition · Click a state to select')"><Keyboard :size="16"/></button><button class="icon-button" title="Settings" @click="showSettings=true"><Settings2 :size="16"/></button><button class="share-button" @click="exportJson"><Download :size="14"/> Export JSON <ChevronDown :size="13"/></button><div class="profile-avatar">M</div></div></header>
      <div class="page-content">
        <div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-icon"><Sparkles :size="12"/></span> YOUR AUTOMATA WORKSPACE</div><h1>NFA Builder</h1><p class="subtitle">Design, visualize, and test your nondeterministic finite automata.</p></div><div class="page-heading-actions"><button class="examples-trigger" @click="examplesOpen=true"><Sparkles :size="14"/> Examples</button><button class="new-state-button" @click="addState"><Plus :size="16"/> Add state</button></div></div>
        <div class="editor-layout">
          <section id="diagram-card" ref="diagramCard" class="card diagram-card" :class="{'diagram-expanded':diagramExpanded}">
            <div class="card-top"><div><div class="section-title">State diagram <span class="live-indicator"><i></i> LIVE</span></div><div class="section-subtitle">Drag states to arrange your automaton</div></div><div class="diagram-head-tools"><button v-if="diagramExpanded" class="diagram-add-state-action" @click="addState"><Plus :size="14"/> Add state</button><button class="diagram-history-button" :disabled="!undoStack.length" aria-label="Undo" title="Undo" @click="undo"><Undo2 :size="16"/></button><button class="diagram-history-button" :disabled="!redoStack.length" aria-label="Redo" title="Redo" @click="redo"><Redo2 :size="16"/></button><button v-if="diagramExpanded" class="diagram-theme-button" :aria-label="isDark?'Switch to light mode':'Switch to dark mode'" :title="isDark?'Switch to light mode':'Switch to dark mode'" @click="isDark=!isDark"><Sun v-if="isDark" :size="16"/><Moon v-else :size="16"/></button><button v-if="diagramExpanded" class="diagram-theme-button" aria-label="Settings" title="Settings" @click="showSettings=true"><Settings2 :size="16"/></button><button class="diagram-expand-button" :aria-label="diagramExpanded?'Minimize diagram':'Maximize diagram'" :title="diagramExpanded?'Minimize diagram':'Maximize diagram'" @click="diagramExpanded?collapseDiagram():expandDiagram()"><Minimize2 v-if="diagramExpanded" :size="16"/><Maximize2 v-else :size="16"/></button><button class="dots-button" title="Export NFA" @click="exportJson"><MoreHorizontal :size="18"/></button></div></div>
            <div class="diagram-wrap" ref="diagram" title="Swipe or drag the blank canvas to pan; pinch to zoom" @pointerdown.capture="onDiagramPointerDown" @pointermove.capture="onDiagramPointerMove" @pointerup.capture="onDiagramPointerEnd" @pointercancel.capture="onDiagramPointerEnd" @wheel="onDiagramWheel">
              <div v-if="showDiagramGrid" class="diagram-grid"></div>
              <button class="diagram-add-state" @click="addState"><Plus :size="15"/> Add state</button>
              <svg class="diagram-svg" :viewBox="diagramViewBox" preserveAspectRatio="xMidYMid meet" :style="{transform:`translate(${pan.x}px, ${pan.y}px) scale(${zoom})`}">
                <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#9aa3b3"/></marker><marker id="startArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#ff805f"/></marker></defs>
                <g v-for="(t,i) in transitions" :key="i"><path class="edge-path" :d="edgePath(t)" marker-end="url(#arrow)"/><g class="edge-label" :transform="`translate(${edgeLabel(t).x},${edgeLabel(t).y})`"><rect x="-13" y="-12" width="26" height="23" rx="7"/><text text-anchor="middle" dominant-baseline="central">{{t.symbol}}</text></g></g>
                <g v-for="s in states" :key="s.id" class="state-group" :class="{'state-selected':selectedState===s.id,'state-legend-focus':focusedStates.some(target=>target.id===s.id),'state-active':highlightActiveStates&&currentStates.includes(s.id)}" @pointerdown.stop="startDrag($event,s)" @click.stop="selectedState=s.id">
                  <line v-if="s.id===start" :x1="s.x-76" :y1="s.y" :x2="s.x-43" :y2="s.y" class="start-line" marker-end="url(#startArrow)"/>
                  <circle v-if="finals.includes(s.id)" :cx="s.x" :cy="s.y" r="37" class="final-ring"/><circle :cx="s.x" :cy="s.y" r="31" class="state-circle"/><text :x="s.x" :y="s.y+5" text-anchor="middle" class="state-label">{{s.id}}</text>
                  <foreignObject :x="s.x-57" :y="s.y-59" width="114" height="25" class="state-controls"><div xmlns="http://www.w3.org/1999/xhtml" class="state-control-row"><button @pointerdown.stop @click.stop="setStartState(s.id)">→ start</button><button @pointerdown.stop @click.stop="toggleFinal(s.id);notify('Final state updated')">{{finals.includes(s.id)?'★ final':'☆ final'}}</button><button title="Rename state" @pointerdown.stop @click.stop="openRenameState(s.id)"><Pencil :size="10"/></button><button class="delete-state" title="Delete state" @pointerdown.stop @click.stop="deleteState(s.id)"><Trash2 :size="11"/></button></div></foreignObject>
                </g>
              </svg>
              <div v-if="states.length===0" class="empty-diagram">Add a state to start building your NFA</div>
              <div class="zoom-controls"><button title="Zoom in" @click="zoom=Math.min(2.5,zoom+.1)">+</button><span>{{Math.round(zoom*100)}}%</span><button title="Zoom out" @click="zoom=Math.max(.5,zoom-.1)">−</button><button title="Reset zoom and pan" @click="resetDiagramView"><RotateCcw :size="12"/></button></div>
              <div class="diagram-hint"><span class="hint-dot"></span> {{states.length}} states <span class="hint-sep">·</span> {{transitions.length}} transitions</div>
            </div>
            <div class="diagram-footer"><button class="legend-item legend-focus-button" :class="{'legend-focus-active':focusMode==='start'}" :aria-pressed="focusMode==='start'" title="Focus on the start state; click again to reset" @click="toggleLegendFocus('start')"><span class="legend-start">→</span><span>Start state</span></button><button class="legend-item legend-focus-button" :class="{'legend-focus-active':focusMode==='accepting'}" :aria-pressed="focusMode==='accepting'" title="Focus on accepting states; click again to reset" @click="toggleLegendFocus('accepting')"><span class="legend-final"></span><span>Accepting state</span></button><div class="legend-item"><span class="legend-edge">→</span><span>Transition</span></div><button class="diagram-export-button" title="Download diagram as SVG" @click="exportSvg"><Code2 :size="13"/> SVG</button><button class="diagram-export-button" title="Download diagram as PNG" @click="exportPng"><Image :size="13"/> PNG</button><button class="add-transition-link" @click="showAddTransition=true"><CirclePlus :size="14"/> Add transition</button></div>
          </section>

          <section class="card simulator-card"><div class="card-top"><div><div class="section-title"><span class="sim-title-icon"><Activity :size="15"/></span> String simulator</div><div class="section-subtitle">Run an input through your NFA</div></div><button class="dots-button" @click="reset"><RotateCcw :size="15"/></button></div>
            <label class="field-label" for="input-string">INPUT STRING <span class="optional-label">{{alphabetHint}}</span></label><div class="input-row"><div class="input-prefix"><span class="tiny-braces">{ }</span></div><input id="input-string" v-model="inputString" placeholder="Type a string..." @keyup.enter="simulate" @input="reset"/><button class="clear-input" v-if="inputString" @click="inputString='';reset()"><X :size="14"/></button></div>
            <div class="sample-row" v-if="simulationSamples.length"><span>TRY</span><button v-for="s in simulationSamples" :key="s" @click="inputString=s;reset()">{{s}}</button></div>
            <button class="run-button" @click="simulate"><Play :size="14" fill="currentColor"/> Run simulation <span class="run-shortcut">↵</span></button>
            <div v-if="stepTrace.length>1" class="step-controls"><button :disabled="simulationStep===0" @click="previousSimulationStep">← Previous</button><span>Step {{simulationStep}} / {{stepTrace.length-1}}</span><button :disabled="simulationStep>=stepTrace.length-1" @click="advanceSimulation">Next →</button></div>
            <div class="result-panel" :class="result?statusColor:stepTrace.length?'in-progress':''"><div class="result-top"><div class="result-icon"><Check v-if="result==='ACCEPTED'" :size="15"/><X v-else-if="result==='REJECTED'||result==='INVALID'" :size="15"/><Activity v-else :size="14"/></div><div><div class="result-heading">{{result==='ACCEPTED'?'String accepted':result==='REJECTED'?'String rejected':result==='INVALID'?'Invalid input':stepTrace.length?'Simulation step':'Ready to simulate'}}</div><div class="result-copy">{{result==='ACCEPTED'?'At least one path reached a final state.':result==='REJECTED'?'No computation path reached a final state.':result==='INVALID'?'Check the input against your alphabet.':stepTrace.length?`After ${currentTraceStep?.position??0} input symbols, the active states are shown below.`:'Enter an input string and run the simulation.'}}</div></div></div>
              <div v-if="stepTrace.length" class="trace-list"><div v-for="(step,i) in stepTrace" :key="i" class="trace-row" :class="{'trace-current':i===simulationStep}"><span class="trace-step">{{i===0?'START':`STEP ${i}`}}</span><span class="trace-symbol">{{step.symbol==='ε'?'ε':`“${step.symbol}”`}}</span><ArrowRight :size="12" class="trace-arrow"/><span class="trace-states">{{step.error||`{ ${step.states.join(', ')||'∅'} }`}}</span></div></div><div v-else class="result-bottom"><span>Current states</span><div class="state-chips"><span>{{start}}</span></div></div>
            </div>
            <div class="sim-footnote"><CircleHelp :size="13"/> An NFA accepts if <strong>any path</strong> reaches a final state.</div>
          </section>
        </div>

        <section class="card data-card"><div class="data-tabs"><button v-for="tab in activeTabOptions" :key="tab" :class="{'tab-active':activeTab===tab}" @click="activeTab=tab"><span>{{tab==='Transition Table'?'▦':tab==='Formal Definition'?'{ }':'⇄'}}</span><span>{{tab}}</span></button><div class="data-actions" v-if="activeTab==='Transition Table'"><button @click="showAlphabetInput=true"><Plus :size="13"/> Add symbol</button><button @click="openTransitionEditor()"><Plus :size="13"/> Add transition</button></div><button v-else-if="activeTab==='Formal Definition'" class="copy-button" @click="navigator.clipboard?.writeText(tuple);notify('Definition copied')"><Copy :size="13"/> Copy</button><button v-else-if="activeTab==='Batch Tests'" class="copy-button" @click="runBatchTests"><Play :size="13"/> Test strings</button></div>
          <div v-if="activeTab==='Transition Table'" class="table-scroll"><table class="transition-table"><thead><tr><th class="state-column">STATE</th><th v-for="sym in [...alphabet,'ε']" :key="sym">{{sym}}</th><th class="table-empty"></th></tr></thead><tbody><tr v-for="row in table" :key="row.state"><td class="state-cell"><span v-if="start===row.state" class="start-marker">→</span><span v-if="finals.includes(row.state)" class="final-marker">*</span><span>{{row.state}}</span><span class="state-tags"><span v-if="start===row.state" class="mini-tag start-tag">START</span><span v-if="finals.includes(row.state)" class="mini-tag final-tag">FINAL</span></span></td><td v-for="(dest,j) in row.cells" :key="j" class="dest-cell"><span v-if="dest.length" class="dest-pill">{ {{dest.join(', ')}} }</span><span v-else class="empty-set">∅</span></td><td class="row-delete"><button title="Delete state" @click="deleteState(row.state)"><Trash2 :size="13"/></button></td></tr></tbody></table></div>
          <div v-else-if="activeTab==='Formal Definition'" class="tuple-content"><div class="tuple-badge"><Braces :size="16"/> NFA 5-TUPLE</div><pre>{{tuple}}</pre><div class="tuple-note">The formal definition updates automatically as you edit the diagram.</div></div>
          <div v-else-if="activeTab==='Batch Tests'" class="batch-pane"><div class="batch-intro"><div><strong>Test several strings at once</strong><p>Enter one input string per line. Blank lines are skipped.</p></div><button class="confirm-button" @click="runBatchTests"><Play :size="13"/> Test strings</button></div><textarea v-model="batchInput" class="batch-input" placeholder="0101&#10;110&#10;001" spellcheck="false"></textarea><div v-if="batchResults.length" class="batch-results"><div class="batch-results-head"><span>INPUT</span><span>RESULT</span><span>ENDING STATES</span></div><div v-for="(item,index) in batchResults" :key="`${item.input}-${index}`" class="batch-result-row"><code>{{item.input||'ε'}}</code><span class="batch-status" :class="item.valid?(item.accepted?'accepted':'rejected'):'invalid'">{{!item.valid?'Invalid input':item.accepted?'Accepted':'Rejected'}}</span><span class="batch-ending">{ {{item.endStates.join(', ')||'∅'}} }</span></div></div><div v-else class="batch-empty">Results will appear here after you test the strings.</div></div>
          <div v-if="activeTab==='Transition Table'" class="transition-manager"><div class="transition-manager-head"><div><strong>Transitions</strong><span>{{transitions.length}} defined</span></div><button @click="openTransitionEditor()"><Plus :size="13"/> Add transition</button></div><div v-if="transitions.length" class="transition-list"><div v-for="(transition,index) in transitions" :key="`${transition.from}-${transition.symbol}-${transition.to}-${index}`" class="transition-item"><span class="transition-state-name">{{transition.from}}</span><span class="transition-symbol">{{transition.symbol}}</span><ArrowRight :size="14" class="transition-item-arrow"/><span class="transition-state-name">{{transition.to}}</span><div class="transition-item-actions"><button title="Edit transition" aria-label="Edit transition" @click="openTransitionEdit(index)"><Pencil :size="14"/></button><button title="Delete transition" aria-label="Delete transition" @click="deleteTransition(index)"><Trash2 :size="14"/></button></div></div></div><div v-else class="transition-empty">No transitions yet. Add one to define how this NFA moves.</div></div>
          <div v-if="activeTab==='Transition Table'" class="table-footer"><span><span class="table-info">i</span> Empty cells represent the empty set (∅)</span><span>{{states.length}} states <span class="hint-sep">·</span> {{alphabet.length}} input symbols <span class="hint-sep">·</span> ε-transitions enabled</span></div>
        </section>
        <footer class="page-footer"><span>Built for learning automata theory <span class="footer-sparkle">✳</span></span><span>ORBIT NFA STUDIO <span class="footer-version">v1.0</span></span></footer>
      </div>
    </main>

    <Teleport :to="diagramExpanded ? '#diagram-card' : 'body'">
      <div v-if="examplesOpen" class="modal-overlay" @click.self="examplesOpen=false"><div class="modal-card examples-modal"><div class="modal-heading"><div><h2>Example NFAs</h2><p>Load a ready-made machine to explore how it works.</p></div><button class="modal-close" aria-label="Close examples" @click="examplesOpen=false"><X :size="17"/></button></div><div class="example-list"><button class="example-card" @click="loadExample(exampleMachine('ends-01'))"><span class="example-symbol">01</span><span><strong>Strings ending in 01</strong><small>Alphabet: {0, 1}. Uses nondeterminism to guess the final 0.</small></span><ArrowRight :size="15"/></button><button class="example-card" @click="loadExample(exampleMachine('contains-101'))"><span class="example-symbol">101</span><span><strong>Strings containing 101</strong><small>Alphabet: {0, 1}. Finds the substring 101 anywhere.</small></span><ArrowRight :size="15"/></button><button class="example-card" @click="loadExample(exampleMachine('even-zeros'))"><span class="example-symbol">0²</span><span><strong>Even number of zeros</strong><small>Alphabet: {0, 1}. Accepts strings with an even count of 0.</small></span><ArrowRight :size="15"/></button><button class="example-card" @click="loadExample(exampleMachine('contains-aa'))"><span class="example-symbol">aa</span><span><strong>Strings containing aa</strong><small>Alphabet: {a, b}. Accepts once two consecutive a symbols appear.</small></span><ArrowRight :size="15"/></button></div></div></div>
      <div v-if="showRenameState" class="modal-overlay" @click.self="showRenameState=false"><div class="modal-card small-modal"><div class="modal-heading"><div><h2>Rename state</h2><p>Update the state label and its transitions.</p></div><button class="modal-close" aria-label="Close rename dialog" @click="showRenameState=false"><X :size="17"/></button></div><label class="rename-label">STATE NAME<input v-model="renameValue" class="symbol-input" maxlength="20" placeholder="e.g. qNew" @keyup.enter="renameState"/></label><div class="modal-actions"><button class="cancel-button" @click="showRenameState=false">Cancel</button><button class="confirm-button" @click="renameState"><Check :size="14"/> Save state</button></div></div></div>
      <div v-if="showTransitionEdit" class="modal-overlay" @click.self="showTransitionEdit=false"><div class="modal-card"><div class="modal-heading"><div><h2>Edit transition</h2><p>Change its source, input symbol, or destination.</p></div><button class="modal-close" aria-label="Close transition editor" @click="showTransitionEdit=false"><X :size="17"/></button></div><div class="modal-fields"><label>FROM STATE<select v-model="transitionEditValue.from"><option v-for="s in states" :key="s.id">{{s.id}}</option></select></label><label>INPUT SYMBOL<select v-model="transitionEditValue.symbol"><option v-for="sym in [...alphabet,'ε']" :key="sym">{{sym}}</option></select></label><label>TO STATE<select v-model="transitionEditValue.to"><option v-for="s in states" :key="s.id">{{s.id}}</option></select></label></div><div class="modal-actions"><button class="cancel-button" @click="showTransitionEdit=false">Cancel</button><button class="confirm-button" @click="saveTransitionEdit"><Check :size="14"/> Save changes</button></div></div></div>
      <div v-if="showSettings" class="modal-overlay" @click.self="showSettings=false"><div class="modal-card small-modal settings-modal"><div class="modal-heading"><div><h2>Workspace settings</h2><p>Adjust the diagram to your preference.</p></div><button class="modal-close" aria-label="Close settings" @click="showSettings=false"><X :size="17"/></button></div><div class="settings-options"><label class="settings-option"><span><strong>Diagram grid</strong><small>Show the dotted background behind the states.</small></span><input v-model="showDiagramGrid" type="checkbox" class="setting-checkbox"/></label><label class="settings-option"><span><strong>Highlight active states</strong><small>Emphasize states reached by the last simulation.</small></span><input v-model="highlightActiveStates" type="checkbox" class="setting-checkbox"/></label></div><div class="modal-actions"><button class="confirm-button" @click="showSettings=false">Done</button></div></div></div>
      <div v-if="showAddTransition" class="modal-overlay" @click.self="showAddTransition=false"><div class="modal-card"><div class="modal-heading"><div><h2>Add a transition</h2><p>Define how your automaton moves between states.</p></div><button class="modal-close" @click="showAddTransition=false"><X :size="17"/></button></div><div class="modal-fields"><label>FROM STATE<select v-model="newTransition.from"><option v-for="s in states" :key="s.id">{{s.id}}</option></select></label><label>INPUT SYMBOL<select v-model="newTransition.symbol"><option v-for="sym in [...alphabet,'ε']" :key="sym">{{sym}}</option></select></label><label>TO STATE<select v-model="newTransition.to"><option v-for="s in states" :key="s.id">{{s.id}}</option></select></label></div><div class="modal-actions"><button class="cancel-button" @click="showAddTransition=false">Cancel</button><button class="confirm-button" @click="addTransition"><Plus :size="14"/> Add transition</button></div></div></div>
      <div v-if="showAlphabetInput" class="modal-overlay" @click.self="showAlphabetInput=false"><div class="modal-card small-modal"><div class="modal-heading"><div><h2>Add an input symbol</h2><p>Enter one character for your alphabet Σ.</p></div><button class="modal-close" @click="showAlphabetInput=false"><X :size="17"/></button></div><input class="symbol-input" v-model="alphabetInput" maxlength="1" placeholder="e.g. a" @keyup.enter="addSymbol"/><div class="modal-actions"><button class="cancel-button" @click="showAlphabetInput=false">Cancel</button><button class="confirm-button" @click="addSymbol"><Plus :size="14"/> Add symbol</button></div></div></div>
    </Teleport>
    <Transition name="toast"><div v-if="toast" class="toast-message"><Check :size="14"/> {{toast}}</div></Transition>
  </div>
</template>
