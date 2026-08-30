import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';

const GOOGLE_AUTH_URL = (import.meta.env.VITE_API_URL || '/api') + '/auth/google';

export function LoginPage(): JSX.Element {
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      addToast('Welcome back!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = (): void => {
    window.location.href = GOOGLE_AUTH_URL;
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] border border-gray-100 rounded-xl p-10 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8 tracking-tight">Login</h1>

        <button
          onClick={handleGoogle}
          type="button"
          className="w-full flex items-center justify-center gap-3 bg-[#e8f5e9] text-gray-800 py-2.5 rounded-md font-medium text-sm transition-colors hover:bg-[#c8e6c9]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Login with Google
        </button>

        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-x-0 h-px bg-gray-100"></div>
          <span className="relative bg-white px-4 text-sm text-gray-400">or sign up through email</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email ID"
              autoComplete="email"
              required
              className="w-full bg-[#f8f9fa] border-none text-sm text-gray-900 rounded-md px-4 py-3 focus:ring-1 focus:ring-gray-200 outline-none placeholder:text-gray-400"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
              className="w-full bg-[#f8f9fa] border-none text-sm text-gray-900 rounded-md px-4 py-3 focus:ring-1 focus:ring-gray-200 outline-none placeholder:text-gray-400"
            />
          </div>
          
          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00b05b] hover:bg-[#009b50] text-white font-medium py-3 rounded-md transition-colors flex justify-center items-center mt-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
            ) : (
              'Login'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}