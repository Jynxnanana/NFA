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
  const epsilonEdgesIn = states => {
    const included = new Set(states)
    return machine.transitions.filter(edge => edge.symbol === EPSILON && included.has(edge.from) && included.has(edge.to))
  }
  const trace = [{ position: 0, symbol: EPSILON, states: [...active], transitions: epsilonEdgesIn(active) }]
  for (let index = 0; index < symbols.length; index += 1) {
    const symbol = symbols[index]
    if (!machine.alphabet.includes(symbol)) {
      return { valid: false, accepted: false, errorIndex: index, invalidSymbol: symbol, trace, endStates: active }
    }
    const moved = new Set()
    const followedEdges = []
    for (const state of active) {
      for (const edge of machine.transitions) {
        if (edge.from === state && edge.symbol === symbol) {
          moved.add(edge.to)
          followedEdges.push(edge)
        }
      }
    }
    active = epsilonClosure([...moved], machine.transitions)
    trace.push({ position: index + 1, symbol, states: [...active], transitions: [...followedEdges, ...epsilonEdgesIn(active)] })
  }

  const viableStates = trace.map(() => new Set())
  const lastStep = trace.length - 1
  viableStates[lastStep] = new Set(trace[lastStep].states.filter(state => machine.finals.includes(state)))
  trace[lastStep].acceptingStates = [...viableStates[lastStep]]

  const reverseEpsilonClosure = (seed, edges) => {
    const found = new Set(seed)
    const pending = [...seed]
    while (pending.length) {
      const current = pending.pop()
      for (const edge of edges) {
        if (edge.to === current && !found.has(edge.from)) {
          found.add(edge.from)
          pending.push(edge.from)
        }
      }
    }
    return found
  }
  const forwardEpsilonClosure = (seed, edges) => {
    const found = new Set(seed)
    const pending = [...seed]
    while (pending.length) {
      const current = pending.pop()
      for (const edge of edges) {
        if (edge.from === current && !found.has(edge.to)) {
          found.add(edge.to)
          pending.push(edge.to)
        }
      }
    }
    return found
  }

  for (let index = lastStep - 1; index >= 0; index -= 1) {
    const before = new Set(trace[index].states)
    const after = new Set(trace[index + 1].states)
    const afterEpsilonEdges = machine.transitions.filter(edge => edge.symbol === EPSILON && after.has(edge.from) && after.has(edge.to))
    const canReachViableAfter = reverseEpsilonClosure(viableStates[index + 1], afterEpsilonEdges)
    const inputEdges = machine.transitions.filter(edge => edge.symbol === symbols[index] && before.has(edge.from) && after.has(edge.to) && canReachViableAfter.has(edge.to))
    const beforeEpsilonEdges = machine.transitions.filter(edge => edge.symbol === EPSILON && before.has(edge.from) && before.has(edge.to))

    viableStates[index] = reverseEpsilonClosure(inputEdges.map(edge => edge.from), beforeEpsilonEdges)
    trace[index].acceptingStates = [...viableStates[index]]

    const reachableAfterInput = forwardEpsilonClosure(inputEdges.map(edge => edge.to), afterEpsilonEdges)
    const acceptingEpsilonEdges = afterEpsilonEdges.filter(edge => reachableAfterInput.has(edge.from) && canReachViableAfter.has(edge.to))
    trace[index + 1].acceptingTransitions = [...inputEdges, ...acceptingEpsilonEdges]
  }

  const initialStates = new Set(trace[0].states)
  const initialEpsilonEdges = machine.transitions.filter(edge => edge.symbol === EPSILON && initialStates.has(edge.from) && initialStates.has(edge.to))
  const reachableFromStart = forwardEpsilonClosure([machine.start], initialEpsilonEdges)
  const canReachInitialViable = reverseEpsilonClosure(viableStates[0], initialEpsilonEdges)
  trace[0].acceptingStates = [...viableStates[0]]
  trace[0].acceptingTransitions = initialEpsilonEdges.filter(edge => reachableFromStart.has(edge.from) && canReachInitialViable.has(edge.to))

  return { valid: true, accepted: viableStates[lastStep].size > 0, trace, endStates: active }
}
