const API_URL = import.meta.env.VITE_FACULTY_API_URL || 'http://localhost:5000/api';

export const studentApi = {
  async getTests() {
    const response = await fetch(`${API_URL}/students/tests`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('monaco_token')}`
      }
    });
    return await response.json();
  },

  async getTestQuestions(testId) {
    const response = await fetch(`${API_URL}/students/tests/${testId}/questions`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('monaco_token')}`
      }
    });
    return await response.json();
  },

  async verifyTestPassword(testId, password) {
    const response = await fetch(`${API_URL}/students/tests/${testId}/verify-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('monaco_token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });
    return await response.json();
  },

  async submitAnswer(testId, questionId, code) {
    const response = await fetch(`${API_URL}/students/submissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('monaco_token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        testId,
        answers: [{
          questionId,
          submittedAnswer: code
        }]
      })
    });
    return await response.json();
  }
};