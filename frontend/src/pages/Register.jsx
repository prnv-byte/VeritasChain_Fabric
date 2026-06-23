import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { FormInput, FormSelect, FormTextarea } from '../components/Common/FormInputs';
import { GlassCard, LoadingSpinner, Toast } from '../components/Common/Common';
import { StepIndicator } from '../components/Common/StepIndicator';
import { getPasswordStrength } from '../utils/validation';

export default function Register() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [countdown, setCountdown] = useState(10);
  const [form, setForm] = useState({
    name: '', type: '', whatTheyMake: '', address: '', contact: '', email: '', password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [toast, setToast] = useState(null);

  const steps = ['Company Info', 'Contact Details', 'Auth Setup', 'Review'];

  const handleInputChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateStep = () => {
    const newErrors = {};
    if (currentStep === 0) {
      if (!form.name.trim()) newErrors.name = 'Organization name is required';
      if (!form.type) newErrors.type = 'Please select organization type';
      if (!form.whatTheyMake.trim()) newErrors.whatTheyMake = 'Please describe what you make/supply';
      if (!form.address.trim()) newErrors.address = 'Address is required';
      const cleanName = form.name.replace(/[^a-zA-Z0-9]/g, '');
      if (cleanName.length < 3) newErrors.name = 'Name must contain at least 3 alphanumeric characters';
    } else if (currentStep === 1) {
      if (!form.contact.trim()) newErrors.contact = 'Contact number is required';
      if (!form.email.trim()) newErrors.email = 'Email is required';
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email';
    } else if (currentStep === 2) {
      if (!form.password) newErrors.password = 'Password is required';
      if (form.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
      if (!form.confirmPassword) newErrors.confirmPassword = 'Confirm password is required';
      if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    } else if (currentStep === 3) {
      if (!agreed) newErrors.agreed = 'Please confirm to proceed';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep()) return;

    setLoading(true);
    try {
      const result = await api.registerOrg(form);
      if (result.error) {
        setToast({ message: result.error, type: 'error' });
      } else {
        setSuccess(result);
        setCountdown(10);
      }
    } catch (err) {
      setToast({ message: err.message || 'Registration failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!success) return;
    const interval = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [success]);

  useEffect(() => {
    if (success && countdown <= 0) {
      navigate('/login');
    }
  }, [countdown, success, navigate]);

  if (loading) {
    return (
      <div className="page-center">
        <GlassCard className="w-full max-w-md text-center">
          <div className="text-5xl mb-6">⚙️</div>
          <h2 className="text-2xl font-bold mb-3">Registering Your Organization</h2>
          <p className="text-slate-400 mb-6">
            <strong>{form.name}</strong> is being registered and your Fabric identity is being provisioned.
          </p>
          <div className="flex justify-center mb-6">
            <LoadingSpinner size="lg" />
          </div>
          <p className="text-slate-400 text-sm">This may take a few moments...</p>
        </GlassCard>
      </div>
    );
  }

  if (success) {
    return (
      <div className="page-center">
        <GlassCard className="w-full max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-green-400 mb-3">Registration Complete!</h2>
          <p className="text-slate-400 mb-6 leading-relaxed">
            <strong className="text-slate-100">{success.name}</strong> has been registered.
            <br />
            Your password is set and Fabric identity is being provisioned.
          </p>
          <div className="glass p-4 text-left mb-6 text-sm">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Provisioning Details</p>
            <p className="mb-2"><span className="text-slate-400">Organization ID: </span><code className="text-xs break-all">{success.orgId}</code></p>
            <p className="mb-2"><span className="text-slate-400">MSP ID: </span><code className="text-xs">{success.mspId}</code></p>
            <p><span className="text-slate-400">Status: </span><span className="badge-provisioning">{success.fabricStatus}</span></p>
          </div>
          <p className="text-slate-400 text-sm">
            Redirecting to login in {countdown} second{countdown !== 1 ? 's' : ''}...
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl w-full">
        <GlassCard className="w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-gradient">Register Organization</h1>
            <p className="text-slate-400 text-sm">Join the industrial blockchain marketplace</p>
          </div>

          <StepIndicator steps={steps} currentStep={currentStep} />

          <form onSubmit={(e) => {
            e.preventDefault();
            if (currentStep === steps.length - 1) handleSubmit(e);
            else handleNext();
          }} className="space-y-5">
            {/* Step 0: Company Info */}
            {currentStep === 0 && (
              <div className="space-y-4 animate-fade-in">
                <FormInput
                  label="Organization Name"
                  name="name"
                  value={form.name}
                  onChange={handleInputChange('name')}
                  placeholder="e.g. Tata Motors, Steel Corp Ltd"
                  error={errors.name}
                  required
                />
                <FormSelect
                  label="Organization Type"
                  name="type"
                  value={form.type}
                  onChange={handleInputChange('type')}
                  options={[
                    { value: 'manufacturer', label: 'Manufacturer' },
                    { value: 'supplier', label: 'Supplier' },
                  ]}
                  placeholder="Select type..."
                  error={errors.type}
                  required
                />
                <FormInput
                  label="What You Make / Supply"
                  name="whatTheyMake"
                  value={form.whatTheyMake}
                  onChange={handleInputChange('whatTheyMake')}
                  placeholder="e.g. EV batteries, Steel plates, Copper wire"
                  error={errors.whatTheyMake}
                  required
                />
                <FormInput
                  label="Address"
                  name="address"
                  value={form.address}
                  onChange={handleInputChange('address')}
                  placeholder="e.g. 123 Industrial Zone, Mumbai, MH"
                  error={errors.address}
                  required
                />
              </div>
            )}

            {/* Step 1: Contact Details */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-fade-in">
                <FormInput
                  label="Contact Number"
                  name="contact"
                  type="tel"
                  value={form.contact}
                  onChange={handleInputChange('contact')}
                  placeholder="e.g. +91-9876543210"
                  error={errors.contact}
                  required
                />
                <FormInput
                  label="Email Address"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleInputChange('email')}
                  placeholder="e.g. admin@company.com"
                  error={errors.email}
                  required
                />
              </div>
            )}

            {/* Step 2: Auth Setup */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <FormInput
                    label="Password"
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleInputChange('password')}
                    placeholder="At least 8 characters"
                    error={errors.password}
                    required
                  />
                  {form.password && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-400">Strength:</span>
                      <span className="text-xs font-semibold text-indigo-400">{getPasswordStrength(form.password)}</span>
                    </div>
                  )}
                </div>
                <FormInput
                  label="Confirm Password"
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleInputChange('confirmPassword')}
                  placeholder="Confirm your password"
                  error={errors.confirmPassword}
                  required
                />
              </div>
            )}

            {/* Step 3: Review */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="glass p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Organization Name:</span>
                    <span className="font-semibold">{form.name}</span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex justify-between">
                    <span className="text-slate-400">Type:</span>
                    <span className="font-semibold capitalize">{form.type}</span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex justify-between">
                    <span className="text-slate-400">Makes/Supplies:</span>
                    <span className="font-semibold">{form.whatTheyMake}</span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex justify-between">
                    <span className="text-slate-400">Contact:</span>
                    <span className="font-semibold">{form.contact}</span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="font-semibold">{form.email}</span>
                  </div>
                </div>

                <label className="flex items-start gap-3 p-4 glass rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      setErrors(prev => ({ ...prev, agreed: '' }));
                    }}
                    className="mt-1 w-5 h-5 rounded"
                  />
                  <span className="text-sm text-slate-300">
                    I confirm all information is correct and agree to the terms of service.
                  </span>
                </label>
                {errors.agreed && <span className="form-error">{errors.agreed}</span>}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-6 border-t border-white/10">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="btn-glass-secondary flex-1 py-2 font-semibold"
                >
                  Previous
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className={`${currentStep === steps.length - 1 ? 'flex-1' : 'flex-1'} btn-glass py-2 font-semibold flex items-center justify-center gap-2`}
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Registering...
                  </>
                ) : currentStep === steps.length - 1 ? (
                  'Create Account'
                ) : (
                  'Next'
                )}
              </button>
            </div>
          </form>

          <div className="border-t border-white/10 pt-4 mt-4 text-center">
            <p className="text-slate-400 text-sm">
              Already have an account?{' '}
              <a href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold">
                Login here
              </a>
            </p>
          </div>
        </GlassCard>
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
