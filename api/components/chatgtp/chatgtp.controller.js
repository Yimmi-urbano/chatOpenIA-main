const { processChatWithGPT } = require('./chatgtp.service');

const handleChatRequest = async (req, res) => {
  const { domain, userMessage } = req.body;
  const { userId, email } = req.user;

  if (!domain || !userMessage) {
    return res.status(400).json({ error: 'Faltan domain o userMessage' });
  }

  if (!userId || !email) {
    return res.status(400).json({ error: 'Falta información del usuario en el token' });
  }

  try {
    const assistantMessage = await processChatWithGPT(domain, userMessage, process.env.OPENAI_API_KEY, userId, email);
    res.json({ assistantMessage });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Error procesando el mensaje.' });
  }
};

module.exports = { handleChatRequest };
