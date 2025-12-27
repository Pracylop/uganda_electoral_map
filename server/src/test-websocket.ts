import WebSocket from 'ws';

// Use the token from your login
const TEST_TOKEN = process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NjY0ODQyMjgsImV4cCI6MTc2NjU3MDYyOH0.K3Dw0-I__Wi_gmNTQKPe3lLaGXUqgL77_K1AXEKqhGE';

const WS_URL = 'ws://localhost:3001';

console.log('🧪 Testing WebSocket Connection...\n');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connection established');
});

ws.on('message', (data: Buffer) => {
  const message = JSON.parse(data.toString());
  console.log('📨 Received:', message.type);
  console.log('   Payload:', message.payload);

  // Respond to AUTH_REQUIRED
  if (message.type === 'AUTH_REQUIRED') {
    console.log('\n🔐 Sending authentication token...');
    ws.send(JSON.stringify({
      type: 'AUTH',
      payload: { token: TEST_TOKEN }
    }));
  }

  // Handle AUTH_OK
  if (message.type === 'AUTH_OK') {
    console.log('\n✅ Authentication successful!');
    console.log('   User:', message.payload);

    // Send a test PING
    console.log('\n🏓 Sending PING...');
    ws.send(JSON.stringify({ type: 'PING' }));
  }

  // Handle PONG
  if (message.type === 'PONG') {
    console.log('✅ Received PONG\n');
    console.log('🎉 WebSocket test completed successfully!');
    ws.close();
  }

  // Handle ERROR
  if (message.type === 'ERROR') {
    console.error('❌ Error:', message.payload.error);
    ws.close();
  }
});

ws.on('close', () => {
  console.log('\n🔌 WebSocket connection closed');
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});
