import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'User' };
  const token = localStorage.getItem('token');

  const [modal, setModal] = useState(null); // 'expense' | 'receipt' | 'income' | 'transfer'
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  // Bell notification panel toggle
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const [darkMode, setDarkMode] = useState(() => {
    try {
      const userObj = JSON.parse(localStorage.getItem('user')) || {};
      const settings = userObj.settings || {};
      return settings.theme !== 'light';
    } catch { return true; }
  });

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      try {
        const userObj = JSON.parse(localStorage.getItem('user')) || {};
        if (!userObj.settings) userObj.settings = {};
        userObj.settings.theme = next ? 'dark' : 'light';
        localStorage.setItem('user', JSON.stringify(userObj));

        // Also dispatch to the backend so it persists across sessions if needed
        fetch('/api/auth/update', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ settings: userObj.settings })
        }).catch(e => console.error(e));

        window.dispatchEvent(new CustomEvent('theme-changed'));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllRead = () => {
    const allIds = notifications.map(n => n.id);
    localStorage.setItem('readNotifications', JSON.stringify(allIds));
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const dismissNotif = (id) => {
    const cleared = JSON.parse(localStorage.getItem('clearedNotifications') || '[]');
    cleared.push(id);
    localStorage.setItem('clearedNotifications', JSON.stringify(cleared));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const [subCount, setSubCount] = useState(0);
  const [subCost, setSubCost] = useState(0);
  const [upcomingBills, setUpcomingBills] = useState([]);
  const [goal, setGoal] = useState(() => {
    try {
      const stored = localStorage.getItem(`user_goal_${user._id}`);
      return stored ? JSON.parse(stored) : { name: '', progress: 0 };
    } catch {
      return { name: '', progress: 0 };
    }
  });

  const handleEditGoal = () => {
    const newName = prompt('Enter your financial goal name (e.g., MacBook, Vacation):', goal.name);
    if (!newName) return;
    const newProgress = prompt('Enter current progress percentage (0-100):', goal.progress);
    if (!newProgress || isNaN(newProgress) || newProgress < 0 || newProgress > 100) {
      showToast('Invalid progress percentage.', 'error');
      return;
    }
    const newGoal = { name: newName, progress: parseInt(newProgress, 10) };
    setGoal(newGoal);
    localStorage.setItem(`user_goal_${user._id}`, JSON.stringify(newGoal));
    showToast('Goal updated successfully!');
  };

  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [chartType, setChartType] = useState('line'); // 'line' | 'bar'
  const [chartPeriod, setChartPeriod] = useState('month'); // 'week' | 'month'

  // Fetch user expenses and budgets
  const fetchData = async () => {
    try {
      const [expRes, budRes] = await Promise.all([
        fetch('/api/expenses', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/budgets', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (expRes.ok) setExpenses(await expRes.json());
      if (budRes.ok) setBudgets(await budRes.json());
    } catch (e) {
      console.error('Error fetching data', e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  useEffect(() => {
    if (expenses.length > 0 || budgets.length > 0) {
      const notifs = [];
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7);
      const realExpenses = expenses.filter(e => e.type !== 'income');

      const categoryTotals = {};
      realExpenses.forEach(e => {
        const expMonth = new Date(e.date).toISOString().slice(0, 7);
        if (expMonth === currentMonth) {
          categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
        }
      });

      const readIds = JSON.parse(localStorage.getItem('readNotifications') || '[]');
      const clearedIds = JSON.parse(localStorage.getItem('clearedNotifications') || '[]');
      let idCounter = 1;

      const addNotif = (type, title, message, color) => {
        const id = `notif_${idCounter++}_${title.replace(/\s+/g, '')}`;
        if (clearedIds.includes(id)) return;
        notifs.push({
          id, title, msg: message, color, isRead: readIds.includes(id)
        });
      };

      // 1. Budgets
      let allUnderBudget = true;
      budgets.forEach(b => {
        const spent = categoryTotals[b.category] || 0;
        if (spent > b.limit) {
          addNotif('Danger', 'Budget Exceeded', `⚠️ Exceeded ${b.category} budget by ₹${(spent - b.limit).toLocaleString()}.`, 'pink');
          allUnderBudget = false;
        } else if (spent >= b.limit * 0.8) {
          addNotif('Warning', 'Budget Near Limit', `⚠️ Used ${Math.round((spent / b.limit) * 100)}% of ${b.category} budget.`, 'amber');
          allUnderBudget = false;
        }
      });

      if (budgets.length > 0 && allUnderBudget) {
        addNotif('Success', 'Goal Achieved', `🎉 Stayed within all budgets this month.`, 'emerald');
      }

      // 2. Large Transactions
      const recentLarge = realExpenses.filter(e => e.amount >= 5000 && new Date(e.date) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      recentLarge.forEach(e => addNotif('Warning', 'Large Transaction', `💸 ₹${e.amount.toLocaleString()} spent on ${e.merchant || e.category}.`, 'amber'));

      // 3. AI Insights
      const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
      Object.keys(categoryTotals).forEach(cat => {
        if (categoryTotals[cat] > totalSpent * 0.4 && totalSpent > 0) {
          addNotif('Danger', 'Unusual Spike', `🚨 ${cat} accounts for ${Math.round((categoryTotals[cat] / totalSpent) * 100)}% of expenses!`, 'pink');
        }
      });

      const topCategory = Object.keys(categoryTotals).reduce((a, b) => categoryTotals[a] > categoryTotals[b] ? a : b, null);
      if (topCategory && categoryTotals[topCategory] > 1000) {
        addNotif('AI', 'AI Saving Suggestion', `💡 Reduce ${topCategory} by 20% to save ₹${Math.round(categoryTotals[topCategory] * 0.2).toLocaleString()}.`, 'indigo');
      }

      addNotif('Info', 'Monthly Report', `📊 Monthly spending summary is ready.`, 'indigo');

      // Upcoming Bills are handled below
      setNotifications(prev => {
        const bills = prev.filter(n => n.id.toString().startsWith('bill-'));
        return [...notifs, ...bills];
      });
    }
  }, [expenses, budgets]);

  // Fetch dynamic subscription metrics
  useEffect(() => {
    const fetchSubMetrics = async () => {
      try {
        const res = await fetch('/api/subscriptions', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const active = data.filter(s => s.status === 'Active');
          setSubCount(active.length);
          const cost = active.reduce((sum, s) => {
            const amount = s.cost;
            return sum + (s.billingCycle === 'yearly' ? Math.round(amount / 12) : amount);
          }, 0);
          setSubCost(cost);

          const bills = active
            .map(s => {
              const diffTime = new Date(s.nextBillingDate || Date.now()) - new Date();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              let timeStr = diffDays === 1 ? 'Tomorrow' : diffDays === 0 ? 'Today' : diffDays < 0 ? 'Overdue' : `${diffDays} days`;
              return { id: s._id || s.name, name: s.name, timeStr, days: diffDays };
            })
            .sort((a, b) => a.days - b.days)
            .slice(0, 2);

          setUpcomingBills(bills);

          const billNotifs = bills.filter(b => b.days <= 3).map(b => ({
            id: `bill-${b.id}`,
            title: '⚠️ Upcoming Bill',
            msg: `${b.name} is due ${b.timeStr.toLowerCase()}.`,
            color: 'pink',
            isRead: false
          }));
          setNotifications(prev => {
            const others = prev.filter(n => !n.id.toString().startsWith('bill-'));
            const cleared = JSON.parse(localStorage.getItem('clearedNotifications') || '[]');
            const finalBills = billNotifs.filter(b => !cleared.includes(b.id));
            return [...others, ...finalBills];
          });
        }
      } catch (e) {
        console.error('Error fetching subscriptions metrics', e);
      }
    };
    if (token) {
      fetchSubMetrics();
    }
  }, [token]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close notification panel on outside click
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const closeModal = () => setModal(null);

  // Add Expense
  const [expense, setExpense] = useState({ merchant: '', amount: '', category: 'Food', date: new Date().toISOString().slice(0, 10), notes: '' });
  const submitExpense = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(expense) });
      const data = await res.json();
      if (res.ok) { showToast('Expense added!'); closeModal(); setExpense({ merchant: '', amount: '', category: 'Food', date: new Date().toISOString().slice(0, 10), notes: '' }); fetchData(); }
      else showToast(data.message || 'Failed', 'error');
    } catch { showToast('Error adding expense', 'error'); }
    setLoading(false);
  };

  // Add Income
  const [income, setIncome] = useState({ title: '', amount: '', source: 'Salary', date: new Date().toISOString().slice(0, 10) });
  const submitIncome = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...income, category: 'Income', type: 'income' }) });
      const data = await res.json();
      if (res.ok) { showToast('Income added!'); closeModal(); setIncome({ title: '', amount: '', source: 'Salary', date: new Date().toISOString().slice(0, 10) }); fetchData(); }
      else showToast(data.message || 'Failed', 'error');
    } catch { showToast('Error adding income', 'error'); }
    setLoading(false);
  };

  // Upload Receipt
  const [receipt, setReceipt] = useState(null);
  const submitReceipt = async (e) => {
    e.preventDefault();
    if (!receipt) { showToast('Please select a file', 'error'); return; }
    setLoading(true);
    const fd = new FormData(); fd.append('receipt', receipt);
    try {
      const res = await fetch('/api/ocr/process', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (res.ok) { 
        showToast('Receipt scanned! Please review details.'); 
        setReceipt(null); 
        setExpense({ 
          merchant: data.merchant || '', 
          amount: data.amount ? String(data.amount) : '', 
          category: data.category || 'Food', 
          date: data.date || new Date().toISOString().slice(0, 10), 
          notes: data.notes || '' 
        });
        setModal('expense'); 
      }
      else showToast(data.message || 'Failed', 'error');
    } catch { showToast('Error uploading receipt', 'error'); }
    setLoading(false);
  };

  // Transfer
  const [transfer, setTransfer] = useState({ from: 'Savings', to: 'Checking', amount: '', note: '' });
  const submitTransfer = (e) => {
    e.preventDefault();
    showToast(`Transfer of ₹${transfer.amount} recorded!`);
    closeModal();
    setTransfer({ from: 'Savings', to: 'Checking', amount: '', note: '' });
  };

  const getChartData = () => {
    const onlyExpenses = expenses.filter(e => e.type !== 'income');
    const today = new Date();
    let pointsCount = 7;
    let daysStep = 1;

    if (chartPeriod === 'week') {
      pointsCount = 7;
      daysStep = 1;
    } else {
      pointsCount = 10;
      daysStep = 3;
    }

    const dataPoints = [];
    for (let i = pointsCount - 1; i >= 0; i--) {
      const start = new Date(today);
      start.setDate(today.getDate() - i * daysStep);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + daysStep);

      // Sum expenses in this date range
      const sum = onlyExpenses
        .filter(e => {
          const d = new Date(e.date);
          return d >= start && d < end;
        })
        .reduce((s, e) => s + e.amount, 0);

      // Label
      let label = '';
      if (chartPeriod === 'week') {
        label = start.toLocaleDateString('en-IN', { weekday: 'short' });
      } else {
        label = start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      }

      dataPoints.push({ label, amount: sum });
    }

    // Default mock padding if no expenses exist yet
    const hasData = dataPoints.some(p => p.amount > 0);
    if (!hasData) {
      // Seed beautiful mock trends if the database is brand new!
      const mockAmounts = chartPeriod === 'week'
        ? [1200, 1500, 900, 3200, 1800, 2100, 1700]
        : [4500, 5200, 3100, 8900, 6200, 4800, 7100, 5300, 6800, 5900];
      return dataPoints.map((p, idx) => ({ ...p, amount: mockAmounts[idx] || 1500 }));
    }

    return dataPoints;
  };

  const getAiActionHeadline = () => {
    const onlyExpenses = expenses.filter(e => e.type !== 'income');
    if (onlyExpenses.length === 0) return '🤖 AI Suggestion: Add your first expense to begin real-time budget forecasting!';

    // Group spending by category
    const catSums = {};
    onlyExpenses.forEach(e => {
      catSums[e.category] = (catSums[e.category] || 0) + e.amount;
    });

    let topCat = 'Food';
    let topAmt = 0;
    Object.entries(catSums).forEach(([cat, amt]) => {
      if (amt > topAmt) {
        topAmt = amt;
        topCat = cat;
      }
    });

    if (topCat === 'Food') return '🤖 AI Suggestion: Dining out accounts for your highest spending. Try setting a tighter Food budget!';
    if (topCat === 'Shopping') return '🤖 AI Suggestion: Shopping overheads are peaking this week. Consider deferring non-essential purchases!';
    if (topCat === 'Bills') return '🤖 AI Suggestion: Recurring billing detected. Audit your active subscription licenses in Settings.';
    if (topCat === 'Utilities') return '🤖 AI Suggestion: Utility overheads identified. Unplug redundant appliances to lower month-end counts.';
    return `🤖 AI Suggestion: Spending is peaking in ${topCat}. Set a budget limit to optimize savings streaks.`;
  };

  const chartPoints = getChartData();
  const maxVal = Math.max(...chartPoints.map(p => p.amount), 1000);
  const xStep = 500 / (chartPoints.length - 1);

  // Coordinates
  const coords = chartPoints.map((p, idx) => {
    const x = idx * xStep;
    const y = 90 - (p.amount / maxVal) * 75;
    return { x, y, amount: p.amount, label: p.label };
  });

  // SVG Line path
  const linePath = coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = coords.length > 0
    ? `${linePath} L ${coords[coords.length - 1].x} 100 L ${coords[0].x} 100 Z`
    : '';

  // Max spike index
  let maxIdx = 0;
  let maxAmt = 0;
  coords.forEach((c, idx) => {
    if (c.amount > maxAmt) {
      maxAmt = c.amount;
      maxIdx = idx;
    }
  });
  const maxCoord = coords[maxIdx] || { x: 250, y: 30 };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // --- Dynamic Dashboard KPI Calculations ---
  const now = new Date();
  const currentMonthStr = now.toISOString().slice(0, 7);

  const currentMonthExpenses = expenses.filter(e => e.type !== 'income' && e.date.startsWith(currentMonthStr));
  const totalExpensesThisMonth = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const currentMonthIncomes = expenses.filter(e => e.type === 'income' && e.date.startsWith(currentMonthStr));
  const totalIncomeThisMonth = currentMonthIncomes.reduce((sum, e) => sum + e.amount, 0);

  // User logic: Budget is driven by their Income. Adding income should increase the remaining budget!
  const explicitBudgetLimits = budgets.reduce((sum, b) => sum + b.limit, 0);
  const totalBudgetLimit = Math.max(totalIncomeThisMonth, explicitBudgetLimits) || 0;

  const remainingBudget = Math.max(0, totalBudgetLimit - totalExpensesThisMonth);
  const budgetSpentPercent = totalBudgetLimit > 0 ? Math.round((totalExpensesThisMonth / totalBudgetLimit) * 100) : 0;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAverage = now.getDate() > 0 ? Math.round(totalExpensesThisMonth / now.getDate()) : 0;

  const savingsThisMonth = totalIncomeThisMonth - totalExpensesThisMonth;
  const savingsForecast = now.getDate() > 0 ? Math.round((savingsThisMonth / now.getDate()) * daysInMonth) : 0;

  const lastMonthDate = new Date();
  lastMonthDate.setMonth(now.getMonth() - 1);
  const lastMonthStr = lastMonthDate.toISOString().slice(0, 7);
  const lastMonthExpenses = expenses.filter(e => e.type !== 'income' && e.date.startsWith(lastMonthStr));
  const totalLastMonth = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  let vsLastMonth = 0;
  if (totalLastMonth > 0) {
    vsLastMonth = Math.round(((totalExpensesThisMonth - totalLastMonth) / totalLastMonth) * 100);
  }

  // Header dynamic subtext
  let headerSubtext = "Welcome! Let's start tracking your finances today. 🚀";
  let headerSubtextColor = "text-indigo-400";

  if (totalLastMonth > 0) {
    if (vsLastMonth < 0) {
      headerSubtext = `Excellent! Your spending dropped by ${Math.abs(vsLastMonth)}% this month. 📉`;
      headerSubtextColor = "text-emerald-400";
    } else if (vsLastMonth > 0) {
      headerSubtext = `Heads up! Your spending is up by ${Math.abs(vsLastMonth)}% compared to last month. 📈`;
      headerSubtextColor = "text-amber-400";
    } else {
      headerSubtext = `Your spending is exactly on par with last month. 📊`;
      headerSubtextColor = "text-cyan-400";
    }
  } else if (totalExpensesThisMonth > 0) {
    headerSubtext = `You've tracked ₹${totalExpensesThisMonth.toLocaleString()} in expenses so far this month.`;
    headerSubtextColor = "text-emerald-400";
  }

  // AI Coach Computations
  let aiScore = 100 - (budgetSpentPercent > 100 ? 100 : budgetSpentPercent);
  if (totalBudgetLimit === 0) aiScore = 100;
  if (aiScore < 0) aiScore = 0;

  let aiHeadline = "On Track ✅";
  let aiSubtext = "Great job! Keep up the good spending habits.";
  let aiHeadlineColor = "text-emerald-400";

  if (budgetSpentPercent > 100) {
    aiHeadline = "Overspending Risk ⚠️";
    aiHeadlineColor = "text-pink-500";
    aiSubtext = `Exceeded total budget by ₹${(totalExpensesThisMonth - totalBudgetLimit).toLocaleString()}. Please reduce spending.`;
  } else if (budgetSpentPercent > 80) {
    aiHeadline = "Budget Near Limit ⚠️";
    aiHeadlineColor = "text-amber-500";
    aiSubtext = `You've spent ${budgetSpentPercent}% of your budget. Slow down on non-essentials.`;
  } else if (currentMonthExpenses.length > 0) {
    const catSums = {};
    currentMonthExpenses.forEach(e => {
      catSums[e.category] = (catSums[e.category] || 0) + e.amount;
    });
    let topCat = null;
    let topAmt = 0;
    Object.entries(catSums).forEach(([cat, amt]) => {
      if (amt > topAmt) {
        topAmt = amt;
        topCat = cat;
      }
    });
    if (topCat) {
      aiHeadline = "Spending Insight 💡";
      aiHeadlineColor = "text-indigo-400";
      aiSubtext = `${topCat} is your highest expense (₹${topAmt.toLocaleString()}). Try to cut back here.`;
      const ratio = topAmt / (totalIncomeThisMonth || totalExpensesThisMonth || 1);
      aiScore = Math.max(40, 100 - Math.round(ratio * 100));
    }
  } else {
    aiHeadline = "Ready to Start 🚀";
    aiHeadlineColor = "text-indigo-400";
    aiSubtext = "Add your first expense or budget to get AI insights!";
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex">
      {/* Sidebar */}
      <div className="w-64 glass border-r border-slate-800/50 p-6 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="mb-10 text-2xl font-bold text-gradient">FinTrack AI</div>
          <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
            <a href="#" className="flex items-center space-x-3 text-indigo-400 font-medium p-2.5 bg-slate-800/50 rounded-xl">
              <span>📊</span><span>Dashboard</span>
            </a>
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
            <Link to="/notifications" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>🔔</span><span>Notifications</span>
            </Link>
            <Link to="/settings" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>⚙️</span><span>Settings</span>
            </Link>
            <Link to="/help-center" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>❓</span><span>Help Center</span>
            </Link>
            <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }} className="flex items-center space-x-3 text-red-400 hover:text-red-300 p-2.5 hover:bg-red-900/20 rounded-xl transition-all">
              <span>🚪</span><span>Logout</span>
            </a>
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center font-bold">
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <div className="font-medium">{user.name}</div>
              <div className="text-xs text-slate-500">Premium Plan</div>
            </div>
          </div>
          <div className="text-xs text-slate-600 flex items-center space-x-1 justify-center">
            <span>🔒</span>
            <span>Bank-level encrypted</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        <header className="mb-10">
          {/* Top Bar */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 bg-slate-900/50 p-4 rounded-xl glass gap-4 relative z-40">
            {/* Left Side: Greeting */}
            <div className="flex flex-col">
              <h1 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                {greeting}, {user.name ? user.name.split(' ')[0] : 'User'} 👋
              </h1>
              <p className={`text-xs font-medium ${headerSubtextColor}`}>{headerSubtext}</p>
            </div>

            {/* Center: Search Bar */}
            <div className="flex-1 max-w-md w-full relative">
              <input
                type="text"
                placeholder="Search transactions, budgets, reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800/70 border border-slate-700/50 rounded-lg pl-9 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-inner"
              />
              <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>

              {/* Global Search Dropdown */}
              {searchTerm && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-[100] max-h-[80vh] overflow-y-auto">
                  <div className="p-3 space-y-4">
                    {/* Navigation Links */}
                    {['budget', 'report', 'notification', 'setting', 'expense'].filter(kw => kw.includes(searchTerm.toLowerCase())).length > 0 && (
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase px-2 mb-1.5 tracking-wider">Pages & Reports</div>
                        {['budget', 'report', 'notification', 'setting', 'expense'].filter(kw => kw.includes(searchTerm.toLowerCase())).map(kw => (
                          <Link key={kw} to={`/${kw}s`} className="block px-3 py-2 hover:bg-slate-800 rounded-lg text-sm text-indigo-400 transition-colors font-medium">
                            {kw === 'expense' ? 'View Expenses' : `Navigate to ${kw.charAt(0).toUpperCase() + kw.slice(1)}s`} →
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* Subscriptions */}
                    {upcomingBills.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 && (
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase px-2 mb-1.5 tracking-wider">Subscriptions</div>
                        {upcomingBills.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())).map(b => (
                          <div key={b.id} className="px-3 py-2 hover:bg-slate-800 rounded-lg text-sm text-slate-200 flex justify-between">
                            <span>{b.name}</span>
                            <span className="text-xs text-amber-500">{b.timeStr}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Transactions */}
                    {(() => {
                      const st = searchTerm.toLowerCase();
                      const trans = expenses.filter(e =>
                        (e.merchant || e.title || '').toLowerCase().includes(st) ||
                        (e.category || '').toLowerCase().includes(st) ||
                        new Date(e.date).toLocaleDateString('en-IN', { month: 'short' }).toLowerCase().includes(st)
                      );
                      if (trans.length === 0) return null;
                      return (
                        <div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase px-2 mb-1.5 tracking-wider">Transactions ({trans.length})</div>
                          {trans.slice(0, 10).map((e, idx) => (
                            <div key={idx} className="px-3 py-2 hover:bg-slate-800 rounded-lg text-sm text-slate-200 flex justify-between">
                              <span className="flex items-center gap-2">
                                {e.merchant || e.title}
                                <span className="text-[9px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded-full">{e.category}</span>
                              </span>
                              <span className={`font-bold ${e.type === 'income' ? 'text-emerald-400' : 'text-white'}`}>
                                {e.type === 'income' ? '+' : '-'}₹{e.amount}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    {/* No results */}
                    {!expenses.some(e => (e.merchant || e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || (e.category || '').toLowerCase().includes(searchTerm.toLowerCase()) || new Date(e.date).toLocaleDateString('en-IN', { month: 'short' }).toLowerCase().includes(searchTerm.toLowerCase())) &&
                      !upcomingBills.some(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
                      !['budget', 'report', 'notification', 'setting', 'expense'].some(kw => kw.includes(searchTerm.toLowerCase())) && (
                        <div className="p-6 text-center">
                          <div className="text-2xl mb-2">🔍</div>
                          <div className="text-sm text-slate-300 font-medium">No matches found for "{searchTerm}"</div>
                          <div className="text-xs text-slate-500 mt-1">Try searching for Food, Swiggy, or May report</div>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Selectors & Actions */}
            <div className="flex items-center justify-end space-x-4 w-full lg:w-auto">
              <select className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option>May 2026</option>
                <option>April 2026</option>
                <option>March 2026</option>
              </select>
              {/* Bell — click-toggle notification panel */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotifications(o => !o)}
                  className="text-slate-400 hover:text-white transition-colors relative text-xl"
                >
                  <span>🔔</span>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-3 w-80 bg-slate-900 border border-slate-700/60 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
                      <span className="text-sm font-bold text-white">🔔 Notifications</span>
                      <div className="flex gap-2">
                        <button onClick={markAllRead} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold">Mark all read</button>
                        <button onClick={() => setShowNotifications(false)} className="text-slate-500 hover:text-white text-xs ml-2">✕</button>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs">No notifications</div>
                      ) : notifications.map(n => (
                        <div key={n.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors ${n.isRead ? 'opacity-50' : ''}`}>
                          <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 bg-${n.color}-400`}></div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs font-semibold text-${n.color}-400`}>{n.title}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{n.msg}</div>
                          </div>
                          <button onClick={() => dismissNotif(n.id)} className="text-slate-600 hover:text-slate-300 text-xs shrink-0">✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2 border-t border-slate-800 text-center">
                      <Link to="/notifications" onClick={() => setShowNotifications(false)} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold">View all notifications →</Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Moon — dark/light toggle */}
              <button
                onClick={toggleDarkMode}
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="text-slate-400 hover:text-white transition-all text-lg hover:scale-110 active:scale-95"
              >
                <span>{darkMode ? '🌙' : '☀️'}</span>
              </button>
              <div className="flex items-center space-x-2 cursor-pointer border-l border-slate-700 pl-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-sm shadow-md">{user.name ? user.name[0].toUpperCase() : 'U'}</div>
                <span className="text-sm font-medium hidden sm:block">{user.name ? user.name.split(' ')[0] : 'User'}</span>
              </div>
            </div>
          </div>

          {/* Page Title & Action */}
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setDropdownOpen(o => !o)} className="btn-gradient flex items-center space-x-2">
              <span>+ Add Action</span>
              <span className="text-xs">{dropdownOpen ? '▲' : '▼'}</span>
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 mt-2 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50">
                <div className="p-2 space-y-1">
                  <button onClick={() => { setModal('expense'); setDropdownOpen(false); }} className="w-full flex items-center space-x-2 p-2 hover:bg-slate-800 rounded-lg transition-colors text-sm text-left">
                    <span>💸</span><span>Add Expense</span>
                  </button>
                  <button onClick={() => { setModal('receipt'); setDropdownOpen(false); }} className="w-full flex items-center space-x-2 p-2 hover:bg-slate-800 rounded-lg transition-colors text-sm text-left">
                    <span>📄</span><span>Upload Receipt</span>
                  </button>
                  <button onClick={() => { setModal('income'); setDropdownOpen(false); }} className="w-full flex items-center space-x-2 p-2 hover:bg-slate-800 rounded-lg transition-colors text-sm text-left">
                    <span>💰</span><span>Add Income</span>
                  </button>
                  <button onClick={() => { setModal('transfer'); setDropdownOpen(false); }} className="w-full flex items-center space-x-2 p-2 hover:bg-slate-800 rounded-lg transition-colors text-sm text-left">
                    <span>🔄</span><span>Transfer</span>
                  </button>
                  <Link to="/budgets" className="w-full flex items-center space-x-2 p-2 hover:bg-slate-800 rounded-lg transition-colors text-sm text-left">
                    <span>🎯</span><span>Set Budget</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* SECTION 2 — Primary KPI Cards (Reduced to 4) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card 1: Total Expenses */}
          <div className="glass-card flex flex-col justify-between p-5">
            <div>
              <div className="text-slate-400 mb-1 text-xs uppercase tracking-wider">Total Expenses</div>
              <div className="text-3xl font-bold text-white">₹{totalExpensesThisMonth.toLocaleString()}</div>
              <div className={`text-xs mt-1 flex items-center ${vsLastMonth > 0 ? 'text-pink-500' : 'text-emerald-400'}`}>
                <span>{vsLastMonth > 0 ? '↑' : '↓'} {Math.abs(vsLastMonth)}%</span>
                <span className="ml-1 text-slate-500">vs last month</span>
              </div>
            </div>
            <div className="h-8 mt-3">
              <svg className={`w-full h-full ${vsLastMonth > 0 ? 'text-pink-500' : 'text-indigo-500'}`} viewBox="0 0 100 20">
                <path d="M 0 15 Q 20 5, 40 12 T 80 2 T 100 10" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Card 2: Remaining Budget */}
          <div className="glass-card flex flex-col justify-between p-5">
            <div>
              <div className="text-slate-400 mb-1 text-xs uppercase tracking-wider">Remaining Budget</div>
              <div className={`text-3xl font-bold ${remainingBudget === 0 && totalBudgetLimit > 0 ? 'text-pink-500' : 'text-emerald-400'}`}>
                ₹{remainingBudget.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {totalBudgetLimit > 0 ? `${budgetSpentPercent}% spent • Daily: ₹${dailyAverage.toLocaleString()}` : 'No active budgets'}
              </div>
            </div>
            <div className="h-8 mt-3">
              <svg className={`w-full h-full ${remainingBudget === 0 && totalBudgetLimit > 0 ? 'text-pink-500' : 'text-emerald-500'}`} viewBox="0 0 100 20">
                <path d="M 0 5 Q 20 15, 40 10 T 80 18 T 100 5" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Card 3: Savings This Month */}
          <div className="glass-card flex flex-col justify-between p-5">
            <div>
              <div className="text-slate-400 mb-1 text-xs uppercase tracking-wider">Savings This Month</div>
              <div className={`text-3xl font-bold ${savingsThisMonth < 0 ? 'text-pink-500' : 'text-cyan-400'}`}>
                {savingsThisMonth < 0 ? '-' : ''}₹{Math.abs(savingsThisMonth).toLocaleString()}
              </div>
              <div className={`text-xs mt-1 ${savingsForecast < 0 ? 'text-pink-500/70' : 'text-cyan-400/70'}`}>
                Forecast: {savingsForecast < 0 ? '-' : ''}₹{Math.abs(savingsForecast).toLocaleString()}
              </div>
            </div>
            <div className="h-8 mt-3">
              <svg className={`w-full h-full ${savingsThisMonth < 0 ? 'text-pink-500' : 'text-cyan-500'}`} viewBox="0 0 100 20">
                <path d="M 0 15 L 20 12 L 40 14 L 60 8 L 80 5 L 100 2" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Card 4: AI Financial Coach (Compact) */}
          <div className="glass-card flex flex-col justify-between p-5 border border-indigo-500/30">
            <div>
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs text-slate-400 uppercase tracking-wider">AI Coach</div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${aiScore < 50 ? 'bg-pink-600/30 text-pink-400' : aiScore < 80 ? 'bg-amber-600/30 text-amber-400' : 'bg-indigo-600/30 text-indigo-300'}`}>
                  Score: {aiScore}
                </span>
              </div>
              <div className={`text-sm font-bold mb-2 ${aiHeadlineColor}`}>{aiHeadline}</div>
              <div className="text-xs text-slate-300 line-clamp-2" title={aiSubtext}>{aiSubtext}</div>
            </div>
            <Link to="/analytics" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium mt-2 flex items-center justify-between">
              <span>View Full Insights</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* SECTION 3 — Main Analytics Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left (70%) — Spending Trends Chart */}
          <div className="lg:col-span-2 glass-card h-72 flex flex-col justify-between p-5">
            <div className="flex flex-col mb-2 space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Spending Trends</h2>
                <div className="text-xs text-indigo-400 mt-0.5 flex items-center">
                  <span>{getAiActionHeadline()}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <div className="flex bg-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setChartType('line')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${chartType === 'line' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Line
                  </button>
                  <button
                    onClick={() => setChartType('bar')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${chartType === 'bar' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Bar
                  </button>
                </div>
                <div className="flex bg-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setChartPeriod('week')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${chartPeriod === 'week' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setChartPeriod('month')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${chartPeriod === 'month' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Month
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center text-slate-600 relative mt-2 mb-6">
              {chartType === 'line' ? (
                <svg className="w-full h-full max-h-40 text-indigo-500/30 overflow-visible" viewBox="0 0 500 100">
                  <path d={linePath} fill="none" stroke="#6366F1" strokeWidth="3" className="drop-shadow-[0_2px_8px_rgba(99,102,241,0.4)]" />
                  <path d={areaPath} fill="url(#chart-grad)" opacity="0.15" />
                  <defs>
                    <linearGradient id="chart-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>

                  {coords.map((c, idx) => (
                    <g key={idx} className="group">
                      <circle cx={c.x} cy={c.y} r="5" fill="#6366F1" className="cursor-pointer hover:r-7 transition-all" />
                      <text x={c.x} y={c.y - 12} textAnchor="middle" fill="#FFFFFF" className="text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 px-1 py-0.5 rounded pointer-events-none">
                        ₹{c.amount.toLocaleString()}
                      </text>
                    </g>
                  ))}

                  {maxAmt > 0 && (
                    <>
                      <circle cx={maxCoord.x} cy={maxCoord.y} r="5" fill="#EC4899" className="animate-pulse" />
                      <circle cx={maxCoord.x} cy={maxCoord.y} r="8" stroke="#EC4899" strokeWidth="1.5" fill="none" className="animate-ping opacity-75" />
                    </>
                  )}
                </svg>
              ) : (
                <svg className="w-full h-full max-h-40 text-indigo-500/30 overflow-visible" viewBox="0 0 500 100">
                  <defs>
                    <linearGradient id="bar-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#818CF8" />
                      <stop offset="100%" stopColor="#312E81" opacity="0.3" stopOpacity="0.3" />
                    </linearGradient>
                    <linearGradient id="spike-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#F472B6" />
                      <stop offset="100%" stopColor="#9D174D" opacity="0.3" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>
                  {coords.map((c, idx) => {
                    const barWidth = Math.min(24, 400 / coords.length);
                    const xPos = c.x - barWidth / 2;
                    const barHeight = Math.max(5, 100 - c.y);
                    const isSpike = idx === maxIdx && maxAmt > 0;
                    return (
                      <g key={idx} className="group cursor-pointer">
                        <rect
                          x={xPos}
                          y={c.y}
                          width={barWidth}
                          height={barHeight}
                          rx="4"
                          fill={isSpike ? "url(#spike-grad)" : "url(#bar-grad)"}
                          className="transition-all hover:opacity-90 duration-200"
                        />
                        <text
                          x={c.x}
                          y={c.y - 8}
                          textAnchor="middle"
                          fill={isSpike ? "#F472B6" : "#A5B4FC"}
                          className="text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ₹{c.amount.toLocaleString()}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}

              {maxAmt > 0 && (
                <div
                  className="absolute bg-pink-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-lg flex items-center gap-1 backdrop-blur-sm transition-all pointer-events-none"
                  style={{
                    top: `${Math.max(5, maxCoord.y - 30)}px`,
                    left: `${Math.max(10, Math.min(420, maxCoord.x - 30))}px`
                  }}
                >
                  🔥 Spike: ₹{maxAmt.toLocaleString()}
                </div>
              )}

              <div className="absolute bottom-[-22px] left-0 right-0 flex justify-between px-1 text-[8px] text-slate-500 font-semibold uppercase tracking-wider">
                {coords.map((c, idx) => (
                  <span key={idx} className="truncate text-center" style={{ width: `${100 / coords.length}%` }}>
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right (30%) — Recent Transactions */}
          <div className="glass-card h-72 flex flex-col p-5 overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-white">Transactions</h2>
              <Link to="/expenses" className="text-xs text-indigo-400 hover:text-indigo-300">View All</Link>
            </div>

            {expenses.filter(e =>
              (e.merchant || e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
              (e.category || '').toLowerCase().includes(searchTerm.toLowerCase())
            ).length > 0 ? (
              <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                {expenses.filter(e =>
                  (e.merchant || e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (e.category || '').toLowerCase().includes(searchTerm.toLowerCase())
                ).slice(0, 3).map((exp, idx) => (
                  <div key={exp._id || idx} className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base bg-slate-850 p-1.5 rounded-lg border border-slate-800">
                        {exp.type === 'income' ? '💰' : '💸'}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate max-w-[100px]">{exp.merchant || exp.title || 'Expense'}</div>
                        <div className="text-[10px] text-slate-500">{new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black ${exp.type === 'income' ? 'text-emerald-400' : 'text-white'}`}>
                        {exp.type === 'income' ? '+' : '-'}₹{exp.amount.toLocaleString()}
                      </div>
                      <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-medium">
                        {exp.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchTerm ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <div className="text-slate-500 text-xs mb-3">No matching transactions found.</div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xl mb-2">💸</div>
                <div className="text-white text-sm font-medium mb-1">No transactions yet</div>
                <p className="text-slate-500 text-xs mb-3">Start tracking your expenses.</p>
                <button onClick={() => setModal('expense')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer">+ Add</button>
              </div>
            )}
          </div>
        </div>



        {/* SECTION 5 — Compact Bottom Widgets (Quick Preview) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Bills Widget */}
          <div className="glass-card p-4 flex flex-col justify-between h-32">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Upcoming Bills</div>
              <div className="space-y-1 text-xs">
                {upcomingBills.length > 0 ? (
                  upcomingBills.map(b => (
                    <div key={b.id} className="flex justify-between">
                      <span className="text-white truncate max-w-[100px]">{b.name}</span>
                      <span className={b.days <= 3 ? "text-pink-500" : "text-amber-500"}>{b.timeStr}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 italic">No upcoming bills</div>
                )}
              </div>
            </div>
            <button className="text-xs text-indigo-400 hover:text-indigo-300 text-left">View All Bills →</button>
          </div>

          {/* Goals Widget */}
          <div className="glass-card p-4 flex flex-col justify-between h-32">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                <span>Financial Goals</span>
                <button onClick={handleEditGoal} className="text-indigo-400 hover:text-indigo-300">Edit ✎</button>
              </div>
              {goal.name ? (
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-white truncate max-w-[100px]" title={goal.name}>{goal.name}</span>
                      <span className="text-cyan-400">{goal.progress}%</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full transition-all duration-500" style={{ width: `${goal.progress}%` }}></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 italic mt-2 text-xs">
                  No goal set. Add a target!
                </div>
              )}
            </div>
            <button onClick={handleEditGoal} className="text-xs text-indigo-400 hover:text-indigo-300 text-left">Update Goal →</button>
          </div>

          {/* Subscriptions Widget */}
          <div className="glass-card p-4 flex flex-col justify-between h-32">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Subscriptions</div>
              <div className="text-2xl font-bold text-white">{subCount} Active</div>
              <div className="text-xs text-slate-500 mt-1">₹{subCost.toLocaleString()} / month</div>
            </div>
            <Link to="/subscriptions" className="text-xs text-indigo-400 hover:text-indigo-300 text-left">Manage →</Link>
          </div>

          {/* Notifications Widget */}
          <div className="glass-card p-4 flex flex-col justify-between h-32">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Notifications</div>
              <div className="space-y-1 text-xs">
                {notifications.filter(n => !n.isRead).length > 0 ? notifications.filter(n => !n.isRead).slice(0, 2).map(n => (
                  <div key={n.id} className={`text-${n.color}-400 truncate`} title={n.title}>
                    {n.title}
                  </div>
                )) : (
                  <div className="text-slate-500 italic">No new alerts</div>
                )}
              </div>
            </div>
            <Link to="/notifications" className="text-xs text-indigo-400 hover:text-indigo-300 text-left">View All →</Link>
          </div>
        </div>
      </div>

      {/* Floating AI Chat Widget */}
      <div className="fixed bottom-6 right-6 z-50">
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-full shadow-2xl flex items-center space-x-2 transition-all transform hover:scale-105">
          <span className="text-xl">💬</span>
          <span className="font-medium text-sm">Ask FinTrack AI</span>
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
        </div>
      )}

      {/* Modal Backdrop */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>

            {/* Add Expense Modal */}
            {modal === 'expense' && (
              <>
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-xl font-bold text-white">💸 Add Expense</h2>
                  <button onClick={closeModal} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <form onSubmit={submitExpense} className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Merchant / Title</label>
                    <input required className="w-full glass-input" placeholder="e.g. Swiggy, Amazon" value={expense.merchant} onChange={e => setExpense({ ...expense, merchant: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Amount (₹)</label>
                      <input required type="number" min="1" className="w-full glass-input" placeholder="0" value={expense.amount} onChange={e => setExpense({ ...expense, amount: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Category</label>
                      <select className="w-full glass-input" value={expense.category} onChange={e => setExpense({ ...expense, category: e.target.value })}>
                        {['Food', 'Shopping', 'Transport', 'Entertainment', 'Health', 'Education', 'Bills', 'Other'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Date</label>
                    <input type="date" required className="w-full glass-input" value={expense.date} onChange={e => setExpense({ ...expense, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
                    <input className="w-full glass-input" placeholder="Any note..." value={expense.notes} onChange={e => setExpense({ ...expense, notes: e.target.value })} />
                  </div>
                  <button type="submit" disabled={loading} className="w-full btn-gradient mt-2">{loading ? 'Saving...' : 'Add Expense'}</button>
                </form>
              </>
            )}

            {/* Upload Receipt Modal */}
            {modal === 'receipt' && (
              <>
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-xl font-bold text-white">📄 Upload Receipt</h2>
                  <button onClick={closeModal} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <form onSubmit={submitReceipt} className="space-y-4">
                  <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 transition-colors" onClick={() => document.getElementById('receiptFile').click()}>
                    <div className="text-4xl mb-2">📷</div>
                    <p className="text-slate-400 text-sm">{receipt ? receipt.name : 'Click to select receipt image'}</p>
                    <p className="text-slate-600 text-xs mt-1">PNG, JPG, PDF supported</p>
                    <input id="receiptFile" type="file" accept="image/*,.pdf" className="hidden" onChange={e => setReceipt(e.target.files[0])} />
                  </div>
                  <p className="text-xs text-indigo-400">🤖 AI will auto-extract expense details from your receipt.</p>
                  <button type="submit" disabled={loading || !receipt} className="w-full btn-gradient">{loading ? 'Scanning...' : 'Upload & Scan'}</button>
                </form>
              </>
            )}

            {/* Add Income Modal */}
            {modal === 'income' && (
              <>
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-xl font-bold text-white">💰 Add Income</h2>
                  <button onClick={closeModal} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <form onSubmit={submitIncome} className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Title</label>
                    <input required className="w-full glass-input" placeholder="e.g. Monthly Salary" value={income.title} onChange={e => setIncome({ ...income, title: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Amount (₹)</label>
                      <input required type="number" min="1" className="w-full glass-input" placeholder="0" value={income.amount} onChange={e => setIncome({ ...income, amount: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Source</label>
                      <select className="w-full glass-input" value={income.source} onChange={e => setIncome({ ...income, source: e.target.value })}>
                        {['Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Date</label>
                    <input type="date" required className="w-full glass-input" value={income.date} onChange={e => setIncome({ ...income, date: e.target.value })} />
                  </div>
                  <button type="submit" disabled={loading} className="w-full btn-gradient mt-2">{loading ? 'Saving...' : 'Add Income'}</button>
                </form>
              </>
            )}

            {/* Transfer Modal */}
            {modal === 'transfer' && (
              <>
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-xl font-bold text-white">🔄 Transfer</h2>
                  <button onClick={closeModal} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <form onSubmit={submitTransfer} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">From</label>
                      <select className="w-full glass-input" value={transfer.from} onChange={e => setTransfer({ ...transfer, from: e.target.value })}>
                        {['Savings', 'Checking', 'Cash', 'Investment'].map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">To</label>
                      <select className="w-full glass-input" value={transfer.to} onChange={e => setTransfer({ ...transfer, to: e.target.value })}>
                        {['Checking', 'Savings', 'Cash', 'Investment'].map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Amount (₹)</label>
                    <input required type="number" min="1" className="w-full glass-input" placeholder="0" value={transfer.amount} onChange={e => setTransfer({ ...transfer, amount: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Note (optional)</label>
                    <input className="w-full glass-input" placeholder="Reason for transfer..." value={transfer.note} onChange={e => setTransfer({ ...transfer, note: e.target.value })} />
                  </div>
                  <button type="submit" className="w-full btn-gradient mt-2">Record Transfer</button>
                </form>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;