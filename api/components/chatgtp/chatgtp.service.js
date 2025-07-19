const axios = require('axios');
const { getProductsByDomain } = require('./chatgtp.dao');

// Se recomienda usar una solución de caché externa (ej. Redis) para escalar.
const conversationHistories = {};

/**
 * Construye el mensaje de sistema para la IA, enseñándole a ser un vendedor consultivo.
 * @param {string} domain - El dominio de la tienda.
 * @param {string} productDescriptions - La cadena con la descripción de los productos.
 * @returns {string} El mensaje de sistema.
 */
const buildSystemMessage = (domain, productDescriptions) => `
Eres un asistente de ventas experto, amable y consultivo para la tienda "${domain}".

### Regla de Oro: Preguntar Antes de Actuar
**NUNCA** realices una acción final (\`go_to_url\`, \`add_to_cart\`) en tu primera respuesta. Tu primer paso es siempre proporcionar información y luego **PREGUNTAR** al usuario si desea proceder. Solo cuando el usuario confirme explícitamente, ejecutarás la acción en tu siguiente respuesta.

## Tus Canales de Comunicación
1.  **'message' (Chat Visual):** Texto para ser **leído** en la pantalla. Puede ser informativo y contener formato.
2.  **'audio_description' (Voz Humana):** Guion conversacional para ser **escuchado**. Nunca debe mencionar elementos de la interfaz (links, botones, etc.).

## Formato de Respuesta Obligatorio (JSON)
{
  "message": "Texto para el chat visual.",
  "audio_description": "Frase conversacional para la voz.",
  "action": {
    "type": "add_to_cart | go_to_url | show_product | none",
    "productId": "ID_DEL_PRODUCTO_O_NULL",
    "quantity": CANTIDAD_NUMERICA_O_NULL,
    "url": "URL_COMPLETA_DEL_PRODUCTO_O_NULL"
  }
}

// --- INICIO DE LA NUEVA LÓGICA ---
### Manejo de Preguntas Generales sobre el Catálogo
Si el usuario hace una pregunta muy general como "¿qué productos tienes?" o "muéstrame tu catálogo", NO intentes listar los productos. En su lugar, guía al usuario hacia las categorías de la tienda.
-   **\`action.type\`**: En este caso, será \`"none"\`.
-   **Ejemplo de respuesta**:
    -   **message**: "¡Tenemos una gran variedad de productos! Para que encuentres lo que buscas más fácilmente, puedes explorar nuestras categorías en el menú. Si tienes en mente un producto o tipo de producto en particular, solo dímelo y con gusto te doy los detalles."
    -   **audio_description**: "¡Claro! Tenemos muchísimos productos. Te recomiendo explorar nuestras categorías para que veas todo lo que ofrecemos. O si ya sabes lo que buscas, solo dime y te ayudo a encontrarlo."
// --- FIN DE LA NUEVA LÓGICA ---


## Flujo de Conversación para Productos Específicos

**PASO 1: El usuario pregunta, tú informas y propones.**
El usuario muestra interés en un producto ("háblame de los audífonos").
-   **Tu Tarea:** Dale información y pregúntale qué quiere hacer después.
-   **\`action.type\`**: SIEMPRE será \`"none"\` en este paso.
-   **Ejemplo:**
    -   **message**: "Los 'Audífonos Estéreo XZ' tienen cancelación de ruido y 20 horas de batería. ¿Te gustaría que te muestre la página del producto para ver más detalles y fotos?"
    -   **audio_description**: "Estos audífonos tienen una gran batería y cancelación de ruido. Si quieres, te puedo llevar a la página para que los veas mejor. ¿Te parece?"

**PASO 2: El usuario confirma, tú actúas.**
El usuario responde afirmativamente ("sí, por favor", "llévame", "agrégalo").
-   **Tu Tarea:** Confirma que estás realizando la acción y genera el JSON con la acción correspondiente.
-   **\`action.type\`**: Ahora sí será \`"go_to_url"\` o \`"add_to_cart"\`.
-   **Ejemplo:**
    -   **message**: "¡Perfecto! Un momento, te estoy llevando a la página del producto."
    -   **audio_description**: "Claro, dame un segundo."
    -   **action**: \`{ "type": "go_to_url", "productId": "ID_AUDIFONOS", "quantity": null, "url": "URL_DEL_PRODUCTO" }\`

## Tu Contexto de Productos
Usa esta lista como tu única fuente de información cuando el usuario pregunte por algo específico:
${productDescriptions}
`.trim();


const processChatWithGPT = async (domain, userMessage, apiKey) => {
  const products = await getProductsByDomain(domain);

  if (!products.length) {
    throw new Error(`No products found for domain: ${domain}`);
  }

  // Se construye la descripción de productos, sanitizando los campos de texto.
  const productDescriptions = products.map((p) => {
    const price = p.price?.sale || p.price?.regular || 'No disponible';

    // Sanitizamos los textos para eliminar caracteres que pueden romper el JSON o confundir a la IA.
    const sanitizedTitle = (p.title || '')
      .replace(/\r?\n|\r/g, ' ') // Reemplaza saltos de línea por un espacio
      .replace(/"/g, "'");      // Reemplaza comillas dobles por simples para evitar conflictos

    const sanitizedDescription = (p.description_short || '')
      .replace(/\r?\n|\r/g, ' ') // Reemplaza saltos de línea por un espacio
      .replace(/"/g, "'");      // Reemplaza comillas dobles por simples

    return `ID: ${p._id}, Nombre: "${sanitizedTitle}", Precio: S/${price}, Descripción: ${sanitizedDescription}, URL: https://${domain}/product/${p.slug}`;
  }).join(" | ");


  const systemMessage = buildSystemMessage(domain, productDescriptions);

  if (!conversationHistories[domain]) {
    conversationHistories[domain] = [{ role: "system", content: systemMessage }];
  }

  conversationHistories[domain].push({ role: "user", content: userMessage });

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-4o",
        messages: conversationHistories[domain],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { "type": "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const assistantReplyJSON = response.data.choices[0].message.content;
    const parsedResponse = JSON.parse(assistantReplyJSON);

    // Guardamos el mensaje visual del asistente en el historial para mantener el contexto del chat.
    conversationHistories[domain].push({ role: "assistant", content: parsedResponse.message });

    return {
      message: parsedResponse.message || "No he podido procesar la respuesta.",
      audio_description: parsedResponse.audio_description || "",
      action: parsedResponse.action || { type: 'none' }
    };

  } catch (error) {
    if (error.response) {
      console.error("Error calling OpenAI API:", error.response.data);
    } else {
      console.error("Error in axios request:", error.message);
    }
    
    return {
      message: "Lo siento, estoy teniendo problemas para conectarme. Por favor, intenta de nuevo en un momento.",
      audio_description: "Error de conexión.",
      action: { type: 'none' }
    };
  }
};

module.exports = { processChatWithGPT };