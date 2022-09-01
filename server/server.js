var cors = require("cors")
var express = require("express")

// server listening port
var PORT = Number(process.argv.pop()) || 8086

// express instance
var app = express()

// middlewares
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// global variables
var lastAnalyticsTime = 0
var bufferTimeGreaterThan500 = 0
var playbackSwitchCount = 0
var downloadSwitchCount = 0

var lastPlaybackBitrateData
var lastDownloadBitrateData

/**
 * logData function logs data to console
 * @params eventId
 * @params message
 * @params data
 * @params level
 * @returns void
 */
function logData(eventId, message, data, level = "Info") {
  var eventLog = {
    eventId: eventId,
    level: level,
    message: message,
    data: data
  };

  console.warn(eventLog);
}

/**
 * restAll function resets all global variable to default state onplay end
 * @return void
 */
function resetAll() {
  lastAnalyticsTime = 0
  bufferTimeGreaterThan500 = 0
  playbackSwitchCount = 0
  downloadSwitchCount = 0

  lastPlaybackBitrateData = null
  lastDownloadBitrateData = null
}

/**
 * accepts requestion on "/analytics" endpoint
 * @params req
 * @params res
 * @returns void
 */
app.post("/analytics", function (req, res) {
  var bufferTime = req.body.bufferTime

  // count all buffer events that lasted more than 500ms
  if (bufferTime > 500) bufferTimeGreaterThan500++

  // check if buffer events that occurred within 30 seconds of play is greater than 3
  if (bufferTimeGreaterThan500 > 3 && Math.abs(req.body.currentTime - lastAnalyticsTime) < 30) {
    req.body.bufferTimeGreaterThan500 = bufferTimeGreaterThan500

    logData("TOO_MANY_BUFFERING", bufferTimeGreaterThan500 + " buffers with time greater than 500ms occurred within 30 seconds of play", req.body)
    bufferTimeGreaterThan500 = 0
  }

  // check if there is any buffer event that lasted for more than 1 second
  if (bufferTime > 1000) {
    logData("TOO_MANY_BUFFERING", "Some buffer interruptions lasted more 1 second", req.body)
  }

  lastAnalyticsTime = req.body.currentTime
  res.end()
})

/**
 * accepts requestion on "/summary" endpoint
 * @params req
 * @params res
 * @returns void
 */
app.post("/summary", function (req, res) {
  logData("SUMMARY", "Player overall summary.", req.body)

  // rest all variables
  resetAll()
  res.end()
})

/**
 * accepts requestion on "/download-bitrate-switches" endpoint
 * @params req
 * @params res
 * @returns void
 */
app.post("/download-bitrate-switches", function (req, res) {
  downloadSwitchCount++

  var videoPlayerWidth = req.body.videoPlayerSize.width
  var currentFrameWidth = req.body.currentFrameSize.width

  if (downloadSwitchCount > 2 && Math.abs(req.body.currentTime - lastDownloadBitrateData.currentTime) < 10) {
    lastDownloadBitrateData = req.body
    logData("TOO_MANY_BITRATE_SWITCHES", "Too many download bitrate switches in the last 10 seconds.", req.body)
    downloadSwitchCount = 0
  }

  if (currentFrameWidth < videoPlayerWidth) {
    var message = "The selected bitrate " + req.body.currentBitrate + " is meant for a smaller player frame size."
    logData("HIGHEST_BITRATE_POSSIBLE", message, req.body)
  }

  // console.log("download bitrate change")
  lastDownloadBitrateData = req.body
  res.end()
})

/**
 * accepts requestion on "/playback-bitrate-switches" endpoint
 * @params req
 * @params res
 * @returns void
 */
app.post("/playback-bitrate-switches", function (req, res) {
  playbackSwitchCount++

  var videoPlayerWidth = req.body.videoPlayerSize.width
  var currentFrameWidth = req.body.currentFrameSize.width

  if (playbackSwitchCount > 2 && Math.abs(req.body.currentTime - lastPlaybackBitrateData.currentTime) < 10) {
    lastPlaybackBitrateData = req.body
    logData("TOO_MANY_BITRATE_SWITCHES", "Too many playback bitrate switches in the last 10 seconds.", req.body)
    playbackSwitchCount = 0
  }

  if (currentFrameWidth < videoPlayerWidth) {
    var message = "The selected bitrate " + req.body.currentBitrate + " is meant for a smaller player frame size."
    logData("HIGHEST_BITRATE_POSSIBLE", message, req.body)
  }

  // console.log("playback bitrate change")
  lastPlaybackBitrateData = req.body
  res.end()
})

/**
 * accepts requestion on "/onload" endpoint
 * @params req
 * @params res
 * @returns void
 */
app.post("/onload", function (req, res) {
  resetAll()
  logData("PLAYER_INITIALIZED", "The AMPlayer was initialized.", req.body)
  res.end()
})

/**
 * app entry point
 * @params port
 * @params callback function
 * @returns void
 */
app.listen(PORT, function () {
  console.log("server running on port " + PORT)
})
