const prisma = require('../config/prismaClient');

// @desc    Get all budgets for user
// @route   GET /api/budgets
// @access  Private
exports.getBudgets = async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const budgets = await prisma.budget.findMany({
      where: { userId: req.user.id, month: currentMonth },
    });
    res.status(200).json(budgets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Set or update a budget
// @route   POST /api/budgets
// @access  Private
exports.setBudget = async (req, res) => {
  try {
    const { category, limit } = req.body;
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Use upsert — creates if not found, updates if it exists
    const budget = await prisma.budget.upsert({
      where: {
        userId_category_month: {
          userId: req.user.id,
          category,
          month: currentMonth,
        },
      },
      update: { limit: parseFloat(limit) },
      create: {
        userId: req.user.id,
        category,
        limit: parseFloat(limit),
        month: currentMonth,
      },
    });

    res.status(200).json(budget);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a budget
// @route   DELETE /api/budgets/:id
// @access  Private
exports.deleteBudget = async (req, res) => {
  try {
    const budget = await prisma.budget.findUnique({ where: { id: req.params.id } });
    if (!budget) return res.status(404).json({ message: 'Budget not found' });
    if (budget.userId !== req.user.id) return res.status(401).json({ message: 'Not authorized' });

    await prisma.budget.delete({ where: { id: req.params.id } });
    res.status(200).json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete all budgets for user
// @route   DELETE /api/budgets
// @access  Private
exports.deleteAllBudgets = async (req, res) => {
  try {
    await prisma.budget.deleteMany({ where: { userId: req.user.id } });
    res.status(200).json({ message: 'All budgets deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};