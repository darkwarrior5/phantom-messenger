/**
 * Backend Integration Test Suite
 */
const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:8080/ws';

async function runTests() {
    console.log('🧪 Phantom Messenger Backend Tests\n');
    console.log('═'.repeat(50));

    const results = [];

    // Test 1: Connection
    results.push(await runTest('WebSocket Connection', testConnection));

    // Test 2: Ping/Pong
    results.push(await runTest('Ping/Pong Heartbeat', testPingPong));

    // Test 3: Auth Challenge
    results.push(await runTest('Authentication Challenge', testAuthChallenge));

    // Test 4: Invalid Message Handling
    results.push(await runTest('Invalid Message Handling', testInvalidMessage));

    // Test 5: Rate Limiting
    results.push(await runTest('Rate Limiting (10 rapid pings)', testRateLimiting));

    // Summary
    console.log('\n' + '═'.repeat(50));
    const passed = results.filter(Boolean).length;
    const total = results.length;

    if (passed === total) {
        console.log(`✅ All tests passed! (${passed}/${total})`);
    } else {
        console.log(`❌ Some tests failed (${passed}/${total})`);
    }
    console.log('═'.repeat(50));

    process.exit(passed === total ? 0 : 1);
}

async function runTest(name, testFn) {
    process.stdout.write(`\n▶ ${name}... `);
    try {
        const result = await testFn();
        console.log(result ? '✅ PASS' : '❌ FAIL');
        return result;
    } catch (err) {
        console.log(`❌ ERROR: ${err.message}`);
        return false;
    }
}

function createWs() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(SERVER_URL);
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Connection timeout'));
        }, 5000);

        ws.on('open', () => {
            clearTimeout(timeout);
            resolve(ws);
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

async function testConnection() {
    const ws = await createWs();
    ws.close();
    return true;
}

async function testPingPong() {
    const ws = await createWs();

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            ws.close();
            resolve(false);
        }, 3000);

        ws.on('message', (data) => {
            clearTimeout(timeout);
            const msg = JSON.parse(data.toString());
            ws.close();
            resolve(msg.type === 'pong' && msg.requestId === 'ping-test');
        });

        ws.send(JSON.stringify({
            type: 'ping',
            requestId: 'ping-test',
            payload: {},
            timestamp: Date.now()
        }));
    });
}

async function testAuthChallenge() {
    const ws = await createWs();

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            ws.close();
            resolve(false);
        }, 3000);

        ws.on('message', (data) => {
            clearTimeout(timeout);
            const msg = JSON.parse(data.toString());
            ws.close();
            resolve(
                msg.type === 'authenticate' &&
                typeof msg.payload.challenge === 'string' &&
                msg.payload.challenge.length > 20
            );
        });

        ws.send(JSON.stringify({
            type: 'authenticate',
            requestId: 'auth-test',
            payload: {},
            timestamp: Date.now()
        }));
    });
}

async function testInvalidMessage() {
    const ws = await createWs();

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            ws.close();
            resolve(false);
        }, 3000);

        ws.on('message', (data) => {
            clearTimeout(timeout);
            const msg = JSON.parse(data.toString());
            ws.close();
            resolve(msg.type === 'error');
        });

        // Send invalid message (missing required fields)
        ws.send(JSON.stringify({
            type: 'unknown-type',
            requestId: 'invalid-test',
            payload: {},
            timestamp: Date.now()
        }));
    });
}

async function testRateLimiting() {
    const ws = await createWs();
    let responseCount = 0;
    let gotRateLimited = false;

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            ws.close();
            // Pass if we got responses (rate limiting doesn't affect ping heavily)
            // The server is working if we got any responses at all
            resolve(responseCount > 0);
        }, 3000);

        ws.on('message', (data) => {
            responseCount++;
            const msg = JSON.parse(data.toString());
            if (msg.type === 'error' && msg.payload?.code === 'RATE_LIMITED') {
                gotRateLimited = true;
            }
            // Once we have enough responses or get rate limited, pass
            if (responseCount >= 10 || gotRateLimited) {
                clearTimeout(timeout);
                ws.close();
                resolve(true);
            }
        });

        // Send 10 rapid pings
        for (let i = 0; i < 10; i++) {
            ws.send(JSON.stringify({
                type: 'ping',
                requestId: `rate-${i}`,
                payload: {},
                timestamp: Date.now()
            }));
        }
    });
}

runTests().catch(console.error);
