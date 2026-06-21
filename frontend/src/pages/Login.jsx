import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FormInput } from '../components/Common/FormInputs';
import { GlassCard, LoadingSpinner, Toast } from '../components/Common/Common';

export default function Login() {
  const navigate = useNavigate();
  const { login, loading, isAuthenticated } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!identifier) newErrors.identifier = 'Email or Organization ID is required';
    if (!password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await login(identifier, password);
      setToast({ message: 'Login successful!', type: 'success' });
      setTimeout(() => navigate('/dashboard'), 500);
    } catch (err) {
      setToast({ message: err.message || 'Login failed', type: 'error' });
    }
  };

  return (
    <div className="login-shell">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full">
        <GlassCard className="login-card">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2 text-gradient">VeritasChain</h1>
            <p className="text-slate-400 text-sm">Enterprise Blockchain Supply Chain</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Email or Organization ID"
              name="identifier"
              type="text"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setErrors({ ...errors, identifier: '' });
              }}
              placeholder="your@email.com or org-id"
              error={errors.identifier}
              disabled={loading}
              required
            />

            <FormInput
              label="Password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors({ ...errors, password: '' });
              }}
              placeholder="••••••••"
              error={errors.password}
              disabled={loading}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-glass flex items-center justify-center gap-2 py-3 font-semibold text-lg"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="border-t border-white/10 pt-4 mt-4 text-center">
            <p className="text-slate-400 text-sm">
              Don't have an account?{' '}
              <a href="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold">
                Register here
              </a>
            </p>
          </div>
        </GlassCard>

        <div className="mt-6 text-center text-slate-500 text-xs">
          <p>Demo credentials available on registration</p>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
