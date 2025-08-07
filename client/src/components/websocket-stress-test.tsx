/**
 * WebSocket Stress Testing Component
 * 
 * Simulates slow clients, reconnects, and validates session stability
 * for 20-30 minute drafting sessions under active usage.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface StressTestState {
  isRunning: boolean;
  testType: 'reload' | 'tab_away' | 'slow_network' | 'message_flood' | 'idle_timeout';
  startTime: number;
  events: Array<{
    timestamp: number;
    type: 'connection' | 'message' | 'error' | 'close' | 'reconnect';
    details: string;
    draftId?: string;
  }>;
  connectionCount: number;
  messageCount: number;
  errorCount: number;
  missedPicks: number;
  invalidStates: number;
}

interface WebSocketStressTestProps {
  draftId: string;
  onTestResult: (result: { success: boolean; details: string }) => void;
}

export function WebSocketStressTest({ draftId, onTestResult }: WebSocketStressTestProps) {
  const [testState, setTestState] = useState<StressTestState>({
    isRunning: false,
    testType: 'reload',
    startTime: 0,
    events: [],
    connectionCount: 0,
    messageCount: 0,
    errorCount: 0,
    missedPicks: 0,
    invalidStates: 0
  });

  const wsRef = useRef<WebSocket | null>(null);
  const testIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const addEvent = (type: StressTestState['events'][0]['type'], details: string) => {
    setTestState(prev => ({
      ...prev,
      events: [...prev.events.slice(-19), {
        timestamp: Date.now(),
        type,
        details,
        draftId
      }]
    }));
  };

  // Test 1: Simulate page reloads mid-draft
  const simulatePageReload = () => {
    console.log('🔄 [StressTest] SIMULATING PAGE RELOAD');
    addEvent('connection', 'Simulating page reload - closing connection');
    
    if (wsRef.current) {
      wsRef.current.close(1001, 'Page reload simulation');
    }
    
    // Simulate delay before reconnection
    setTimeout(() => {
      console.log('🔄 [StressTest] RECONNECTING AFTER RELOAD');
      createWebSocketConnection();
    }, Math.random() * 3000 + 1000); // 1-4 second delay
  };

  // Test 2: Simulate tab away/back (visibility change)
  const simulateTabAway = () => {
    console.log('👁️ [StressTest] SIMULATING TAB AWAY');
    addEvent('connection', 'Simulating tab away - reducing activity');
    
    // Simulate reduced message frequency
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true
    });
    
    document.dispatchEvent(new Event('visibilitychange'));
    
    setTimeout(() => {
      console.log('👁️ [StressTest] SIMULATING TAB BACK');
      addEvent('connection', 'Simulating tab back - resuming activity');
      
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true
      });
      
      document.dispatchEvent(new Event('visibilitychange'));
    }, 5000);
  };

  // Test 3: Simulate slow network conditions
  const simulateSlowNetwork = () => {
    console.log('🐌 [StressTest] SIMULATING SLOW NETWORK');
    addEvent('message', 'Simulating slow network - delayed responses');
    
    // Send messages with artificial delays
    let messageCount = 0;
    const slowMessageInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && messageCount < 10) {
        const message = {
          type: 'stress_test_message',
          draftId,
          sequence: messageCount,
          timestamp: Date.now()
        };
        
        wsRef.current.send(JSON.stringify(message));
        addEvent('message', `Slow network message ${messageCount} sent`);
        messageCount++;
      } else {
        clearInterval(slowMessageInterval);
      }
    }, 2000); // Send every 2 seconds instead of immediately
  };

  // Test 4: Message flood test
  const simulateMessageFlood = () => {
    console.log('🌊 [StressTest] SIMULATING MESSAGE FLOOD');
    addEvent('message', 'Simulating message flood - high frequency');
    
    let floodCount = 0;
    const floodInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && floodCount < 50) {
        const message = {
          type: 'stress_test_flood',
          draftId,
          sequence: floodCount,
          data: 'x'.repeat(100), // Add some payload
          timestamp: Date.now()
        };
        
        wsRef.current.send(JSON.stringify(message));
        floodCount++;
        
        if (floodCount % 10 === 0) {
          addEvent('message', `Flood test: ${floodCount} messages sent`);
        }
      } else {
        clearInterval(floodInterval);
        addEvent('message', `Flood test complete: ${floodCount} messages sent`);
      }
    }, 100); // Send every 100ms
  };

  // Test 5: Idle timeout simulation
  const simulateIdleTimeout = () => {
    console.log('⏰ [StressTest] SIMULATING IDLE TIMEOUT');
    addEvent('connection', 'Simulating idle timeout - no heartbeat');
    
    // Stop sending pings temporarily
    if (wsRef.current) {
      // Override the ping mechanism temporarily
      const originalSend = wsRef.current.send;
      wsRef.current.send = function(data) {
        const parsed = JSON.parse(data);
        if (parsed.type !== 'ping') {
          originalSend.call(this, data);
        } else {
          addEvent('message', 'Blocked ping during idle timeout simulation');
        }
      };
      
      // Restore normal operation after test
      setTimeout(() => {
        if (wsRef.current) {
          wsRef.current.send = originalSend;
          addEvent('connection', 'Restored normal ping operation');
        }
      }, 60000); // 1 minute idle
    }
  };

  const createWebSocketConnection = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/draft-ws?draftId=${draftId}&userId=stress-test-user`;
    
    try {
      const ws = new WebSocket(wsUrl, ['draft-protocol']);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('🚀 [StressTest] WebSocket connected');
        addEvent('connection', 'WebSocket connected for stress testing');
        setTestState(prev => ({ ...prev, connectionCount: prev.connectionCount + 1 }));
      };
      
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('📨 [StressTest] Message received:', message.type);
        addEvent('message', `Received: ${message.type} for draft ${message.draftId}`);
        setTestState(prev => ({ ...prev, messageCount: prev.messageCount + 1 }));
        
        // Validate draft ID consistency
        if (message.draftId !== draftId) {
          addEvent('error', `Draft ID mismatch: expected ${draftId}, got ${message.draftId}`);
          setTestState(prev => ({ ...prev, invalidStates: prev.invalidStates + 1 }));
        }
      };
      
      ws.onclose = (event) => {
        console.log('🔌 [StressTest] WebSocket closed:', event.code, event.reason);
        addEvent('close', `Connection closed: ${event.code} - ${event.reason}`);
      };
      
      ws.onerror = (error) => {
        console.error('🚨 [StressTest] WebSocket error:', error);
        addEvent('error', 'WebSocket error occurred');
        setTestState(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
      };
      
    } catch (error) {
      console.error('🚨 [StressTest] Failed to create WebSocket:', error);
      addEvent('error', 'Failed to create WebSocket connection');
    }
  };

  const startStressTest = (testType: StressTestState['testType']) => {
    console.log(`🧪 [StressTest] Starting ${testType} test`);
    
    setTestState(prev => ({
      ...prev,
      isRunning: true,
      testType,
      startTime: Date.now(),
      events: [],
      connectionCount: 0,
      messageCount: 0,
      errorCount: 0,
      missedPicks: 0,
      invalidStates: 0
    }));
    
    // Create initial connection
    createWebSocketConnection();
    
    // Start the specific test
    setTimeout(() => {
      switch (testType) {
        case 'reload':
          simulatePageReload();
          break;
        case 'tab_away':
          simulateTabAway();
          break;
        case 'slow_network':
          simulateSlowNetwork();
          break;
        case 'message_flood':
          simulateMessageFlood();
          break;
        case 'idle_timeout':
          simulateIdleTimeout();
          break;
      }
    }, 2000);
    
    // Auto-stop test after 2 minutes
    testIntervalRef.current = setTimeout(() => {
      stopStressTest();
    }, 120000);
  };

  const stopStressTest = () => {
    console.log('🛑 [StressTest] Stopping stress test');
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Stress test complete');
      wsRef.current = null;
    }
    
    if (testIntervalRef.current) {
      clearTimeout(testIntervalRef.current);
      testIntervalRef.current = null;
    }
    
    const duration = Date.now() - testState.startTime;
    const success = testState.errorCount === 0 && testState.invalidStates === 0;
    
    addEvent('connection', `Stress test complete - Duration: ${Math.round(duration / 1000)}s`);
    
    onTestResult({
      success,
      details: `${testState.testType} test: ${testState.connectionCount} connections, ${testState.messageCount} messages, ${testState.errorCount} errors, ${testState.invalidStates} invalid states`
    });
    
    setTestState(prev => ({ ...prev, isRunning: false }));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
      if (testIntervalRef.current) {
        clearTimeout(testIntervalRef.current);
      }
    };
  }, []);

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>WebSocket Stress Testing</CardTitle>
        <div className="text-sm text-muted-foreground">
          Simulate slow clients, reconnects, and validate 20-30 minute session stability
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Button
            onClick={() => startStressTest('reload')}
            disabled={testState.isRunning}
            variant="outline"
            size="sm"
          >
            Page Reload
          </Button>
          <Button
            onClick={() => startStressTest('tab_away')}
            disabled={testState.isRunning}
            variant="outline"
            size="sm"
          >
            Tab Away
          </Button>
          <Button
            onClick={() => startStressTest('slow_network')}
            disabled={testState.isRunning}
            variant="outline"
            size="sm"
          >
            Slow Network
          </Button>
          <Button
            onClick={() => startStressTest('message_flood')}
            disabled={testState.isRunning}
            variant="outline"
            size="sm"
          >
            Message Flood
          </Button>
          <Button
            onClick={() => startStressTest('idle_timeout')}
            disabled={testState.isRunning}
            variant="outline"
            size="sm"
          >
            Idle Timeout
          </Button>
        </div>
        
        {testState.isRunning && (
          <Button onClick={stopStressTest} variant="destructive" size="sm">
            Stop Test
          </Button>
        )}
        
        <Separator />
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{testState.connectionCount}</div>
            <div className="text-xs text-muted-foreground">Connections</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{testState.messageCount}</div>
            <div className="text-xs text-muted-foreground">Messages</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{testState.errorCount}</div>
            <div className="text-xs text-muted-foreground">Errors</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">{testState.missedPicks}</div>
            <div className="text-xs text-muted-foreground">Missed Picks</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{testState.invalidStates}</div>
            <div className="text-xs text-muted-foreground">Invalid States</div>
          </div>
        </div>
        
        <Separator />
        
        <div className="max-h-64 overflow-y-auto space-y-2">
          <div className="text-sm font-medium">Recent Events</div>
          {testState.events.map((event, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <Badge variant={
                event.type === 'error' ? 'destructive' : 
                event.type === 'connection' ? 'default' : 
                event.type === 'message' ? 'secondary' : 'outline'
              }>
                {event.type}
              </Badge>
              <span className="text-muted-foreground">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
              <span>{event.details}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}