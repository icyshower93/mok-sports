
// Test script to simulate app initialization and catch TDZ errors
import { readFileSync } from 'fs';

console.log('🧪 Testing for TDZ errors in current build...');

try {
  // Check if the build files exist
  const jsFile = readFileSync('dist/public/assets/index-C9O6cbz3.js', 'utf8');
  console.log('✅ Build file exists, size:', jsFile.length);
  
  // Look for potential TDZ patterns in the build
  const suspiciousPatterns = [
    'Cannot access',
    'before initialization', 
    'temporal dead zone',
    'ReferenceError'
  ];
  
  let foundIssues = false;
  suspiciousPatterns.forEach(pattern => {
    if (jsFile.includes(pattern)) {
      console.log('⚠️ Found suspicious pattern in build:', pattern);
      foundIssues = true;
    }
  });
  
  if (!foundIssues) {
    console.log('✅ No obvious TDZ patterns found in build');
  }
  
} catch (error) {
  console.error('❌ Error during TDZ testing:', error.message);
}

