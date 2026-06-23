import React from 'react';
import { motion } from 'framer-motion';

export function GlassmorphicCard({ children, className = '', hoverable = false, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={hoverable ? { y: -5 } : undefined}
      onClick={onClick}
      className={`
        glass-card 
        ${hoverable ? 'cursor-pointer transition-all duration-300' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}

export function GlassmorphicButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3 text-base',
  };

  return (
    <motion.button
      whileHover={!disabled && !loading ? { scale: 1.02 } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.98 } : undefined}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        glass-button ${variant} ${sizeClasses[size]}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          {children}
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}

export function GlassmorphicInput({
  type = 'text',
  placeholder = '',
  value,
  onChange,
  disabled = false,
  error = false,
  errorMessage = '',
  className = '',
  ...props
}) {
  return (
    <div className="w-full">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`
          glass-input w-full
          ${error ? 'border-red-500 bg-red-500/5' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
        {...props}
      />
      {error && errorMessage && (
        <p className="text-red-400 text-sm mt-1">{errorMessage}</p>
      )}
    </div>
  );
}

export function GlassmorphicTextarea({
  placeholder = '',
  value,
  onChange,
  disabled = false,
  error = false,
  errorMessage = '',
  className = '',
  rows = 4,
  ...props
}) {
  return (
    <div className="w-full">
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        rows={rows}
        className={`
          glass-textarea w-full
          ${error ? 'border-red-500 bg-red-500/5' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
        {...props}
      />
      {error && errorMessage && (
        <p className="text-red-400 text-sm mt-1">{errorMessage}</p>
      )}
    </div>
  );
}

export function GlassmorphicSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  disabled = false,
  error = false,
  errorMessage = '',
  className = '',
  ...props
}) {
  return (
    <div className="w-full">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`
          glass-select w-full
          ${error ? 'border-red-500 bg-red-500/5' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && errorMessage && (
        <p className="text-red-400 text-sm mt-1">{errorMessage}</p>
      )}
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full"
      />
    </div>
  );
}
