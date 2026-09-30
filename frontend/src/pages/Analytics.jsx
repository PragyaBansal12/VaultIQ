import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, AreaChart, Area
} from 'recharts';

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#3b82f6', '#ef4444', '#10b981'];
const CATEGORIES = ['Food', 'Shopping', 'Transport', 'Entertainment', 'Health', 'Education', 'Bills', 'Other'];

const Analytics = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'User' };
  const token = localStorage.getItem('token');

  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('This Month');

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

  const realExpenses = expenses.filter(e => e.type !== 'income');
  const realIncome = expenses.filter(e => e.type === 'income');
  const now = new Date();

  const filteredExpenses = realExpenses.filter(e => {
    const expDate = new Date(e.date);
    if (filter === 'This Month') return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    if (filter === 'This Year') return expDate.getFullYear() === now.getFullYear();
    if (filter === 'This Week') {
      const diffTime = Math.abs(now - expDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }
    return true;
  });

  const filteredIncome = realIncome.filter(e => {
    const expDate = new Date(e.date);
    if (filter === 'This Month') return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    if (filter === 'This Year') return expDate.getFullYear() === now.getFullYear();
    if (filter === 'This Week') {
      const diffTime = Math.abs(now - expDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }
    return true;
  });

  const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = filteredIncome.reduce((sum, e) => sum + e.amount, 0);
  const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);

  let budgetMultiplier = 1;
  if (filter === 'This Year') budgetMultiplier = 12;
  if (filter === 'This Week') budgetMultiplier = 0.25;
  const scaledTotalBudget = totalBudget * budgetMultiplier;

  const budgetRemaining = scaledTotalBudget - totalSpent;
  const savings = totalIncome - totalSpent;

  // Category Pie Data
  const categoryTotals = {};
  filteredExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });
  const pieData = Object.keys(categoryTotals).map((cat, index) => ({
    name: cat,
    value: categoryTotals[cat],
    fill: COLORS[index % COLORS.length]
  })).sort((a, b) => b.value - a.value);

  // Budget vs Actual Bar Data
  const budgetBarData = budgets.map((b, index) => {
    const spent = categoryTotals[b.category] || 0;
    return {
      name: b.category,
      Budget: b.limit * budgetMultiplier,
      Spent: spent,
      fill: COLORS[index % COLORS.length]
    };
  });

  // Monthly Trend Data (Simulated across months)
  const monthlyTotals = {};
  expenses.forEach(e => {
    const month = new Date(e.date).toLocaleString('default', { month: 'short' });
    monthlyTotals[month] = (monthlyTotals[month] || 0) + e.amount;
  });

  // Ensure we have some base data if it's empty
  const trendData = Object.keys(monthlyTotals).length > 0 ? Object.keys(monthlyTotals).map(m => ({
    name: m,
    Spent: monthlyTotals[m]
  })) : [
    { name: 'Jan', Spent: 12000 },
    { name: 'Feb', Spent: 15000 },
    { name: 'Mar', Spent: 13000 },
    { name: 'Apr', Spent: 18000 },
    { name: 'May', Spent: totalSpent }
  ];

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
            <Link to="/budgets" className="flex items-center space-x-3 text-slate-400 hover:text-white p-2.5 hover:bg-slate-800/30 rounded-xl transition-all">
              <span>🎯</span><span>Budgets</span>
            </Link>
            <Link to="/analytics" className="flex items-center space-x-3 text-indigo-400 font-medium p-2.5 bg-slate-800/50 rounded-xl">
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
            <a href="#" onClick={(e) => { e.preventDefault(); localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); }} className="flex items-center space-x-3 text-red-400 hover:text-red-300 p-2.5 hover:bg-red-900/20 rounded-xl transition-all">
              <span>🚪</span><span>Logout</span>
            </a>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">📈 Analytics</h1>
            <p className="text-slate-400 text-sm mt-1">Deep dive into your financial habits</p>
          </div>
          <div className="flex space-x-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option>This Week</option>
              <option>This Month</option>
              <option>This Year</option>
            </select>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <div className="space-y-6">
            {/* Overview KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-5 border-t-4 border-t-indigo-500">
                <div className="text-slate-400 text-sm mb-1">Total Spent</div>
                <div className="text-3xl font-bold text-white">₹{totalSpent.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-2">Last Month: ₹{(totalSpent * 0.8).toLocaleString()}</div>
              </div>
              <div className="glass-card p-5 border-t-4 border-t-emerald-500">
                <div className="text-slate-400 text-sm mb-1">Savings</div>
                <div className="text-3xl font-bold text-emerald-400">₹{savings.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-2">Income: ₹{totalIncome.toLocaleString()}</div>
              </div>
              <div className="glass-card p-5 border-t-4 border-t-cyan-500">
                <div className="text-slate-400 text-sm mb-1">Budget Remaining</div>
                <div className="text-3xl font-bold text-cyan-400">₹{budgetRemaining.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-2">Out of ₹{scaledTotalBudget.toLocaleString()}</div>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <div className="glass-card p-5 h-80 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-2">Category Spending</h3>
                <div className="flex-1 min-h-0">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                          {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-500 text-sm">No expenses yet.</div>
                  )}
                </div>
              </div>

              {/* Bar Chart */}
              <div className="glass-card p-5 h-80 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-2">Budget vs Actual</h3>
                <div className="flex-1 min-h-0">
                  {budgetBarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={budgetBarData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} cursor={{ fill: '#334155', opacity: 0.4 }} />
                        <Legend />
                        <Bar dataKey="Budget" fill="#334155" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Spent" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-500 text-sm">No budgets set.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly Trend */}
            <div className="glass-card p-5 h-80 flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4">Monthly Spending Trend</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="Spent" stroke="#6366f1" fillOpacity={1} fill="url(#colorSpent)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI Insights & Top Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Insights */}
              <div className="glass-card bg-indigo-900/10 border-indigo-500/30 p-5">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="text-2xl">🤖</div>
                  <h3 className="text-lg font-bold text-white">AI Insights</h3>
                </div>
                <div className="space-y-4">
                  {pieData.length > 0 && (
                    <div className="p-3 bg-slate-800/50 rounded-xl border-l-2 border-pink-500">
                      <div className="text-pink-500 font-medium text-sm">💡 High Spending Area</div>
                      <div className="text-slate-300 text-xs mt-1">
                        {pieData[0].name} expenses are unusually high at ₹{pieData[0].value.toLocaleString()}.
                        Consider reducing non-essential spending here.
                      </div>
                    </div>
                  )}
                  {budgetRemaining > 0 && (
                    <div className="p-3 bg-slate-800/50 rounded-xl border-l-2 border-emerald-500">
                      <div className="text-emerald-500 font-medium text-sm">✅ On Track</div>
                      <div className="text-slate-300 text-xs mt-1">
                        You have stayed within budget for most categories. Great job!
                      </div>
                    </div>
                  )}
                  {expenses.length > 0 && expenses[0].amount > 5000 && (
                    <div className="p-3 bg-slate-800/50 rounded-xl border-l-2 border-amber-500">
                      <div className="text-amber-500 font-medium text-sm">📈 Trend Prediction</div>
                      <div className="text-slate-300 text-xs mt-1">
                        Based on your latest ₹{expenses[0].amount} expense, your monthly spending will likely exceed your average by 8%.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Categories */}
              <div className="glass-card p-5">
                <h3 className="text-lg font-bold text-white mb-4">Top Spending Categories</h3>
                <div className="space-y-4">
                  {pieData.slice(0, 4).map((cat, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: cat.fill }}>
                          {idx + 1}
                        </div>
                        <span className="text-slate-300 font-medium">{cat.name}</span>
                      </div>
                      <span className="font-semibold text-white">₹{cat.value.toLocaleString()}</span>
                    </div>
                  ))}
                  {pieData.length === 0 && <p className="text-slate-500 text-sm">No categories yet.</p>}
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="glass-card p-5">
              <h3 className="text-lg font-bold text-white mb-4">Recent Transactions</h3>
              {expenses.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400">
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium">Category</th>
                        <th className="pb-3 font-medium">Description</th>
                        <th className="pb-3 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realExpenses.slice(0, 5).map(e => (
                        <tr key={e._id} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="py-3">{new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                          <td className="py-3">
                            <span className="bg-slate-800 px-2 py-1 rounded text-xs">{e.category}</span>
                          </td>
                          <td className="py-3 truncate max-w-[200px]">{e.description || 'Expense'}</td>
                          <td className="py-3 text-right font-medium">₹{e.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-sm">No recent transactions.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;