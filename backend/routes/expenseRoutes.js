const express = require('express');
const router = express.Router();
const { getExpenses, createExpense, deleteExpense, deleteAllExpenses } = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // Protect all routes

router.route('/')
  .get(getExpenses)
  .post(createExpense)
  .delete(deleteAllExpenses);

router.route('/:id')
  .delete(deleteExpense);

module.exports = router;