import React, { useState, useEffect, useRef } from 'react';
import Editor from "@monaco-editor/react";
import { Play, Send } from 'lucide-react';

const CodeChallenge = () => {
  const [activeQuestion, setActiveQuestion] = useState("Q.1");
  const [language, setLanguage] = useState("JavaScript");
  const [code, setCode] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [autoSelected, setAutoSelected] = useState(true);
  const [activeSocket, setActiveSocket] = useState(null);
  const [submissionId, setSubmissionId] = useState(null);
  const socketRef = useRef(null);
  
  // Map frontend language names to backend language identifiers
  const getLanguageIdentifier = (uiLanguage) => {
    const languageMap = {
      'javascript': 'javascript',
      'python': 'python',
      'java': 'java',
      'c++': 'cpp',
      'c': 'c'
    };
    // Important: make sure we convert to lowercase to match the backend's expected format
    return languageMap[uiLanguage.toLowerCase()] || uiLanguage.toLowerCase();
  };
  
  // Reset execution state to allow rerunning
  const resetExecutionState = () => {
    setIsRunning(false);
    
    // Properly close the socket if it exists and is open
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      socketRef.current = null;
    }
    
    // Ensure activeSocket is also nullified
    setActiveSocket(null);
    
    console.log('Execution state reset, buttons should be enabled');
  };

  // Example problem data
  const problems = {
    "Q.1": {
      id: "two-sum",
      title: "Two Sum",
      description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
      constraints: "You may assume that each input would have exactly one solution, and you may not use the same element twice.",
      examples: [
        {
          input: "nums = [2,7,11,15], target = 9",
          output: "[0,1]",
          explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
        },
        {
          input: "nums = [3,2,4], target = 6",
          output: "[1,2]"
        },
        {
          input: "nums = [3,3], target = 6",
          output: "[0,1]"
        }
      ],
      starterCode: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var twoSum = function(nums, target) {
  // Write your solution here
  
};`
    },
    "Q.2": {
      id: "palindrome-number",
      title: "Palindrome Number",
      description: "Given an integer x, return true if x is a palindrome, and false otherwise.",
      examples: [
        {
          input: "x = 121",
          output: "true"
        },
        {
          input: "x = -121",
          output: "false",
          explanation: "From left to right, it reads -121. From right to left, it reads 121-. Therefore it is not a palindrome."
        }
      ],
      starterCode: `/**
 * @param {number} x
 * @return {boolean}
 */
var isPalindrome = function(x) {
  // Write your solution here
  
};`
    },
    "Q.3": {
      id: "valid-parentheses",
      title: "Valid Parentheses",
      description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
      constraints: "An input string is valid if: Open brackets must be closed by the same type of brackets. Open brackets must be closed in the correct order.",
      examples: [
        {
          input: 's = "()"',
          output: "true"
        },
        {
          input: 's = "()[]{}"',
          output: "true"
        },
        {
          input: 's = "(]"',
          output: "false"
        }
      ],
      starterCode: `/**
 * @param {string} s
 * @return {boolean}
 */
var isValid = function(s) {
  // Write your solution here
  
};`
    }
  };

  // Get appropriate starter code based on language
  const getStarterCode = (problem, lang) => {
    // Language-specific starter code templates
    const templates = {
      'JavaScript': problem.starterCode,
      'C': `#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

// ${problem.title} solution

int main() {
  // Write your solution here
  
  return 0;
}`,
      'Python': `# ${problem.title}
def solution():
  # Write your solution here
  # Use input() for user input in Python
  # Example: name = input("Enter your name: ")
  pass

if __name__ == "__main__":
  solution()`,
      'Java': `public class Solution {
  // ${problem.title}
  public static void main(String[] args) {
    // Write your solution here
    
  }
}`,
      'C++': `#include <iostream>
#include <vector>
using namespace std;

// ${problem.title} solution
int main() {
  // Write your solution here
  
  return 0;
}`
    };
    
    return templates[lang] || problem.starterCode;
  };

  // Set initial code based on active problem
  useEffect(() => {
    if (problems[activeQuestion]) {
      setCode(getStarterCode(problems[activeQuestion], language));
    }
  }, [activeQuestion, language]);
  
  // Cleanup WebSocket connection on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);
  
  // Set a safety timeout to ensure buttons are re-enabled if execution hangs
  useEffect(() => {
    let safetyTimer = null;
    
    if (isRunning) {
      // If execution is running for more than 30 seconds, reset state
      safetyTimer = setTimeout(() => {
        console.log('Safety timeout reached, re-enabling buttons');
        resetExecutionState();
      }, 30000);
    }
    
    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [isRunning]);

  // Connect to WebSocket
  const connectToWebSocket = (id) => {
    console.log('Connecting to WebSocket with ID:', id);
    
    // Force close any existing connections
    if (socketRef.current) {
      console.log('Closing existing socket, state:', socketRef.current.readyState);
      socketRef.current.onclose = null; // Remove existing handler to avoid conflicts
      socketRef.current.onerror = null;
      socketRef.current.onmessage = null;
      
      if (socketRef.current.readyState !== WebSocket.CLOSED) {
        socketRef.current.close();
      }
      socketRef.current = null;
    }
    
    if (activeSocket) {
      console.log('Clearing active socket reference');
      setActiveSocket(null);
    }

    console.log('Creating new WebSocket connection');
    const wsUrl = `ws://localhost:8080/api/ws/terminal/${id}`;
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('WebSocket connection established');
      setActiveSocket(socket);
    };
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WebSocket message received:', message, 'Current isRunning state:', isRunning);
        
        switch (message.type) {
          case 'output':
            // Handle output message based on the format seen in the screenshot
            setTerminalOutput(prev => [
              ...prev,
              { 
                type: message.content.isError ? 'error' : 'output', 
                content: message.content.text 
              }
            ]);
            break;
            
          case 'input_prompt':
            // Handle input prompt message (e.g., "Enter your name:")
            setTerminalOutput(prev => [
              ...prev,
              { type: 'output', content: message.content }
            ]);
            break;
          
          case 'status':
            let statusText = '';
            let statusValue = '';
            
            if (typeof message.content === 'object') {
              statusText = `Status: ${message.content.status}`;
              statusValue = message.content.status;
            } else {
              statusText = `Status: ${message.content}`;
              statusValue = message.content;
            }
            
            setTerminalOutput(prev => [
              ...prev,
              { type: 'system', content: statusText }
            ]);
            
            // If status contains "completed" or "failed", stop running
            if (statusValue.includes('completed') || statusValue.includes('failed')) {
              console.log('Execution completed or failed, stopping');
              setTimeout(() => {
                setIsRunning(false);
              }, 500); // Small delay to ensure UI updates properly
            }
            break;
          
          case 'error':
            let errorContent = '';
            if (typeof message.content === 'object' && message.content.message) {
              errorContent = message.content.message;
            } else {
              errorContent = String(message.content);
            }
            
            setTerminalOutput(prev => [
              ...prev,
              { type: 'error', content: errorContent }
            ]);
            
            console.log('Error received, enabling buttons');
            setTimeout(() => {
              setIsRunning(false);
            }, 500); // Small delay to ensure UI updates properly
            break;
          
          case 'system':
            const systemContent = String(message.content);
            setTerminalOutput(prev => [
              ...prev,
              { type: 'system', content: systemContent }
            ]);
            
            // Check for connection closing message which indicates execution is complete
            if (systemContent.includes('Connection will close') || 
                systemContent.includes('completed successfully') ||
                systemContent.includes('Execution completed')) {
              console.log('System message indicates completion, enabling buttons');
              setTimeout(() => {
                setIsRunning(false);
              }, 500);
            }
            break;
            
          default:
            // Handle any other message types or direct string content
            console.log('Unknown message type:', message);
            if (typeof message === 'object') {
              setTerminalOutput(prev => [
                ...prev,
                { type: 'output', content: JSON.stringify(message) }
              ]);
            }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setTerminalOutput(prev => [
        ...prev,
        { type: 'error', content: 'WebSocket connection error' }
      ]);
      
      console.log('WebSocket error, enabling buttons');
      setTimeout(() => {
        setIsRunning(false);
      }, 500); // Small delay to ensure UI updates properly
    };
    
    socket.onclose = () => {
      console.log('WebSocket connection closed');
      setActiveSocket(null);
      
      // Ensure buttons are re-enabled when the connection closes
      setTimeout(() => {
        resetExecutionState();
      }, 100);
    };
    
    // Set the socket reference early to ensure we can clean it up if needed
    socketRef.current = socket;
    return socket;
  };
  
  // Handle code execution
  const runCode = async () => {
    console.log('Run button clicked, current state:', { 
      isRunning, 
      socketState: activeSocket ? activeSocket.readyState : 'no socket',
      socketRefState: socketRef.current ? socketRef.current.readyState : 'no socket ref'
    });

    // First make sure previous connections are fully closed
    resetExecutionState();
    
    // Increase the delay to ensure clean state before starting new execution
    setTimeout(async () => {
      // Double-check socket state before proceeding
      if (activeSocket || socketRef.current) {
        console.warn('Socket still exists after reset, forcing cleanup');
        if (activeSocket && activeSocket.readyState !== WebSocket.CLOSED) {
          activeSocket.close();
        }
        if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
          socketRef.current.close();
        }
        socketRef.current = null;
        setActiveSocket(null);
        
        // Extra delay to ensure socket is fully closed
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setIsRunning(true);
      setTerminalOutput([
        { type: 'system', content: `Running ${problems[activeQuestion].id}...` }
      ]);
      
      try {
        // Submit code to the backend
        const response = await fetch('http://localhost:8080/api/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: code,
            language: getLanguageIdentifier(language),
            input: '',
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }
        
        const data = await response.json();
        setSubmissionId(data.id);
        
        // Connect to WebSocket for real-time updates
        connectToWebSocket(data.id);
        
      } catch (error) {
        console.error('Error submitting code:', error);
        setTerminalOutput(prev => [
          ...prev,
          { type: 'error', content: `Error: ${error.message}` }
        ]);
        
        resetExecutionState();
      }
    }, 200); // Increased delay to ensure clean state
  };

  // Handle code submission
  const submitCode = async () => {
    setIsRunning(true);
    setTerminalOutput([
      { type: 'system', content: `Submitting solution for ${problems[activeQuestion].id}...` }
    ]);
    
    try {
      // Submit code to the backend
      const response = await fetch('http://localhost:8080/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          language: getLanguageIdentifier(language),
          input: '',
          problemId: problems[activeQuestion].id
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSubmissionId(data.id);
      
      // Connect to WebSocket for real-time updates
      connectToWebSocket(data.id);
      
    } catch (error) {
      console.error('Error submitting solution:', error);
      setTerminalOutput(prev => [
        ...prev,
        { type: 'error', content: `Error: ${error.message}` }
      ]);
      setIsRunning(false);
    }
  };

  // Render the current problem
  const renderProblem = () => {
    const problem = problems[activeQuestion];
    if (!problem) return null;

    return (
      <div className="problem-container">
        <h1>{problem.title}</h1>
        
        <div className="problem-description">
          <p>{problem.description}</p>
          {problem.constraints && <p>{problem.constraints}</p>}
        </div>
        
        {/* Test cases section removed */}
      </div>
    );
  };

  // Add this useEffect to monitor socket state
  useEffect(() => {
    // If we have an active socket but aren't running, we should clean up
    if (activeSocket && !isRunning) {
      console.log('Cleaning up inactive socket');
      if (activeSocket.readyState === WebSocket.OPEN) {
        activeSocket.close();
      }
      setActiveSocket(null);
    }
  }, [activeSocket, isRunning]);

  return (
    <div className="code-challenge-container">
      <header className="code-challenge-header">
        <h1>OnScreen Test</h1>
        <button className="sign-in-btn">Sign In</button>
      </header>
      
      {/* <div className="code-challenge-problem-nav">
        <h3 className="problem-number">1. {problems["Q.1"].title}</h3>
      </div> */}
      
      <div className="code-challenge-main">
        <div className="problem-tabs">
          <button 
            className={activeQuestion === "Q.1" ? "tab-active" : ""} 
            onClick={() => setActiveQuestion("Q.1")}
          >
            Q.1
          </button>
          <button 
            className={activeQuestion === "Q.2" ? "tab-active" : ""} 
            onClick={() => setActiveQuestion("Q.2")}
          >
            Q.2
          </button>
          <button 
            className={activeQuestion === "Q.3" ? "tab-active" : ""} 
            onClick={() => setActiveQuestion("Q.3")}
          >
            Q.3
          </button>
        </div>
        
        <div className="problem-content">
          {renderProblem()}
        </div>
        
        <div className="editor-section">
          <div className="editor-header">
            <div className="editor-controls">
              <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)}
                className="language-selector"
              >
                <option value="JavaScript">JavaScript</option>
                <option value="Python">Python</option>
                <option value="Java">Java</option>
                <option value="C++">C++</option>
                <option value="C">C</option>
              </select>
              
              
            </div>
            
            <div className="editor-actions">
              <button 
                className="run-btn"
                onClick={runCode}
                disabled={isRunning}
                title={isRunning ? "Code execution in progress..." : "Run code"}
              >
                {isRunning ? (
                  <>
                    <span className="loading-spinner"></span> Running...
                  </>
                ) : (
                  <>
                    <Play size={16} /> Run
                  </>
                )}
              </button>
              
              <button 
                className="submit-btn"
                onClick={submitCode}
                disabled={isRunning}
                title={isRunning ? "Code execution in progress..." : "Submit solution"}
              >
                {isRunning ? (
                  <>
                    <span className="loading-spinner"></span> Submitting...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Submit
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="editor-container">
            <Editor
              height="100%"
              defaultLanguage="python"
              language={language.toLowerCase() === 'c++' ? 'cpp' : language.toLowerCase()}
              value={code}
              onChange={(value) => setCode(value)}
              theme="hc-black"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </div>
      </div>
      
      <div className="terminal-section">
        <div className="terminal-header">
          <span>Terminal</span>
          {/* <div className="terminal-controls">
            <button className="terminal-btn">⊞</button>
            <button className="terminal-btn">□</button>
            <button className="terminal-btn">✕</button>
          </div> */}
        </div>
        <div className="terminal-content">
          {terminalOutput.map((line, index) => (
            <div 
              key={index} 
              className={`terminal-line ${line.type}`}
            >
              {line.content}
            </div>
          ))}
          <div className="terminal-prompt">
            <span className="prompt-symbol">$</span>
            <input 
              type="text" 
              className="terminal-input" 
              placeholder="Type here..."
              disabled={!isRunning}
              // Update the ref callback
              ref={(inputEl) => {
                // Auto-focus input when isRunning changes to true
                if (inputEl && isRunning) {
                  inputEl.focus();
                  // Clear any previous input
                  inputEl.value = '';
                }
              }}
              onKeyDown={(e) => { // Change from onKeyPress to onKeyDown for better cross-browser support
                if (e.key === 'Enter') {
                  e.preventDefault(); // Prevent default to avoid form submissions
                  const input = e.target.value.trim();
                  
                  if (!input) return; // Skip empty input
                  
                  if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
                    try {
                      // Send input to server
                      activeSocket.send(JSON.stringify({
                        "type": "input",
                        "content": input
                      }));
                      
                      // Add input to terminal output
                      setTerminalOutput(prev => [
                        ...prev,
                        { type: 'system', content: `$ ${input}` }
                      ]);
                      
                      // Clear the input field
                      e.target.value = '';
                    } catch (error) {
                      console.error("Error sending input:", error);
                      setTerminalOutput(prev => [
                        ...prev,
                        { type: 'error', content: `Failed to send input: ${error.message}` }
                      ]);
                    }
                  } else {
                    // Better error message with socket state information
                    const socketState = activeSocket ? 
                      ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][activeSocket.readyState] : 
                      'NO_SOCKET';
                      
                    console.log(`Cannot send input: Socket state is ${socketState}`);
                    setTerminalOutput(prev => [
                      ...prev,
                      { type: 'error', content: `Cannot send input: connection not available (${socketState})` }
                    ]);
                  }
                }
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && activeSocket && activeSocket.readyState === WebSocket.OPEN) {
                  const input = e.target.value;
                  // Send input to WebSocket with the correct format
                  try {
                    activeSocket.send(JSON.stringify({
                      "type": "input",
                      "content": input
                    }));
                    
                    // Add input to terminal output
                    setTerminalOutput(prev => [
                      ...prev,
                      { type: 'system', content: `$ ${input}` }
                    ]);
                    
                    // Clear the input field
                    e.target.value = '';
                  } catch (error) {
                    console.error("Error sending input:", error);
                    setTerminalOutput(prev => [
                      ...prev,
                      { type: 'error', content: `Failed to send input: ${error.message}` }
                    ]);
                  }
                } else if (e.key === 'Enter') {
                  // Inform user if socket isn't available
                  if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) {
                    setTerminalOutput(prev => [
                      ...prev,
                      { type: 'error', content: `Cannot send input: connection closed` }
                    ]);
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeChallenge;
