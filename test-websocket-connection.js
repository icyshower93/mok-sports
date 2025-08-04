#!/usr/bin/env node

/**
 * Direct WebSocket Connection Test
 * Tests if WebSocket connections reach the backend server
 */

import WebSocket from 'ws';

const testConnection = () => {
  console.log('🔌 Testing WebSocket connection...');
  
  const wsUrl = 'ws://localhost:5000/draft-ws?userId=test-user&draftId=test-draft';
  console.log('📡 Connecting to:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log('✅ WebSocket connection opened successfully!');
    console.log('📤 Sending test message...');
    ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
  });
  
  ws.on('message', (data) => {
    console.log('📥 Received message:', data.toString());
  });
  
  ws.on('close', (code, reason) => {
    console.log(`❌ WebSocket connection closed: ${code} - ${reason}`);
  });
  
  ws.on('error', (error) => {
    console.error('💥 WebSocket error:', error.message);
  });
  
  // Close after 10 seconds
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
      console.log('🔄 Test completed - connection closed');
    }
    process.exit(0);
  }, 10000);
};

testConnection();