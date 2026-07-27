module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método no permitido'
    });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;

    const message = body?.message;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Falta el mensaje'
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY no está configurada en Vercel'
      });
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `
Eres el Oráculo de Alquimia Sagrada.

Tu personalidad es sabia, mística, empática y cálida.
Responde siempre en español.
Tu tono debe ser espiritual, poético y cercano, pero claro.
No afirmes que puedes predecir el futuro con certeza.
Puedes orientar, reflexionar y acompañar al usuario.

Si el usuario pregunta por las terapias de Alquimia Sagrada,
responde de manera coherente con la información disponible
en el sitio web.
                `.trim()
              }
            ]
          },

          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: message
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    console.log('Gemini status:', response.status);

    if (!response.ok) {
      console.error('Gemini error:', JSON.stringify(data));

      return res.status(response.status).json({
        error: data?.error?.message || 'Error en Gemini API',
        details: data?.error || null
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join('')
        .trim();

    if (!reply) {
      console.error('Respuesta inesperada de Gemini:', JSON.stringify(data));

      return res.status(500).json({
        error: 'Gemini no devolvió texto',
        details: data
      });
    }

    return res.status(200).json({
      reply
    });

  } catch (err) {
    console.error('Error crítico:', err);

    return res.status(500).json({
      error: 'Fallo crítico: ' + err.message
    });
  }
};
