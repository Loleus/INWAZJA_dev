/* Cele budowania wielopilkowego.
   `pwa`  — aplikacja instalowalna z autoaktualizacją (folder do wystawienia na dowolnym hostingu),
   pozostałe — portale z grami: folder + archiwum .zip z index.html w korzeniu. */
export const TARGETS = {
  pwa: {
    kind: 'pwa',
    label: 'PWA',
    outDir: 'dist-pwa',
    note: 'Wystaw folder pod HTTPS (może być podkatalog). Aktualizacja: wgraj nowe pliki — gra sama pobierze wersję i przeładuje się w menu.',
  },
  yandex: {
    kind: 'portal',
    label: 'Yandex Games',
    outDir: 'dist-portals/yandex',
    zip: 'dist-portals/inwazja-yandex.zip',
    sdkSrc: '/sdk.js',
    adapter: 'yandex',
    note: 'SDK ładowane względną ścieżką /sdk.js (tak wymaga Yandex przy archiwum); adapter: LoadingAPI.ready + GameplayAPI.start/stop.',
  },
  itch: {
    kind: 'portal',
    label: 'itch.io',
    outDir: 'dist-portals/itch',
    zip: 'dist-portals/inwazja-itch.zip',
    sdkSrc: null,
    adapter: null,
    note: 'Projekt typu HTML, zaznacz „played in the browser”, rozmiar osadzenia 800×730.',
  },
  crazygames: {
    kind: 'portal',
    label: 'CrazyGames',
    outDir: 'dist-portals/crazygames',
    zip: 'dist-portals/inwazja-crazygames.zip',
    sdkSrc: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
    adapter: 'crazygames',
    note: 'SDK v3; adapter: init, loadingStart/Stop, gameplayStart/Stop.',
  },
  poki: {
    kind: 'portal',
    label: 'Poki',
    outDir: 'dist-portals/poki',
    zip: 'dist-portals/inwazja-poki.zip',
    sdkSrc: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js',
    adapter: 'poki',
    note: 'Adapter: init, gameLoadingFinished, gameplayStart/Stop.',
  },
};

export const PORTALS = ['yandex', 'itch', 'crazygames', 'poki'];

/** Skróty wiersza poleceń. */
export const GROUPS = {
  portals: PORTALS,
  all: ['pwa', ...PORTALS],
};
