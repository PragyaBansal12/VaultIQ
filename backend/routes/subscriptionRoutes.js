const express = require('express');
const router = express.Router();
const { getSubscriptions, addSubscription, updateSubscription, deleteSubscription } = require('../controllers/subscriptionController');
const { protect } = require('../middleware/authMiddleware');

// Secure all endpoints with authentication guard
router.use(protect);

router.route('/')
  .get(getSubscriptions)
  .post(addSubscription);

router.route('/:id')
  .put(updateSubscription)
  .delete(deleteSubscription);

module.exports = router;