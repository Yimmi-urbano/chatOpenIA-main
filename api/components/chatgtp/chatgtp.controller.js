const { processChatWithGPT } = require('./chatgtp.service');

const handleChatRequest = async (req, res) => {
  const { domain, userMessage } = req.body;
  if (!domain || !userMessage) {
    return res.status(400).json({ error: 'Faltan domain o userMessage' });
  }

  try {
    const assistantMessage = await processChatWithGPT(domain, userMessage, process.env.OPENAI_API_KEY);
    res.json({ assistantMessage });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Error procesando el mensaje.' });
  }
};

module.exports = { handleChatRequest };
