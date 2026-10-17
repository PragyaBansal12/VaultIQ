const express = require('express');
const router = express.Router();
const { getBudgets, setBudget, deleteBudget, deleteAllBudgets } = require('../controllers/budgetController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/').get(getBudgets).post(setBudget).delete(deleteAllBudgets);
router.route('/:id').delete(deleteBudget);

module.exports = router;