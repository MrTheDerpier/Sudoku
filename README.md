# Sudoku PWA

A production-ready, dependency-free Sudoku Progressive Web App designed for Android Chrome and GitHub Pages.

## Features

- Four puzzle difficulty levels: Easy, Medium, Hard, and Expert.
- Fully client-side Sudoku generation, solving, and unique-solution puzzle validation.
- Unlimited hints and unlimited incorrect attempts.
- High-contrast, elderly-friendly interface with large readable text and 44px-or-larger touch targets.
- Touch-first portrait layout that scales to the available screen width.
- Smooth cell selection, number placement, hint pulse, error shake, and completion confetti animations.
- Timer, move counter, and mistake counter.
- Automatic localStorage save and restore.
- Installable PWA with manifest icons and an offline cache-first service worker.

## GitHub Pages

Publish the repository root with GitHub Pages. The app is static and does not require a build step.

## Local development

```bash
python3 -m http.server 4173
```

Open <http://127.0.0.1:4173/> in Chrome. Service workers require a secure context in production, which GitHub Pages provides over HTTPS.
