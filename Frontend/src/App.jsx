import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import TestList from './components/TestList';
import CodeChallenge from "./components/CodeChallenge.jsx";
import Header from './components/Header';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import "./index.css";

function App() {
  // Google OAuth Client ID - in production, this should be in environment variables
  const GOOGLE_CLIENT_ID = "586378657128-smg8t52eqbji66c3eg967f70hsr54q5r.apps.googleusercontent.com";

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route 
                path="/tests" 
                element={
                  <ProtectedRoute>
                    <TestList />
                    <Footer />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/editor" 
                element={
                  <ProtectedRoute>
                    <CodeChallenge />
                    <Footer />
                  </ProtectedRoute>
                } 
              />
              <Route path="/" element={<Navigate to="/tests" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App

