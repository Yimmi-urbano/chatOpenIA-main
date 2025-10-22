require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('./config/database');

const rateLimit = require('express-rate-limit');

const chatLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 5, 
  message: {
    success: false,
    error: "Demasiadas solicitudes, espera un momento antes de intentarlo nuevamente."
  }
});

const chatRouter = require('./api/components/chatgtp/chatgtp.router');
const ttsRouter = require('./api/components/convertTextToVoice/awsdolly.router');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.use('/chatbot', chatLimiter, chatRouter);
app.use('/textvoice', chatLimiter,  ttsRouter);

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
