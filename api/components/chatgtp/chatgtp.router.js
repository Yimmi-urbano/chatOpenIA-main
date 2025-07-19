const express = require('express');
const router = express.Router();
const { handleChatRequest } = require('./chatgtp.controller');

router.post('/question', handleChatRequest);

module.exports = router;
