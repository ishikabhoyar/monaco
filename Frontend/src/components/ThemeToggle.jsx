import { useState, useEffect } from 'react';

const ThemeToggle = () => {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    // Check if there's a saved theme preference
    const savedTheme = localStorage.getItem('monaco_theme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    // Update the HTML class and CSS variables
    const root = document.documentElement;
    root.className = theme;
    
    // Save theme preference
    localStorage.setItem('monaco_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-md border border-gray-600 bg-gray-800 hover:bg-gray-700 transition-colors"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
    >
      {/* Sun Icon for Light Mode */}
      <svg
        className={`h-5 w-5 transition-all ${theme === 'dark' ? 'rotate-90 scale-0' : 'rotate-0 scale-100'}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>

      {/* Moon Icon for Dark Mode */}
      <svg
        className={`absolute top-2 left-2 h-5 w-5 transition-all ${theme === 'dark' ? 'rotate-0 scale-100' : 'rotate-90 scale-0'}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
};

export default ThemeToggle;