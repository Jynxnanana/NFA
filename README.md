# CHCCI NFA Automata Lab

A responsive web app for creating, visualizing, and studying nondeterministic finite automata (NFAs). It is built with Vue 3, JavaScript, Vite, and Tailwind CSS 4.

## Run locally

Install [Node.js](https://nodejs.org/), then run these commands in the project folder:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). Create a production build with `npm run build`.

## Features

- Add, rename, move, and delete states; choose start and accepting states.
- Create and edit transitions, including epsilon transitions.
- Undo and redo edits to the automaton.
- Simulate strings one step at a time and see the active state set.
- Run several input strings together with batch tests.
- Load example NFAs for common languages.
- Open the in-app quick guide for instructions on building and testing an NFA.
- Import and export automata as JSON; the current machine is also saved in the browser.
- Export the state diagram as SVG or PNG.
- Use the editor on phones with a navigation drawer, landscape fullscreen, touch pan, and pinch zoom.
- Switch between light and dark themes.

## How the stack is used

- **JavaScript** stores automata and implements validation, epsilon closure, and NFA simulation.
- **Vue 3** renders the interactive editor and keeps the diagram, transition table, and formal definition in sync.
- **Tailwind CSS 4** is configured through the Vite plugin; custom CSS provides the editor layout, diagram, and responsive behavior.
- **Node.js and Vite** run the development server and create the production build.
