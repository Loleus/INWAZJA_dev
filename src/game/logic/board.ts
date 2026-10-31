import {
  ARROW,
  BOARD_H,
  BOARD_SKETCH,
  CELL,
  COLS,
  GAME_W,
  LANE_ARROWS,
  LANE_ROUTES,
  PATH_CELL,
  PLAY_BOTTOM,
  ROWS,
  WORLD_Y,
} from '../constants';
import type { LanePath, Point } from '../types';

const BOARD_ROAD: boolean[][] = BOARD_SKETCH.map((row) => row.split('').map((ch) => ch !== '0'));

/** Czy gęsta komórka (25 px) jest jezdnią — decyduje jej blok 2×2. */
export function isPath(col: number, row: number): boolean {
  const block = BOARD_ROAD[Math.floor(row / 2)];
  return Boolean(block && block[Math.floor(col / 2)]);
}

/** Wieżę wolno stawiać tylko na trawie sąsiadującej z drogą (także po skosie). */
export function isAdjacentToPath(col: number, row: number): boolean {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if ((dx !== 0 || dy !== 0) && isPath(col + dx, row + dy)) return true;
    }
  }
  return false;
}

export function isInsideGrid(col: number, row: number): boolean {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

/** Środek gęstej komórki we współrzędnych ekranu. */
export function cellCenter(col: number, row: number): Point {
  return { x: col * CELL + CELL / 2, y: WORLD_Y + row * CELL + CELL / 2 };
}

export function pointerCell(x: number, y: number): { col: number; row: number } {
  return { col: Math.floor(x / CELL), row: Math.floor((y - WORLD_Y) / CELL) };
}

export function pointerOnBoard(x: number, y: number): boolean {
  return y >= WORLD_Y && y < PLAY_BOTTOM && x >= 0 && x <= GAME_W;
}

export function onBoard(x: number, y: number): boolean {
  return x >= 0 && x <= GAME_W && y >= WORLD_Y && y <= WORLD_Y + BOARD_H;
}

/* ----------------------------------- trasy wrogów ----------------------------------- */
function buildPath(id: string, coords: [number, number][]): LanePath {
  const points = coords.map(([c, r]) => ({
    x: c * PATH_CELL + PATH_CELL / 2,
    y: WORLD_Y + r * PATH_CELL + PATH_CELL / 2,
  }));
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return { id, points, length };
}

export const PATHS: LanePath[] = Object.entries(LANE_ROUTES).map(([id, coords]) => buildPath(id, coords));

/** Dystans do bazy; odcinek za krawędzią planszy nie jest przebyty, bo wróg trafia do bazy przy x > GAME_W. */
export function pathLengthToBase(path: LanePath): number {
  const end = path.points[path.points.length - 1];
  return path.length - Math.max(0, end.x - GAME_W);
}

export function getPathById(id: string): LanePath {
  return PATHS.find((p) => p.id === id) ?? PATHS[0];
}

/** Identyfikator drogi, jeśli punkt leży na jednej z dwóch strzałek jej wjazdu. */
export function laneEntryArrowAt(x: number, y: number): string | null {
  const radiusSq = ARROW.hoverRadius * ARROW.hoverRadius;
  for (const entry of LANE_ARROWS) {
    for (let i = 0; i < 2; i++) {
      const dx = x - (entry.x + entry.dx * i * ARROW.spacing);
      const dy = y - (entry.y + entry.dy * i * ARROW.spacing);
      if (dx * dx + dy * dy <= radiusSq) return entry.id;
    }
  }
  return null;
}

/* ----------------------------------- zakręty dróg ----------------------------------- */
const BEND_OPPOSITE: Record<string, string> = { ne: 'sw', sw: 'ne', nw: 'se', se: 'nw' };

function bendCorner(col: number, row: number): string | null {
  let mask = 0;
  if (isPath(col, row - 1)) mask |= 1;
  if (isPath(col + 1, row)) mask |= 2;
  if (isPath(col, row + 1)) mask |= 4;
  if (isPath(col - 1, row)) mask |= 8;
  if (mask === 3) return 'ne';
  if (mask === 6) return 'se';
  if (mask === 9) return 'nw';
  if (mask === 12) return 'sw';
  return null;
}

/** Klucz zaokrąglonego kafelka zakrętu albo null, gdy wystarczy zwykły kafelek. */
function cornerTextureKey(col: number, row: number): string | null {
  if (!isInsideGrid(col, row)) return null;
  if (col === 0 || col === COLS - 1 || row === 0 || row === ROWS - 1) return null;
  const bend = bendCorner(col, row);
  if (!bend) return null;
  const on = isPath(col, row);
  const corner = on ? BEND_OPPOSITE[bend] : bend;
  return (on ? 'tile-corner-' : 'tile-inner-') + corner + tileToneSuffix(col, row);
}

/** Szachownica dwóch tonów trawy i piasku. */
function tileToneSuffix(col: number, row: number): string {
  return (col + row) % 2 === 0 ? '' : '-b';
}

/** Klucz kafelka komórki: zakręt albo zwykła trawa/droga w jednym z dwóch tonów. */
export function tileTextureKey(col: number, row: number): string {
  const corner = cornerTextureKey(col, row);
  if (corner) return corner;
  const alt = (col + row) % 2 === 0;
  if (isPath(col, row)) return alt ? 'tile-path' : 'tile-path2';
  return alt ? 'tile-grass' : 'tile-grass2';
}
