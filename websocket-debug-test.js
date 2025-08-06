// Direct WebSocket test to isolate the issue
import WebSocket from 'ws';

console.log('Starting WebSocket connection test...');

const ws = new WebSocket('ws://localhost:5000/draft-ws?userId=test-user&draftId=82b3103b-161d-42ae-9b64-60fb907fdec2');

let connectionStartTime = Date.now();
let messageCount = 0;

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully');
  console.log('Connection time:', Date.now() - connectionStartTime, 'ms');
  
  // Send initial ping
  ws.send(JSON.stringify({
    type: 'ping',
    timestamp: Date.now()
  }));
  
  console.log('📤 Initial ping sent');
  
  // Set up heartbeat every 5 seconds
  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      }));
      console.log('💓 Heartbeat ping sent');
    } else {
      console.log('❌ WebSocket not open, stopping heartbeat');
      clearInterval(heartbeat);
    }
  }, 5000);
});

ws.on('message', (data) => {
  messageCount++;
  console.log(`📨 Message ${messageCount} received:`, data.toString());
});

ws.on('close', (code, reason) => {
  const connectionDuration = Date.now() - connectionStartTime;
  console.log(`❌ Connection closed after ${connectionDuration}ms`);
  console.log(`Close code: ${code}, reason: ${reason.toString()}`);
  console.log(`Total messages received: ${messageCount}`);
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('🚨 WebSocket error:', error);
  process.exit(1);
});

// Keep test running for 30 seconds max
setTimeout(() => {
  console.log('⏰ Test timeout - closing connection');
  ws.close(1000, 'Test timeout');
}, 30000);