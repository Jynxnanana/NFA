export const EPSILON = '\u03b5'

export function validateMachine(value) {
  if (!value || typeof value !== 'object') throw new Error('The file must contain an NFA object.')
  if (!Array.isArray(value.states) || value.states.length === 0) throw new Error('The NFA must have at least one state.')
  if (!Array.isArray(value.alphabet) || !Array.isArray(value.transitions) || !Array.isArray(value.finals)) throw new Error('The file is missing states, alphabet, transitions, or final states.')

  const ids = value.states.map(state => typeof state === 'string' ? state : state?.id)
  if (ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) throw new Error('State names must be non-empty and unique.')
  const alphabet = value.alphabet
  if (alphabet.some(symbol => typeof symbol !== 'string' || [...symbol].length !== 1 || symbol === EPSILON) || new Set(alphabet).size !== alphabet.length) {
    throw new Error('Alphabet symbols must be unique single characters. Epsilon is added automatically.')
  }

  const idSet = new Set(ids)
  const states = value.states.map((state, index) => {
    const id = typeof state === 'string' ? state : state.id
    const position = typeof state === 'object' ? state : {}
    return {
      id,
      x: Number.isFinite(position.x) ? Math.max(42, Math.min(758, position.x)) : 180 + (index % 4) * 160,
      y: Number.isFinite(position.y) ? Math.max(42, Math.min(368, position.y)) : 110 + (Math.floor(index / 4) % 3) * 100,
    }
  })
  const transitions = value.transitions.map(transition => {
    if (!transition || !idSet.has(transition.from) || !idSet.has(transition.to)) throw new Error('Every transition must point to a state in the NFA.')
    if (typeof transition.symbol !== 'string' || (transition.symbol !== EPSILON && !alphabet.includes(transition.symbol))) throw new Error('A transition uses a symbol outside the input alphabet.')
    return { from: transition.from, to: transition.to, symbol: transition.symbol }
  })
  if (!idSet.has(value.start)) throw new Error('The start state must be included in the state list.')
  if (value.finals.some(state => !idSet.has(state)) || new Set(value.finals).size !== value.finals.length) throw new Error('Every accepting state must be included in the state list.')

  return { states, alphabet: [...alphabet], transitions, start: value.start, finals: [...value.finals] }
}

export function epsilonClosure(seed, transitions) {
  const found = new Set(seed)
  const pending = [...seed]
  while (pending.length) {
    const current = pending.pop()
    for (const edge of transitions) {
      if (edge.from === current && edge.symbol === EPSILON && !found.has(edge.to)) {
        found.add(edge.to)
        pending.push(edge.to)
      }
    }
  }
  return [...found]
}

export function runNfa(machine, input) {
  const symbols = [...input]
  let active = epsilonClosure([machine.start], machine.transitions)
  const trace = [{ position: 0, symbol: EPSILON, states: [...active] }]
  for (let index = 0; index < symbols.length; index += 1) {
    const symbol = symbols[index]
    if (!machine.alphabet.includes(symbol)) {
      return { valid: false, accepted: false, errorIndex: index, invalidSymbol: symbol, trace, endStates: active }
    }
    const moved = new Set()
    for (const state of active) {
      for (const edge of machine.transitions) if (edge.from === state && edge.symbol === symbol) moved.add(edge.to)
    }
    active = epsilonClosure([...moved], machine.transitions)
    trace.push({ position: index + 1, symbol, states: [...active] })
  }
  return { valid: true, accepted: active.some(state => machine.finals.includes(state)), trace, endStates: active }
}
