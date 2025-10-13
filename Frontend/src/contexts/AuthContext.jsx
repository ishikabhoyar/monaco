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
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on app load
  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const savedUser = localStorage.getItem('monaco_user');
        const savedToken = localStorage.getItem('monaco_token');
        if (savedUser && savedToken) {
          setUser(JSON.parse(savedUser));
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
    try {
      // For Google OAuth login
      if (googleToken && userInfo) {
        const userData = {
          id: userInfo.sub || Date.now(),
          email: email,
          name: userInfo.name || email.split('@')[0],
          picture: userInfo.picture || null,
          loginTime: new Date().toISOString(),
          googleToken: googleToken
        };

        setUser(userData);
        localStorage.setItem('monaco_user', JSON.stringify(userData));
        localStorage.setItem('monaco_token', googleToken);
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
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('monaco_user');
    localStorage.removeItem('monaco_token');
  };

  const value = {
    user,
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