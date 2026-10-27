import { useCallback, useEffect, useRef } from "react";
import type Phaser from "phaser";
import { createGame } from "./game/createGame";
import { registerYarinFont } from "./assets/yarinFont";

export default function App() {
  const gameRef = useRef<Phaser.Game | null>(null);

  // Fokus na canvasie gry — skróty klawiaturowe działają od razu po załadowaniu
  // strony i po każdym kliknięciu w obszar gry (także przy osadzeniu strony).
  const focusCanvas = useCallback(() => {
    const canvas = gameRef.current?.canvas;
    if (canvas) {
      canvas.setAttribute("tabindex", "0");
      canvas.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    if (gameRef.current) return;
    let cancelled = false;
    let timer = 0;

    const boot = async () => {
      // Phaser renderuje tekst do canvasu i cache'uje pomiar szerokości,
      // więc font musi być załadowany przed startem scen.
      registerYarinFont();
      try {
        await Promise.all([
          document.fonts.load('23px Yarin'),
          document.fonts.load('bold 23px Yarin'),
        ]);
        await document.fonts.ready;
      } catch {
        // Brak FontFace API — start na foncie zapasowym.
      }
      if (cancelled) return;
      const game = createGame("game-root");
      gameRef.current = game;
      timer = window.setTimeout(focusCanvas, 150);
    };

    void boot();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [focusCanvas]);

  return (
    <div
      className="flex h-full w-full items-center justify-center bg-black"
      onPointerDown={focusCanvas}
    >
      <div id="game-root" className="h-full w-full" />
    </div>
  );
}
