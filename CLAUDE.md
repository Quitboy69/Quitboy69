# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What this repository is

`quitboy69/quitboy69` is a small personal repository. The name follows GitHub's
`username/username` special-repository convention (whose `README.md` renders on
the owner's profile page), but the tracked content is actually a **single-page
"To-Do Liste" web app** written in German, embedded entirely inside `README.md`.

There is no build system, package manager, framework, test suite, or CI. The
whole app is plain HTML + inline CSS + vanilla JavaScript in one file.

## Repository layout

```
.
├── README.md              # The entire app: HTML + inline <style> + inline <script> (German UI)
└── .vscode/
    └── settings.json      # Editor setting (default binary editor for .cpuprofile)
```

That is the complete file inventory. Do not assume hidden tooling exists.

## ⚠️ Known issues (read before editing)

1. **`README.md` contains unresolved Git merge conflict markers.** The file
   currently includes literal `<<<<<<< HEAD`, `=======`, and
   `>>>>>>> <sha>` lines from an unfinished merge. The HTML is therefore
   malformed (e.g. the `<head>`/`<title>` block and an `<h1>` heading are
   fenced off inside conflict markers). If you touch this file, expect to
   resolve these conflicts. Do **not** introduce new conflict markers.

2. **`README.md` is misnamed for its content.** It holds an HTML document,
   not Markdown. GitHub will still try to render it as Markdown on the profile
   page, which is why the raw HTML/JS shows through. Renaming or restructuring
   is a product decision — confirm with the owner before doing so, since the
   filename is what makes it a profile README.

3. **Stray markup.** A lone `<Button>Like</Button>` sits in the body outside
   the app's logic; it is not wired to anything.

## The app itself

The To-Do app (once conflict markers are removed) works entirely client-side:

- `todoList` — an in-memory JavaScript array holding task strings. **Not
  persisted**; a page reload clears everything (no `localStorage`/backend).
- `addTask()` — reads `#taskInput`, trims it, pushes to `todoList`, clears the
  input, re-renders. Alerts if empty.
- `deleteTask(index)` — splices the item at `index` and re-renders.
- `renderList()` — clears `#todoList` and rebuilds `<li>` elements, each with a
  "Löschen" (delete) button, from the `todoList` array.

UI text is German ("Neue Aufgabe hinzufügen…", "Hinzufügen", "Deine Aufgaben:",
"Löschen", "Bitte eine Aufgabe eingeben."). Keep new user-facing strings in
German to match unless the owner asks otherwise.

## How to run / preview

There is no build step. To view the app, open the HTML directly in a browser:

```bash
# Copy to an .html file first (README.md is not served as HTML by browsers)
cp README.md /tmp/todo.html && xdg-open /tmp/todo.html   # or open on macOS
```

Or paste the HTML portion into any static HTML file. Because everything is
inline, no server, install, or bundler is required.

## Conventions & guidance for changes

- **Keep it self-contained.** The app is a single HTML file with inline styles
  and scripts. Preserve that shape unless the owner explicitly wants to split
  files or add tooling — don't introduce npm, a framework, or a bundler on your
  own initiative.
- **Vanilla JS only.** No dependencies are present; don't add any without asking.
- **Match existing style.** Function-based vanilla JS, `document.getElementById`
  DOM access, German comments and UI strings.
- **Never commit merge conflict markers.** Before committing, grep for
  `<<<<<<<`, `=======`, `>>>>>>>` and ensure none remain.

## Git workflow

- Default branch: `main`.
- Commit history is sparse and messages are informal (some in German, e.g.
  "Aktualisieren von README.md"). Prefer clear, descriptive messages going
  forward.
- Do not open a pull request unless explicitly asked.
