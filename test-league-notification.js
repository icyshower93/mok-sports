// Test script to simulate league full notification
const fetch = require('node-fetch');

async function testLeagueNotification() {
  try {
    console.log('Testing league full notification...');
    
    // First, let's check what leagues exist
    const leaguesResponse = await fetch('http://localhost:5000/api/leagues', {
      credentials: 'include'
    });
    
    if (leaguesResponse.ok) {
      const leagues = await leaguesResponse.json();
      console.log('Available leagues:', leagues);
      
      if (leagues.length > 0) {
        const testLeague = leagues.find(l => l.joinCode === 'EEW2YU') || leagues[0];
        console.log('Testing with league:', testLeague);
        
        // Test league full notification
        const notificationResponse = await fetch('http://localhost:5000/api/push/test-league-full', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leagueId: testLeague.id }),
          credentials: 'include'
        });
        
        const result = await notificationResponse.text();
        console.log('Notification test result:', result);
      }
    } else {
      console.log('Failed to fetch leagues:', leaguesResponse.status);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testLeagueNotification();