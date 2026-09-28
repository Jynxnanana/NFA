# Orbit — NFA Automata Studio

A small web app for building and simulating nondeterministic finite automata (NFAs). This is a class project starter built with Vue, JavaScript, Vite, and Tailwind CSS.

## Run locally

Install [Node.js](https://nodejs.org/) first. In a terminal opened in this project folder, run:

```sh
npm install
npm run dev
```

Open the local address printed by Vite (usually `http://localhost:5173`). To create a production build, run `npm run build`.

## Included

- Add and remove states; drag states around the diagram.
- Choose the start state and toggle accepting/final states.
- Add alphabet symbols and transitions, including ε-transitions.
- View a transition table and the formal definition `M = (Q, Σ, δ, q₀, F)`.
- Simulate an input string with ε-closure and a step trace.
- Export the current automaton as JSON.

## How the stack is used

- **JavaScript** contains the automaton data and simulation logic.
- **Vue 3** renders the interactive editor and keeps the diagram, table, and definition in sync.
- **Tailwind CSS 4** is wired through the Vite plugin; the workspace also uses custom CSS for its visual design and diagram.
- **Node.js and Vite** run the local development server and produce the web build.

The starter opens with an example machine. You can modify it in the UI to demonstrate your own NFA.
