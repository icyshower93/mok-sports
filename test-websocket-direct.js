/**
 * WebSocket Direct Connection Test
 * Tests WebSocket connection directly without browser complications
 */

import WebSocket from 'ws';

const draftId = 'bc40e0fa-d58a-4662-8395-0a7f44b71cbb';
const userId = '9932fcd8-7fbb-49c3-8fbb-f254cff1bb9a';
const wsUrl = `ws://localhost:5000/draft-ws?userId=${userId}&draftId=${draftId}`;

console.log('🔌 Testing WebSocket connection...');
console.log('URL:', wsUrl);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully!');
  
  // Send ping message
  ws.send(JSON.stringify({
    type: 'ping',
    draftId: draftId,
    userId: userId,
    timestamp: Date.now()
  }));
  
  console.log('📤 Sent ping message');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📥 Received message:', message);
});

ws.on('close', (code, reason) => {
  console.log('🔌 Connection closed:', code, reason.toString());
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

// Keep connection alive for 30 seconds to test heartbeat
setTimeout(() => {
  console.log('⏰ Test complete - closing connection');
  ws.close();
}, 30000);