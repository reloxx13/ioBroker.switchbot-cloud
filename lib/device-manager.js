/**
 * Device Manager
 *
 * Handles device discovery and state management
 */

'use strict';

const CommandMapper = require('./command-mapper');

class DeviceManager {
    constructor(adapter, api, errorHandler) {
        this.adapter = adapter;
        this.api = api;
        this.errorHandler = errorHandler;
        this.log = adapter.log;
        this.devices = new Map();
        this.deviceStates = new Map();
        this.commandMapper = new CommandMapper();

        // Device type mappings
        this.deviceTypes = {
            // Physical devices
            'Bot': {
                type: 'bot',
                commands: ['turnOn', 'turnOff', 'press'],
                states: { power: 'boolean', battery: 'number' }
            },
            'Curtain': {
                type: 'curtain',
                commands: ['turnOn', 'turnOff', 'setPosition'],
                states: { slidePosition: 'number', moving: 'boolean', battery: 'number' }
            },
            'Curtain3': {
                type: 'curtain3',
                commands: ['turnOn', 'turnOff', 'setPosition'],
                states: { slidePosition: 'number', moving: 'boolean', battery: 'number' }
            },
            'Smart Lock': {
                type: 'lock',
                commands: ['lock', 'unlock'],
                states: { lockState: 'string', battery: 'number' }
            },
            'Smart Lock Pro': {
                type: 'lockpro',
                commands: ['lock', 'unlock'],
                states: { lockState: 'string', battery: 'number' }
            },
            'Smart Lock Ultra': {
                type: 'lockultra',
                commands: ['lock', 'unlock'],
                states: { lockState: 'string', battery: 'number' }
            },
            'Keypad Touch': {
                type: 'keypadtouch',
                commands: [],
                states: { battery: 'number' }
            },
            'Meter': {
                type: 'meter',
                commands: [],
                states: { temperature: 'number', humidity: 'number', battery: 'number' }
            },
            'MeterPlus': {
                type: 'meterplus',
                commands: [],
                states: { temperature: 'number', humidity: 'number', battery: 'number' }
            },
            'MeterPro': {
                type: 'meterpro',
                commands: [],
                states: { temperature: 'number', humidity: 'number', battery: 'number' }
            },
            'MeterPro(CO2)': {
                type: 'meterproco2',
                commands: [],
                states: { temperature: 'number', humidity: 'number', battery: 'number', CO2: 'number' }
            },
            'WoIOSensor': {
                type: 'outdoormeter',
                commands: [],
                states: { temperature: 'number', humidity: 'number', battery: 'number' }
            },
            'Plug': {
                type: 'plug',
                commands: ['turnOn', 'turnOff'],
                states: { power: 'boolean', voltage: 'number', weight: 'number', electricityOfDay: 'number' }
            },
            'Plug Mini (US)': {
                type: 'plugminus',
                commands: ['turnOn', 'turnOff'],
                states: { power: 'boolean' }
            },
            'Plug Mini (JP)': {
                type: 'plugminijp',
                commands: ['turnOn', 'turnOff'],
                states: { power: 'boolean' }
            },
            'Plug Mini (EU)': {
                type: 'plugminieu',
                commands: ['turnOn', 'turnOff'],
                states: { power: 'boolean' }
            },
            'Color Bulb': {
                type: 'colorbulb',
                commands: ['turnOn', 'turnOff', 'setBrightness', 'setColor', 'setColorTemperature'],
                states: { power: 'boolean', brightness: 'number', color: 'string', colorTemperature: 'number' }
            },
            'Strip Light': {
                type: 'striplight',
                commands: ['turnOn', 'turnOff', 'setBrightness', 'setColor'],
                states: { power: 'boolean', brightness: 'number', color: 'string' }
            },
            'Humidifier': {
                type: 'humidifier',
                commands: ['turnOn', 'turnOff', 'setMode'],
                states: { power: 'boolean', humidity: 'number', temperature: 'number', nebulizationEfficiency: 'number', auto: 'boolean', childLock: 'boolean', sound: 'boolean', lackWater: 'boolean' }
            },
            'Motion Sensor': {
                type: 'motionsensor',
                commands: [],
                states: { moveDetected: 'boolean', brightness: 'string', battery: 'number' }
            },
            'Contact Sensor': {
                type: 'contactsensor',
                commands: [],
                states: { openState: 'string', moveDetected: 'boolean', brightness: 'string', battery: 'number' }
            },
            'Water Detector': {
                type: 'waterdetector',
                commands: [],
                states: { status: 'number', battery: 'number' }
            },
            'Hub Mini': {
                type: 'hubmini',
                commands: [],
                states: {}
            },
            'Hub Mini2': {
                type: 'hubmini2',
                commands: [],
                states: {}
            },
            'Hub 2': {
                type: 'hub2',
                commands: [],
                states: { temperature: 'number', humidity: 'number', lightLevel: 'number' }
            }
        };
    }

    /**
     * Discover and create all devices
     */
    async discoverDevices() {
        try {
            this.log.info('Starting device discovery...');
            const deviceData = await this.api.getDevices();

            // Process physical devices
            for (const device of deviceData.deviceList) {
                await this.createDevice(device, 'physical');
            }

            // Process IR remote devices
            for (const device of deviceData.infraredRemoteList) {
                await this.createDevice(device, 'infrared');
            }

            this.log.info(`Device discovery completed. Found ${this.devices.size} devices.`);

        } catch (error) {
            this.log.error(`Device discovery failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create device objects and states
     */
    async createDevice(deviceInfo, category) {
        const deviceId = deviceInfo.deviceId;
        const deviceName = deviceInfo.deviceName || deviceId;
        const deviceType = deviceInfo.deviceType || deviceInfo.remoteType;

        this.log.debug(`Creating device: ${deviceName} (${deviceType})`);

        // Store device info
        this.devices.set(deviceId, {
            ...deviceInfo,
            category,
            type: deviceType
        });

        // Create device channel
        await this.adapter.setObjectNotExistsAsync(deviceId, {
            type: 'channel',
            common: {
                name: deviceName,
                type: deviceType
            },
            native: deviceInfo
        });

        // Create device states based on type
        if (category === 'physical') {
            await this.createPhysicalDeviceStates(deviceId, deviceType);
        } else {
            await this.createInfraredDeviceStates(deviceId, deviceType);
        }

        if (category === 'physical' && ['Keypad Touch', 'Hub Mini', 'Hub Mini2', 'Smart Lock Ultra'].includes(deviceType)) {
            await this.updateDeviceInfo(deviceInfo);
        }

        // Subscribe to state changes for controllable devices
        if (this.hasControllableStates(deviceType)) {
            this.adapter.subscribeStates(`${deviceId}.*`);
        }
    }

    /**
     * Create states for physical devices
     */
    async createPhysicalDeviceStates(deviceId, deviceType) {
        const typeInfo = this.deviceTypes[deviceType];
        if (!typeInfo) {
            this.log.warn(`Unknown device type: ${deviceType}. Creating basic states.`);
            return;
        }

        // Create common info states
        await this.adapter.setObjectNotExistsAsync(`${deviceId}.info`, {
            type: 'channel',
            common: { name: 'Device Information' },
            native: {}
        });

        await this.adapter.setObjectNotExistsAsync(`${deviceId}.info.deviceType`, {
            type: 'state',
            common: {
                name: 'Device Type',
                type: 'string',
                role: 'info.name',
                read: true,
                write: false
            },
            native: {}
        });

        await this.adapter.setStateAsync(`${deviceId}.info.deviceType`, deviceType, true);

        // Create common API states that all devices have
        const commonApiStates = {
            deviceId: { type: 'string', role: 'info.id' },
            hubDeviceId: { type: 'string', role: 'info.id' },
            version: { type: 'string', role: 'info.firmware' }
        };

        for (const [stateName, config] of Object.entries(commonApiStates)) {
            if (stateName === 'version' && ['Hub Mini', 'Hub Mini2'].includes(deviceType)) continue;
            await this.adapter.setObjectNotExistsAsync(`${deviceId}.${stateName}`, {
                type: 'state',
                common: {
                    name: stateName,
                    type: config.type,
                    role: config.role,
                    read: true,
                    write: false
                },
                native: {}
            });
        }

        // Create status states based on device type
        for (const [stateName, stateType] of Object.entries(typeInfo.states)) {
            await this.createDeviceState(deviceId, stateName, stateType, false);
        }

        // Create command states for controllable devices
        for (const command of typeInfo.commands) {
            await this.createCommandState(deviceId, command);
        }
    }

    /**
     * Create states for infrared devices
     */
    async createInfraredDeviceStates(deviceId, deviceType) {
        // Create basic info for IR devices
        await this.adapter.setObjectNotExistsAsync(`${deviceId}.info`, {
            type: 'channel',
            common: { name: 'Device Information' },
            native: {}
        });

        await this.adapter.setObjectNotExistsAsync(`${deviceId}.info.remoteType`, {
            type: 'state',
            common: {
                name: 'Remote Type',
                type: 'string',
                role: 'info.name',
                read: true,
                write: false
            },
            native: {}
        });

        await this.adapter.setStateAsync(`${deviceId}.info.remoteType`, deviceType, true);

        // Create basic control state for IR devices
        await this.adapter.setObjectNotExistsAsync(`${deviceId}.command`, {
            type: 'state',
            common: {
                name: 'Send Command',
                type: 'string',
                role: 'text',
                read: false,
                write: true,
                desc: 'Send IR command (JSON format)'
            },
            native: {}
        });

        this.adapter.subscribeStates(`${deviceId}.command`);
    }

    /**
     * Create device state
     */
    async createDeviceState(deviceId, stateName, stateType, writable = false) {
        const stateId = `${deviceId}.${stateName}`;

        const roleMap = {
            'power': 'switch.power',
            'temperature': 'value.temperature',
            'humidity': 'value.humidity',
            'battery': 'value.battery',
            'brightness': 'level.dimmer',
            'slidePosition': 'level.blind',
            'lockState': 'sensor.lock',
            'moveDetected': 'sensor.motion',
            'openState': 'sensor.door',
            'CO2': 'value.co2'
        };

        const unit = this.getStateUnit(stateName);
        const objectDef = {
            type: 'state',
            common: {
                name: stateName,
                type: stateType,
                role: roleMap[stateName] || 'state',
                read: true,
                write: writable
            },
            native: {}
        };

        // Add unit if available
        if (unit !== undefined) {
            objectDef.common.unit = unit;
        }

        await this.adapter.setObjectNotExistsAsync(stateId, objectDef);
    }

    /**
     * Create command state
     */
    async createCommandState(deviceId, command) {
        const stateId = `${deviceId}.${command}`;

        await this.adapter.setObjectNotExistsAsync(stateId, {
            type: 'state',
            common: {
                name: command,
                type: 'mixed',
                role: 'button',
                read: false,
                write: true,
                desc: `Execute ${command} command`
            },
            native: {}
        });
    }

    /**
     * Get unit for state
     */
    getStateUnit(stateName) {
        const units = {
            'temperature': '°C',
            'humidity': '%',
            'battery': '%',
            'brightness': '%',
            'slidePosition': '%',
            'voltage': 'V',
            'weight': 'kg',
            'electricityOfDay': 'kWh',
            'electricCurrent': 'mA',
            'CO2': 'ppm',
            'power': 'W',
            'colorTemperature': 'K',
            'nebulizationEfficiency': '%',
            'lightLevel': ''
        };
        return units[stateName] || '';
    }

    /**
     * Check if device type has controllable states
     */
    hasControllableStates(deviceType) {
        const typeInfo = this.deviceTypes[deviceType];
        return typeInfo && typeInfo.commands.length > 0;
    }

    /**
     * Publish discovery fields and individual Keypad access-key states.
     */
    async updateDeviceInfo(device) {
        if (device.lockDevicesIds !== undefined && (!Array.isArray(device.lockDevicesIds) || device.lockDevicesIds.some(id => typeof id !== 'string'))) {
            throw new Error('Invalid Lock Ultra lockDevicesIds: expected an array of strings');
        }
        const keyFields = ['id', 'name', 'type', 'status', 'createTime', 'password', 'iv'];
        const keys = new Set();
        if (device.keyList !== undefined) {
            if (!Array.isArray(device.keyList)) throw new Error('Invalid Keypad Touch keyList: expected an array');
            for (const key of device.keyList) {
                if (!key || !/^[0-9]+$/.test(String(key.id)) || keys.has(String(key.id))) {
                    throw new Error('Invalid or duplicate Keypad Touch key ID');
                }
                for (const field of keyFields) {
                    const value = key[field];
                    if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) {
                        throw new Error('Invalid Keypad Touch key field');
                    }
                }
                keys.add(String(key.id));
            }
        }
        for (const field of ['deviceId', 'deviceName', 'deviceType', 'enableCloudService', 'hubDeviceId', 'lockDeviceId', 'group', 'master', 'groupName']) {
            if (device[field] === undefined) continue;
            const id = `${device.deviceId}.${field}`;
            await this.adapter.setObjectNotExistsAsync(id, {
                type: 'state',
                common: { name: field, type: typeof device[field], role: this.getStateRole(field), read: true, write: false },
                native: {}
            });
            await this.adapter.setStateAsync(id, device[field], true);
        }
        if (['Hub Mini', 'Hub Mini2'].includes(device.deviceType)) {
            const id = `${device.deviceId}.version`;
            const object = await this.adapter.getObjectAsync(id);
            const state = await this.adapter.getStateAsync(id);
            if (object?.type === 'state' && (!state || state.val === null)) {
                await this.adapter.delObjectAsync(id);
            }
        }
        if (device.lockDevicesIds !== undefined) {
            const root = `${device.deviceId}.lockDevicesIds`;
            await this.adapter.setObjectNotExistsAsync(root, {
                type: 'channel', common: { name: 'Grouped lock IDs' }, native: {}
            });
            for (const [index, value] of device.lockDevicesIds.entries()) {
                const id = `${root}.${index}`;
                await this.adapter.setObjectNotExistsAsync(id, {
                    type: 'state',
                    common: { name: `Lock ${index + 1}`, type: 'string', role: 'info.id', read: true, write: false },
                    native: { lockAssociation: true }
                });
                await this.adapter.setStateAsync(id, value, true);
            }
            const prefix = `${this.adapter.namespace}.${root}.`;
            const existing = await this.adapter.getObjectViewAsync('system', 'state', {
                startkey: prefix, endkey: prefix + String.fromCharCode(65535)
            });
            const current = new Set(device.lockDevicesIds.map((_, index) => prefix + index));
            for (const row of existing.rows) {
                if (row.value.native?.lockAssociation && !current.has(row.id)) {
                    await this.adapter.delObjectAsync(row.id.slice(this.adapter.namespace.length + 1));
                }
            }
        }
        if (device.keyList === undefined) return;

        const acl = { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600, state: 0x600 };
        const root = `${device.deviceId}.keyList`;
        const oldRoot = await this.adapter.getObjectAsync(root);
        if (oldRoot && oldRoot.type === 'state') await this.adapter.delObjectAsync(root);
        await this.adapter.extendObjectAsync(root, {
            type: 'channel', common: { name: 'Access keys' }, native: {}, acl
        });
        for (const key of device.keyList) {
            const channel = `${root}.${key.id}`;
            await this.adapter.extendObjectAsync(channel, {
                type: 'channel', common: { name: key.name }, native: { keypadKey: true }, acl
            });
            for (const field of keyFields) {
                const id = `${channel}.${field}`;
                await this.adapter.extendObjectAsync(id, {
                    type: 'state',
                    common: { name: field, type: typeof key[field], role: field === 'id' ? 'info.id' : 'state', read: true, write: false },
                    native: {}, acl
                });
                await this.adapter.setStateAsync(id, key[field], true);
            }
        }
        const prefix = `${this.adapter.namespace}.${root}.`;
        const existing = await this.adapter.getObjectViewAsync('system', 'channel', {
            startkey: prefix, endkey: prefix + String.fromCharCode(65535)
        });
        for (const row of existing.rows) {
            const keyId = row.id.slice(prefix.length);
            if (row.value.native?.keypadKey && !keys.has(keyId)) {
                await this.adapter.delObjectAsync(`${root}.${keyId}`, { recursive: true });
            }
        }
    }

    /**
     * Update all device states
     */
    async updateAllDeviceStates() {
        const physicalDevices = Array.from(this.devices.values()).filter(d => d.category === 'physical');

        if (physicalDevices.some(device => ['Keypad Touch', 'Hub Mini', 'Hub Mini2', 'Smart Lock Ultra'].includes(device.type))) {
            await this.errorHandler.safeExecute(async () => {
                const data = await this.api.getDevices();
                if (!Array.isArray(data.deviceList)) throw new Error('Invalid device list');
                for (const device of data.deviceList) {
                    if (['Keypad Touch', 'Hub Mini', 'Hub Mini2', 'Smart Lock Ultra'].includes(device.deviceType) && this.devices.has(device.deviceId)) {
                        await this.updateDeviceInfo(device);
                    }
                }
            }, 'update device discovery fields');
        }

        for (const device of physicalDevices) {
            await this.errorHandler.safeExecute(async () => {
                await this.updateDeviceState(device.deviceId);
            }, `update device ${device.deviceId}`);
        }
    }

    /**
     * Update device state
     */
    async updateDeviceState(deviceId) {
        return await this.errorHandler.handleRateLimit(async () => {
            const status = await this.api.getDeviceStatus(deviceId);

            this.log.debug(`Updating states for device ${deviceId} with status: ${JSON.stringify(status)}`);

            for (const [key, value] of Object.entries(status)) {
                const stateId = `${deviceId}.${key}`;

                // Get unit for this state
                const unit = this.getStateUnit(key);

                // Create object if it doesn't exist
                const objectDef = {
                    type: 'state',
                    common: {
                        name: key,
                        type: typeof value,
                        role: this.getStateRole(key),
                        read: true,
                        write: false
                    },
                    native: {}
                };

                // Add unit if available
                if (unit) {
                    objectDef.common.unit = unit;
                }

                await this.adapter.setObjectNotExistsAsync(stateId, objectDef);

                await this.adapter.setStateAsync(stateId, value, true);
            }
        });
    }

    /**
     * Get appropriate state role based on state name
     */
    getStateRole(stateName) {
        const roleMap = {
            temperature: 'value.temperature',
            humidity: 'value.humidity',
            battery: 'value.battery',
            power: 'switch.power',
            version: 'info.firmware',
            deviceId: 'info.id',
            deviceType: 'info.name',
            hubDeviceId: 'info.id',
            lockState: 'sensor.lock',
            doorState: 'sensor.door',
            brightness: 'value.brightness',
            lightLevel: 'value.brightness',
            CO2: 'value.ppm'
        };

        return roleMap[stateName] || 'state';
    }

    /**
     * Handle state changes
     */
    async handleStateChange(id, state) {
        const parts = id.split('.');
        if (parts.length < 3) return;

        const deviceId = parts[parts.length - 2];
        const stateName = parts[parts.length - 1];

        const device = this.devices.get(deviceId);
        if (!device) {
            this.log.warn(`Unknown device: ${deviceId}`);
            return;
        }

        if (device.category === 'infrared') {
            await this.handleInfraredCommand(deviceId, stateName, state.val);
        } else {
            await this.handlePhysicalDeviceCommand(deviceId, stateName, state.val);
        }
    }

    /**
     * Handle physical device commands
     * @param {string} deviceId - Device identifier
     * @param {string} command - Command name to execute
     * @param {any} value - Command parameter value
     * @returns {Promise<void>}
     * @throws {Error} If command execution fails
     */
    async handlePhysicalDeviceCommand(deviceId, command, value) {
        try {
            // Map command to API format using CommandMapper
            const commandData = this.commandMapper.mapCommand(command, value);

            if (!commandData) {
                this.log.warn(`Unknown command: ${command} for device ${deviceId}`);
                return;
            }

            await this.api.sendCommand(deviceId, commandData);
            this.log.info(`Command ${command} sent to device ${deviceId}`);

            // Update device state after command
            this.adapter.setTimeout(() => {
                this.updateDeviceState(deviceId).catch(err =>
                    this.log.debug(`Failed to update device state after command: ${err.message}`)
                );
            }, 2000);

        } catch (error) {
            this.log.error(`Failed to send command ${command} to device ${deviceId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Handle infrared device commands
     * @param {string} deviceId - Device identifier
     * @param {string} stateName - State name being changed
     * @param {string|object} value - Command value (JSON string or object)
     * @returns {Promise<void>}
     * @throws {Error} If command execution fails
     */
    async handleInfraredCommand(deviceId, stateName, value) {
        if (stateName !== 'command') return;

        try {
            let commandData;
            if (typeof value === 'string') {
                try {
                    commandData = JSON.parse(value);
                } catch {
                    commandData = { command: value, parameter: 'default' };
                }
            } else {
                commandData = value;
            }

            await this.api.sendCommand(deviceId, commandData);
            this.log.info(`IR command sent to device ${deviceId}: ${JSON.stringify(commandData)}`);

        } catch (error) {
            this.log.error(`Failed to send IR command to device ${deviceId}: ${error.message}`);
            throw error;
        }
    }
}

module.exports = DeviceManager;