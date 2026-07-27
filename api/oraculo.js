module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    const history = Array.isArray(body?.history)
      ? body.history
      : [];

    // Contexto opcional de la Carta Natal, calculado en el frontend por la
    // calculadora existente. El Oráculo solo lo interpreta: nunca recalcula
    // posiciones astronómicas. Se acota por las dudas, aunque en la práctica
    // el resumen que manda el frontend ya es compacto.
    const natalChart = typeof body?.natalChart === 'string'
      ? body.natalChart.slice(0, 1500)
      : null;

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

    // Convertimos el historial del frontend al formato de Gemini.
    const contents = history
      .filter(item =>
        item &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string'
      )
      .map(item => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [
          {
            text: item.content
          }
        ]
      }));

    // Aseguramos que el último mensaje sea el actual.
    if (
      contents.length === 0 ||
      contents[contents.length - 1].role !== 'user' ||
      contents[contents.length - 1].parts[0].text !== message
    ) {
      contents.push({
        role: 'user',
        parts: [
          {
            text: message
          }
        ]
      });
    }

    const baseInstruction = `
Eres el Oráculo de Alquimia Sagrada.

Tu personalidad es sabia, mística, empática y misteriosa.

Responde siempre en español.

Tu tono debe ser espiritual, poético,
pero también claro y comprensible.

Acompañás al usuario desde una perspectiva
de introspección, simbolismo y espiritualidad.

No afirmes que podés predecir el futuro con certeza.
No presentes tus respuestas como verdades absolutas.

Podés ofrecer interpretaciones (si son cartas natales procura
que la respuesta sea compacta pero que abarque los puntos más
importantes, también podes usar emojis para decorar la 
respuesta), preguntas para la reflexión,
orientación espiritual y acompañamiento emocional.

Si el usuario pregunta por Alquimia Sagrada,
sus terapias, carta natal u otros servicios del sitio,
respondé únicamente con la información que realmente
esté disponible en el contexto que recibas.

No inventes servicios, precios, horarios ni datos.
            `.trim();

    // Bloque adicional, solo si el frontend mandó datos de una carta natal
    // ya calculada. No reemplaza la instrucción base: se suma a continuación.
    const natalInstruction = natalChart
      ? `

A continuación tenés los datos ya calculados de la carta natal de este
consultante. Fueron calculados por una herramienta astronómica externa:
no los cuestiones, no los recalcules y no inventes datos adicionales,
solo interpretalos simbólicamente.

${natalChart}

Para la primera lectura de esta carta: mantenela muy breve, centrada en
Sol, Luna y Ascendente, sumando como mucho uno o dos elementos más que
te parezcan relevantes, la respuesta no debería tener más de
900 caracteres. Usá un lenguaje simbólico e introspectivo, evitando
frases deterministas como "esto significa que definitivamente..." o
"te va a ocurrir...". Preferí formas como "esta configuración puede
invitarte a...", "podría manifestarse como...", "desde una mirada
simbólica...".

Cerrá esa primera lectura con una aclaración breve, una sola vez (no la
repitas en respuestas siguientes sobre la carta): "Esta lectura es una
interpretación simbólica de tu carta natal y está pensada como una
herramienta de introspección y autoconocimiento."

En preguntas posteriores sobre la carta (por ejemplo sobre un planeta,
una casa, o cómo se relaciona con vínculos o decisiones), respondé
usando estos datos reales, sin repetir la lectura completa cada vez.`
      : '';

    const requestBody = {
      systemInstruction: {
        parts: [
          {
            text: (baseInstruction + natalInstruction).trim()
          }
        ]
      },

      contents
    };

    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

      try {
        const response = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },

            body: JSON.stringify(requestBody)
          }
        );

        const data = await response.json();

        console.log(
          `Gemini attempt ${attempt}:`,
          response.status
        );

        // Respuesta correcta
        if (response.ok) {

          const reply = data?.candidates?.[0]?.content?.parts
            ?.map(part => part.text || '')
            .join('')
            .trim();

          if (reply) {
            return res.status(200).json({
              reply
            });
          }

          lastError = 'Gemini no devolvió texto.';
        } else {

          lastError =
            data?.error?.message ||
            `Gemini respondió con HTTP ${response.status}`;

          console.error(
            `Gemini error attempt ${attempt}:`,
            JSON.stringify(data)
          );

          // Solo reintentamos errores que pueden ser temporales.
          const retryable =
            response.status === 429 ||
            response.status === 500 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504;

          if (!retryable) {
            return res.status(response.status).json({
              error: lastError
            });
          }
        }

      } catch (err) {

        lastError = err.message;

        console.error(
          `Gemini network error attempt ${attempt}:`,
          err
        );
      }

      // Esperamos antes del siguiente intento.
      if (attempt < maxAttempts) {
        await new Promise(resolve =>
          setTimeout(resolve, 700 * attempt)
        );
      }
    }

    return res.status(503).json({
      error: 'El servicio del Oráculo está temporalmente ocupado. Intentá nuevamente en unos segundos.',
      details: lastError
    });

  } catch (err) {

    console.error('Error crítico del Oráculo:', err);

    return res.status(500).json({
      error: 'Fallo crítico: ' + err.message
    });
  }
};

