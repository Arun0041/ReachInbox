import { useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function AuthCallbackPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('outbox_token', token);
      window.history.replaceState({}, document.title, '/auth/callback');
    }
    void refresh().finally(() => navigate('/dashboard', { replace: true }));
  }, [location.search, refresh, navigate]);

  return <Navigate to="/dashboard" replace />;
}