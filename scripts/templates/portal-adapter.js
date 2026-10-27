/* Adapter portalu — szablon wypełniany przez scripts/build.mjs.

   Łączy cykl życia gry (sygnał `inwazja:scene` z createGame) z SDK portalu:
   - pierwsze osiągnięcie menu → „gra załadowana" (raz),
   - scena rozgrywki → „gra się toczy", każda inna scena → „gra wstrzymana".
   Zdarzenia są wysyłane tylko przy zmianie stanu (portale odrzucają podwójne start/start i stop/stop).
   Brak SDK (offline, blokada reklam, uruchomienie poza portalem) nigdy nie przerywa gry. */
(function () {
  'use strict';

  var PORTAL = '__PORTAL__';
  var GAMEPLAY_SCENE = 'GameScene';

  var scene = document.documentElement.dataset.scene || '';
  var api = null;
  var loadedReported = false;
  var playing = false;

  function safe(fn) {
    try {
      fn();
    } catch (error) {
      /* SDK potrafi rzucać poza własną domeną — to nie może zatrzymać gry */
    }
  }

  var connectors = {
    yandex: function () {
      if (typeof YaGames === 'undefined') return null;
      return YaGames.init().then(function (ysdk) {
        var features = ysdk.features || {};
        return {
          loaded: function () {
            if (features.LoadingAPI) features.LoadingAPI.ready();
          },
          start: function () {
            if (features.GameplayAPI) features.GameplayAPI.start();
          },
          stop: function () {
            if (features.GameplayAPI) features.GameplayAPI.stop();
          },
        };
      });
    },

    poki: function () {
      if (typeof PokiSDK === 'undefined') return null;
      var poki = {
        loaded: function () {
          PokiSDK.gameLoadingFinished();
        },
        start: function () {
          PokiSDK.gameplayStart();
        },
        stop: function () {
          PokiSDK.gameplayStop();
        },
      };
      // Odrzucone init (np. adblock) nadal pozwala grać — dokumentacja Poki każe kontynuować.
      return PokiSDK.init().then(
        function () {
          return poki;
        },
        function () {
          return poki;
        },
      );
    },

    crazygames: function () {
      var sdk = window.CrazyGames && window.CrazyGames.SDK;
      if (!sdk) return null;
      return sdk.init().then(function () {
        safe(function () {
          sdk.game.loadingStart();
        });
        return {
          loaded: function () {
            sdk.game.loadingStop();
          },
          start: function () {
            sdk.game.gameplayStart();
          },
          stop: function () {
            sdk.game.gameplayStop();
          },
        };
      });
    },
  };

  function sync() {
    if (!api) return;
    if (!loadedReported && scene && scene !== 'BootScene') {
      loadedReported = true;
      safe(api.loaded);
    }
    var wantPlaying = scene === GAMEPLAY_SCENE;
    if (wantPlaying !== playing) {
      playing = wantPlaying;
      safe(wantPlaying ? api.start : api.stop);
    }
  }

  window.addEventListener('inwazja:scene', function (event) {
    scene = (event && event.detail) || document.documentElement.dataset.scene || '';
    sync();
  });

  safe(function () {
    var connect = connectors[PORTAL];
    var pending = connect && connect();
    if (pending && pending.then) {
      pending.then(function (connected) {
        api = connected;
        sync();
      }, function () {});
    }
  });
})();
