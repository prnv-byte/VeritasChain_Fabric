export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password) {
  return password.length >= 8;
}

export function getPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  return ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][strength] || 'Weak';
}

export function validateRequired(value) {
  return value && value.trim().length > 0;
}

export const validators = {
  email: (v) => validateEmail(v) ? '' : 'Invalid email address',
  password: (v) => validatePassword(v) ? '' : 'Password must be at least 8 characters',
  required: (v, label = 'This field') => validateRequired(v) ? '' : `${label} is required`,
  match: (v1, v2, label = 'Values') => v1 === v2 ? '' : `${label} do not match`,
};
