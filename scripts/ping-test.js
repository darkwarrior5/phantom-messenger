const WebSocket = require('ws');

console.log('Connecting to ws://localhost:8080/ws...');
const ws = new WebSocket('ws://localhost:8080/ws');

ws.on('open', () => {
    console.log('✅ Connected');
    const msg = {
        type: 'ping',
        requestId: 'test-ping',
        payload: {},
        timestamp: Date.now()
    };
    console.log('📤 Sending:', JSON.stringify(msg));
    ws.send(JSON.stringify(msg));
});

ws.on('message', (data) => {
    console.log('📩 Received:', data.toString());
    ws.close();
    process.exit(0);
});

ws.on('error', (err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});

ws.on('close', (code, reason) => {
    console.log('Connection closed:', code, reason.toString());
});

setTimeout(() => {
    console.log('⏱️ Timeout after 5s');
    process.exit(1);
}, 5000);
