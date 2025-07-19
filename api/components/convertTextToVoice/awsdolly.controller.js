const { synthesizeSpeech } = require('./awsdolly.service');

const convertTextToSpeech = async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto requerido' });

  try {
    const audioStream = await synthesizeSpeech(text);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'inline; filename=voz.mp3'
    });
    res.send(audioStream);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generando audio' });
  }
};

module.exports = { convertTextToSpeech };
