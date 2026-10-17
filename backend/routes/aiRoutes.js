const express = require('express');
const router = express.Router();
const { getInsights, chat, simulate } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // Secure all AI endpoints with JWT authentication

router.get('/insights', getInsights);
router.post('/chat', chat);
router.post('/simulate', simulate);

module.exports = router;