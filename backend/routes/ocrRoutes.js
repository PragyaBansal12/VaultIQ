const express = require('express');
const router = express.Router();
const multer = require('multer');
const { processReceipt } = require('../controllers/ocrController');
const { protect } = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

router.post('/process', protect, upload.single('receipt'), processReceipt);

module.exports = router;