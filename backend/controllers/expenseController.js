const prisma = require('../config/prismaClient');

// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Private
exports.getExpenses = async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'desc' },
    });
    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create an expense
// @route   POST /api/expenses
exports.createExpense = async (req, res) => {
  try {
    const { amount, category, merchant, date, notes, type } = req.body;

    const expense = await prisma.expense.create({
      data: {
        userId: req.user.id,
        amount: parseFloat(amount),
        category,
        merchant,
        date: date ? new Date(date) : new Date(),
        notes,
        type: type || 'expense',
      },
    });

    // Budget Engine Check
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const budget = await prisma.budget.findFirst({
      where: {
        userId: req.user.id,
        category,
        month: currentMonth,
      },
    });

    if (budget) {
      const startOfMonth = new Date(`${currentMonth}-01`);
      const startOfNextMonth = new Date(startOfMonth);
      startOfNextMonth.setMonth(startOfNextMonth.getMonth() + 1);

      const monthExpenses = await prisma.expense.findMany({
        where: {
          userId: req.user.id,
          category,
          date: {
            gte: startOfMonth,
            lt: startOfNextMonth,
          },
        },
      });

      const totalSpent = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

      if (totalSpent > budget.limit) {
        console.log(`ALERT: Budget exceeded for ${category}. Limit: ${budget.limit}, Spent: ${totalSpent}`);
        // TODO: Send email notification using Nodemailer
      }
    }

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private
exports.deleteExpense = async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id },
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Make sure user owns expense
    if (expense.userId !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await prisma.expense.delete({ where: { id: req.params.id } });

    res.status(200).json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete all expenses for the logged-in user
// @route   DELETE /api/expenses
// @access  Private
exports.deleteAllExpenses = async (req, res) => {
  try {
    await prisma.expense.deleteMany({ where: { userId: req.user.id } });
    res.status(200).json({ message: 'All expenses deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};