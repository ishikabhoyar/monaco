import React, { useState, useEffect, useRef } from 'react';
import Editor from "@monaco-editor/react";
import { Play, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const CodeChallenge = () => {
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [activeQuestion, setActiveQuestion] = useState("Q.1");
  const [language, setLanguage] = useState("JavaScript");
  const [code, setCode] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [autoSelected, setAutoSelected] = useState(true);
  const [activeSocket, setActiveSocket] = useState(null);
  const [submissionId, setSubmissionId] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const socketRef = useRef(null);
  const { token } = useAuth();
  const navigate = useNavigate();

  // Load test data from localStorage
  useEffect(() => {
    const testData = localStorage.getItem('currentTest');
    if (testData) {
      try {
        const parsedData = JSON.parse(testData);
        setTest(parsedData);
        if (parsedData.questions && parsedData.questions.length > 0) {
          setQuestions(parsedData.questions);
          // Set initial code from first question
          const firstQuestion = parsedData.questions[0];
          setLanguage(firstQuestion.programming_language || 'JavaScript');
          setCode(firstQuestion.code_template || getDefaultTemplate(firstQuestion.programming_language || 'JavaScript'));
        }
      } catch (error) {
        console.error('Error loading test data:', error);
      }
    } else {
      // No test data, redirect back to tests
      navigate('/tests');
    }
  }, [navigate]);

  // Timer countdown
  useEffect(() => {
    if (!test || !test.end_time) return;

    const updateTimer = () => {
      const now = new Date();
      const endTime = new Date(test.end_time);
      const diff = endTime - now;

      if (diff <= 0) {
        setTimeRemaining('Time Up!');
        // Optionally auto-submit or redirect
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer(); // Initial call
    const timerId = setInterval(updateTimer, 1000);

    return () => clearInterval(timerId);
  }, [test]);

  // Get default code template for a language
  const getDefaultTemplate = (lang) => {
    const templates = {
      'JavaScript': '// Write your code here\n',
      'Python': '# Write your code here\n',
      'Java': 'public class Solution {\n  public static void main(String[] args) {\n    // Write your code here\n  }\n}',
      'C++': '#include <iostream>\nusing namespace std;\n\nint main() {\n  // Write your code here\n  return 0;\n}',
      'C': '#include <stdio.h>\n\nint main() {\n  // Write your code here\n  return 0;\n}'
    };
    return templates[lang] || '// Write your code here\n';
  };
  
  // Map question index to Q.1, Q.2, Q.3 format
  const getQuestionIndex = (questionKey) => {
    const index = parseInt(questionKey.replace('Q.', '')) - 1;
    return index;
  };

  // Get current question based on activeQuestion
  const getCurrentQuestion = () => {
    const index = getQuestionIndex(activeQuestion);
    return questions[index] || null;
  };
  
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
    const currentQuestion = getCurrentQuestion();
    if (currentQuestion) {
      // Check if there's a saved submission for this question
      const savedSubmission = localStorage.getItem(`submission_${test?.id}_${currentQuestion.id}`);
      if (savedSubmission) {
        try {
          const submission = JSON.parse(savedSubmission);
          setCode(submission.code);
          setLanguage(currentQuestion.programming_language || 'JavaScript');
          setTerminalOutput([
            { type: 'system', content: `Loaded your previous submission from ${new Date(submission.timestamp).toLocaleString()}` }
          ]);
        } catch (error) {
          console.error('Error loading saved submission:', error);
          setLanguage(currentQuestion.programming_language || 'JavaScript');
          setCode(currentQuestion.code_template || getDefaultTemplate(currentQuestion.programming_language || 'JavaScript'));
        }
      } else {
        setLanguage(currentQuestion.programming_language || 'JavaScript');
        setCode(currentQuestion.code_template || getDefaultTemplate(currentQuestion.programming_language || 'JavaScript'));
        setTerminalOutput([]);
      }
    } else if (problems[activeQuestion]) {
      // Fallback to example problems if no real test data
      setCode(getStarterCode(problems[activeQuestion], language));
      setTerminalOutput([]);
    }
  }, [activeQuestion]);
  
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
      const currentQuestion = getCurrentQuestion();
      setTerminalOutput([
        { type: 'system', content: `Running ${currentQuestion?.title || problems[activeQuestion]?.id || 'code'}...` }
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
    const currentQuestion = getCurrentQuestion();
    setTerminalOutput([
      { type: 'system', content: `Submitting solution for ${currentQuestion?.title || problems[activeQuestion]?.id || 'problem'}...` }
    ]);
    
    try {
      // If we have real test data, submit to faculty backend
      if (currentQuestion && test) {
        const apiUrl = import.meta.env.VITE_FACULTY_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${apiUrl}/students/submissions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            testId: test.id,
            answers: [{
              questionId: currentQuestion.id,
              submittedAnswer: code
            }]
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setTerminalOutput(prev => [
            ...prev,
            { type: 'system', content: '✓ Submission successful!' },
            { type: 'output', content: `Your answer has been submitted for Question ${getQuestionIndex(activeQuestion) + 1}` },
            { type: 'output', content: `Test: ${test.title}` },
            { type: 'system', content: 'You can modify and resubmit your answer anytime before the test ends.' }
          ]);
          
          // Store submission locally
          localStorage.setItem(`submission_${test.id}_${currentQuestion.id}`, JSON.stringify({
            code,
            timestamp: new Date().toISOString()
          }));
        } else {
          throw new Error(data.message || 'Submission failed');
        }
        
        setIsRunning(false);
        return;
      }
      
      // If no test data, show error
      throw new Error('No test data available. Please start a test from the test list.');
      
    } catch (error) {
      console.error('Error submitting solution:', error);
      setTerminalOutput(prev => [
        ...prev,
        { type: 'error', content: `Error: ${error.message}` }
      ]);
      setIsRunning(false);
    }
  };

  // Handle final test submission
  const handleSubmitTest = async () => {
    if (!test) {
      alert('No test data available.');
      return;
    }

    const confirmSubmit = window.confirm(
      'Are you sure you want to submit the entire test? You will not be able to make any changes after submission.'
    );

    if (!confirmSubmit) return;

    try {
      // Save the current question's answer before submitting
      const currentQuestion = getCurrentQuestion();
      if (currentQuestion && code.trim()) {
        const apiUrl = import.meta.env.VITE_FACULTY_API_URL || 'http://localhost:5000/api';
        try {
          const saveResponse = await fetch(`${apiUrl}/students/submissions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              testId: test.id,
              answers: [{
                questionId: currentQuestion.id,
                submittedAnswer: code
              }]
            }),
          });
          
          if (saveResponse.ok) {
            console.log('Current answer saved successfully');
          }
        } catch (err) {
          console.warn('Failed to save current answer:', err);
        }
      }
      
      // For now, just mark test as completed locally and redirect
      // TODO: Implement backend endpoint for test submission
      alert('Test submitted successfully! You will be redirected to the test list.');
      
      // Mark test as submitted locally
      localStorage.setItem(`test_${test.id}_submitted`, JSON.stringify({
        submittedAt: new Date().toISOString(),
        testId: test.id
      }));
      
      // Clear test data
      localStorage.removeItem('currentTest');
      
      // Redirect to tests page
      navigate('/tests');
      
    } catch (error) {
      console.error('Error submitting test:', error);
      alert(`Error submitting test: ${error.message}`);
    }
  };

  // Render the current problem
  const renderProblem = () => {
    const currentQuestion = getCurrentQuestion();
    
    // If we have real test question, use it
    if (currentQuestion) {
      return (
        <div className="problem-container">
          <div className="problem-description">
            <p>{currentQuestion.question_text || currentQuestion.description}</p>
            {currentQuestion.constraints && <p><strong>Constraints:</strong> {currentQuestion.constraints}</p>}
            {currentQuestion.marks && <p><strong>Points:</strong> {currentQuestion.marks}</p>}
          </div>
          
          {currentQuestion.test_cases && currentQuestion.test_cases.length > 0 && (
            <div className="test-cases-section">
              <h3>Example Test Cases:</h3>
              {currentQuestion.test_cases.slice(0, 2).map((testCase, idx) => (
                <div key={idx} className="test-case-card">
                  <div className="test-case-label">Example {idx + 1}</div>
                  <div className="test-case-content">
                    <div className="test-case-item">
                      <span className="test-label">Input:</span>
                      <code className="test-value">{testCase.input}</code>
                    </div>
                    <div className="test-case-item">
                      <span className="test-label">Expected Output:</span>
                      <code className="test-value">{testCase.expected_output}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    // Fallback to example problems
    const problem = problems[activeQuestion];
    if (!problem) return null;

    return (
      <div className="problem-container">
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
        <div className="header-left">
          <div className="header-icon">📝</div>
          <h1>{test?.title || 'CS101: Midterm Examination'}</h1>
        </div>
        <div className="header-right">
          <span className="saved-indicator">All changes saved ✓</span>
          <button className="submit-test-btn" onClick={handleSubmitTest}>Submit Test</button>
          {/* <div className="user-profile">
            <div className="user-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
          </div> */}
        </div>
      </header>
      
      <div className="code-challenge-body">
        {/* Left Sidebar */}
        <div className="left-sidebar">
          {/* Time Remaining */}
          <div className="time-remaining-widget">
            <h3>Time Remaining</h3>
            <div className="timer-value">
              {timeRemaining && timeRemaining !== 'Time Up!' ? (
                <>
                  <div className="time-unit">
                    <span className="time-block">{timeRemaining.split(':')[0]}</span>
                    <span className="time-label">Hours</span>
                  </div>
                  <div className="time-unit">
                    <span className="time-block">{timeRemaining.split(':')[1]}</span>
                    <span className="time-label">Minutes</span>
                  </div>
                  <div className="time-unit">
                    <span className="time-block">{timeRemaining.split(':')[2]}</span>
                    <span className="time-label">Seconds</span>
                  </div>
                </>
              ) : timeRemaining === 'Time Up!' ? (
                <span className="time-up">{timeRemaining}</span>
              ) : (
                <>
                  <div className="time-unit">
                    <span className="time-block">00</span>
                    <span className="time-label">Hours</span>
                  </div>
                  <div className="time-unit">
                    <span className="time-block">00</span>
                    <span className="time-label">Minutes</span>
                  </div>
                  <div className="time-unit">
                    <span className="time-block">00</span>
                    <span className="time-label">Seconds</span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Question Palette */}
          <div className="question-palette-widget">
            <h3>Question Palette</h3>
            <div className="question-palette-grid">
              {(questions.length > 0 ? questions : Array.from({length: 20}, (_, i) => i + 1)).map((q, idx) => {
                const questionKey = `Q.${idx + 1}`;
                const questionNum = idx + 1;
                return (
                  <button 
                    key={questionKey}
                    className={`question-palette-btn ${activeQuestion === questionKey ? "palette-active" : ""}`}
                    onClick={() => setActiveQuestion(questionKey)}
                    disabled={questions.length > 0 && idx >= questions.length}
                  >
                    {questionNum}
                  </button>
                );
              })}
            </div>
            <div className="palette-legend">
              <div className="legend-item">
                <div className="legend-dot legend-current"></div>
                <span>Current</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot legend-answered"></div>
                <span>Answered</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot legend-skipped"></div>
                <span>Skipped</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot legend-marked"></div>
                <span>Marked for Review</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot legend-not-visited"></div>
                <span>Not Visited</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content Area */}
        <div className="main-content-area">
          {/* Top Section: Question text above editor */}
          <div className="top-section">
            <div className="content-wrapper">
              {/* Question Text Bar */}
              <div className="question-bar">
                <div className="question-header">
                  <h2>Question {activeQuestion.replace('Q.', '')} of {questions.length || 20}</h2>
                </div>
                <div className="question-text">
                  {renderProblem()}
                </div>
              </div>
              
              {/* Code Editor */}
              <div className="editor-section-wrapper">
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
                    <button className="reset-code-btn">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                      </svg>
                      Reset Code
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
          </div>
          
          {/* Bottom Section: Console/Testcases */}
          <div className="bottom-section">
            <div className="console-section">
              <div className="console-header">
                <div className="console-tabs">
                  <button className="console-tab console-tab-active">
                    <span>Console</span>
                  </button>
                  <button className="console-tab">
                    <span>Testcases</span>
                  </button>
                </div>
              </div>
              <div className="console-content">
                {terminalOutput.length === 0 ? (
                  <div className="console-placeholder">
                    Console output will appear here...
                  </div>
                ) : (
                  terminalOutput.map((line, index) => (
                    <div 
                      key={index} 
                      className={`console-line ${line.type}`}
                    >
                      {line.content}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
          {/* Action Buttons at Bottom Right */}
          <div className="action-bar">
            <button 
              className="action-bar-btn action-run"
              onClick={runCode}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <span className="loading-spinner"></span>
                  Running...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Run Code
                </>
              )}
            </button>
            <button className="action-bar-btn action-save">
              Save & Next
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14"/>
                <path d="m12 5 7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeChallenge;
