// src/api/chatgtp/chatgtp.router.js
const express = require('express');
const router = express.Router();
const { handleChatRequest } = require('./chatgtp.controller');
const authMiddleware = require('../../../middleware/auth');

router.post('/question', authMiddleware, handleChatRequest);

module.exports = router;
