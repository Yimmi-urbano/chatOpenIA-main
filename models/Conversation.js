const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  userEmail: {
    type: String,
    required: true,
  },
  messages: {
    type: Array,
    required: true,
  },
}, {
  timestamps: true,
});

conversationSchema.index({ domain: 1, userId: 1 }, { unique: true });

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
