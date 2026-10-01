import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState(null); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setStatus('error');
      setMessage('Password must be at least 6 characters.');
      return;
    }

    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch(`/api/auth/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Password reset successfully!');
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setStatus('error');
        setMessage(data.message || 'Reset failed. The link may have expired.');
      }
    } catch {
      setStatus('error');
      setMessage('Connection error. Please try again.');
    }
  };

  // Strength checker
  const getStrength = (pwd) => {
    if (!pwd) return { label: '', color: '', width: '0%' };
    if (pwd.length < 6) return { label: 'Too short', color: 'bg-red-500', width: '20%' };
    if (pwd.length < 8) return { label: 'Weak', color: 'bg-orange-500', width: '40%' };
    if (!/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) return { label: 'Fair', color: 'bg-yellow-400', width: '65%' };
    if (pwd.length >= 10) return { label: 'Strong', color: 'bg-emerald-500', width: '100%' };
    return { label: 'Good', color: 'bg-indigo-400', width: '80%' };
  };
  const strength = getStrength(password);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] relative overflow-hidden">
      <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-700 rounded-full mix-blend-multiply filter blur-xl opacity-30"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-700 rounded-full mix-blend-multiply filter blur-xl opacity-30"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-700 rounded-full mix-blend-multiply filter blur-xl opacity-20"></div>

      <div className="w-full max-w-md z-10">
        <div className="glass-card">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-indigo-500/30">
              🔑
            </div>
            <h1 className="text-3xl font-bold mb-2">
              <span className="text-gradient">Reset Password</span>
            </h1>
            <p className="text-slate-400 text-sm">Choose a strong new password for your account.</p>
          </div>

          {status === 'success' ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-3xl mx-auto">
                🎉
              </div>
              <p className="text-emerald-400 font-semibold">{message}</p>
              <p className="text-slate-500 text-xs">Redirecting you to login...</p>
              <Link to="/login" className="inline-block text-indigo-400 hover:text-indigo-300 text-sm font-medium">
                Go to Login →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full glass-input"
                  placeholder="Minimum 6 characters"
                  required
                />
                {password && (
                  <div className="mt-2">
                    <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: strength.width }}
                      />
                    </div>
                    <p className={`text-xs mt-1 font-medium ${strength.color.replace('bg-', 'text-')}`}>
                      {strength.label}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full glass-input"
                  placeholder="Re-enter your new password"
                  required
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
                )}
                {confirmPassword && password === confirmPassword && password.length >= 6 && (
                  <p className="text-xs text-emerald-400 mt-1">✓ Passwords match</p>
                )}
              </div>

              {status === 'error' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full btn-gradient disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'loading' ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Resetting...
                  </>
                ) : (
                  'Reset Password 🔒'
                )}
              </button>

              <p className="text-center text-slate-400 text-sm">
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                  ← Back to Login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;