import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const CATEGORY_COLORS = {
  Food: 'bg-orange-500/20 text-orange-400',
  Shopping: 'bg-pink-500/20 text-pink-400',
  Transport: 'bg-blue-500/20 text-blue-400',
  Entertainment: 'bg-purple-500/20 text-purple-400',
  Health: 'bg-emerald-500/20 text-emerald-400',
  Education: 'bg-cyan-500/20 text-cyan-400',
  Bills: 'bg-yellow-500/20 text-yellow-400',
  Other: 'bg-slate-500/20 text-slate-400',
};

const CATEGORY_ICONS = {
  Food: '🍔', Shopping: '🛍️', Transport: '🚗',
  Entertainment: '🎬', Health: '💊', Education: '📚',
  Bills: '📄', Other: '📦',
};

const Expenses = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'User' };
  const token = localStorage.getItem('token');

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [confirmDelete, setConfirmDelete] = useState(null); // id to confirm

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/expenses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setExpenses(data);
      else if (res.status === 401) navigate('/login');
    } catch (err) {
      console.error('Failed to load expenses:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, []);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setExpenses(prev => prev.filter(e => e._id !== id));
        showToast('Expense deleted!');
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to delete', 'error');
      }
    } catch {
      showToast('Error deleting expense', 'error');
    }
    setDeletingId(null);
    setConfirmDelete(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const realExpenses = expenses.filter(e => e.type !== 'income');

  const filtered = filterCategory === 'All'
    ? realExpenses
    : realExpenses.filter(e => e.category === filterCategory);

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex">
      {/* Sidebar */}
      <div className="w-64 glass border-r border-slate-800/50 p-6 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="mb-10 text-2xl font-bold text-gradient">FinTrack AI</div>
          <div className="flex items-center space-x-3 p-3 bg-slate-900/60 rounded-2xl border border-slate-850 mb-6">
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-extrabold text-white text-sm shadow-md">
                {user.name ? user.name.substring(0, 2).toUpperCase() : 'ME'}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0B0F19] rounded-full animate-pulse" title="Online Client"></span>
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                {user.name || 'Meenakshi'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Premium Master Tier
              </div>
            </div>
          </div>
          <nav className="space-y-1">
            <Link to="/dashboard" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>📊</span><span>Dashboard</span>
            </Link>
            <Link to="/expenses" className="flex items-center space-x-3 text-indigo-400 font-medium p-2.5 bg-slate-800/50 rounded-xl">
              <span>💸</span><span>Expenses</span>
            </Link>
            <Link to="/budgets" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>🎯</span><span>Budgets</span>
            </Link>
            <Link to="/analytics" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>📈</span><span>Analytics</span>
            </Link>
            <Link to="/ai-assistant" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>🤖</span><span>AI Assistant</span>
            </Link>
            <Link to="/reports" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>📋</span><span>Reports</span>
            </Link>
            <Link to="/subscriptions" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>🔁</span><span>Subscriptions</span>
            </Link>
            <Link to="/notifications" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>🔔</span><span>Notifications</span>
            </Link>
            <Link to="/settings" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>⚙️</span><span>Settings</span>
            </Link>
            <Link to="/help-center" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>❓</span><span>Help Center</span>
            </Link>
            <a href="#" className="flex items-center space-x-3 text-red-400 hover:text-red-300 p-2.5 hover:bg-red-900/20 rounded-xl transition-all"
              onClick={e => { e.preventDefault(); handleLogout(); }}>
              <span>🚪</span><span>Logout</span>
            </a>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">💸 Expenses</h1>
            <p className="text-slate-400 text-sm mt-1">Track and manage all your expenses</p>
          </div>
          <Link to="/dashboard" className="btn-gradient flex items-center space-x-2 text-sm">
            <span>← Back to Dashboard</span>
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="glass-card p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Expenses</div>
            <div className="text-2xl font-bold text-white">₹{realExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</div>
          </div>
          <div className="glass-card p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Showing ({filterCategory})</div>
            <div className="text-2xl font-bold text-indigo-400">₹{totalFiltered.toLocaleString()}</div>
          </div>
          <div className="glass-card p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Entries</div>
            <div className="text-2xl font-bold text-cyan-400">{filtered.length}</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['All', 'Food', 'Shopping', 'Transport', 'Entertainment', 'Health', 'Education', 'Bills', 'Other'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
            >
              {cat !== 'All' && CATEGORY_ICONS[cat]} {cat}
            </button>
          ))}
        </div>

        {/* Expense List */}
        <div className="glass-card p-0 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-400 text-sm">Loading expenses...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-4">💸</div>
              <div className="text-white font-semibold mb-1">No expenses found</div>
              <p className="text-slate-500 text-sm">
                {filterCategory !== 'All' ? `No expenses in "${filterCategory}" category.` : 'Add your first expense from the Dashboard.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs text-slate-500 uppercase tracking-wider bg-slate-900/50">
                <div className="col-span-4">Merchant / Note</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2 text-right">Amount</div>
                <div className="col-span-2 text-center">Action</div>
              </div>

              {filtered.map(exp => (
                <div key={exp._id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-800/30 transition-colors group">
                  {/* Merchant */}
                  <div className="col-span-4 flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-lg flex-shrink-0">
                      {CATEGORY_ICONS[exp.category] || '📦'}
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm">{exp.merchant || 'Unnamed'}</div>
                      {exp.notes && <div className="text-xs text-slate-500 truncate max-w-[150px]">{exp.notes}</div>}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="col-span-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[exp.category] || 'bg-slate-700 text-slate-300'}`}>
                      {exp.category}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="col-span-2 text-sm text-slate-400">
                    {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>

                  {/* Amount */}
                  <div className="col-span-2 text-right font-bold text-white">
                    ₹{exp.amount.toLocaleString()}
                  </div>

                  {/* Delete */}
                  <div className="col-span-2 flex justify-center">
                    {confirmDelete === exp._id ? (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleDelete(exp._id)}
                          disabled={deletingId === exp._id}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          {deletingId === exp._id ? '...' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(exp._id)}
                        className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-red-900/40 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-xs font-medium transition-all"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
        </div>
      )}

      {/* Confirm Delete Modal */}
    </div>
  );
};

export default Expenses;