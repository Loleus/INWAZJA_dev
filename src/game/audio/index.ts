/* Publiczne wejście silnika audio — sceny i UI importują wyłącznie stąd. */
export { gameAudio, AudioEngine } from './AudioEngine';
export { ALL_SOUND_IDS, ENEMY_LOOPS, SOUNDS, soundFile } from './manifest';
export type { AudioFallback, SoundDef, SoundId } from './manifest';
