# Azure Media Player

## Prerequisite
- This setup requires at least node 12 to run.
- A modern web browser (Tested on Chromium: 104.0.5112.102 (Official Build) (x86_64))

## Installation
- Clone this repository to (local) dev environment
- Change directory into the `server` directory
- Run `yarn install` or `npm install` to install dependencies

## Running the plugin
- Change directory into the `server` directory
- First spin up the server and ensure it's listening on a specific port by running the command `yarn start` This will run the http server on default port `8086` or you can specify your own port using the command `yarn start --port [port_numer]` e.g `yarn start --port 3000`

- If a different port was chosen in the step above, then ensure to add it as an option into the AMPlayer options.

```js
var myPlayer = amp('vid1', {
  /* Options */
  ...
  autoplay: true,
  debug: true,
  port: 3000, // assuming 3000 was chosen for the server.
  ...
  plugins: {}
}
```

- Next open the `index.html` contained within the `client` directory of this repository in your favourite `javascript` supported web browser (preferrably Chromium base browsers).

- Monitor the `Terminal` or `Console` output of the server to see all the (event) data sent from the `client` to the `server` in real time.

## Note
The browser Console trace can be disabled by setting the `debug` property of the `plugin` to `false`.

```js
var myPlayer = amp('vid1', {
  /* Options */
  ...
  traceConfig: { maxLogLevel: 0, TraceTargets: [{ target: 'console' }] }, // disable inbuilt tracing.
  port: null,
  plugins: {
    /* load our telemetry plugin */
    telemetry: {
      /* Options */
      debug: true,
      appName: "Telemetry Data Plugin"
    }
  }
}
```
