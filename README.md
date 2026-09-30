# SwitchBot.StreamDeckPlugin

English | [日本語](README.ja.md)

A Stream Deck plugin for controlling SwitchBot devices through SwitchBot OpenAPI v1.1.

You can control devices such as Bots, lights, air conditioners, locks, and curtains directly from Stream Deck keys. The plugin also supports retrieving device status, controlling infrared remotes, and sending custom SwitchBot API requests.

## Installation

Download the latest `.streamDeckPlugin` file from [GitHub Releases](https://github.com/Ovis/SwitchBot.StreamDeckPlugin/releases), then open the downloaded file to install the plugin in Stream Deck.

### Requirements

- Stream Deck 7.1 or later
- Windows 10 or later
- macOS 13 or later
- A SwitchBot account
- SwitchBot OpenAPI Token and Secret

## Initial setup

A SwitchBot OpenAPI **Token** and **Secret** are required to use this plugin.

See the SwitchBot support article for instructions on obtaining them:

- [How to obtain a Token](https://support.switch-bot.com/hc/en-us/articles/12822710195351-How-to-obtain-a-Token)

After obtaining the credentials:

1. Place any action from this plugin on an empty Stream Deck key.
2. Select the action and open **Authentication** at the bottom of the Property Inspector.
3. Enter your **Token** and **Secret**.
4. Run **Test connection** and confirm that the plugin can connect to the SwitchBot API.

The Token and Secret are shared by the entire plugin. **Once configured, you do not need to enter them again for other actions.**

## Features

### Device control

SwitchBot devices can be controlled through actions grouped by purpose.

| Action | Main use |
| --- | --- |
| **Bot** | Control SwitchBot Bot devices |
| **Power** | Control plugs, relays, and other power devices |
| **Lighting** | Control lighting devices |
| **Climate** | Control air conditioners and other climate devices |
| **Security** | Control locks and other security devices |
| **Curtains & Blinds** | Control curtains, Blind Tilt, Roller Shade, and related devices |
| **Cleaning** | Control robot vacuums |

Each action provides operations and parameters appropriate for the selected device.

Security-sensitive operations such as unlocking require a confirmation action to help prevent accidental operation.

### Infrared Remote

Control infrared remotes registered with a SwitchBot Hub from Stream Deck.

Select a virtual infrared remote, such as a TV or air conditioner, and send the supported commands.

### Get Status

Retrieve the current status of a SwitchBot device.

The result can be displayed directly on a Stream Deck key. A display template can be used to choose the fields and layout shown on the key.

For example:

```text
Temperature: {temperature}°C
Humidity: {humidity}%
```

After retrieving status once, the available fields from the response are shown in the Property Inspector. You can click a field to insert it into the template.

If the display template is left blank, the plugin automatically selects major fields from the retrieved information.

Status can also be refreshed automatically at the following intervals:

- Manual only
- 1 minute
- 2 minutes
- 5 minutes
- 10 minutes
- 30 minutes
- 60 minutes

In manual mode, press the Stream Deck key to retrieve the latest status immediately.

The complete response JSON can also be copied to the clipboard when needed.

### API Request

Send requests directly to SwitchBot OpenAPI for more advanced use cases.

Presets are available for common device, scene, and webhook APIs. Custom mode supports GET, POST, PUT, and DELETE requests to the SwitchBot API.

Use this action when you need an API that is not covered by the device-control actions or when you need to configure a more detailed request.

Responses can also be copied to the clipboard.

## Supported devices

Not every device available through SwitchBot OpenAPI supports device-control commands.

Based on SwitchBot OpenAPI Control Commands support, this plugin only lists controllable devices in the corresponding device-control actions.

Devices such as meters, contact sensors, and hubs may support status retrieval without supporting Control Commands. These devices can be used with **Get Status**, but are not shown as choices in device-control actions.

## Disclaimer

This plugin uses SwitchBot OpenAPI to control devices, but **does not guarantee support for every device or operation available through SwitchBot OpenAPI**.

Only a limited set of physical devices has been tested by the developer. Even when a device is shown as supported by the plugin, it may not operate correctly depending on the device, firmware, or changes to SwitchBot OpenAPI.

Physical-device testing during development has been performed on Windows. macOS is a supported target of the plugin, but has not been tested on physical hardware by the developer.

## Development

Node.js 24 or later is required.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run validate
```

### Technology

- TypeScript
- Node.js 24
- Stream Deck SDK 3.x
- SwitchBot OpenAPI v1.1
- Zod
- Vitest

See [docs/IMPLEMENTATION_SPEC.md](docs/IMPLEMENTATION_SPEC.md) for the current implementation contract.

## License

See the LICENSE file in this repository.
