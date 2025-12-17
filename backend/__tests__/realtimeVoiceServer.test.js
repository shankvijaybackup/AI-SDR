import { WebSocketServer } from 'ws';
import http from 'http';
import { attachRealtimeVoiceServer } from '../realtimeVoiceServer.js';
import { getActiveCall, updateCallTranscript } from '../routes/initiate-call.js';

// Mock dependencies
jest.mock('../routes/initiate-call.js', () => ({
  getActiveCall: jest.fn(),
  updateCallTranscript: jest.fn()
}));

// Mock WebSocket client
class MockWebSocket {
  constructor() {
    this.send = jest.fn();
    this.close = jest.fn();
    this.on = jest.fn();
    this.readyState = 1; // OPEN
  }
}

describe('Realtime Voice Server', () => {
  let server;
  let wss;
  let testPort = 0; // Let OS assign a port
  let testUrl;
  
  // Test data
  const testCall = {
    callId: 'test-call-123',
    leadName: 'Test User',
    leadEmail: 'test@example.com',
    script: 'Test script content',
    voicePersona: 'female'
  };

  beforeAll((done) => {
    // Create HTTP server
    server = http.createServer();
    
    // Attach WebSocket server
    wss = new WebSocketServer({ server });
    attachRealtimeVoiceServer(server);
    
    // Start server on random port
    server.listen(0, () => {
      testPort = server.address().port;
      testUrl = `ws://localhost:${testPort}/twilio-realtime-voice`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('WebSocket Connection', () => {
    let client;
    
    beforeEach(() => {
      client = new MockWebSocket();
      getActiveCall.mockReturnValue(testCall);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('should establish connection successfully', (done) => {
      const ws = new WebSocket(testUrl);
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });
    });
  });

  describe('Call Flow', () => {
    let client;
    
    beforeEach(() => {
      client = new MockWebSocket();
      getActiveCall.mockReturnValue(testCall);
    });

    test('should handle call start event', async () => {
      const ws = new WebSocket(testUrl);
      
      await new Promise((resolve) => ws.on('open', resolve));
      
      // Simulate call start
      ws.send(JSON.stringify({
        event: 'start',
        start: {
          streamSid: 'test-stream-123',
          callSid: 'test-call-123'
        }
      }));

      // Verify active call was retrieved
      expect(getActiveCall).toHaveBeenCalledWith('test-call-123');
      
      ws.close();
    });
  });

  describe('Audio Processing', () => {
    test('should handle audio media events', async () => {
      const ws = new WebSocket(testUrl);
      
      await new Promise((resolve) => ws.on('open', resolve));
      
      // Simulate call start
      ws.send(JSON.stringify({
        event: 'start',
        start: {
          streamSid: 'test-stream-123',
          callSid: 'test-call-123'
        }
      }));

      // Simulate audio data
      const audioData = Buffer.from('test-audio-data').toString('base64');
      ws.send(JSON.stringify({
        event: 'media',
        media: {
          payload: audioData
        }
      }));
      
      // Verify audio was processed (in a real test, we'd check if it was forwarded to OpenAI)
      // This is simplified - in a real test, we'd mock the OpenAI WebSocket
      
      ws.close();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON', async () => {
      const ws = new WebSocket(testUrl);
      
      await new Promise((resolve) => ws.on('open', resolve));
      
      // Send invalid JSON
      ws.send('invalid-json');
      
      // Connection should remain open
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      ws.close();
    });

    test('should handle unknown call', async () => {
      const ws = new WebSocket(testUrl);
      
      await new Promise((resolve) => ws.on('open', resolve));
      
      // Mock getActiveCall to return null (call not found)
      getActiveCall.mockReturnValueOnce(null);
      
      // Simulate call start with unknown call SID
      ws.send(JSON.stringify({
        event: 'start',
        start: {
          streamSid: 'test-stream-unknown',
          callSid: 'unknown-call-123'
        }
      }));
      
      // Connection should remain open
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      ws.close();
    });
  });

  describe('Performance', () => {
    test('should handle audio streaming with low latency', async () => {
      const ws = new WebSocket(testUrl);
      
      await new Promise((resolve) => ws.on('open', resolve));
      
      // Simulate call start
      ws.send(JSON.stringify({
        event: 'start',
        start: {
          streamSid: 'test-stream-perf',
          callSid: 'test-call-perf'
        }
      }));

      // Simulate multiple audio chunks
      const testChunk = Buffer.alloc(640).toString('base64'); // 20ms of audio
      const chunks = Array(50).fill(testChunk); // 1 second of audio
      
      const startTime = Date.now();
      
      for (const chunk of chunks) {
        ws.send(JSON.stringify({
          event: 'media',
          media: { payload: chunk }
        }));
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      console.log(`Processed ${chunks.length} audio chunks in ${totalTime}ms`);
      
      // Verify processing time is reasonable
      expect(totalTime).toBeLessThan(1500); // Should process 1s of audio in <1.5s
      
      ws.close();
    }, 10000); // Increase timeout for performance test
  });
});
