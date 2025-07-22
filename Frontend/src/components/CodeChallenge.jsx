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
      'c': 'c',
      'go': 'golang'
    };
    return languageMap[uiLanguage.toLowerCase()] || uiLanguage.toLowerCase();
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
    // Default JavaScript starter code is in the problem object
    if (lang === 'JavaScript') {
      return problem.starterCode;
    }
    
    // Language-specific starter code templates
    const templates = {
      'C': `#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

// ${problem.title} solution

int main() {
  // Write your solution here
  
  return 0;
}`,
      'Go': `package main

import (
  "fmt"
)

// ${problem.title} solution
func main() {
  // Write your solution here
  
}`,
      'Python': `# ${problem.title}
def solution():
  # Write your solution here
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

  // Connect to WebSocket
  const connectToWebSocket = (id) => {
    // Close existing connection if any
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }

    const wsUrl = `ws://localhost:8080/api/ws/terminal/${id}`;
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('WebSocket connection established');
      setActiveSocket(socket);
    };
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WebSocket message received:', message);
        
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
            if (typeof message.content === 'object') {
              statusText = `Status: ${message.content.status}`;
            } else {
              statusText = `Status: ${message.content}`;
            }
            
            setTerminalOutput(prev => [
              ...prev,
              { type: 'system', content: statusText }
            ]);
            
            // If status contains "completed" or "failed", stop running
            if ((typeof message.content === 'string' && 
                (message.content.includes('completed') || message.content.includes('failed'))) ||
                (message.content.status && 
                (message.content.status.includes('completed') || message.content.status.includes('failed')))) {
              setIsRunning(false);
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
            setIsRunning(false);
            break;
          
          case 'system':
            setTerminalOutput(prev => [
              ...prev,
              { type: 'system', content: String(message.content) }
            ]);
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
      setIsRunning(false);
    };
    
    socket.onclose = () => {
      console.log('WebSocket connection closed');
      setActiveSocket(null);
    };
    
    socketRef.current = socket;
    return socket;
  };
  
  // Handle code execution
  const runCode = async () => {
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
          input: '',  // Add input if needed
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
      setIsRunning(false);
    }
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

  return (
    <div className="code-challenge-container">
      <header className="code-challenge-header">
        <h1>OnScreen Test</h1>
        <button className="sign-in-btn">Sign In</button>
      </header>
      
      <div className="code-challenge-problem-nav">
        <h3 className="problem-number">1. {problems["Q.1"].title}</h3>
      </div>
      
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
                <option value="Go">Go</option>
              </select>
              
              <button 
                className={`auto-btn ${autoSelected ? 'auto-selected' : ''}`}
                onClick={() => setAutoSelected(!autoSelected)}
              >
                Auto
              </button>
            </div>
            
            <div className="editor-actions">
              <button 
                className="run-btn"
                onClick={runCode}
                disabled={isRunning}
              >
                <Play size={16} /> Run
              </button>
              
              <button 
                className="submit-btn"
                onClick={submitCode}
                disabled={isRunning}
              >
                <Send size={16} /> Submit
              </button>
            </div>
          </div>
          
          <div className="editor-container">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              language={language.toLowerCase() === 'go' ? 'go' : language.toLowerCase()}
              value={code}
              onChange={(value) => setCode(value)}
              theme="vs-dark"
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
          <div className="terminal-controls">
            <button className="terminal-btn">⊞</button>
            <button className="terminal-btn">□</button>
            <button className="terminal-btn">✕</button>
          </div>
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
              onKeyPress={(e) => {
                if (e.key === 'Enter' && activeSocket) {
                  const input = e.target.value;
                  // Send input to WebSocket with the correct format
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
