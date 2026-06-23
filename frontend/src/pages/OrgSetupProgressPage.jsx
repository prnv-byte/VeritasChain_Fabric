import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { CenteredLayout } from '../components/Layout';
import {
  GlassmorphicCard,
  GlassmorphicButton,
  LoadingSpinner,
} from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { orgService } from '../services/api';

export function OrgSetupProgressPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error } = useToast();

  const orgId = location.state?.orgId;
  const orgData = location.state || {};

  const [countdown, setCountdown] = useState(120);
  const [orgStatus, setOrgStatus] = useState('registering');
  const [mspId, setMspId] = useState(orgData.mspId || '');
  const [name, setName] = useState(orgData.name || '');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Auto-check status every 3 seconds
  useEffect(() => {
    if (!orgId) {
      error('Organization ID not found');
      navigate('/register');
      return;
    }

    const checkStatus = async () => {
      try {
        const response = await orgService.checkStatus(orgId);
        setOrgStatus(response.data.fabricStatus);
        setMspId(response.data.mspId);
        setName(response.data.name);
        setLastUpdated(new Date());

        if (response.data.fabricStatus === 'active') {
          success('Organization created successfully!');
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        }
      } catch (err) {
        console.error('Status check failed:', err);
      }
    };

    // Check immediately
    checkStatus();

    // Then check every 3 seconds
    const intervalId = setInterval(checkStatus, 3000);

    return () => clearInterval(intervalId);
  }, [orgId, navigate, success, error]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const handleManualRefresh = async () => {
    try {
      const response = await orgService.checkStatus(orgId);
      setOrgStatus(response.data.fabricStatus);
      setMspId(response.data.mspId);
      setName(response.data.name);
      setLastUpdated(new Date());
      success('Status updated');
    } catch (err) {
      error('Failed to update status');
    }
  };

  const getStatusColor = () => {
    switch (orgStatus) {
      case 'active':
        return 'from-green-400 to-green-500';
      case 'failed':
        return 'from-red-400 to-red-500';
      default:
        return 'from-blue-400 to-purple-500';
    }
  };

  const getStatusIcon = () => {
    if (orgStatus === 'active') {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center"
        >
          <span className="text-3xl">✓</span>
        </motion.div>
      );
    }

    if (orgStatus === 'failed') {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-red-500 flex items-center justify-center"
        >
          <span className="text-3xl">✕</span>
        </motion.div>
      );
    }

    return <LoadingSpinner />;
  };

  return (
    <CenteredLayout>
      <GlassmorphicCard className="elevated">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-block mb-6"
          >
            {getStatusIcon()}
          </motion.div>

          <h1 className="text-3xl font-bold text-white mb-2">
            {orgStatus === 'active'
              ? 'Organization Created!'
              : orgStatus === 'failed'
                ? 'Setup Failed'
                : 'Setting Up Organization'}
          </h1>

          <p className="text-white/70 mb-6">
            {orgStatus === 'active'
              ? 'Your organization is ready. Redirecting to login...'
              : orgStatus === 'failed'
                ? 'Unfortunately, the setup process failed. Please try registering again.'
                : 'Your organization is being set up on the blockchain network.'}
          </p>
        </div>

        {/* Organization Info */}
        <div className="space-y-3 mb-8">
          <InfoBox label="Organization Name" value={name} />
          <InfoBox label="MSP ID" value={mspId} isMono />
          <InfoBox label="Status" value={orgStatus.toUpperCase()} />
        </div>

        {/* Countdown */}
        {orgStatus === 'registering' && (
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-center mb-8"
          >
            <div className={`inline-block text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${getStatusColor()}`}>
              {countdown}s
            </div>
            <p className="text-white/70 text-sm mt-2">Estimated time remaining</p>
          </motion.div>
        )}

        {/* Last Updated */}
        <div className="text-center text-white/60 text-xs mb-6">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>

        {/* Manual Refresh */}
        <GlassmorphicButton
          onClick={handleManualRefresh}
          variant="secondary"
          className="w-full mb-4"
        >
          <RefreshCw className="w-4 h-4 inline mr-2" />
          Refresh Status
        </GlassmorphicButton>

        {/* Actions */}
        {orgStatus === 'active' && (
          <GlassmorphicButton
            onClick={() => navigate('/login')}
            className="w-full"
          >
            Go to Login
          </GlassmorphicButton>
        )}

        {orgStatus === 'failed' && (
          <GlassmorphicButton
            onClick={() => navigate('/register')}
            className="w-full"
          >
            Try Again
          </GlassmorphicButton>
        )}

        {/* Help Text */}
        <div className="mt-8 p-4 bg-blue-500/10 border border-blue-400/30 rounded-lg">
          <p className="text-blue-200 text-xs leading-relaxed">
            <strong>Note:</strong> Organization setup typically takes 1-2 minutes. This page
            automatically checks for updates every 3 seconds. You can also manually refresh to
            check the status at any time.
          </p>
        </div>
      </GlassmorphicCard>
    </CenteredLayout>
  );
}

function InfoBox({ label, value, isMono = false }) {
  return (
    <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
      <p className="text-white/70 text-xs uppercase mb-1">{label}</p>
      <p className={`text-white text-sm break-words ${isMono ? 'font-mono' : ''}`}>
        {value || 'Loading...'}
      </p>
    </div>
  );
}
