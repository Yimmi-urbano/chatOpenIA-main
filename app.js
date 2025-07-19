require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const chatRouter = require('./api/components/chatgtp/chatgtp.router');
const ttsRouter = require('./api/components/convertTextToVoice/awsdolly.router');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.error("Error MongoDB:", err));

app.use('/chatbot', chatRouter);
app.use('/textvoice', ttsRouter);

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
