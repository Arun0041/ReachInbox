import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Clock, Send, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { slackApi } from '../../api/slack';
import { getErrorMessage } from '../../api/client';

export function AppLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [slackConnected, setSlackConnected] = useState(false);

  useEffect(() => {
    slackApi
      .status()
      .then((s) => setSlackConnected(s.connected))
      .catch(() => setSlackConnected(false));
  }, []);

  const handleLogout = (): void => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleSlack = async (): Promise<void> => {
    try {
      const authUrl = await slackApi.connect();
      window.location.href = authUrl;
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-[260px] flex-shrink-0 flex flex-col border-r border-gray-100 bg-white">
        {/* Brand */}
        <div className="h-16 flex items-center px-6">
          <div className="text-2xl font-extrabold tracking-tighter">ONE</div>
        </div>
        
        {/* User Profile */}
        <div className="px-4 mb-4">
          <div className="bg-[#f6f7fb] rounded-xl p-2.5 flex items-center gap-3 cursor-pointer relative group">
            {user?.avatar_url ? (
              <img className="w-9 h-9 rounded-full object-cover" src={user.avatar_url} alt="avatar" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-semibold">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{user?.name || 'User'}</div>
              <div className="text-xs text-gray-500 truncate">{user?.email || 'user@example.com'}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
            
            {/* Dropdown Menu (Hover) */}
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-100 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={handleSlack}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
              >
                Slack {slackConnected && <span className="text-green-500 text-xs">Connected</span>}
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg"
              >
                Log out
              </button>
            </div>
          </div>
        </div>

        {/* Compose Button */}
        <div className="px-4 mb-8">
          <NavLink
            to="/dashboard"
            end
            className="flex items-center justify-center w-full py-2.5 border-2 border-[#00b05b] text-[#00b05b] font-medium rounded-full hover:bg-green-50 transition-colors"
          >
            Compose
          </NavLink>
        </div>

        {/* Navigation */}
        <div className="px-4 flex-1">
          <div className="text-xs font-semibold text-gray-400 mb-3 px-2 tracking-wider">CORE</div>
          <nav className="space-y-1">
            <NavLink
              to="/dashboard/scheduled"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-[#e8f5e9] text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <Clock className="w-4 h-4" />
              <span className="flex-1">Scheduled</span>
            </NavLink>
            <NavLink
              to="/dashboard/sent"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-[#e8f5e9] text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <Send className="w-4 h-4" />
              <span className="flex-1">Sent</span>
            </NavLink>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-white flex flex-col min-w-0">
        <Outlet />
      </main>
    </div>
  );
}