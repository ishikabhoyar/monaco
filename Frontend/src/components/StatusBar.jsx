import React from "react";

const StatusBar = ({ togglePanel, panelVisible }) => {
  return (
    <div className="status-bar">
      {/* Left Section of the Status Bar */}
      <div className="status-bar-left">
        {/* Branch Indicator */}
        <div className="status-item">
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
            aria-label="Branch Icon"
          >
            <line x1="6" y1="3" x2="6" y2="15"></line>
            <circle cx="18" cy="6" r="3"></circle>
            <circle cx="6" cy="18" r="3"></circle>
            <path d="M18 9a9 9 0 0 1-9 9"></path>
          </svg>
          <span>main</span>
        </div>

        {/* Error Indicator */}
        <div className="status-item">
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
            aria-label="Error Icon"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>0 errors</span>
        </div>

        {/* Warning Indicator */}
        <div className="status-item">
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
            aria-label="Warning Icon"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>0 warnings</span>
        </div>

        {/* Toggle Terminal Button */}
        <button
          className="status-item status-button"
          onClick={togglePanel}
          aria-label="Toggle Terminal"
        >
          <span>{panelVisible ? "Hide Terminal" : "Show Terminal"}</span>
        </button>
      </div>

      {/* Right Section of the Status Bar */}
      <div className="status-bar-right">
        {/* Line and Column Indicator */}
        <div className="status-item">
          <span>Ln 1, Col 1</span>
        </div>

        {/* Spaces Indicator */}
        <div className="status-item">
          <span>Spaces: 2</span>
        </div>

        {/* Encoding Indicator */}
        <div className="status-item">
          <span>UTF-8</span>
        </div>

        {/* Language Mode */}
        <div className="status-item">
          <span>JavaScript</span>
        </div>

        {/* EOL (End of Line) Indicator */}
        <div className="status-item">
          <span>LF</span>
        </div>

        {/* Connection Status */}
        <div className="status-item">
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
            aria-label="Connection Icon"
          >
            <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
            <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
            <line x1="12" y1="20" x2="12.01" y2="20"></line>
          </svg>
          <span>Connected</span>
        </div>

        {/* Bell Icon */}
        <div className="status-item">
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
            aria-label="Bell Icon"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;