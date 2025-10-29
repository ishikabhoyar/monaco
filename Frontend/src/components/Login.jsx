import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';

const Login = () => {
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { login } = useAuth();

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('monaco_token');
    if (token) {
      navigate('/tests');
    }
  }, [navigate]);

  const handleLoginSuccess = async (credentialResponse) => {
    console.log('Google login success:', credentialResponse);
    
    if (credentialResponse.credential) {
      try {
        console.log('Processing Google credential...');
        
        // For demo purposes, we'll decode the JWT token to get user info
        // In a real app, you would send this to your backend for verification
        const base64Url = credentialResponse.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const userInfo = JSON.parse(jsonPayload);
        console.log('User info:', userInfo);
        
        const success = await login(userInfo.email, credentialResponse.credential, userInfo);
        
        if (success) {
          navigate('/tests');
        } else {
          throw new Error('Authentication failed');
        }
      } catch (error) {
        console.error('Error during login:', error);
        setError(`Authentication failed: ${error.message || 'Please try again.'}`);
      }
    } else {
      console.error('No credential received from Google');
      setError('No credential received from Google. Please try again.');
    }
  };

  const handleLoginError = () => {
    console.error('Google login failed - checking network and configuration...');
    
    // Check if we're online
    if (!navigator.onLine) {
      setError('You appear to be offline. Please check your internet connection and try again.');
      return;
    }
    
    // Check if Google Identity Services script loaded
    if (typeof window !== 'undefined' && !window.google) {
      console.error('Google Identity Services script not loaded');
      setError('Google authentication service is not available. Please refresh the page and try again.');
      return;
    }
    
    setError('Google login failed. This might be due to network connectivity issues, browser compatibility, or Google account configuration. Please try again or contact support if the problem persists.');
  };

  return (
    <div className="login-container">
      {/* Theme Toggle - Top Right */}
      <div className="theme-toggle">
        <ThemeToggle />
      </div>

      {/* Left Side - Background Image */}
      <div className="login-left">
        <img
          src="/BG-login(2).jpg"
          alt="Login Background"
          className="login-bg-image"
        />
      </div>

      {/* Right Side - Login Form */}
      <div className="login-right">
        <div className="login-form-container">
          {/* Logos */}
          <div className="login-logos">
            <img 
              src="/Vidyavihar@3x.png" 
              alt="KJSCE" 
              className="login-logo" 
            />
            <img 
              src="/kjsce2x.png" 
              alt="Somaiya Vidyavihar" 
              className="login-logo" 
            />
          </div>

          {/* Title */}
          <h1 className="login-title">
            Welcome To Monaco Editor
          </h1>
          <p className="login-subtitle">
            Please sign in with your Google account to continue.
          </p>

          {/* Error Display */}
          {error && (
            <div className="login-error">
              <p style={{ fontSize: '0.875rem', margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Google Login Button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={handleLoginError}
              useOneTap
            />
          </div>

          <div className="login-footer">
            <p className="login-footer-text">
              Need help?{' '}
              <button className="login-footer-link">
                Contact admin
              </button>
            </p>
          </div>

          <div className="login-demo-note">
            <p className="login-demo-text">
              Sign in with your Google account to access the Monaco Editor
            </p>
          </div>

          {/* Trust Logo */}
          <div className="login-trust-logo">
            <img
              src="/Bottom.png"
              alt="Somaiya Trust"
              className="trust-logo-img"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;