import React, { useState, useEffect, useRef } from 'react';

const WebSocketTerminal = ({ code, language, onClose }) => {
  const [connected, setConnected] = useState(false);
  const [output, setOutput] = useState([]);
  const [input, setInput] = useState('');
  const [submissionId, setSubmissionId] = useState(null);
  const wsRef = useRef(null);
  const outputRef = useRef(null);

  // Auto-scroll to bottom of output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Connect to WebSocket on component mount
  useEffect(() => {
    // Use API URL from environment variable
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    
    // Create WebSocket connection
    wsRef.current = new WebSocket(`${wsUrl}/ws`);
    
    // Connection opened
    wsRef.current.addEventListener('open', () => {
      setConnected(true);
      setOutput(prev => [...prev, { type: 'system', content: 'Connected to server' }]);
      
      // Send the code submission
      const submission = {
        language,
        code
      };
      wsRef.current.send(JSON.stringify(submission));
    });
    
    // Listen for messages
    wsRef.current.addEventListener('message', (event) => {
      const message = event.data;
      
      // Check if this is a submission ID message
      if (message.startsWith('Submission ID: ')) {
        const id = message.substring('Submission ID: '.length);
        setSubmissionId(id);
        setOutput(prev => [...prev, { type: 'system', content: `Execution started with ID: ${id}` }]);
        return;
      }
      
      // Regular output
      setOutput(prev => [...prev, { type: 'output', content: message }]);
    });
    
    // Connection closed
    wsRef.current.addEventListener('close', () => {
      setConnected(false);
      setOutput(prev => [...prev, { type: 'system', content: 'Disconnected from server' }]);
    });
    
    // Connection error
    wsRef.current.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      setOutput(prev => [...prev, { type: 'error', content: 'Connection error' }]);
    });
    
    // Clean up on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [code, language]);
  
  // Handle input submission
  const handleInputSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || !connected) return;
    
    // Send input to server
    wsRef.current.send(input);
    
    // Add input to output display
    setOutput(prev => [...prev, { type: 'input', content: input }]);
    
    // Clear input field
    setInput('');
  };
  
  return (
    <div className="websocket-terminal">
      <div className="terminal-header">
        <div className="terminal-title">
          {connected ? 'Connected' : 'Disconnected'} 
          {submissionId && ` - Execution ID: ${submissionId}`}
        </div>
        <button className="terminal-close" onClick={onClose}>×</button>
      </div>
      
      <div className="terminal-output" ref={outputRef}>
        {output.map((line, index) => (
          <div key={index} className={`terminal-line ${line.type}`}>
            {line.type === 'input' && <span className="input-prefix">&gt; </span>}
            {line.content}
          </div>
        ))}
      </div>
      
      <form className="terminal-input-form" onSubmit={handleInputSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter input..."
          disabled={!connected}
          className="terminal-input-field"
        />
        <button 
          type="submit" 
          disabled={!connected} 
          className="terminal-input-submit"
        >
          Send
        </button>
      </form>
      
      <style jsx>{`
        .websocket-terminal {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: #1e1e1e;
          color: #d4d4d4;
          font-family: 'Consolas', monospace;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .terminal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background-color: #252526;
          border-bottom: 1px solid #333;
        }
        
        .terminal-title {
          font-size: 14px;
        }
        
        .terminal-close {
          background: none;
          border: none;
          color: #d4d4d4;
          font-size: 18px;
          cursor: pointer;
        }
        
        .terminal-output {
          flex: 1;
          padding: 12px;
          overflow-y: auto;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .terminal-line {
          margin-bottom: 4px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        
        .terminal-line.system {
          color: #569cd6;
        }
        
        .terminal-line.error {
          color: #f44747;
        }
        
        .terminal-line.input {
          color: #ce9178;
        }
        
        .input-prefix {
          color: #569cd6;
          font-weight: bold;
        }
        
        .terminal-input-form {
          display: flex;
          padding: 8px;
          background-color: #252526;
          border-top: 1px solid #333;
        }
        
        .terminal-input-field {
          flex: 1;
          background-color: #1e1e1e;
          color: #d4d4d4;
          border: 1px solid #3c3c3c;
          border-radius: 4px;
          padding: 8px 12px;
          font-family: 'Consolas', monospace;
          font-size: 14px;
        }
        
        .terminal-input-field:focus {
          outline: none;
          border-color: #007acc;
        }
        
        .terminal-input-submit {
          margin-left: 8px;
          background-color: #0e639c;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .terminal-input-submit:hover {
          background-color: #1177bb;
        }
        
        .terminal-input-submit:disabled {
          background-color: #3c3c3c;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default WebSocketTerminal;
