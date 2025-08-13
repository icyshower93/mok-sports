// Test WebSocket connection persistence and real-time updates
import WebSocket from 'ws';
import http from 'http';

console.log('🧪 Starting WebSocket Connection Persistence Test');

// Test 1: Basic connection establishment
const ws = new WebSocket('ws://localhost:5000/draft-ws');

ws.on('open', function open() {
  console.log('✅ WebSocket connected successfully');
  console.log('🔗 Connection state:', ws.readyState);
  
  // Send identify message like the frontend does
  const identifyMessage = {
    type: 'identify',
    userId: 'test_scores_user',
    draftId: 'admin_updates',
    source: 'test_script',
    connectionId: `test_${Date.now()}`,
  };
  
  console.log('📤 Sending identify message:', identifyMessage);
  ws.send(JSON.stringify(identifyMessage));
});

ws.on('message', function message(data) {
  try {
    const msg = JSON.parse(data.toString());
    console.log('📨 Received message:', msg.type);
    
    if (msg.type === 'identified') {
      console.log('✅ Successfully identified to server');
      
      // Wait a bit then trigger an admin advance to test real-time updates
      setTimeout(() => {
        console.log('🧪 Triggering admin advance to test real-time broadcast...');
        
        // Make HTTP request to advance day
        const options = {
          hostname: 'localhost',
          port: 5000,
          path: '/api/admin/advance-day',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        };
        
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            console.log('📈 Admin advance response:', JSON.parse(data));
          });
        });
        
        req.on('error', (err) => {
          console.error('❌ Admin advance error:', err);
        });
        
        req.end();
      }, 2000);
    } else if (msg.type === 'admin_date_advanced') {
      console.log('🎯 SUCCESS! Received real-time admin_date_advanced message');
      console.log('✅ WebSocket real-time updates working correctly');
      
      // Test successful, close connection
      setTimeout(() => {
        console.log('🧪 Test completed successfully, closing connection');
        ws.close();
      }, 1000);
    }
  } catch (e) {
    console.log('❌ Message parsing error:', e);
  }
});

ws.on('close', (code, reason) => {
  console.log(`🔌 WebSocket closed - Code: ${code}, Reason: ${reason?.toString() || 'none'}`);
  
  if (code === 1000) {
    console.log('✅ Normal closure - Test completed');
  } else {
    console.log('❌ Unexpected closure during test');
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

// Keep script running for 10 seconds max
setTimeout(() => {
  console.log('⏰ Test timeout reached, closing');
  if (ws.readyState === 1) {
    ws.close();
  }
  process.exit(0);
}, 10000);