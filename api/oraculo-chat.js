// Ejemplo de la lógica que debe tener el endpoint del Chat del Oráculo
import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { message, history } = req.body; // Recibe el mensaje libre y opcionalmente el historial

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Configuración del Oráculo con un system instruction místico
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: "Eres un oráculo sabio, místico y empático...",
      }
    });

    return res.status(200).json({ reply: response.text });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
