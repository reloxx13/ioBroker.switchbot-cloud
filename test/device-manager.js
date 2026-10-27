const assert = require('node:assert/strict');
const DeviceManager = require('../lib/device-manager');

describe('Keypad Touch status support', () => {
    it('creates read-only status objects without warnings or command subscriptions', async () => {
        const objects = new Map();
        const states = new Map();
        const warnings = [];
        const subscriptions = [];
        const adapter = {
            namespace: 'switchbot-cloud.0',
            log: { debug() {}, warn: message => warnings.push(message) },
            async setObjectNotExistsAsync(id, object) {
                if (!objects.has(id)) objects.set(id, object);
            },
            async extendObjectAsync(id, object) {
                objects.set(id, object);
            },
            async getObjectAsync(id) { return objects.get(id); },
            async getObjectViewAsync(_design, _search, options) {
                return { rows: [...objects].filter(([id, obj]) => obj.type === 'channel' && `switchbot-cloud.0.${id}`.startsWith(options.startkey)).map(([id, value]) => ({ id: `switchbot-cloud.0.${id}`, value })) };
            },
            async delObjectAsync(id, options) {
                for (const target of [...objects.keys()]) {
                    if (target === id || (options?.recursive && target.startsWith(id + '.'))) {
                        objects.delete(target);
                        states.delete(target);
                    }
                }
            },
            async setStateAsync(id, value, ack) {
                states.set(id, { value, ack });
            },
            subscribeStates: pattern => subscriptions.push(pattern)
        };
        const status = {
            deviceId: 'AABBCCDDEE01',
            deviceType: 'Keypad Touch',
            hubDeviceId: 'AABBCCDDEE02',
            battery: 100,
            version: 'V3.1'
        };
        const device = {
            ...status,
            deviceName: 'Example Keypad',
            enableCloudService: true,
            lockDeviceId: 'AABBCCDDEE03',
            keyList: [{ id: 1, name: 'Example', type: 'permanent', status: 'normal', createTime: 1234567890, password: 'example-encrypted', iv: 'example-iv' }]
        };
        device.keyList.push({ ...device.keyList[0], id: 2, name: 'Second example' });
        objects.set(`${device.deviceId}.keyList`, { type: 'state', common: { type: 'string' } });
        states.set(`${device.deviceId}.keyList`, { value: 'legacy-json', ack: true });
        let discoveryCalls = 0;
        const manager = new DeviceManager(adapter, {
            async getDevices() {
                discoveryCalls++;
                return { deviceList: [device] };
            },
            async getDeviceStatus(id) {
                assert.equal(id, status.deviceId);
                return status;
            }
        }, { handleRateLimit: action => action(), safeExecute: action => action() });

        await manager.createDevice(device, 'physical');
        for (const [field, value] of Object.entries(device)) {
            if (['battery', 'version', 'keyList'].includes(field)) continue;
            assert.deepEqual(states.get(`${device.deviceId}.${field}`), { value, ack: true });
        }
        assert.equal(objects.get(`${device.deviceId}.keyList`).type, 'channel');
        assert.equal(states.has(`${device.deviceId}.keyList`), false);
        for (const key of device.keyList) {
            for (const [field, value] of Object.entries(key)) {
                const id = `${device.deviceId}.keyList.${key.id}.${field}`;
                const object = objects.get(id);
                assert.equal(object.common.type, typeof value);
                assert.equal(object.common.write, false);
                assert.deepEqual(object.acl, { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600, state: 0x600 });
                assert.deepEqual(states.get(id), { value, ack: true });
            }
        }
        assert.deepEqual(warnings, []);
        const battery = objects.get(`${status.deviceId}.battery`);
        assert.equal(battery.common.role, 'value.battery');
        assert.equal(battery.common.unit, '%');
        assert.equal(battery.common.write, false);

        device.keyList.reverse();
        device.keyList[1].name = 'Renamed example';
        await manager.updateAllDeviceStates();
        assert.deepEqual(states.get(`${device.deviceId}.keyList.1.name`), { value: 'Renamed example', ack: true });
        assert.deepEqual(states.get(`${device.deviceId}.keyList.2.id`), { value: 2, ack: true });
        device.keyList = device.keyList.filter(key => key.id === 1);
        await manager.updateAllDeviceStates();
        assert.equal(objects.has(`${device.deviceId}.keyList.2`), false);
        assert.equal(states.has(`${device.deviceId}.keyList.2.password`), false);
        assert.equal(objects.has(`${device.deviceId}.keyList.1`), true);
        device.keyList = [];
        await manager.updateAllDeviceStates();
        assert.equal(discoveryCalls, 3);
        assert.equal([...states.keys()].some(id => id.startsWith(`${device.deviceId}.keyList.`)), false);
        for (const [field, value] of Object.entries(status)) {
            const id = `${status.deviceId}.${field}`;
            assert.equal(objects.get(id).common.write, false);
            assert.deepEqual(states.get(id), { value, ack: true });
        }
        assert.deepEqual(subscriptions, []);
        assert.equal([...objects.values()].some(object => object.common.write), false);
    });

    it('rejects malformed key lists without publishing values', async () => {
        const manager = new DeviceManager({ log: {} });
        await assert.rejects(manager.updateDeviceInfo({ deviceId: 'example', keyList: {} }), /expected an array/);
        const key = { id: 1, name: 'Example', type: 'permanent', status: 'normal', createTime: 123, password: 'encrypted-example', iv: 'example-iv' };
        for (const keyList of [[{ ...key, id: '../escape' }], [key, key], [{ id: 1 }]]) {
            await assert.rejects(manager.updateDeviceInfo({ deviceId: 'example', keyList }), /Invalid/);
        }
    });

    it('continues warning for an unsupported device type', async () => {
        const warnings = [];
        const manager = new DeviceManager({ log: { warn: message => warnings.push(message) } });
        await manager.createPhysicalDeviceStates('AABBCCDDEE01', 'Unknown Model');
        assert.deepEqual(warnings, ['Unknown device type: Unknown Model. Creating basic states.']);
    });
});


describe('Hub Mini discovery fields', () => {
    for (const deviceType of ['Hub Mini', 'Hub Mini2']) {
        it(`publishes ${deviceType} discovery values and removes only an empty firmware placeholder`, async () => {
            const objects = new Map([['example.version', { type: 'state', common: { type: 'string' } }]]);
            const states = new Map();
            const device = { deviceId: 'example', deviceName: 'Example hub', deviceType, enableCloudService: true, hubDeviceId: '000000000000' };
            const adapter = {
                log: { debug() {}, warn() {} },
                async setObjectNotExistsAsync(id, obj) { if (!objects.has(id)) objects.set(id, obj); },
                async setStateAsync(id, value, ack) { states.set(id, { value, ack }); },
                async getObjectAsync(id) { return objects.get(id); },
                async getStateAsync(id) { const state = states.get(id); return state ? { val: state.value } : null; },
                async delObjectAsync(id) { objects.delete(id); states.delete(id); },
                subscribeStates() { throw new Error('Hub has no commands'); }
            };
            const manager = new DeviceManager(adapter, {
                async getDevices() { return { deviceList: [device] }; },
                async getDeviceStatus() { return {}; }
            }, { safeExecute: action => action(), handleRateLimit: action => action() });
            await manager.createDevice(device, 'physical');
            for (const [field, value] of Object.entries(device)) {
                assert.deepEqual(states.get(`example.${field}`), { value, ack: true });
            }
            assert.equal(objects.has('example.version'), false);
            device.deviceName = 'Renamed example hub';
            device.enableCloudService = false;
            await manager.updateAllDeviceStates();
            assert.deepEqual(states.get('example.deviceName'), { value: device.deviceName, ack: true });
            assert.deepEqual(states.get('example.enableCloudService'), { value: false, ack: true });
            objects.set('example.version', { type: 'state', common: { type: 'string' } });
            states.set('example.version', { value: 'existing-firmware', ack: true });
            await manager.updateAllDeviceStates();
            assert.equal(objects.has('example.version'), true);
            assert.equal(states.get('example.version').value, 'existing-firmware');
        });
    }
});


describe('Lock Ultra discovery fields', () => {
    it('refreshes scalar fields and individual lock associations without turning calibrate into a command', async () => {
        const objects = new Map(), states = new Map();
        const device = { deviceId: 'example', deviceName: 'Example lock', deviceType: 'Smart Lock Ultra', enableCloudService: true, hubDeviceId: 'example-hub', group: true, master: true, groupName: 'Example group', lockDevicesIds: ['example', 'second'] };
        const adapter = {
            namespace: 'switchbot-cloud.0',
            log: { debug() {}, warn() {} },
            async setObjectNotExistsAsync(id, object) { if (!objects.has(id)) objects.set(id, object); },
            async setStateAsync(id, value, ack) { states.set(id, { value, ack }); },
            async getObjectViewAsync(_design, _search, options) {
                return { rows: [...objects].filter(([id, object]) => object.type === 'state' && `switchbot-cloud.0.${id}`.startsWith(options.startkey)).map(([id, value]) => ({ id: `switchbot-cloud.0.${id}`, value })) };
            },
            async delObjectAsync(id) { objects.delete(id); states.delete(id); },
            subscribeStates() {}
        };
        const manager = new DeviceManager(adapter, {
            async getDevices() { return { deviceList: [device] }; },
            async getDeviceStatus() { return { calibrate: true }; }
        }, { safeExecute: action => action(), handleRateLimit: action => action() });
        await manager.createDevice(device, 'physical');
        for (const [field, value] of Object.entries(device)) {
            if (field !== 'lockDevicesIds') assert.deepEqual(states.get(`example.${field}`), { value, ack: true });
        }
        assert.deepEqual(states.get('example.lockDevicesIds.0'), { value: 'example', ack: true });
        assert.deepEqual(states.get('example.lockDevicesIds.1'), { value: 'second', ack: true });
        assert.equal(objects.get('example.lockDevicesIds.0').common.type, 'string');
        device.lockDevicesIds = ['second'];
        device.groupName = 'Renamed example group';
        await manager.updateAllDeviceStates();
        assert.deepEqual(states.get('example.groupName'), { value: device.groupName, ack: true });
        assert.deepEqual(states.get('example.lockDevicesIds.0'), { value: 'second', ack: true });
        assert.equal(objects.has('example.lockDevicesIds.1'), false);
        assert.equal(states.has('example.lockDevicesIds.1'), false);
        assert.equal(objects.get('example.calibrate').common.type, 'boolean');
        assert.equal(objects.get('example.calibrate').common.write, false);
        assert.deepEqual(states.get('example.calibrate'), { value: true, ack: true });
        device.lockDevicesIds = [];
        await manager.updateAllDeviceStates();
        assert.equal(states.has('example.lockDevicesIds.0'), false);
        assert.equal(objects.get('example.lockDevicesIds').type, 'channel');
        await assert.rejects(manager.updateDeviceInfo({ ...device, lockDevicesIds: {} }), /expected an array of strings/);
    });
});
