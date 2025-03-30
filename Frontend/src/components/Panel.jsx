import React, { useState, useEffect, useRef } from "react";
import { X, Maximize2, ChevronDown, Plus } from "lucide-react";

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
  onInputSubmit,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const terminalRef = useRef(null);
  const [inputBuffer, setInputBuffer] = useState("");

  // Update active tab when initialTab changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Auto-scroll terminal to the bottom when content changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Handle keyboard input for the terminal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isRunning) return;

      if (e.key === "Enter") {
        if (inputBuffer.trim() && onInputSubmit) {
          e.preventDefault();
          // Update parent's userInput state directly and call submit in the same function
          // instead of using setTimeout which creates a race condition
          onUserInputChange(inputBuffer); 
          onInputSubmit(inputBuffer); // Pass inputBuffer directly to avoid race condition
          setInputBuffer("");
        }
      } else if (e.key === "Backspace") {
        setInputBuffer((prev) => prev.slice(0, -1));
      } else if (e.key.length === 1) {
        setInputBuffer((prev) => prev + e.key);
      }
    };

    const terminalElement = terminalRef.current;
    terminalElement?.addEventListener("keydown", handleKeyDown);

    return () => {
      terminalElement?.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRunning, inputBuffer, onInputSubmit, onUserInputChange]);

  // Render the terminal tab
  const renderTerminal = () => (
    <div
      className="panel-terminal"
      ref={terminalRef}
      tabIndex={0} // Make div focusable
      onClick={() => terminalRef.current?.focus()} // Focus when clicked
    >
      {terminalOutput.length > 0 ? (
        <>
          {terminalOutput.map((line, index) => {
            const typeClass =
              line.type === "warning"
                ? "terminal-warning"
                : line.type === "error"
                ? "terminal-error"
                : "terminal-output";

            return (
              <div key={index} className={`terminal-line ${typeClass}`}>
                {line.timestamp && (
                  <span className="terminal-timestamp">{line.timestamp} </span>
                )}
                {line.type === "command" && <span className="terminal-prompt">$</span>}
                {line.content}
              </div>
            );
          })}

          {isRunning && (
            <div className="terminal-line terminal-input-line">
              <span className="terminal-prompt">$</span> {inputBuffer}
              <span className="terminal-cursor"></span>
            </div>
          )}
        </>
      ) : (
        <div className="terminal-line">
          <span className="terminal-prompt">$</span>
          <span className="terminal-cursor"></span>
        </div>
      )}
    </div>
  );

  // Render other tabs
  const renderProblems = () => (
    <div className="panel-problems">
      <div className="panel-empty-message">No problems have been detected in the workspace.</div>
    </div>
  );

  const renderOutput = () => (
    <div className="panel-output">
      <div className="output-line">[Extension Host] Extension host started.</div>
      <div className="output-line">[Language Server] Language server started.</div>
      {activeRunningFile && (
        <div className="output-line">[Running] {activeRunningFile}</div>
      )}
    </div>
  );

  const renderDebugConsole = () => (
    <div className="panel-debug-console">
      <div className="debug-line">Debug session not yet started.</div>
      <div className="debug-line">Press F5 to start debugging.</div>
    </div>
  );

  const renderPorts = () => (
    <div className="panel-ports">
      <div className="ports-line">No forwarded ports detected.</div>
    </div>
  );

  const renderComments = () => (
    <div className="panel-comments">
      <div className="comments-line">No comments have been added to this workspace.</div>
    </div>
  );

  // Get content for the active tab
  const getTabContent = () => {
    switch (activeTab) {
      case "terminal":
        return renderTerminal();
      case "problems":
        return renderProblems();
      case "output":
        return renderOutput();
      case "debug":
        return renderDebugConsole();
      case "ports":
        return renderPorts();
      case "comments":
        return renderComments();
      default:
        return <div>Unknown tab</div>;
    }
  };

  return (
    <div className="panel" style={{ height: `${height}px` }}>
      <div className="panel-tabs">
        {["problems", "output", "debug", "terminal", "ports", "comments"].map((tab) => (
          <div
            key={tab}
            className={`panel-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            <span className="tab-name">{tab.toUpperCase()}</span>
          </div>
        ))}

        <div className="panel-actions">
          {/* <button className="panel-action-btn">
            <span className="current-terminal">node - frontend</span>
            <ChevronDown size={16} />
          </button>
          <button className="panel-action-btn">
            <Plus size={16} />
          </button>
          <button className="panel-action-btn">
            <Maximize2 size={16} />
          </button> */}
          <button className="panel-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="panel-content">{getTabContent()}</div>
    </div>
  );
};

export default Panel;