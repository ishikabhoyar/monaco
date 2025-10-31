import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on app load
  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const savedUser = localStorage.getItem('monaco_user');
        const savedToken = localStorage.getItem('monaco_token');
        if (savedUser && savedToken) {
          setUser(JSON.parse(savedUser));
          setToken(savedToken);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        localStorage.removeItem('monaco_user');
        localStorage.removeItem('monaco_token');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (email, googleToken, userInfo = null) => {
    // For Google OAuth login
    if (googleToken && userInfo) {
      // Exchange Google token for our JWT
      const API_URL = import.meta.env.VITE_FACULTY_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/students/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${googleToken}`
        },
        body: JSON.stringify({
          email: email,
          name: userInfo.name || email.split('@')[0]
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Login failed');
      }

      const userData = {
        id: userInfo.sub || Date.now(),
        email: email,
        name: userInfo.name || email.split('@')[0],
        picture: userInfo.picture || null,
        loginTime: new Date().toISOString(),
        token: data.token // Store the JWT instead of Google token
      };

      setUser(userData);
      localStorage.setItem('monaco_user', JSON.stringify(userData));
      localStorage.setItem('monaco_token', userData.token);
      setToken(userData.token);
      return true;
    }
    
    // Fallback for demo purposes (though we're moving to Google-only)
    if (email && email.includes('@')) {
      const userData = {
        id: Date.now(),
        email: email,
        name: email.split('@')[0],
        loginTime: new Date().toISOString()
      };

      setUser(userData);
      localStorage.setItem('monaco_user', JSON.stringify(userData));
      localStorage.setItem('monaco_token', 'demo_token');
      return true;
    }
    
    return false;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('monaco_user');
    localStorage.removeItem('monaco_token');
  };

  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!user,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};