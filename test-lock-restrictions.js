// Test lock restrictions for different scenarios

const testLockRestrictions = async () => {
  const baseUrl = 'http://localhost:3000';
  const leagueId = '243d719b-92ce-4752-8689-5da93ee69213';
  
  console.log('🧪 Testing Lock Restriction System\n');
  
  // Test different weeks and scenarios
  const testCases = [
    { season: 2024, week: 1, description: '2024 Week 1 (Testing Season)' },
    { season: 2024, week: 2, description: '2024 Week 2 (Testing Season)' },
    { season: 2025, week: 1, description: '2025 Week 1 (Production Season)' },
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`\n--- Testing ${testCase.description} ---`);
      
      // Test week lock status
      const response = await fetch(`${baseUrl}/api/leagues/${leagueId}/week-lock-status/${testCase.season}/${testCase.week}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Week Lock Status:`);
        console.log(`   Can Lock: ${data.canLock ? '✅ YES' : '❌ NO'}`);
        console.log(`   Week Status: ${data.weekStatus}`);
        console.log(`   Message: ${data.message}`);
        console.log(`   Games: ${data.gamesCompleted}/${data.totalGames} completed, ${data.gamesInProgress} in progress`);
        if (data.reason) {
          console.log(`   Reason: ${data.reason}`);
        }
      } else {
        console.log(`❌ Error getting week status: ${response.status} ${response.statusText}`);
        const errorData = await response.text();
        console.log(`   Error details: ${errorData}`);
      }
      
      // Test lock validation
      console.log(`\n   Testing lock validation...`);
      const validateResponse = await fetch(`${baseUrl}/api/leagues/${leagueId}/locks/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nflTeamId: '1', // Patriots
          lockType: 'lock',
          season: testCase.season,
          week: testCase.week
        })
      });
      
      if (validateResponse.ok) {
        const validateData = await validateResponse.json();
        console.log(`   Lock Validation: ${validateData.valid ? '✅ VALID' : '❌ INVALID'}`);
        if (validateData.message) {
          console.log(`   Validation Message: ${validateData.message}`);
        }
        if (validateData.reason) {
          console.log(`   Validation Reason: ${validateData.reason}`);
        }
      } else {
        console.log(`   ❌ Error validating lock: ${validateResponse.status}`);
      }
      
    } catch (error) {
      console.log(`❌ Error testing ${testCase.description}:`, error.message);
    }
  }
  
  console.log('\n🏁 Lock restriction testing complete!');
};

// Run the test
testLockRestrictions().catch(console.error);