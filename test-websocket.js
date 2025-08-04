// Simple WebSocket connection test
import WebSocket from 'ws';

console.log('Testing WebSocket connection to draft server...');

// Test connection to the draft WebSocket endpoint
const ws = new WebSocket('ws://localhost:5000/draft-ws', {
  headers: {
    'Origin': 'http://localhost:5000'
  }
});

ws.on('open', function open() {
  console.log('✅ WebSocket connected successfully!');
  
  // Send a test message
  ws.send(JSON.stringify({
    type: 'join_draft',
    draftId: 'test-draft-123',
    userId: 'test-user-456'
  }));
});

ws.on('message', function message(data) {
  console.log('📨 Received message:', data.toString());
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close(code, reason) {
  console.log('🔌 WebSocket closed:', code, reason.toString());
});

// Keep connection alive for testing
setTimeout(() => {
  console.log('Closing test connection...');
  ws.close();
}, 5000);