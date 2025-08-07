// WebSocket Connection Test for New Draft
import WebSocket from 'ws';
import fetch from 'node-fetch';

async function testWebSocketConnection() {
  console.log('🧪 Testing WebSocket connection to new draft...');
  
  try {
    // First, let's create a new draft
    console.log('📋 Creating new draft for test...');
    
    const resetResponse = await fetch('http://localhost:5000/api/testing/reset-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId: '243d719b-92ce-4752-8689-5da93ee69213' })
    });
    
    if (!resetResponse.ok) {
      console.log('❌ Failed to create draft:', resetResponse.status);
      return;
    }
    
    const resetData = await resetResponse.json();
    const draftId = resetData.draftId;
    console.log('✅ Created draft:', draftId);
    
    // Test WebSocket connection
    const wsUrl = `ws://localhost:5000/draft-ws?draftId=${draftId}&userId=test-user-123`;
    console.log('🔗 Connecting to:', wsUrl);
    
    const ws = new WebSocket(wsUrl, ['draft-protocol']);
    
    // Set timeout for test
    const testTimeout = setTimeout(() => {
      console.log('⏰ Test timeout - closing connection');
      ws.close();
    }, 10000);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      console.log('🏓 Sending ping...');
      
      ws.send(JSON.stringify({
        type: 'ping',
        draftId: draftId,
        userId: 'test-user-123',
        timestamp: Date.now()
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      console.log('📨 Received message:', message.type);
      console.log('🔍 Draft ID in message:', message.draftId);
      console.log('🔍 Expected draft ID:', draftId);
      console.log('🔍 Draft ID match:', message.draftId === draftId ? '✅' : '❌');
      
      if (message.type === 'pong') {
        console.log('🏓 Pong received - connection healthy');
        console.log('✅ WebSocket test PASSED');
        clearTimeout(testTimeout);
        ws.close();
        process.exit(0);
      } else if (message.type === 'connected') {
        console.log('🔌 Connected message received');
      }
    });
    
    ws.on('close', (code, reason) => {
      console.log('🔌 Connection closed:', code, reason.toString());
      clearTimeout(testTimeout);
      process.exit(0);
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      clearTimeout(testTimeout);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testWebSocketConnection();