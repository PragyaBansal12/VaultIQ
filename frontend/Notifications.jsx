import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Notifications = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'User' };

  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [filterType, setFilterType] = useState('All');
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    try {
      const [expRes, budRes] = await Promise.all([
        fetch('/api/expenses', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/budgets', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (expRes.status === 401) { navigate('/login'); return; }

      const expData = await expRes.json();
      const budData = await budRes.json();

      setExpenses(expData || []);
      setBudgets(budData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading) {
      generateNotifications();
    }
  }, [loading, expenses, budgets]);

  const generateNotifications = () => {
    const notifs = [];
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const realExpenses = expenses.filter(e => e.type !== 'income');

    // Category Totals for this month
    const categoryTotals = {};
    realExpenses.forEach(e => {
      const expMonth = new Date(e.date).toISOString().slice(0, 7);
      if (expMonth === currentMonth) {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
      }
    });

    const readIds = JSON.parse(localStorage.getItem(`readNotifications_${user._id}`) || '[]');
    const clearedIds = JSON.parse(localStorage.getItem(`clearedNotifications_${user._id}`) || '[]');
    let idCounter = 1;

    const addNotif = (categoryGroup, type, title, message, icon, timeStr, linkPath) => {
      const id = `notif_${idCounter++}_${title.replace(/\s+/g, '')}`;

      // Skip if explicitly cleared by user
      if (clearedIds.includes(id)) return;

      const isRead = readIds.includes(id);

      let colorClass = 'bg-slate-500/20 text-slate-400 border-l-slate-500';
      if (type === 'Warning') colorClass = 'bg-amber-500/10 text-amber-400 border-l-amber-500';
      if (type === 'Danger') colorClass = 'bg-red-500/10 text-red-400 border-l-red-500';
      if (type === 'AI') colorClass = 'bg-indigo-500/10 text-indigo-400 border-l-indigo-500';
      if (type === 'Success') colorClass = 'bg-emerald-500/10 text-emerald-400 border-l-emerald-500';

      notifs.push({
        id,
        categoryGroup, // 'Budget', 'AI', 'Payments', 'Alerts'
        type, // 'Warning', 'Danger', 'AI', 'Success', 'Info'
        title,
        message,
        icon,
        colorClass,
        timeStr,
        isRead,
        linkPath
      });
    };

    // 1. Budget Exceeded & Near Limit Warnings
    let allUnderBudget = true;
    budgets.forEach(b => {
      const spent = categoryTotals[b.category] || 0;
      if (spent > b.limit) {
        addNotif(
          'Budget',
          'Danger',
          'Budget Exceeded',
          `⚠️ You exceeded your ${b.category} budget by ₹${(spent - b.limit).toLocaleString()}.`,
          '⚠️',
          '2h ago',
          '/budgets'
        );
        allUnderBudget = false;
      } else if (spent >= b.limit * 0.8) {
        addNotif(
          'Budget',
          'Warning',
          'Budget Near Limit',
          `⚠️ You have used ${Math.round((spent / b.limit) * 100)}% of your ${b.category} budget limit.`,
          '⚠️',
          '3h ago',
          '/budgets'
        );
        allUnderBudget = false;
      }
    });

    // 2. Goal Achievement Success
    if (budgets.length > 0 && allUnderBudget) {
      addNotif('Alerts', 'Success', 'Goal Achieved', `🎉 Great job! You stayed within all your budgets this month.`, '🎉', '5h ago', '/budgets');
    }

    // 3. Large Transaction Alerts
    const recentLarge = realExpenses.filter(e => e.amount >= 5000 && new Date(e.date) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    recentLarge.forEach(e => {
      addNotif(
        'Payments',
        'Warning',
        'Large Transaction Detected',
        `💸 Large expense detected: ₹${e.amount.toLocaleString()} spent on ${e.merchant || e.category}.`,
        '💸',
        '1d ago',
        '/expenses'
      );
    });

    // 4. Unusual Spending Alerts (AI feature)
    const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
    Object.keys(categoryTotals).forEach(cat => {
      if (categoryTotals[cat] > totalSpent * 0.4 && totalSpent > 0) {
        addNotif(
          'AI',
          'Danger',
          'Unusual Spending Spike',
          `🚨 Unusually high spending detected in ${cat}. It accounts for ${Math.round((categoryTotals[cat] / totalSpent) * 100)}% of your monthly expenses!`,
          '🚨',
          '2d ago',
          '/analytics'
        );
      }
    });

    // 5. AI Saving Suggestions
    const topCategory = Object.keys(categoryTotals).reduce((a, b) => categoryTotals[a] > categoryTotals[b] ? a : b, null);
    if (topCategory && categoryTotals[topCategory] > 1000) {
      const potentialSave = Math.round(categoryTotals[topCategory] * 0.2);
      addNotif(
        'AI',
        'AI',
        'AI Saving Suggestion',
        `💡 Reducing your ${topCategory.toLowerCase()} expenses by 20% could save you ₹${potentialSave.toLocaleString()} this month.`,
        '💡',
        '2d ago',
        '/analytics'
      );
    }

    // 6. Monthly Summary Info (Only if they actually have expenses)
    if (realExpenses.length > 0) {
      addNotif('Alerts', 'Info', 'Monthly Spending Report', `📊 Your monthly spending summary is ready to view.`, '📊', '3d ago', '/reports');
    }

    // 7. Welcome Notification for Brand New Accounts
    if (expenses.length === 0 && budgets.length === 0) {
      addNotif(
        'Alerts', 
        'Success', 
        'Welcome to FinTrack AI!', 
        '👋 Welcome! Get started by adding your first budget or expense to activate your AI financial coach.', 
        '✨', 
        'Just now', 
        '/dashboard'
      );
    }

    setNotifications(notifs);
  };

  const markAsRead = (id) => {
    const readIds = JSON.parse(localStorage.getItem(`readNotifications_${user._id}`) || '[]');
    if (!readIds.includes(id)) {
      readIds.push(id);
      localStorage.setItem(`readNotifications_${user._id}`, JSON.stringify(readIds));
      generateNotifications();
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    localStorage.setItem(`readNotifications_${user._id}`, JSON.stringify(allIds));
    generateNotifications();
    showToast('✅ All marked as read!');
  };

  const clearAllNotifications = () => {
    const allIds = notifications.map(n => n.id);
    const clearedIds = JSON.parse(localStorage.getItem(`clearedNotifications_${user._id}`) || '[]');
    const uniqueNewCleared = Array.from(new Set([...clearedIds, ...allIds]));
    localStorage.setItem(`clearedNotifications_${user._id}`, JSON.stringify(uniqueNewCleared));
    generateNotifications();
    showToast('🗑️ Cleared all notifications!');
  };

  // Filtering Notifications
  const filteredNotifs = notifications.filter(n => {
    if (filterType === 'All') return true;
    if (filterType === 'Unread') return !n.isRead;
    return n.categoryGroup === filterType;
  });

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex relative">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl bg-indigo-600 text-white text-sm font-semibold transition-all">
          {toast}
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
            <Link to="/subscriptions" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>🔁</span><span>Subscriptions</span>
            </Link>
            <Link to="/notifications" className="flex items-center space-x-3 text-indigo-400 font-medium p-2.5 bg-slate-800/50 rounded-xl">
              <span>🔔</span><span>Notifications</span>
            </Link>
            <Link to="/settings" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>⚙️</span><span>Settings</span>
            </Link>
            <Link to="/help-center" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>❓</span><span>Help Center</span>
            </Link>
            <a href="#" onClick={(e) => { e.preventDefault(); localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); }} className="flex items-center space-x-3 text-red-400 hover:text-red-300 p-2.5 hover:bg-red-900/20 rounded-xl transition-all mt-6">
              <span>🚪</span><span>Logout</span>
            </a>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end border-b border-slate-800/50 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              🔔 Notifications
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="bg-pink-600 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {notifications.filter(n => !n.isRead).length} New
                </span>
              )}
            </h1>
            <p className="text-slate-400 text-sm mt-1">Track financial warnings, budget limits, AI suggestions, and payment reminders</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={markAllAsRead}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-900/20 px-3.5 py-2 rounded-lg"
            >
              ✓ Mark all as read
            </button>
            <button
              onClick={clearAllNotifications}
              className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors bg-red-900/10 px-3.5 py-2 rounded-lg border border-red-900/30"
            >
              🗑️ Clear all
            </button>
          </div>
        </header>

        {/* Scalable Filters Bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['All', 'Unread', 'Budget', 'AI', 'Payments', 'Alerts'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterType === type
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
            >
              {type === 'Unread' ? `📥 Unread (${notifications.filter(n => !n.isRead).length})` : type}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : filteredNotifs.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/20 rounded-2xl border border-slate-800 border-dashed">
            <div className="text-4xl mb-3">📭</div>
            <h3 className="text-white font-medium mb-1">No notifications found</h3>
            <p className="text-slate-500 text-xs">Try selecting a different filter above.</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl">
            {filteredNotifs.map((notif) => (
              <div
                key={notif.id}
                className={`glass-card p-3.5 flex items-start space-x-4 border-l-[3.5px] transition-all relative cursor-pointer ${notif.colorClass} ${notif.isRead
                    ? 'opacity-50 hover:opacity-85 border-slate-700/30'
                    : 'bg-[#101626]/80 hover:bg-[#131b2e] border-slate-700/60 shadow-lg shadow-black/10'
                  }`}
                onClick={() => {
                  markAsRead(notif.id);
                  if (notif.linkPath) navigate(notif.linkPath);
                }}
              >
                {/* Glowing Dot for Unread */}
                {!notif.isRead && (
                  <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-slate-900/60 border border-slate-700/20`}>
                  {notif.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <h3 className={`font-semibold text-sm ${notif.isRead ? 'text-slate-400' : 'text-white'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-[10px] font-medium text-slate-500 shrink-0">{notif.timeStr}</span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed mb-2">
                    {notif.message}
                  </p>

                  <div className="flex gap-2">
                    {!notif.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notif.id);
                        }}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 border border-indigo-850 px-2 py-0.5 rounded transition-colors"
                      >
                        Mark Read
                      </button>
                    )}
                    {notif.linkPath && (
                      <span className="text-[10px] font-bold text-slate-400 hover:underline">
                        View Details →
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;