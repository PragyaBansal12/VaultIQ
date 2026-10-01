import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const CATEGORY_ICONS = {
  'Entertainment': '🎬',
  'Cloud Services': '☁',
  'Fitness': '💪',
  'Music': '🎵',
  'Education': '📚',
  'Productivity': '🧠',
  'Other': '📦'
};

const Subscriptions = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'User' };

  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Form states for adding/editing
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSub, setNewSub] = useState({
    name: '',
    category: 'Entertainment',
    cost: '',
    billingCycle: 'monthly',
    nextRenewal: '',
    paymentMethod: 'UPI',
    status: 'Active',
    notifyBefore: true
  });

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Selected sub for details modal
  const [selectedSub, setSelectedSub] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch('/api/subscriptions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        navigate('/login');
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setSubscriptions(data || []);
      }
    } catch (e) {
      console.error('Failed to load subscriptions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newSub.name || !newSub.cost) {
      showToast('Name and cost are required', 'error');
      return;
    }

    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newSub)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('✅ Subscription added successfully!');
        setSubscriptions(prev => [...prev, data]);
        setShowAddModal(false);
        setNewSub({
          name: '',
          category: 'Entertainment',
          cost: '',
          billingCycle: 'monthly',
          nextRenewal: '',
          paymentMethod: 'UPI',
          status: 'Active',
          notifyBefore: true
        });
      } else {
        showToast(data.message || 'Error adding subscription', 'error');
      }
    } catch {
      showToast('Connection error', 'error');
    }
  };

  const toggleStatus = async (sub) => {
    const nextStatus = sub.status === 'Active' ? 'Paused' : 'Active';
    try {
      const res = await fetch(`/api/subscriptions/${sub._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (res.ok) {
        setSubscriptions(prev => prev.map(s => s._id === sub._id ? data : s));
        showToast(`Status updated to ${nextStatus}!`);
        if (selectedSub?._id === sub._id) setSelectedSub(data);
      }
    } catch {
      showToast('Error updating status', 'error');
    }
  };

  const toggleNotification = async (sub) => {
    try {
      const res = await fetch(`/api/subscriptions/${sub._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notifyBefore: !sub.notifyBefore })
      });
      const data = await res.json();
      if (res.ok) {
        setSubscriptions(prev => prev.map(s => s._id === sub._id ? data : s));
        showToast(data.notifyBefore ? '🔔 Reminders activated' : '🔕 Reminders silenced');
      }
    } catch {
      showToast('Error updating notification', 'error');
    }
  };

  const deleteSub = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subscription?')) return;
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSubscriptions(prev => prev.filter(s => s._id !== id));
        showToast('🗑️ Subscription removed successfully!');
        setSelectedSub(null);
      }
    } catch {
      showToast('Error deleting subscription', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Calculations & Analytics metrics
  const activeSubs = subscriptions.filter(s => s.status === 'Active');
  const monthlyCost = activeSubs.reduce((sum, s) => {
    const amount = s.cost;
    return sum + (s.billingCycle === 'yearly' ? Math.round(amount / 12) : amount);
  }, 0);

  const annualCostForecast = monthlyCost * 12;

  // Potential savings (Unused services, duplicate packages)
  const unusedSubs = subscriptions.filter(s => s.status === 'Active' && s.unusedDays >= 20);
  const potentialSavings = unusedSubs.reduce((sum, s) => {
    const amount = s.cost;
    return sum + (s.billingCycle === 'yearly' ? Math.round(amount / 12) : amount);
  }, 0);

  // Health Score (Base: 100, subtract points for unused days, cancelled services, duplicate categories)
  const categoryCounts = {};
  subscriptions.forEach(s => {
    if (s.status === 'Active') {
      categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
    }
  });

  let duplicateCategoriesCount = 0;
  Object.values(categoryCounts).forEach(c => {
    if (c > 1) duplicateCategoriesCount += (c - 1);
  });

  let healthScore = 100;
  healthScore -= unusedSubs.length * 15;
  healthScore -= duplicateCategoriesCount * 8;
  healthScore = Math.max(Math.min(healthScore, 100), 20);

  // Upcoming renewals (within 7 days)
  const upcomingRenewals = activeSubs.filter(s => {
    const diffTime = new Date(s.nextRenewal) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  // Filtered List
  const filteredSubs = subscriptions.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || s.category === filterCategory;
    const matchesStatus = filterStatus === 'All' || s.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex relative">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white'
        }`}>
          {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
        </div>
      )}

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
            <Link to="/subscriptions" className="flex items-center space-x-3 text-indigo-400 font-medium p-2.5 bg-slate-800/50 rounded-xl">
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
            <a href="#" className="flex items-center space-x-3 text-red-400 hover:text-red-300 p-2.5 hover:bg-red-900/20 rounded-xl transition-all mt-6"
              onClick={e => { e.preventDefault(); handleLogout(); }}>
              <span>🚪</span><span>Logout</span>
            </a>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">🔁 Subscription Console</h1>
            <p className="text-slate-400 text-sm mt-1">Audit, optimize, and control your active recurring contracts natively</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              🔒 Secure Sync Enabled
            </div>
            <button onClick={() => setShowAddModal(true)} className="btn-gradient px-4 py-2 text-sm font-semibold flex items-center gap-2">
              ➕ Add Contract
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Top Quick Stats Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="glass-card p-5 border-t-4 border-t-indigo-500 flex flex-col justify-between">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">💳 Monthly Subscription Cost</div>
                  <div className="text-3xl font-black text-white mt-2">₹{monthlyCost.toLocaleString()}</div>
                </div>
                <div className="text-slate-500 text-[11px] mt-2 font-medium">Auto-aggregated across active cycles</div>
              </div>

              <div className="glass-card p-5 border-t-4 border-t-blue-500 flex flex-col justify-between">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">🔁 Active Subscriptions</div>
                  <div className="text-3xl font-black text-blue-400 mt-2">{activeSubs.length}</div>
                </div>
                <div className="text-slate-500 text-[11px] mt-2 font-medium">{subscriptions.filter(s => s.status === 'Paused').length} currently paused</div>
              </div>

              <div className="glass-card p-5 border-t-4 border-t-amber-500 flex flex-col justify-between">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">📅 Upcoming Renewals</div>
                  <div className="text-3xl font-black text-amber-400 mt-2">{upcomingRenewals.length} <span className="text-xs text-slate-500 font-normal">This Week</span></div>
                </div>
                <div className="text-slate-500 text-[11px] mt-2 font-medium">Nearest: {upcomingRenewals[0]?.name || 'None'}</div>
              </div>

              <div className="glass-card p-5 border-t-4 border-t-emerald-500 flex flex-col justify-between">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">💰 Potential Savings</div>
                  <div className="text-3xl font-black text-emerald-400 mt-2">₹{potentialSavings.toLocaleString()}/mo</div>
                </div>
                <div className="text-slate-500 text-[11px] mt-2 font-medium">By canceling {unusedSubs.length} unused service{unusedSubs.length === 1 ? '' : 's'}</div>
              </div>

            </div>

            {/* Middle Section - List & Filters + Right widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: List, Search, Filters */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Search and Filters Strip */}
                <div className="glass-card p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">🔍</span>
                      <input
                        type="text"
                        placeholder="Search subscriptions, categories..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-[#0D1220] border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                        className="bg-[#0D1220] border border-slate-800 text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                      >
                        <option value="All">All Categories</option>
                        {Object.keys(CATEGORY_ICONS).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="bg-[#0D1220] border border-slate-800 text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Paused">Paused</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Subscriptions List grid */}
                {filteredSubs.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredSubs.map(sub => (
                      <div key={sub._id} className={`glass-card p-5 hover:border-slate-700 transition-all flex flex-col justify-between gap-4 border-l-4 relative overflow-hidden ${
                        sub.status === 'Active' ? 'border-l-indigo-500' : 'border-l-slate-700 opacity-60'
                      }`}>
                        
                        {/* Status absolute indicator */}
                        <div className="absolute top-4 right-4 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${sub.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{sub.status}</span>
                        </div>

                        <div>
                          {/* Logo icon + title */}
                          <div className="flex items-center gap-3">
                            <span className="text-2xl bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                              {CATEGORY_ICONS[sub.category] || '📦'}
                            </span>
                            <div>
                              <h3 className="font-bold text-white text-base leading-tight truncate max-w-[120px]">{sub.name}</h3>
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
                                {sub.category}
                              </span>
                            </div>
                          </div>

                          {/* Billing specifics */}
                          <div className="mt-4 space-y-2">
                            <div className="flex justify-between items-baseline">
                              <span className="text-slate-400 text-xs">Cost</span>
                              <span className="text-lg font-black text-white">₹{sub.cost.toLocaleString()} <span className="text-[10px] text-slate-500 font-semibold uppercase">/{sub.billingCycle}</span></span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Next Renewal</span>
                              <span className="text-slate-200 font-medium">
                                {new Date(sub.nextRenewal).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Via Portal</span>
                              <span className="text-slate-300 font-medium">{sub.paymentMethod}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions buttons */}
                        <div className="border-t border-slate-800/80 pt-3 mt-2 flex justify-between items-center gap-2">
                          <button
                            onClick={() => setSelectedSub(sub)}
                            className="text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/50 transition-colors"
                          >
                            Details
                          </button>
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleStatus(sub)}
                              title={sub.status === 'Active' ? 'Pause Alerts' : 'Activate Alerts'}
                              className={`text-lg p-1 px-2.5 rounded-lg border transition-all cursor-pointer ${
                                sub.status === 'Active'
                                  ? 'bg-amber-950/20 text-amber-500 border-amber-800/30 hover:bg-amber-900/20'
                                  : 'bg-indigo-950/20 text-indigo-400 border-indigo-800/30 hover:bg-indigo-900/20'
                              }`}
                            >
                              {sub.status === 'Active' ? '⏸️' : '▶️'}
                            </button>
                            <button
                              onClick={() => deleteSub(sub._id)}
                              title="Delete subscription"
                              className="text-lg p-1 px-2.5 rounded-lg bg-red-950/20 text-red-400 border border-red-800/30 hover:bg-red-900/20 transition-all cursor-pointer"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-slate-900/20 rounded-2xl border-2 border-dashed border-slate-800 p-6">
                    <div className="text-5xl">🔍</div>
                    <h3 className="text-white font-bold text-lg mt-3">No Subscriptions Found</h3>
                    <p className="text-slate-500 text-sm mt-1">Try adjusting your active search filters or add a new portal contract above.</p>
                  </div>
                )}

                {/* AI Subscription Automatic Detection Widget */}
                <div className="glass-card bg-indigo-900/10 border-indigo-500/30 p-6 relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 text-8xl opacity-10">🤖</div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-2xl">🤖</div>
                    <div>
                      <h3 className="text-lg font-bold text-white">AI Recurring Detection Logs</h3>
                      <p className="text-slate-400 text-xs">FinTrack AI scans transaction descriptions for hidden active cycles</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-[#0B0F19]/80 border border-slate-800/60 p-4 rounded-xl flex justify-between items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-indigo-900/40 text-indigo-400 px-2 py-0.5 rounded-full font-bold">Netflix Recurring Detected</span>
                          <span className="text-[10px] text-slate-500 font-medium">Confidence: 99%</span>
                        </div>
                        <p className="text-slate-300 text-sm mt-1.5 font-medium">₹649 charged every month via UPI webhook logs.</p>
                      </div>
                      <span className="text-2xl">🎬</span>
                    </div>

                    <div className="bg-[#0B0F19]/80 border border-slate-800/60 p-4 rounded-xl flex justify-between items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-emerald-950/40 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Spotify Premium Detected</span>
                          <span className="text-[10px] text-slate-500 font-medium">Confidence: 96%</span>
                        </div>
                        <p className="text-slate-300 text-sm mt-1.5 font-medium">₹119 auto-debited on Credit Card logs recurring monthly.</p>
                      </div>
                      <span className="text-2xl">🎵</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: AI Insights, upcoming timeline, health dial */}
              <div className="space-y-6">
                
                {/* Subscription Health score widget */}
                <div className="glass-card p-5 text-center">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Subscription Health Score</h3>
                  
                  {/* Health radial dial */}
                  <div className="flex justify-center items-center py-6 relative">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle cx="64" cy="64" r="50" stroke="#1E293B" strokeWidth="10" fill="transparent" />
                      <circle cx="64" cy="64" r="50" stroke="url(#indigoGrad)" strokeWidth="10" fill="transparent" 
                        strokeDasharray={2 * Math.PI * 50} 
                        strokeDashoffset={2 * Math.PI * 50 * (1 - healthScore / 100)} 
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="indigoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#818CF8" />
                          <stop offset="100%" stopColor="#4F46E5" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute text-center">
                      <div className="text-3xl font-black text-white">{healthScore}</div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">/ 100 Score</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {healthScore >= 80 
                      ? '✨ Excellent subscription discipline! Your overhead contracts are highly optimized.' 
                      : healthScore >= 60 
                        ? '⚠️ Duplication or inactive licenses detected! Cancel redundant packages to boost efficiency.' 
                        : '🚨 Critically low efficiency! You have highly redundant active contracts.'}
                  </p>
                </div>

                {/* AI Insights & Duplicates Warning Panel */}
                <div className="glass-card p-5 border-l-4 border-l-pink-500 bg-pink-950/5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">💡</span>
                    <h3 className="text-base font-bold text-white">AI Optimization Insights</h3>
                  </div>

                  <div className="space-y-4">
                    
                    {/* Unused warning */}
                    {unusedSubs.map(sub => (
                      <div key={sub._id} className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-red-400">⚠️ Unused Service Alert</span>
                          <span className="text-slate-500 font-semibold">{sub.unusedDays} days inactive</span>
                        </div>
                        <p className="text-slate-300">
                          <strong>{sub.name}</strong> shows zero usage logs recently. Switch off to save ₹{sub.cost.toLocaleString()}/month!
                        </p>
                        <button
                          onClick={() => toggleStatus(sub)}
                          className="text-[10px] bg-red-900/30 hover:bg-red-900/50 text-white px-2 py-1 rounded font-bold cursor-pointer"
                        >
                          ⏸️ Pause Billing Alerts
                        </button>
                      </div>
                    ))}

                    <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-xs space-y-1.5">
                      <span className="font-bold text-indigo-400">💡 Billing Optimization</span>
                      <p className="text-slate-300">
                        Switching <strong>AWS Cloud Services</strong> to annual billing would yield a <strong>15% bulk discount</strong>, saving you ₹4,410/year!
                      </p>
                    </div>

                    <div className="p-3 bg-[#0D1220]/80 border border-slate-800 rounded-xl text-xs space-y-1.5">
                      <span className="font-bold text-slate-400">📊 Annual Cost Projection</span>
                      <p className="text-slate-300">
                        At your current pace, you will spend <strong className="text-indigo-400">₹{annualCostForecast.toLocaleString()} this year</strong> on active portals alone.
                      </p>
                    </div>

                  </div>
                </div>

                {/* Upcoming Renewals Timeline Widget */}
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">📅</span>
                    <h3 className="text-base font-bold text-white">Upcoming Renewals Timeline</h3>
                  </div>

                  {activeSubs.length > 0 ? (
                    <div className="space-y-4 relative pl-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                      {activeSubs.slice(0, 4).map(sub => {
                        const diffTime = new Date(sub.nextRenewal) - new Date();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        let dayLabel = `${diffDays} days left`;
                        if (diffDays === 0) dayLabel = 'Today';
                        else if (diffDays === 1) dayLabel = 'Tomorrow';

                        return (
                          <div key={sub._id} className="relative text-xs">
                            <span className="absolute -left-[19px] top-1.5 w-2 h-2 rounded-full bg-indigo-500"></span>
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold text-white">{sub.name}</span>
                                <div className="text-[10px] text-slate-500 font-semibold">{new Date(sub.nextRenewal).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-white">₹{sub.cost.toLocaleString()}</div>
                                <span className="text-[9px] text-slate-400">{dayLabel}</span>
                              </div>
                            </div>
                            {/* Toggle reminder button */}
                            <div className="flex items-center gap-1.5 mt-1">
                              <input
                                type="checkbox"
                                id={`notify-${sub._id}`}
                                checked={sub.notifyBefore}
                                onChange={() => toggleNotification(sub)}
                                className="w-3.5 h-3.5 accent-indigo-500 rounded border-slate-700 bg-slate-900 cursor-pointer"
                              />
                              <label htmlFor={`notify-${sub._id}`} className="text-[9px] text-slate-400 cursor-pointer select-none">
                                Notify 24h prior
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs">No active renewals on timeline.</p>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

      </div>

      {/* ➕ Add Subscription Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[110] flex justify-center items-center p-4">
          <div className="glass-card max-w-md w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">➕ Add New Recurring Contract</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xl">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Netflix, AWS Cloud"
                  value={newSub.name}
                  onChange={e => setNewSub(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-[#0D1220] border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-semibold">Category</label>
                  <select
                    value={newSub.category}
                    onChange={e => setNewSub(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-[#0D1220] border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    {Object.keys(CATEGORY_ICONS).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-semibold">Billing Cycle</label>
                  <select
                    value={newSub.billingCycle}
                    onChange={e => setNewSub(prev => ({ ...prev, billingCycle: e.target.value }))}
                    className="w-full bg-[#0D1220] border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-semibold">Cost (₹)</label>
                  <input
                    type="number"
                    placeholder="INR Cost"
                    value={newSub.cost}
                    onChange={e => setNewSub(prev => ({ ...prev, cost: parseFloat(e.target.value) || '' }))}
                    className="w-full bg-[#0D1220] border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-semibold">Next Renewal Date</label>
                  <input
                    type="date"
                    value={newSub.nextRenewal}
                    onChange={e => setNewSub(prev => ({ ...prev, nextRenewal: e.target.value }))}
                    className="w-full bg-[#0D1220] border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-semibold">Payment Portal</label>
                  <select
                    value={newSub.paymentMethod}
                    onChange={e => setNewSub(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full bg-[#0D1220] border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Razorpay">Razorpay</option>
                    <option value="Net Banking">Net Banking</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="add-notify"
                    checked={newSub.notifyBefore}
                    onChange={e => setNewSub(prev => ({ ...prev, notifyBefore: e.target.checked }))}
                    className="w-4 h-4 accent-indigo-500 rounded border-slate-700 bg-slate-900 cursor-pointer"
                  />
                  <label htmlFor="add-notify" className="text-xs text-slate-300 cursor-pointer select-none">
                    Notify before renewal
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-gradient py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                  Save Contract
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Subscription Details Modal Drawer */}
      {selectedSub && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[110] flex justify-center items-center p-4">
          <div className="glass-card max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{CATEGORY_ICONS[selectedSub.category] || '📦'}</span>
                <span>{selectedSub.name} Details</span>
              </h3>
              <button onClick={() => setSelectedSub(null)} className="text-slate-400 hover:text-white text-xl">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-900/60 p-4 rounded-xl space-y-2.5 border border-slate-800/60">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Total Monthly Cost:</span>
                  <span className="font-bold text-white">₹{selectedSub.cost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Cycle Frequency:</span>
                  <span className="font-bold text-white uppercase">{selectedSub.billingCycle}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Current Status:</span>
                  <span className="font-bold text-emerald-400 uppercase">{selectedSub.status}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Payment Gateway:</span>
                  <span className="font-bold text-white">{selectedSub.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Next Renewal Threshold:</span>
                  <span className="font-bold text-amber-400">
                    {new Date(selectedSub.nextRenewal).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                  </span>
                </div>
              </div>

              {/* AI confidence badge inside details */}
              <div className="p-3.5 bg-indigo-950/20 border border-indigo-800/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-indigo-300">🤖 AI Sync Engine Confidence</span>
                  <p className="text-slate-400 mt-0.5">Confidence is based on historical transaction signature matches.</p>
                </div>
                <span className="font-black text-indigo-400 text-sm bg-indigo-900/30 px-2.5 py-1 rounded-lg">
                  {selectedSub.confidence}%
                </span>
              </div>

              {/* Unused warning inside details if applicable */}
              {selectedSub.unusedDays >= 20 && (
                <div className="p-3.5 bg-red-950/20 border border-red-800/30 rounded-xl text-xs text-red-400">
                  ⚠️ <strong>Unused License Alert:</strong> This service has seen zero activity logs for {selectedSub.unusedDays} consecutive days. Consider pausing or canceling it.
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => toggleStatus(selectedSub)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  selectedSub.status === 'Active'
                    ? 'bg-amber-950/20 text-amber-500 border-amber-800/30 hover:bg-amber-900/20'
                    : 'bg-indigo-950/20 text-indigo-400 border-indigo-800/30 hover:bg-indigo-900/20'
                }`}
              >
                {selectedSub.status === 'Active' ? '⏸️ Pause Contract' : '▶️ Activate Contract'}
              </button>
              <button
                onClick={() => deleteSub(selectedSub._id)}
                className="flex-1 bg-red-950/20 text-red-400 border border-red-800/30 hover:bg-red-900/20 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                🗑️ Cancel Contract
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Subscriptions;