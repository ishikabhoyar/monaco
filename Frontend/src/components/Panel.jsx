import React from "react";
import { useState, useEffect } from "react";
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

  const renderTerminal = () => {
    return (
      <div className="panel-terminal">
        {terminalOutput.length > 0 ? (
          // Render output from EditorArea when available
          <>
            {terminalOutput.map((line, index) => (
              <div key={index} className={`terminal-line ${line.type === 'warning' ? 'terminal-warning' : 'terminal-output'}`}>
                {line.type === 'command' ? <span className="terminal-prompt">$</span> : ''} {line.content}
              </div>
            ))}
            {waitingForInput && (
              <div className="terminal-line">
                <span className="terminal-prompt">Input:</span>
                <input
                  type="text"
                  className="terminal-input"
                  value={userInput}
                  onChange={(e) => onUserInputChange && onUserInputChange(e.target.value)}
                  placeholder="Enter input for your program here..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && onInputSubmit) {
                      onInputSubmit();
                    }
                  }}
                  autoFocus
                />
              </div>
            )}
          </>
        ) : (
          // Default terminal content when no output
          <>
            <div className="terminal-line">
              <span className="terminal-prompt">$</span> npm start
            </div>
            <div className="terminal-line terminal-output">Starting the development server...</div>
            <div className="terminal-line terminal-output">Compiled successfully!</div>
            <div className="terminal-line terminal-output">You can now view vscode-clone in the browser.</div>
            <div className="terminal-line terminal-output">Local: http://localhost:3000</div>
            <div className="terminal-line terminal-output">On Your Network: http://192.168.1.5:3000</div>
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

