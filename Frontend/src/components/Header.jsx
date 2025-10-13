import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-white font-bold text-lg">Monaco Editor</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        {user?.picture && (
          <img
            src={user.picture}
            alt="Profile"
            className="w-8 h-8 rounded-full"
          />
        )}
        <span className="text-gray-300 text-sm">
          Welcome, {user?.name || user?.email}
        </span>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded transition-colors duration-200"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;