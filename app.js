const SIZE = 9;
const BOX = 3;
const DIFFICULTIES = { easy: 38, medium: 46, hard: 52, expert: 58 };
const STORAGE_KEY = 'sudoku-pwa-state-v1';

const boardEl = document.getElementById('board');
const difficultyEl = document.getElementById('difficulty');
const timerEl = document.getElementById('timer');
const movesEl = document.getElementById('moves');
const mistakesEl = document.getElementById('mistakes');
const statusEl = document.getElementById('status');
const installButton = document.getElementById('installButton');
let deferredInstallPrompt;
let state = null;
let selected = null;
let timerId = null;
let touchStart = null;

const clone = grid => grid.map(row => [...row]);
const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]);
const indexToRC = i => [Math.floor(i / SIZE), i % SIZE];
const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

function canPlace(grid, row, col, value) {
  for (let i = 0; i < SIZE; i++) if (grid[row][i] === value || grid[i][col] === value) return false;
  const br = Math.floor(row / BOX) * BOX;
  const bc = Math.floor(col / BOX) * BOX;
  for (let r = br; r < br + BOX; r++) for (let c = bc; c < bc + BOX; c++) if (grid[r][c] === value) return false;
  return true;
}

function fillGrid(grid) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== 0) continue;
      for (const n of shuffle([1,2,3,4,5,6,7,8,9])) {
        if (canPlace(grid, r, c, n)) {
          grid[r][c] = n;
          if (fillGrid(grid)) return true;
          grid[r][c] = 0;
        }
      }
      return false;
    }
  }
  return true;
}

function countSolutions(grid, limit = 2) {
  let count = 0;
  function solve() {
    if (count >= limit) return;
    let best = null;
    let options = null;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c]) continue;
        const candidates = [1,2,3,4,5,6,7,8,9].filter(n => canPlace(grid, r, c, n));
        if (!candidates.length) return;
        if (!options || candidates.length < options.length) { best = [r, c]; options = candidates; }
      }
    }
    if (!best) { count++; return; }
    const [r, c] = best;
    for (const n of options) { grid[r][c] = n; solve(); grid[r][c] = 0; }
  }
  solve();
  return count;
}

function createPuzzle(difficulty) {
  const solution = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  fillGrid(solution);
  const puzzle = clone(solution);
  let removed = 0;
  for (const pos of shuffle([...Array(81).keys()])) {
    if (removed >= DIFFICULTIES[difficulty]) break;
    const [r, c] = indexToRC(pos);
    const old = puzzle[r][c];
    puzzle[r][c] = 0;
    if (countSolutions(clone(puzzle)) !== 1) puzzle[r][c] = old;
    else removed++;
  }
  return { puzzle, solution };
}

function newGame(difficulty = state?.difficulty || difficultyEl.value) {
  const { puzzle, solution } = createPuzzle(difficulty);
  state = { difficulty, puzzle, solution, grid: clone(puzzle), moves: 0, mistakes: 0, elapsed: 0, started: Date.now(), complete: false };
  selected = null;
  difficultyEl.value = difficulty;
  save();
  render();
  startTimer();
  statusEl.textContent = 'New game ready. Select a cell, then tap a number.';
}

function render() {
  boardEl.innerHTML = '';
  state.grid.flat().forEach((value, i) => {
    const [r, c] = indexToRC(i);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.role = 'gridcell';
    cell.dataset.row = r;
    cell.dataset.col = c;
    cell.ariaLabel = `Row ${r + 1}, column ${c + 1}${value ? `, ${value}` : ', empty'}`;
    cell.textContent = value || '';
    if (state.puzzle[r][c]) cell.classList.add('given');
    cell.addEventListener('click', () => selectCell(r, c));
    boardEl.appendChild(cell);
  });
  updateHighlights();
  updateStats();
}

function updateStats() {
  timerEl.textContent = formatTime(state.elapsed);
  movesEl.textContent = state.moves;
  mistakesEl.textContent = state.mistakes;
}

function selectCell(row, col) {
  selected = { row, col };
  updateHighlights();
}

function updateHighlights() {
  document.querySelectorAll('.cell').forEach(cell => {
    const r = Number(cell.dataset.row), c = Number(cell.dataset.col);
    cell.classList.remove('selected', 'peer', 'same');
    if (!selected) return;
    const value = state.grid[selected.row][selected.col];
    if (r === selected.row && c === selected.col) cell.classList.add('selected');
    else if (r === selected.row || c === selected.col || (Math.floor(r / 3) === Math.floor(selected.row / 3) && Math.floor(c / 3) === Math.floor(selected.col / 3))) cell.classList.add('peer');
    if (value && state.grid[r][c] === value) cell.classList.add('same');
  });
}

function setNumber(value, isHint = false) {
  if (!selected || state.complete) return;
  const { row, col } = selected;
  if (state.puzzle[row][col]) { statusEl.textContent = 'Original clues cannot be changed.'; return; }
  if (value && value !== state.solution[row][col]) {
    state.mistakes++;
    flash(row, col, 'error');
    statusEl.textContent = 'That number does not fit. Try again or use a hint.';
    save(); updateStats(); return;
  }
  if (state.grid[row][col] !== value) state.moves++;
  state.grid[row][col] = value;
  const cell = cellAt(row, col);
  cell.textContent = value || '';
  cell.ariaLabel = `Row ${row + 1}, column ${col + 1}${value ? `, ${value}` : ', empty'}`;
  flash(row, col, isHint ? 'hint' : 'placed');
  statusEl.textContent = isHint ? 'Hint placed.' : 'Number placed.';
  updateHighlights(); updateStats(); save(); checkComplete();
}

function hint() {
  const empties = [];
  state.grid.forEach((row, r) => row.forEach((value, c) => { if (!value) empties.push([r, c]); }));
  if (!empties.length) return;
  const [r, c] = selected && !state.grid[selected.row][selected.col] ? [selected.row, selected.col] : empties[Math.floor(Math.random() * empties.length)];
  selected = { row: r, col: c };
  setNumber(state.solution[r][c], true);
}

function erase() { if (selected) setNumber(0); }
function cellAt(row, col) { return boardEl.children[row * SIZE + col]; }
function flash(row, col, className) { const cell = cellAt(row, col); cell.classList.remove(className); void cell.offsetWidth; cell.classList.add(className); setTimeout(() => cell.classList.remove(className), 1300); }
function checkComplete() {
  const done = state.grid.every((row, r) => row.every((value, c) => value === state.solution[r][c]));
  if (!done) return;
  state.complete = true; save(); clearInterval(timerId); statusEl.textContent = 'Congratulations! Puzzle complete.'; celebrate();
}
function celebrate() {
  const colors = ['#12355b', '#f2b84b', '#176b42', '#2c6fb7', '#b42318'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('span');
    p.className = 'confetti-piece'; p.style.left = `${Math.random() * 100}%`; p.style.background = colors[i % colors.length]; p.style.animationDelay = `${Math.random() * .7}s`; document.getElementById('confetti').appendChild(p);
    setTimeout(() => p.remove(), 3600);
  }
}
function startTimer() { clearInterval(timerId); timerId = setInterval(() => { if (!state.complete) { state.elapsed++; updateStats(); save(); } }, 1000); }
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } }

document.getElementById('newGame').addEventListener('click', () => newGame(difficultyEl.value));
document.getElementById('hint').addEventListener('click', hint);
document.getElementById('erase').addEventListener('click', erase);
difficultyEl.addEventListener('change', () => { if (state) state.difficulty = difficultyEl.value; save(); });
document.querySelectorAll('[data-number]').forEach(button => button.addEventListener('click', () => setNumber(Number(button.dataset.number))));
document.addEventListener('keydown', event => { if (/^[1-9]$/.test(event.key)) setNumber(Number(event.key)); if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') erase(); });
boardEl.addEventListener('pointerdown', event => { touchStart = { x: event.clientX, y: event.clientY }; });
boardEl.addEventListener('pointerup', event => {
  if (!touchStart || !selected) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 32) return;
  const row = Math.max(0, Math.min(8, selected.row + (Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0)));
  const col = Math.max(0, Math.min(8, selected.col + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0)));
  selectCell(row, col);
});
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; installButton.hidden = false; });
installButton.addEventListener('click', async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; installButton.hidden = true; deferredInstallPrompt = null; });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));

const saved = load();
if (saved?.grid && saved?.solution && saved?.puzzle) { state = saved; difficultyEl.value = state.difficulty; render(); startTimer(); }
else newGame('easy');
