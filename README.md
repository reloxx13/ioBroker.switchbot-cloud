# ioBroker.switchbot-cloud

[![NPM version](https://img.shields.io/npm/v/iobroker.switchbot-cloud.svg)](https://www.npmjs.com/package/iobroker.switchbot-cloud)
[![Downloads](https://img.shields.io/npm/dm/iobroker.switchbot-cloud.svg)](https://www.npmjs.com/package/iobroker.switchbot-cloud)
![Number of Installations](https://iobroker.live/badges/switchbot-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/switchbot-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.switchbot-cloud.png?downloads=true)](https://nodei.co/npm/iobroker.switchbot-cloud/)

**Tests:**
[![Test and Release](https://github.com/kaschtn/ioBroker.switchbot-cloud/actions/workflows/test-and-release.yml/badge.svg?branch=main)](https://github.com/kaschtn/ioBroker.switchbot-cloud/actions/workflows/test-and-release.yml)
[![Test Develop](https://github.com/kaschtn/ioBroker.switchbot-cloud/actions/workflows/test-develop.yml/badge.svg)](https://github.com/kaschtn/ioBroker.switchbot-cloud/actions/workflows/test-develop.yml)

## SwitchBot adapter for ioBroker

Control your SwitchBot devices via the official SwitchBot API v1.1.

This adapter allows you to control and monitor SwitchBot devices through ioBroker using the SwitchBot Cloud API. It supports specific physical devices and infrared remote devices.

## Features

- **Full SwitchBot API v1.1 support** with improved authentication
- **Physical device control**: Bot, Curtain, Smart Lock (Pro/Ultra), Meter, MeterPlus, MeterPro, MeterPro(CO2), WoIOSensor (Outdoor Meter), Plug, Plug Mini (US/JP/EU), Color Bulb, Strip Light, Humidifier, Motion Sensor, Contact Sensor, Water Detector, Hub Mini, Hub Mini2
- **Infrared remote control**: All IR device types (TV, Air Conditioner, Light, Fan, etc.)
- **Real-time status updates** with configurable polling intervals
- **Comprehensive error handling** with automatic retry logic
- **Rate limiting** to respect API quotas
- **Easy configuration** through web interface
- **Multi-language support** (English, German)

## Prerequisites

1. **SwitchBot Account**: You need a SwitchBot account with devices added to your app
2. **SwitchBot App**: Version 6.14 or later (required for API secret key)
3. **API Credentials**: Open Token and Secret Key from the SwitchBot app
4. **Cloud Service**: Must be enabled in the SwitchBot app for BLE devices

## Getting API Credentials

To use this adapter, you need to obtain API credentials from the SwitchBot mobile app:

1. **Update your app** to version 6.14 or later
2. **Open SwitchBot app** on your mobile device
3. **Go to Profile → Preferences**
4. **Tap "App Version" 10 times** (Developer Options will appear)
5. **Tap "Developer Options"**
6. **Tap "Get Token"**
7. **Copy both the Token and Secret Key**

> **Note**: Keep your API credentials secure and never share them publicly.

## Installation

1. Install the adapter from the ioBroker Admin interface
2. Go to the adapter configuration
3. Enter your **Open Token** and **Secret Key**
4. Configure the **Poll Interval** (minimum 10 seconds, default 60 seconds)
5. Enable **Cloud Service** if you have BLE devices
6. Click **"Test Connection"** to verify your credentials
7. Save the configuration and start the adapter

## Configuration

### API Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **Open Token** | Your SwitchBot API token from the mobile app | - |
| **Secret Key** | Your SwitchBot API secret key from the mobile app | - |
| **Poll Interval** | How often to poll device status (milliseconds) | 60000 |
| **Enable Cloud Service** | Required for BLE devices to work via API | true |

### Important Notes

- **API Rate Limits**: 10,000 requests per day per account
- **Minimum Poll Interval**: 10 seconds (10000ms) to avoid rate limiting
- **BLE Devices**: Require Cloud Service to be enabled in the SwitchBot app
- **Device Range**: Physical devices must be within range of a SwitchBot Hub for cloud access
- **Device Compatibility**: Only devices listed in the "Supported Devices" section are currently implemented
- **Unknown Devices**: Unsupported devices will be detected but won't have specific state mappings

## Supported Devices

> **Note**: This is the initial release focusing on the most commonly used SwitchBot devices. Support for additional devices (robot vacuums, cameras, air purifiers, etc.) will be added in future releases.

### Physical Devices

The following devices are currently supported:

| Device Type | Control | Status |
|-------------|---------|--------|
| **Bot** | Turn On/Off, Press | power, battery |
| **Curtain** | Turn On/Off, Set Position | slidePosition, moving, battery |
| **Lock (Smart Lock/Pro/Ultra)** | Lock/Unlock | lockState, battery |
| **Keypad Touch** | - | battery, version, deviceId, deviceName, deviceType, enableCloudService, hubDeviceId, lockDeviceId, keyList.&lt;keyId&gt;.* |
| **Meter** | - | temperature, humidity, battery |
| **Meter Plus (MeterPlus)** | - | temperature, humidity, battery |
| **Meter Pro (MeterPro)** | - | temperature, humidity, battery |
| **Meter Pro CO2** | - | temperature, humidity, CO2, battery |
| **Outdoor Meter (WoIOSensor)** | - | temperature, humidity, battery |
| **Plug** | Turn On/Off | power, voltage, weight, electricityOfDay |
| **Plug Mini (US/JP/EU)** | Turn On/Off | power |
| **Color Bulb** | On/Off, Set Brightness, Set Color, Set Color Temp | power, brightness, color, colorTemperature |
| **Strip Light** | On/Off, Set Brightness, Set Color | power, brightness, color |
| **Humidifier** | On/Off, Set Mode | power, humidity, temperature, nebulizationEfficiency, auto, childLock, sound, lackWater |
| **Motion Sensor** | - | moveDetected, brightness, battery |
| **Contact Sensor** | - | openState, moveDetected, brightness, battery |
| **Water Detector** | - | status, battery |
| **Hub Mini** | - | deviceId, deviceName, deviceType, enableCloudService, hubDeviceId |
| **Hub Mini2** | - | deviceId, deviceName, deviceType, enableCloudService, hubDeviceId |
| **Hub 2** | - | temperature, humidity, lightLevel |

### Infrared Remote Devices

All infrared remote devices are supported for sending commands:
- TV, Air Conditioner, Light, Fan, Projector, etc.
- Commands are sent as JSON objects or simple command strings

### Device Compatibility Notes

Smart Lock Ultra also exposes device-list fields `deviceName`, `enableCloudService`, `group`, `master`, and `groupName` when returned. Associated lock IDs are individual string states under `lockDevicesIds.<index>`; an empty list leaves an empty channel. Removed associations are cleaned up locally. Its `calibrate` Boolean is a read-only indication that the lock has been calibrated, not a command button. Discovery refresh is shared with Hub Mini/Mini2 and Keypad Touch.

Hub Mini and Hub Mini2 expose their device-list fields even when the status endpoint returns no fields. They share the discovery refresh with Keypad Touch (one extra device-list request per polling cycle when any of these devices exists). No firmware value is fabricated: empty legacy `version` objects are removed, while any existing non-null firmware value is preserved.

Keypad Touch publishes read-only status and discovery fields. Each access key has a channel `keyList.<keyId>` containing typed states `id`, `name`, `type`, `status`, `createTime`, `password`, and `iv`. The last two fields retain the API-encrypted values. Key channels and states use admin-owner ACLs (0600). Discovery fields refresh once per polling cycle through an additional device-list request; removed keys and their states are deleted. Earlier PR installations using a JSON `keyList` state migrate automatically to this channel structure. Battery and firmware version have been observed in API responses but may depend on the device/API. Passcode management (`createKey`/`deleteKey`) is not implemented; it requires asynchronous webhook result handling.

- **API Device Types**: The adapter matches devices using exact API `deviceType` values
- **Fallback Handling**: Unsupported devices are detected but created with minimal functionality
- **Future Support**: Additional device types will be added based on user demand
- **Testing**: All supported devices have been mapped based on official SwitchBot API documentation

## Device Objects

The adapter creates the following object structure:

```
switchbot.0.
├── info.connection (connection status)
├── {deviceId}/
│   ├── info/
│   │   ├── deviceType (device type)
│   │   └── remoteType (for IR devices)
│   ├── {status_states} (temperature, humidity, power, etc.)
│   └── {control_commands} (turnOn, turnOff, setPosition, etc.)
```

### Example Device Structure

```
switchbot.0.
├── info.connection = true
├── 500291B269BE/                    (Humidifier)
│   ├── info/
│   │   └── deviceType = "Humidifier"
│   ├── power = false
│   ├── humidity = 45
│   ├── temperature = 23.5
│   ├── nebulizationEfficiency = 60
│   ├── auto = true
│   ├── childLock = false
│   ├── sound = true
│   ├── lackWater = false
│   ├── turnOn (button)
│   ├── turnOff (button)
│   └── setMode (command)
└── FA7310762361/                    (TV Remote)
    ├── info/
    │   └── remoteType = "TV"
    └── command (send IR commands)
```

## Usage Examples

### Controlling Physical Devices

```javascript
// Turn on a SwitchBot Bot
setState('switchbot.0.{deviceId}.turnOn', true);

// Set curtain position to 50%
setState('switchbot.0.{deviceId}.setPosition', 50);

// Lock a SwitchBot Lock
setState('switchbot.0.{deviceId}.lock', true);

// Set color bulb brightness to 75%
setState('switchbot.0.{deviceId}.setBrightness', 75);
```

### Controlling Infrared Devices

```javascript
// Turn on TV
setState('switchbot.0.{deviceId}.command', 'turnOn');

// Send custom IR command
setState('switchbot.0.{deviceId}.command', JSON.stringify({
    command: 'setChannel',
    parameter: '5'
}));
```

### Reading Device Status

```javascript
// Read temperature from meter
const temp = getState('switchbot.0.{deviceId}.temperature').val;

// Check if curtain is moving
const moving = getState('switchbot.0.{deviceId}.moving').val;

// Get battery level
const battery = getState('switchbot.0.{deviceId}.battery').val;
```

## Troubleshooting

### Common Issues

1. **"Authentication failed"**
   - Verify your token and secret are correct
   - Make sure you're using the latest SwitchBot app (v6.14+)
   - Check that Developer Options are enabled

2. **"Connection failed"**
   - Check your internet connection
   - Verify the SwitchBot API is accessible
   - Try the "Test Connection" button in settings

3. **"Device not responding"**
   - Ensure Cloud Service is enabled in the SwitchBot app
   - Check device battery level
   - Verify device is within range of a SwitchBot Hub
   - Confirm the device type is supported (see supported devices list)

4. **"Unknown device type" warnings**
   - This indicates the device is detected but not yet supported
   - Check the supported devices list in this README
   - Unsupported devices will be created with basic info only

4. **"Rate limit exceeded"**
   - Increase poll interval (recommended: 60+ seconds)
   - Reduce manual command frequency
   - Check for other applications using the same API

### Debug Information

Enable debug logging to get detailed information:

1. Go to ioBroker Admin → Log
2. Set log level to "debug" for switchbot adapter
3. Check logs for detailed API communication

### API Limits

- **Daily limit**: 10,000 requests per account
- **Rate limiting**: Built-in delays between requests
- **Retry logic**: Automatic retry on temporary failures

## Changelog

### **WORK IN PROGRESS**
- (iobroker-bot) Adapter requires node.js >= 20 now.


### **WORK IN PROGRESS**
- (ioBroker-Bot) Adapter requires js-controller >= 6.0.11 now.

### 0.1.0 (2025-12-01)
- Initial release
- SwitchBot API v1.1 support
- Support for all major SwitchBot devices
- Comprehensive error handling and retry logic
- Multi-language admin interface
- Rate limiting and API quota management

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License

MIT License

Copyright (c) 2024-2026 ioBroker Community <info@iobroker.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE

SOFTWARE.
