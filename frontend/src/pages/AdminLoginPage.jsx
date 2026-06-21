import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock } from 'lucide-react';
import { CenteredLayout } from '../components/Layout';
import {
  GlassmorphicCard,
  GlassmorphicInput,
  GlassmorphicButton,
} from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';

export function AdminLoginPage() {
  const [adminKey, setAdminKey] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { error, success } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!adminKey.trim()) {
      error('Please enter the admin key');
      return;
    }

    setLoading(true);

    // Admin key validation is done on the backend via Authorization header
    // For now, just store and navigate
    try {
      localStorage.setItem('vc_admin_key', adminKey);
      success('Admin authentication successful!');
      navigate('/admin-dashboard');
    } catch (err) {
      error('Authentication failed');
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
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
            </motion.div>
            <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
            <p className="text-white/70 text-sm">VeritasChain Platform Management</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Admin Key
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-white/50" />
                <GlassmorphicInput
                  type="password"
                  placeholder="Enter admin authentication key"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
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
              Access Admin Panel
            </GlassmorphicButton>
          </form>

          <div className="mt-6 pt-6 border-t border-white/20">
            <p className="text-white/70 text-sm text-center">
              Not an admin?{' '}
              <Link to="/login" className="text-blue-300 hover:text-blue-200 font-semibold">
                Login as Organization
              </Link>
            </p>
          </div>

          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-400/30 rounded-lg">
            <p className="text-amber-200 text-xs">
              <strong>⚠️ Restricted Access:</strong> This area is only for authorized
              administrators.
            </p>
          </div>
        </GlassmorphicCard>
      </motion.div>
    </CenteredLayout>
  );
}
