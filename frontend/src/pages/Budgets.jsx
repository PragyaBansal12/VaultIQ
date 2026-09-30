import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const CATEGORIES = ['Food', 'Shopping', 'Transport', 'Entertainment', 'Health', 'Education', 'Bills', 'Other'];

const CATEGORY_ICONS = {
  Food: '🍔', Shopping: '🛍️', Transport: '🚗',
  Entertainment: '🎬', Health: '💊', Education: '📚',
  Bills: '📄', Other: '📦',
};

const getMonthLabel = (yyyy_mm) => {
  const [year, month] = yyyy_mm.split('-');
  return new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

const currentMonth = new Date().toISOString().slice(0, 7);

const Budgets = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'User' };
  const token = localStorage.getItem('token');

  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [editingBudget, setEditingBudget] = useState(null); // budget object being edited
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Form state
  const [form, setForm] = useState({ category: 'Food', limit: '' });
  const [saving, setSaving] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Fetch budgets and expenses together
  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, eRes] = await Promise.all([
        fetch('/api/budgets', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/expenses', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (bRes.status === 401 || eRes.status === 401) { navigate('/login'); return; }
      const [bData, eData] = await Promise.all([bRes.json(), eRes.json()]);
      if (bRes.ok) setBudgets(bData);
      if (eRes.ok) setExpenses(eData);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Calculate spent amount for a category this month
  const getSpent = (category) => {
    return expenses
      .filter(e => {
        const expMonth = new Date(e.date).toISOString().slice(0, 7);
        return e.type !== 'income' && e.category === category && expMonth === currentMonth;
      })
      .reduce((sum, e) => sum + e.amount, 0);
  };

  // Save (create or update) budget
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.limit || Number(form.limit) <= 0) {
      showToast('Please enter a valid limit', 'error');
      return;
    }
    setSaving(true);
    try {
      const url = editingBudget ? `/api/budgets/${editingBudget._id}` : '/api/budgets';
      const method = editingBudget ? 'PUT' : 'POST';
      // Backend setBudget handles upsert via POST, so always POST (backend finds or creates)
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category: form.category, limit: Number(form.limit) }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(editingBudget ? 'Budget updated!' : 'Budget saved!');
        setForm({ category: 'Food', limit: '' });
        setEditingBudget(null);
        fetchData();
      } else {
        showToast(data.message || 'Failed to save', 'error');
      }
    } catch {
      showToast('Error saving budget', 'error');
    }
    setSaving(false);
  };

  const handleEdit = (budget) => {
    setEditingBudget(budget);
    setForm({ category: budget.category, limit: budget.limit });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/budgets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setBudgets(prev => prev.filter(b => b._id !== id));
        showToast('Budget deleted!');
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to delete', 'error');
      }
    } catch {
      showToast('Error deleting budget', 'error');
    }
    setDeletingId(null);
    setConfirmDelete(null);
  };

  const totalBudgeted = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + getSpent(b.category), 0);
  const exceeded = budgets.filter(b => getSpent(b.category) > b.limit);

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
            <Link to="/expenses" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>💸</span><span>Expenses</span>
            </Link>
            <Link to="/budgets" className="flex items-center space-x-3 text-indigo-400 font-medium p-2.5 bg-slate-800/50 rounded-xl">
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
            <a href="#" onClick={e => { e.preventDefault(); handleLogout(); }}
              className="flex items-center space-x-3 text-red-400 hover:text-red-300 p-2.5 hover:bg-red-900/20 rounded-xl transition-all">
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
            <h1 className="text-3xl font-bold text-white">🎯 Budgets</h1>
            <p className="text-slate-400 text-sm mt-1">{getMonthLabel(currentMonth)} — Set and track your spending limits</p>
          </div>
          <Link to="/dashboard" className="btn-gradient text-sm">← Dashboard</Link>
        </div>

        {/* Alerts for exceeded budgets */}
        {exceeded.length > 0 && (
          <div className="mb-6 space-y-2">
            {exceeded.map(b => {
              const spent = getSpent(b.category);
              return (
                <div key={b._id} className="flex items-center space-x-3 bg-red-900/30 border border-red-500/40 rounded-xl px-4 py-3">
                  <span className="text-xl">⚠️</span>
                  <span className="text-red-400 text-sm font-medium">
                    You exceeded your <strong>{b.category}</strong> budget by ₹{(spent - b.limit).toLocaleString()}!
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT — Set Budget Form */}
          <div className="lg:col-span-1">
            <div className="glass-card p-6">
              <h2 className="text-lg font-bold text-white mb-5">
                {editingBudget ? '✏️ Edit Budget' : '+ Set Budget'}
              </h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Category</label>
                  <select
                    className="w-full glass-input"
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Monthly Limit (₹)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full glass-input"
                    placeholder="e.g. 5000"
                    value={form.limit}
                    onChange={e => setForm({ ...form, limit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Month</label>
                  <div className="glass-input text-slate-300 cursor-not-allowed opacity-70">
                    {getMonthLabel(currentMonth)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="flex-1 btn-gradient">
                    {saving ? 'Saving...' : editingBudget ? 'Update Budget' : 'Save Budget'}
                  </button>
                  {editingBudget && (
                    <button type="button" onClick={() => { setEditingBudget(null); setForm({ category: 'Food', limit: '' }); }}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors">
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              {/* Summary Stats */}
              <div className="mt-6 pt-5 border-t border-slate-800 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Budgeted</span>
                  <span className="text-white font-semibold">₹{totalBudgeted.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Spent</span>
                  <span className={totalSpent > totalBudgeted ? 'text-red-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                    ₹{totalSpent.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Remaining</span>
                  <span className={totalBudgeted - totalSpent < 0 ? 'text-red-400 font-semibold' : 'text-cyan-400 font-semibold'}>
                    ₹{(totalBudgeted - totalSpent).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Budget List with Progress Bars */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="glass-card p-10 flex flex-col items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-400 text-sm">Loading budgets...</p>
              </div>
            ) : budgets.length === 0 ? (
              <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
                <div className="text-5xl mb-4">🎯</div>
                <div className="text-white font-semibold mb-1">No budgets set yet</div>
                <p className="text-slate-500 text-sm">Use the form to set your first monthly budget.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {budgets.map(budget => {
                  const spent = getSpent(budget.category);
                  const pct = Math.min((spent / budget.limit) * 100, 100);
                  const over = spent > budget.limit;
                  const warning = !over && pct >= 80;
                  const barColor = over
                    ? 'from-red-500 to-rose-600'
                    : warning
                      ? 'from-amber-400 to-orange-500'
                      : 'from-indigo-500 to-emerald-400';
                  const pctColor = over ? 'text-red-400' : warning ? 'text-amber-400' : 'text-emerald-400';

                  return (
                    <div key={budget._id} className="glass-card p-5 group">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-xl">
                            {CATEGORY_ICONS[budget.category] || '📦'}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{budget.category}</div>
                            <div className="text-xs text-slate-500">{getMonthLabel(budget.month)}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* Edit */}
                          <button
                            onClick={() => handleEdit(budget)}
                            className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-indigo-900/40 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg text-xs transition-all"
                          >
                            ✏️ Edit
                          </button>
                          {/* Delete */}
                          {confirmDelete === budget._id ? (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleDelete(budget._id)}
                                disabled={deletingId === budget._id}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs transition-colors"
                              >
                                {deletingId === budget._id ? '...' : 'Yes'}
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-2 py-1 bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(budget._id)}
                              className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-red-900/40 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-xs transition-all"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Amounts row */}
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-400">
                          ₹{spent.toLocaleString()} spent
                        </span>
                        <span className={`font-semibold ${pctColor}`}>
                          ₹{budget.limit.toLocaleString()} limit &nbsp;
                          <span>({Math.round((spent / budget.limit) * 100)}%)</span>
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Remaining / Warning */}
                      <div className="mt-2 text-xs">
                        {over ? (
                          <span className="text-red-400 font-medium">
                            ⚠️ Exceeded by ₹{(spent - budget.limit).toLocaleString()}
                          </span>
                        ) : warning ? (
                          <span className="text-amber-400">
                            ⚡ Close to limit — ₹{(budget.limit - spent).toLocaleString()} remaining
                          </span>
                        ) : (
                          <span className="text-emerald-400">
                            ✅ ₹{(budget.limit - spent).toLocaleString()} remaining
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'} text-white`}>
          {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
        </div>
      )}
    </div>
  );
};

export default Budgets;