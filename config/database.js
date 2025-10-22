const mongoose = require('mongoose');
require('dotenv').config();

function createConnection(uri) {
  const connection = mongoose.createConnection(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  connection.on('connected', () => {
    console.log(`MongoDB conectado en ${uri}`);
  });

  connection.on('error', (err) => {
    console.error(`Error de conexión MongoDB en ${uri}:`, err);
  });

  return connection;
}

const clientsConnection = createConnection(process.env.MONGO_URI_CLIENTS);
const catalogConnection = createConnection(process.env.MONGO_URI_CATALOG);

const ConversationSchema = require('../models/Conversation');
const ProductSchema = require('../models/Product');

const Conversation = clientsConnection.model('Conversation', ConversationSchema);
const Product = catalogConnection.model('Product', ProductSchema);

module.exports = {
  Conversation,
  Product,
};
