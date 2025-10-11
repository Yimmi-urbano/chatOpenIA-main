const AWS = require('aws-sdk');

AWS.config.update({ region: 'us-east-1' });

const polly = new AWS.Polly();

const synthesizeSpeech = async (text) => {
  const params = {
    Text: text,
    OutputFormat: 'mp3',
    Engine: 'neural',
    VoiceId: 'Mia',
    LanguageCode: "es-MX",
  };

  const data = await polly.synthesizeSpeech(params).promise();
  return data.AudioStream; 
};

module.exports = { synthesizeSpeech };
