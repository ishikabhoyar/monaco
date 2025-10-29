import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './TestList.css';

const TestList = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [password, setPassword] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const navigate = useNavigate();
  const { token } = useAuth();

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      console.log('Fetching tests with token:', token?.substring(0, 50) + '...');
      const response = await fetch('http://localhost:5000/api/students/tests', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('monaco_user');
          localStorage.removeItem('monaco_token');
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        console.log('Tests received:', data.tests);
        data.tests.forEach(test => {
          console.log(`Test: ${test.title}, Status: ${test.status}, Start: ${test.start_time}, End: ${test.end_time}`);
        });
        setTests(data.tests);
      } else {
        setError(data.message || 'Failed to fetch tests');
      }
    } catch (error) {
      setError('Failed to fetch tests');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = async (test) => {
    try {
      const response = await fetch(`http://localhost:5000/api/students/tests/${test.id}/questions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('currentTest', JSON.stringify({
          id: test.id,
          questions: data.questions,
          currentQuestionIndex: 0
        }));
        navigate('/editor');
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Failed to start test');
      console.error('Error:', error);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!selectedTest || !password) return;

    try {
      const response = await fetch(`http://localhost:5000/api/students/tests/${selectedTest.id}/verify-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (data.success) {
        setShowPasswordModal(false);
        setPassword('');
        handleStartTest(selectedTest);
      } else {
        setError('Invalid password');
      }
    } catch (error) {
      setError('Failed to verify password');
      console.error('Error:', error);
    }
  };

  const handleTestClick = (test) => {
    if (test.password_required) {
      setSelectedTest(test);
      setShowPasswordModal(true);
    } else {
      handleStartTest(test);
    }
  };

  const filteredTests = tests.filter(test => {
    if (filterStatus === 'all') return true;
    return test.status.toLowerCase() === filterStatus.toLowerCase();
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner"></div>
          <p className="loading-text">Loading tests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-box">
          <div className="error-content">
            <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="error-title">Error</h3>
              <p className="error-message">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="test-list-container">
      {/* Header Section */}
      <div className="test-list-header">
        <div className="header-content">
          <div>
            <h1 className="header-title">
              📝 Available Tests
            </h1>
            <p className="header-subtitle">
              Select a test to start your coding challenge
            </p>
          </div>
          
          {/* Filter Tabs */}
          <div className="filter-tabs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`filter-tab ${filterStatus === 'all' ? 'active' : ''}`}
            >
              All Tests
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`filter-tab ${filterStatus === 'active' ? 'active' : ''}`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterStatus('upcoming')}
              className={`filter-tab ${filterStatus === 'upcoming' ? 'active' : ''}`}
            >
              Upcoming
            </button>
          </div>
        </div>
      </div>

      {/* Tests Grid */}
      <div className="test-list-content">
        {filteredTests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="empty-title">No tests available</h3>
            <p className="empty-message">Check back later for new tests</p>
          </div>
        ) : (
          <div className="tests-grid">
            {filteredTests.map(test => (
              <div key={test.id} className="test-card">
                {/* Status Badge */}
                <div className="test-card-stripe"></div>
                
                <div className="test-card-content">
                  {/* Header */}
                  <div className="test-card-header">
                    <h2 className="test-title">
                      {test.title}
                    </h2>
                    <span className={`status-badge status-${test.status?.toLowerCase() || 'closed'}`}>
                      <span className="status-dot"></span>
                      {test.status}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="test-description">
                    {test.description || 'No description available'}
                  </p>

                  {/* Test Details */}
                  <div className="test-details">
                    <div className="test-detail">
                      <svg className="test-detail-icon icon-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span><strong>{test.duration_minutes}</strong> minutes</span>
                    </div>
                    
                    {test.total_questions && (
                      <div className="test-detail">
                        <svg className="test-detail-icon icon-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span><strong>{test.total_questions}</strong> questions</span>
                      </div>
                    )}

                    {test.password_required && (
                      <div className="test-detail icon-amber">
                        <svg className="test-detail-icon icon-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span><strong>Password required</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleTestClick(test)}
                    disabled={test.status !== 'Active'}
                    className={`test-button ${
                      test.status === 'Active' ? 'test-button-active' : 'test-button-disabled'
                    }`}
                  >
                    {test.status === 'Active' ? (
                      <>
                        <span>Start Test</span>
                        <svg style={{width: '1.25rem', height: '1.25rem'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    ) : (
                      <>
                        <svg style={{width: '1.25rem', height: '1.25rem'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>Not Available</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            {/* Modal Header */}
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="modal-title">Protected Test</h2>
                  <p className="modal-subtitle">Enter password to continue</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              <label className="modal-label">
                Test Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                className="modal-input"
                placeholder="Enter password"
                autoFocus
              />
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                  setError(null);
                }}
                className="modal-button modal-button-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={!password}
                className="modal-button modal-button-submit"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestList;