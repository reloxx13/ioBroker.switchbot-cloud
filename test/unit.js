require('./device-manager');
const path = require('path');
const { tests } = require('@iobroker/testing');
const { expect } = require('chai');

// Use tests.integration() with defineAdditionalTests for custom tests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Adapter Startup with Valid Config', (getHarness) => {
            it('Should start the adapter without errors', async function() {
                // Windows CI runners have notably slower process spawn/kill overhead
                // for the adapter harness, so allow more headroom than on Linux/macOS.
                this.timeout(30000);

                console.log('🔍 Step 1: Getting harness...');
                const harness = getHarness();

                console.log('🔍 Step 2: Fetching adapter object...');
                // Get adapter object using promisified pattern
                const obj = await new Promise((res, rej) => {
                    harness.objects.getObject('system.adapter.switchbot-cloud.0', (err, o) => {
                        if (err) return rej(err);
                        res(o);
                    });
                });

                expect(obj, 'Adapter object should exist').to.exist;
                console.log('✅ Step 2: Adapter object loaded');

                console.log('🔍 Step 3: Configuring adapter...');
                // Configure adapter
                Object.assign(obj.native, {
                    token: 'test-token',
                    secret: 'test-secret',
                    pollInterval: 60000
                });

                await new Promise((res, rej) => {
                    harness.objects.setObject(obj._id, obj, (err) => {
                        if (err) return rej(err);
                        res();
                    });
                });
                console.log('✅ Step 3: Adapter configured');

                console.log('🔍 Step 4: Starting adapter...');
                // Start adapter
                await harness.startAdapterAndWait();
                console.log('✅ Step 4: Adapter started');

                console.log('⏳ Step 5: Waiting for adapter initialization...');
                // Wait for adapter initialization
                await new Promise((res) => setTimeout(res, 2000));

                console.log('🔍 Step 6: Checking created states...');
                // Check that adapter created basic structure
                const stateIds = await harness.dbConnection.getStateIDs('switchbot-cloud.0.*');

                console.log(`📊 Step 7: Found ${stateIds.length} state(s)`);

                if (stateIds.length > 0) {
                    console.log('✅ Adapter started and created states');

                    // Verify at least info states exist
                    const infoStates = stateIds.filter(id => id.includes('info.'));
                    expect(infoStates.length, 'Should have info states').to.be.greaterThan(0);
                } else {
                    // It's okay if no states are created without valid credentials
                    console.log('⚠️  No states created (expected with test credentials)');
                }

                console.log('🛑 Step 8: Stopping adapter...');
                await harness.stopAdapter();
                console.log('✅ Step 9: Adapter stopped');
            });
        });

        suite('Adapter Startup with Missing Config', (getHarness) => {
            it('Should handle missing configuration gracefully', async function() {
                // Windows CI runners have notably slower process spawn/kill overhead
                // for the adapter harness, so allow more headroom than on Linux/macOS.
                this.timeout(30000);

                console.log('🔍 Test 2: Testing missing configuration handling...');
                const harness = getHarness();

                const obj = await new Promise((res, rej) => {
                    harness.objects.getObject('system.adapter.switchbot-cloud.0', (err, o) => {
                        if (err) return rej(err);
                        res(o);
                    });
                });

                expect(obj, 'Adapter object should exist').to.exist;

                // Clear configuration
                obj.native = {
                    token: '',
                    secret: '',
                    pollInterval: 60000
                };

                await new Promise((res, rej) => {
                    harness.objects.setObject(obj._id, obj, (err) => {
                        if (err) return rej(err);
                        res();
                    });
                });

                console.log('🔍 Starting adapter without credentials...');

                // Use startAdapter instead of startAdapterAndWait since adapter may fail immediately
                await harness.startAdapter();

                // Give adapter brief time to start and validate config
                await new Promise((res) => setTimeout(res, 3000));

                const stateIds = await harness.dbConnection.getStateIDs('switchbot-cloud.0.*');
                console.log(`📊 Found ${stateIds.length} states with empty credentials`);

                // With empty credentials, adapter should not create device states
                const deviceStates = stateIds.filter(id => !id.includes('info.'));

                expect(deviceStates.length, 'Should have no device states without valid credentials').to.equal(0);
                console.log('✅ Adapter correctly handled missing credentials - no device states created');

                // Cleanup
                await harness.stopAdapter();
            });
        });
    }
});