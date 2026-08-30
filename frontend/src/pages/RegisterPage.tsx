import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';

export function RegisterPage(): JSX.Element {
  const { register } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(name, email, password);
      addToast('Account created. Welcome!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] border border-gray-100 rounded-xl p-10 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8 tracking-tight">Create Account</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              autoComplete="name"
              required
              className="w-full bg-[#f8f9fa] border-none text-sm text-gray-900 rounded-md px-4 py-3 focus:ring-1 focus:ring-gray-200 outline-none placeholder:text-gray-400"
            />
          </div>
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
              autoComplete="new-password"
              minLength={6}
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
              'Sign up'
            )}
          </button>
        </form>
        
        <p className="text-center mt-6 text-sm text-gray-500">
          Already have an account? <Link to="/login" className="text-[#00b05b] font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}