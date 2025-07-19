const express = require('express');
const router = express.Router();
const { convertTextToSpeech } = require('./awsdolly.controller');

router.post('/speak', convertTextToSpeech);

module.exports = router;
