import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { to: '/dashboard', end: true, label: 'Compose' },
  { to: '/dashboard/scheduled', end: false, label: 'Scheduled' },
  { to: '/dashboard/sent', end: false, label: 'Sent' },
];

export function AppLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = (): void => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header__brand">
          <span className="header__logo">✉</span>
          <span>ReachInbox</span>
        </div>
        <nav className="tabs" aria-label="Task navigation">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `tab ${isActive ? 'tab--active' : ''}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <div className="header__user">
          <span className="header__name">{user?.name || 'User'}</span>
          <button className="btn btn--ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}