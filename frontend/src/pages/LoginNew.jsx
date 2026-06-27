import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock } from 'lucide-react';
import { CenteredLayout } from '../components/Layout';
import {
  GlassmorphicCard,
  GlassmorphicInput,
  GlassmorphicButton,
} from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { authService } from '../services/api';

export function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { error, success } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!identifier || !password) {
      error('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.login(identifier, password);
      const user = response.data;

      localStorage.setItem('user', JSON.stringify(user));
      success('Login successful!');
      
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from);
    } catch (err) {
      error(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenteredLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <GlassmorphicCard className="elevated">
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="inline-block mb-4"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">VC</span>
              </div>
            </motion.div>
            <h1 className="text-3xl font-bold text-white mb-2">VeritasChain</h1>
            <p className="text-white/70 text-sm">Supply Chain Transparency Platform</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Email or Username
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-white/50" />
                <GlassmorphicInput
                  type="text"
                  placeholder="Enter your email or username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-white/50" />
                <GlassmorphicInput
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pl-10"
                />
              </div>
            </div>

            <GlassmorphicButton
              type="submit"
              disabled={loading}
              loading={loading}
              size="lg"
              className="w-full"
            >
              Login
            </GlassmorphicButton>
          </form>

          <div className="mt-6 pt-6 border-t border-white/20">
            <p className="text-white/70 text-sm text-center">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-300 hover:text-blue-200 font-semibold">
                Register here
              </Link>
            </p>
          </div>

        </GlassmorphicCard>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="mt-6 text-center"
        >
          <Link to="/admin-login" className="text-white/40 hover:text-white/60 text-xs tracking-wide">
            Admin access →
          </Link>
        </motion.div>
      </motion.div>
    </CenteredLayout>
  );
}
