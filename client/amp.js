(function () {
  "use strict";

  amp.plugin('telemetry', function (options) {
    var player = this,
      callback = function (data) { console.log("Default diagnostics logger callback", data); };

    if (!!options && !!options.callback && typeof (options.callback) === 'function') {
      callback = options.callback;
    }

    // initialize the plugin
    init();

    function init() {
      player.ready(handleReady);
      player.addEventListener(amp.eventName.error, handleError);
    }

    function handleReady() {

      var data = {
        ampVersion: player.getAmpVersion(),
        appName: options.appName,
        debugMode: options.debug,
        userAgent: navigator.userAgent,
        port: options.port,
        options: {
          autoplay: player.options().autoplay,
          heuristicProfile: player.options().heuristicProfile,
          techOrder: JSON.stringify(player.options().techOrder)
        }
      };

      logData("AMPInstanceCreated", data);
      sendData({ appName: data.appName, ampVersion: data.ampVersion, sessionId: player.currentSrc() }, "onload")
      player.addEventListener(amp.eventName.loadedmetadata, handleLoadedMetaData);
    }

    function handleError() {
      var err = player.error();
      var data = {
        sessionId: player.currentSrc(),
        currentTime: player.currentTime(),
        code: "0x" + err.code.toString(16),
        message: err.message
      };

      logData("Error", data, "Error");
    }

    // function clean() {
    //   // remove all attached listeners
    //   player.removeEventListener()
    // }

    function logData(eventId, data, level = "Info") {
      var eventLog = {
        eventId: eventId,
        level: level,
        data: data
      };

      callback(eventLog);
    }

    function getAvailableTracks() {
      var stream = player.currentVideoStreamList().streams.length ? player.currentVideoStreamList().streams[0] : undefined;

      return stream.tracks;
    }

    function sendData(data, uri = "analytics") {
      var xhr = new XMLHttpRequest();
      var host = "http://127.0.0.1:" + (player.options().port || 8086) + "/" + uri

      xhr.open("POST", host, true)
      xhr.setRequestHeader("Access-Control-Allow-Origin", "*")
      xhr.setRequestHeader("Content-type", "application/json; charset=utf-8");

      xhr.send(JSON.stringify(data))
      xhr.onload = function () {
        if (xhr.status != 200) {
          if (options.debug) logData("RequestError", { status: xhr.statusText, message: xhr.statusText }, "Error")
          return
        }

        if (options.debug) logData("RequestSuccess", { status: "success", message: "data sent to server" })
      }

      xhr.onprogress = function (event) {
        if (event.lengthComputable) {
          if (options.debug) logData("RequestStream", { status: "success", message: "sent " + event.loaded + " of " + event.total })
          return
        }

        if (options.debug) logData("RequestStream", { status: "success", message: "sent " + event.loaded + " bytes" })
      }

      xhr.onerror = function () {
        logData("RequestError", { status: "error", message: "internal server error" })
      }
    }

    function handleLoadedMetaData() {

      var bufferStart = 0
      var totalBufferTime = 0
      var downloadBitrateSwitches = []
      var playbackBitrateSwitches = []
      var availableBitrates = null
      var currentBitrate = 0
      var currentFrameSize = null
      var videoPlayerSize = {
        width: player.width(),
        height: player.height()
      }

      var isBuffering = false, bufferTime = 0, bufferCount = 0;

      player.addEventListener(amp.eventName.play, handlePlay)
      player.addEventListener(amp.eventName.waiting, handleWaiting)
      player.addEventListener(amp.eventName.ended, handleEnd);

      player.addEventListener(amp.eventName.playbackbitratechanged, handlePlaybackBitrateChanged);
      player.addEventListener(amp.eventName.downloadbitratechanged, handleDownloadBitrateChanged);

      if (player.videoBufferData()) {
        if (options.debug) {
          var bufferData = player.videoBufferData()

          player.videoBufferData().addEventListener(amp.bufferDataEventName.downloadrequested, function (event) {
            logData(
              event.type, {
              message: "download requested",
              bufferLevel: bufferData.bufferLevel
            })
          })

          player.videoBufferData().addEventListener(amp.bufferDataEventName.downloadcompleted, function (event) {
            logData(
              event.type, {
              message: "download completed",
              bufferLevel: bufferData.bufferLevel
            })
          })

          player.videoBufferData().addEventListener(amp.bufferDataEventName.downloadfailed, function (event) {
            logData(
              event.type, {
              code: "download failed code: 0x" + bufferData.downloadFailed.code.toString(8),
              message: " + bufferData.downloadFailed.message"
            })
          })
        }
      }

      // get all available bitrates
      if (player.currentVideoStreamList()) {
        availableBitrates = getAvailableTracks().map(function (v) { return v._bitrate })
      }

      function handlePlay(event) {
        isBuffering = false

        // disregard initial (first) player load buffer time.
        if (0 != bufferStart) {
          bufferTime = Math.abs(new Date().getTime() - bufferStart)
          totalBufferTime += bufferTime
        }

        var data = {
          isBuffering,
          bufferTime,
          bufferCount,
          currentBitrate,
          totalBufferTime,
          videoPlayerSize,
          currentFrameSize,
          availableBitrates,
          downloadBitrateSwitches,
          playbackBitrateSwitches,
          sessionId: player.currentSrc(),
          currentTime: player.currentTime(),
        }

        // send data async
        sendData(data)
      }

      function handleWaiting(event) {
        bufferCount++
        isBuffering = true
        bufferStart = new Date().getTime()
      }

      function handleEnd(event) {

        var data = {
          totalBufferTime,
          availableBitrates,
          playbackBitrateSwitches,
          downloadBitrateSwitches,
          totalBufferCount: bufferCount,
          lastBufferTime: bufferStart,
          lastBitrate: currentBitrate,
        }

        // remove all events
        // clean()

        // send data async
        sendData(data, "summary")
      }

      function handleDownloadBitrateChanged(event) {
        // get the changed bitrates
        var bitrate = player.currentDownloadBitrate()
        if (currentBitrate !== bitrate) {
          downloadBitrateSwitches.push({ from: currentBitrate, to: bitrate })
          currentBitrate = bitrate
        }

        var allTracks = getAvailableTracks()
        for (var i = 0; i < allTracks.length; i++) {
          // get the current frame size using the selected bitrate
          var track = allTracks[i]
          if (track._bitrate == currentBitrate) {
            currentFrameSize = { width: track._width, height: track._height }
            break
          }
        }

        var data = {
          isBuffering,
          currentBitrate,
          currentFrameSize,
          downloadBitrateSwitches,
          videoPlayerSize,
          currentTime: player.currentTime()
        }

        // send data async
        sendData(data, "download-bitrate-switches")
      }

      function handlePlaybackBitrateChanged(event) {
        // get the changed bitrates
        var bitrate = player.currentPlaybackBitrate()
        if (currentBitrate !== bitrate) {
          playbackBitrateSwitches.push({ from: currentBitrate, to: bitrate })
          currentBitrate = bitrate
        }

        var allTracks = getAvailableTracks()
        for (var i = 0; i < allTracks.length; i++) {
          // get the current frame size using the selected bitrate
          var track = allTracks[i]
          if (track._bitrate == currentBitrate) {
            currentFrameSize = { width: track._width, height: track._height }
            break
          }
        }

        var data = {
          isBuffering,
          currentBitrate,
          currentFrameSize,
          playbackBitrateSwitches,
          videoPlayerSize,
          currentTime: player.currentTime()
        }

        // send data async
        sendData(data, "playback-bitrate-switches")
      }
    }
  });
}).call(this);
