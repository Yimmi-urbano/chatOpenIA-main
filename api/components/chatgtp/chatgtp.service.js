/**
 * @fileoverview Servicio de chat optimizado para interactuar con la API de OpenAI.
 *
 * Mejoras clave:
 * - Abstracción del historial de chat para escalabilidad (preparado para Redis/DB).
 * - Manejo de errores robusto, incluyendo fallos en el parsing de JSON de la IA.
 * - Uso de plantillas literales (template literals) para prompts más legibles.
 * - Centralización de constantes y configuración para fácil mantenimiento.
 * - Código más limpio, modular y comentado.
 */

const axios = require('axios');
require('dotenv').config();
const { getProductsByDomain } = require('./chatgtp.dao');

// --- Configuración Centralizada ---
// Mover constantes a un solo lugar facilita su modificación y mantenimiento.
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o';
const MAX_HISTORY_LENGTH = 10; // Mantiene el sistema (prompt) + los últimos 9 intercambios.
const CACHE = new Map(); // Caché en memoria simple para configuraciones de dominio.

/**
 * --- Gestión de Historial (Abstracción para Escalabilidad) ---
 *
 * El objeto `conversationHistories` original no es escalable. Se agotaría la memoria
 * y el historial se perdería con cada reinicio.
 * Esta nueva implementación simula cómo se usaría un servicio externo (como Redis o una base de datos)
 * para gestionar el historial de conversaciones de forma persistente y escalable.
 */
const chatHistoryManager = {
  // En un entorno de producción, esto interactuaría con Redis, MongoDB, etc.
  _histories: new Map(),

  /**
   * Obtiene el historial de una conversación por dominio.
   * @param {string} domain - El identificador del inquilino (tenant).
   * @returns {Promise<Array<Object>|null>} El historial de mensajes.
   */
  async getHistory(domain) {
    return this._histories.get(domain) || null;
  },

  /**
   * Actualiza o crea el historial de una conversación.
   * @param {string} domain - El identificador del inquilino.
   * @param {Array<Object>} messages - El array completo de nuevos mensajes.
   */
  async setHistory(domain, messages) {
    this._histories.set(domain, messages);
  },

  /**
   * Añade mensajes al historial existente, manteniendo el tamaño máximo.
   * @param {string} domain - El identificador del inquilino.
   * @param {Array<Object>} newMessages - Array de nuevos mensajes a añadir (usuario y/o asistente).
   * @returns {Promise<Array<Object>>} El historial actualizado.
   */
  async appendToHistory(domain, newMessages) {
    const currentHistory = (await this.getHistory(domain)) || [];
    if (currentHistory.length === 0) {
      // Debería ser inicializado con el prompt del sistema primero.
      // Esta función asume que la inicialización ya ocurrió.
      console.warn(`Historial para ${domain} se está añadiendo sin haber sido inicializado.`);
    }

    const updatedHistory = [...currentHistory, ...newMessages];

    // Poda el historial si excede el límite, pero siempre conserva el mensaje del sistema.
    if (updatedHistory.length > MAX_HISTORY_LENGTH) {
      const systemMessage = updatedHistory[0]; // El primer mensaje siempre es el del sistema.
      const conversation = updatedHistory.slice(1); // El resto es la conversación.
      const prunedConversation = conversation.slice(-MAX_HISTORY_LENGTH + 1);
      const finalHistory = [systemMessage, ...prunedConversation];
      await this.setHistory(domain, finalHistory);
      return finalHistory;
    }

    await this.setHistory(domain, updatedHistory);
    return updatedHistory;
  },
};

/**
 * Obtiene la configuración de negocio por dominio, usando un caché para optimizar.
 * @param {string} domain
 * @returns {Promise<Object>}
 */
const fetchConfig = async (domain) => {
  if (CACHE.has(domain)) {
    return CACHE.get(domain);
  }

  try {
    const { data } = await axios.get(`${process.env.API_CONFIGURATION}/api/configurations`, {
      headers: { domain },
    });

    const config = data?.[0] || {};
    CACHE.set(domain, config); // Almacena en caché el resultado exitoso.
    return config;
  } catch (err) {
    console.error(`Error al obtener configuración para ${domain}:`, err.message);
    throw new Error(`Error de configuración para el dominio ${domain}`);
  }
};

/**
 * Construye el mensaje del sistema para el asistente IA usando plantillas literales para mayor legibilidad.
 * @param {string} domain
 * @param {string} productDescriptions
 * @param {Object} infoBusiness
 * @returns {string}
 */
const buildSystemMessage = (domain, productDescriptions, infoBusiness) => {
  // Sanitiza la información para evitar conflictos de formato en el string.
  const safeBusinessInfo = JSON.stringify(infoBusiness, null, 2);
  const safeProductDescriptions = JSON.stringify(productDescriptions, null, 2);

  // El uso de plantillas literales (`) mejora drásticamente la legibilidad y mantenimiento del prompt.
  return `Eres un asistente de ventas experto, amable y consultivo para la tienda "${domain}", que se especializa en comercio electrónico. Usa únicamente la siguiente información de la empresa: ${safeBusinessInfo}. Tu propósito es ayudar a los usuarios de manera clara, segura y personalizada, siguiendo estrictamente las reglas y formatos establecidos.

---

### REGLA DE ORO: PREGUNTA ANTES DE ACTUAR
NUNCA ejecutes una acción final como "go_to_url" o "add_to_cart" o "show_product" en tu primera respuesta. Primero informa y luego pregunta al usuario si desea continuar. Solo si el usuario responde de forma afirmativa y explícita, podrás ejecutar la acción en el siguiente turno. Prohibido inventar productos, descripciones o enlaces. Solo responde usando los productos proporcionados. Si un producto no está, informa amablemente que no lo tienes.

---

### RESPUESTAS ANTE PRODUCTOS NO ENCONTRADOS
- message: "No encontré ese producto en nuestro catálogo actual. ¿Quizás tienes otro en mente o te gustaría explorar nuestras categorías?"
- audio_description: "No tengo ese producto por ahora. ¿Quieres que busquemos otro parecido?"
- action.type: "none"

---

### CANALES DE RESPUESTA DISPONIBLES
1. "message": Texto visual mostrado al usuario. No links, no botones, no html
2. "audio_description": Frase hablada. No menciones botones, links ni elementos visuales.
---
### FORMATO DE RESPUESTA (JSON plano OBLIGATORIO)
\`\`\`json
{
  "message": "Texto para el chat visual. No links, no botones, no html",
  "audio_description": "Frase hablada. No menciones botones, links ni elementos visuales.",
  "action": {
    "type": "add_to_cart | go_to_url | show_product | none",
    "productId": "ID del producto o null",
    "quantity": "número o null",
    "url": "URL completa o null",
    "price_sale": Precio de oferta o null,
    "title": Titulo del producto o null,
    "price_regular":Precio normal o null,
    "image": Imagen del producto o null,
    "slug": Slug del producto o null
  }
}
\`\`\`
---

IMPORTANTE: 
Devuelve únicamente JSON plano válido. 
No uses comillas simples, no uses comentarios, no uses.


### COMPORTAMIENTO INTELIGENTE

**Consultas generales sobre el catálogo:**
- message: "Tenemos una gran variedad. Te recomiendo explorar nuestras categorías. ¿Hay algo específico que te interese?"
- audio_description: "Hay muchos productos. ¿Qué te interesa en particular?"
- action.type: "none"

---

### FLUJO PARA PRODUCTOS

**Producto EXISTENTE:**
1. Menciona detalles del producto.
2. Si te pregunta por un producto en especifico o te pide recomendaciones de productos usa este tipo de respuesta o dice que quiere ver el producto - ### FORMATO DE RESPUESTA PARA MOSTRAR PRODUCTOS 
3. Pregunta si desea verlo o agregarlo al carrito.
3.1 Si responde que si desea verlo usa: ### FORMATO DE RESPUESTA PARA MOSTRAR PRODUCTOS con la URL del producto
4. No ejecutes ninguna acción aún.
Ejemplo:
- message: "El Reloj Smart XY tiene monitor de ritmo cardíaco y batería de larga duración. ¿Deseas verlo?"
- audio_description: "Este reloj tiene monitor de ritmo y buena batería. ¿Quieres verlo?"

**Producto NO EXISTENTE:**
- message: "No tengo información sobre ese producto. ¿Quieres que busquemos otro parecido o te muestro nuestras categorías?"
- audio_description: "No encontré ese producto. ¿Buscamos otro similar?"
- action.type: "none"

---

### CATÁLOGO DISPONIBLE
Usa solo esta información para responder. No inventes productos, características ni URL:
${safeProductDescriptions}`;
};


/**
 * Procesa un mensaje del usuario con contexto multitenant.
 * @param {string} domain
 * @param {string} userMessage
 * @param {string} apiKey
 * @returns {Promise<Object>}
 */
const processChatWithGPT = async (domain, userMessage, apiKey) => {
  // Nota: `getProductsByDomain` también podría ser cacheado si el catálogo no cambia constantemente.
  const products = await getProductsByDomain(domain);

  if (!products?.length) {
    return {
      message: 'No hay productos disponibles para esta tienda en este momento.',
      audio_description: 'El catálogo de esta tienda está vacío.',
      action: { type: 'none' },
    };
  }

  const productDescriptions = products.map((p) => {
    const clean = (str) => (str || '').replace(/\r?\n|\r/g, ' ').replace(/"/g, "'");
    return `ID: ${p._id}, Nombre: "${clean(p.title)}", Precio: S/${p.price?.regular ?? 'N/A'}, Oferta: S/${p.price?.sale ?? 'N/A'}, Descripción: ${clean(p.description_short)}, URL: /product/${p.slug}, IMAGEN: ${p.image_default[0]}, SLUG: ${p.slug}`;
  }).join(' | ');

  const config = await fetchConfig(domain);

  let conversation = await chatHistoryManager.getHistory(domain);

  // Si no hay historial, se crea con el prompt del sistema.
  if (!conversation) {
    const systemMessage = buildSystemMessage(domain, productDescriptions, config);
    conversation = [{ role: 'system', content: systemMessage }];
    await chatHistoryManager.setHistory(domain, conversation);
  }

  // Añade el mensaje del usuario al historial para la llamada a la API.
  const messagesForAPI = [...conversation, { role: 'user', content: userMessage }];

  try {
    const { data } = await axios.post(
      OPENAI_API_URL,
      {
        model: OPENAI_MODEL,
        messages: messagesForAPI,
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" }, // Pide a los modelos compatibles que la salida sea JSON.
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const rawAssistantResponse = data.choices[0].message.content;
    let assistantReply;

    // --- MANEJO DE ERRORES DE PARSING ---
    // La IA puede fallar y no devolver un JSON válido. Este bloque previene que el servidor crashee.
    try {
      assistantReply = JSON.parse(rawAssistantResponse);
    } catch (parseError) {
      console.error("Error al parsear la respuesta JSON de OpenAI:", rawAssistantResponse);
      throw new Error("La respuesta de la IA no tenía un formato JSON válido.");
    }

    // Almacena el turno del usuario y la respuesta del asistente en el historial.
    await chatHistoryManager.appendToHistory(domain, [
      { role: 'user', content: userMessage },
      // Es crucial guardar el contenido exacto que la IA generó para mantener el contexto.
      { role: 'assistant', content: rawAssistantResponse },
    ]);

    return {
      message: assistantReply.message ?? 'Respuesta vacía.',
      audio_description: assistantReply.audio_description ?? '',
      action: assistantReply.action ?? { type: 'none' },
    };

  } catch (err) {
    console.error('Error en la comunicación con OpenAI:', err?.response?.data || err.message);
    return {
      message: 'Hubo un problema al procesar tu solicitud. Por favor, intenta de nuevo.',
      audio_description: 'Lo siento, ocurrió un error.',
      action: { type: 'none' },
    };
  }
};

module.exports = { processChatWithGPT };