import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import CodeChallenge from "./components/CodeChallenge.jsx";
import Header from './components/Header';
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
                path="/editor" 
                element={
                  <ProtectedRoute>
                    {/* <Header /> */}
                    <CodeChallenge />
                    <footer className="footer-bar fixed bottom-0 left-0 right-0 border-t border-slate-200/40 dark:border-gray-800/20 bg-black">
                      <div className="flex items-center justify-center h-7">
                        <span className="text-xs text-slate-400 dark:text-gray-400 flex items-center">
                          Copyright © 2025. Made with
                          ♡ by Ishika and Arnab.
                        </span>
                      </div>
                    </footer>
                  </ProtectedRoute>
                } 
              />
              <Route path="/" element={<Navigate to="/editor" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App

