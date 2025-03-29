import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

const Panel = ({ 
  height,
  terminalOutput = [],
  isRunning = false,
  waitingForInput = false,
  activeRunningFile = null,
  initialTab = "terminal",
  onClose,
  userInput = "",
  onUserInputChange,
  onInputSubmit
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Set active tab when initialTab changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Update the renderTerminal function to create an interactive terminal
  const renderTerminal = () => {
    const terminalRef = useRef(null);
    const [inputBuffer, setInputBuffer] = useState("");
    
    // Auto-scroll terminal to bottom when content changes
    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, [terminalOutput]);
    
    // Set up keyboard event listeners when terminal is focused
    useEffect(() => {
      const handleKeyDown = (e) => {
        if (!isRunning) return;
        
        if (e.key === 'Enter') {
          // Send current input buffer through WebSocket
          if (inputBuffer.trim() && onInputSubmit) {
            e.preventDefault(); // Prevent default Enter behavior
            
            // Important: Set user input and THEN call submit in a sequence
            onUserInputChange(inputBuffer);
            
            // Add a small delay before submitting to ensure state update
            setTimeout(() => {
              onInputSubmit();
              // Clear buffer after submission is processed
              setInputBuffer("");
            }, 10);
          }
        } else if (e.key === 'Backspace') {
          // Handle backspace to remove characters
          setInputBuffer(prev => prev.slice(0, -1));
        } else if (e.key.length === 1) {
          // Add regular characters to input buffer
          setInputBuffer(prev => prev + e.key);
        }
      };
      
      // Add event listener
      if (terminalRef.current) {
        terminalRef.current.addEventListener('keydown', handleKeyDown);
      }
      
      // Clean up
      return () => {
        if (terminalRef.current) {
          terminalRef.current.removeEventListener('keydown', handleKeyDown);
        }
      };
    }, [isRunning, inputBuffer, onInputSubmit, onUserInputChange]);
    
    return (
      <div 
        className="panel-terminal" 
        ref={terminalRef}
        tabIndex={0} // Make div focusable
        onClick={() => terminalRef.current?.focus()} // Focus when clicked
      >
        {terminalOutput.length > 0 ? (
          // Render output from EditorArea when available
          <>
            {terminalOutput.map((line, index) => (
              <div key={index} className={`terminal-line ${line.type === 'warning' ? 'terminal-warning' : 'terminal-output'}`}>
                {line.type === 'command' ? <span className="terminal-prompt">$</span> : ''} {line.content}
              </div>
            ))}
            
            {/* Show current input with blinking cursor only when connection is active */}
            {isRunning && (
              <div className="terminal-line terminal-input-line">
                <span className="terminal-prompt">$</span> {inputBuffer}
                <span className="terminal-cursor"></span>
              </div>
            )}
          </>
        ) : (
          // Default terminal content
          <>
            <div className="terminal-line">
              <span className="terminal-prompt">$</span>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderProblems = () => {
    return (
      <div className="panel-problems">
        <div className="panel-empty-message">No problems have been detected in the workspace.</div>
      </div>
    );
  };

  const renderOutput = () => {
    return (
      <div className="panel-output">
        <div className="output-line">[Extension Host] Extension host started.</div>
        <div className="output-line">[Language Server] Language server started.</div>
        {activeRunningFile && (
          <div className="output-line">[Running] {activeRunningFile}</div>
        )}
      </div>
    );
  };

  const getTabContent = () => {
    switch (activeTab) {
      case "terminal":
        return renderTerminal();
      case "problems":
        return renderProblems();
      case "output":
        return renderOutput();
      default:
        return <div>Unknown tab</div>;
    }
  };

  return (
    <div className="panel" style={{ height: `${height}px` }}>
      <div className="panel-tabs">
        <div
          className={`panel-tab ${activeTab === "problems" ? "active" : ""}`}
          onClick={() => setActiveTab("problems")}
        >
          <span className="tab-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </span>
          <span className="tab-name">Problems</span>
        </div>
        <div className={`panel-tab ${activeTab === "output" ? "active" : ""}`} onClick={() => setActiveTab("output")}>
          <span className="tab-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </span>
          <span className="tab-name">Output</span>
        </div>
        <div
          className={`panel-tab ${activeTab === "terminal" ? "active" : ""}`}
          onClick={() => setActiveTab("terminal")}
        >
          <span className="tab-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
          </span>
          <span className="tab-name">Terminal</span>
        </div>

        {/* Add close button */}
        <div className="panel-actions">
          <button className="panel-close-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="panel-content">{getTabContent()}</div>
    </div>
  );
};

export default Panel;

