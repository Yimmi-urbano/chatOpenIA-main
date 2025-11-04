/**
 * @fileoverview Servicio de búsqueda vectorial utilizando LangChain.js.
 *
 * Esta implementación reemplaza HNSWLib-node con herramientas de LangChain,
 * eliminando la necesidad de dependencias nativas y asegurando la compatibilidad
 * con entornos de producción sin herramientas de compilación.
 *
 * Funcionalidades clave:
 * - Uso de OpenAIEmbeddings para crear vectores de texto.
 * - Creación de un MemoryVectorStore para almacenar y buscar productos en memoria.
 * - Búsqueda de productos por similitud semántica.
 * - Cacheo de los VectorStores para optimizar el rendimiento.
 */

const { OpenAIEmbeddings } = require('@langchain/openai');
const { MemoryVectorStore } = require('@langchain/community/vectorstores/memory');
require('dotenv').config();

const VECTOR_STORE_CACHE = new Map(); // Caché para los MemoryVectorStore por dominio.

/**
 * Construye o recupera desde el caché un MemoryVectorStore para un dominio.
 * @param {string} domain - El dominio para el que se construirá el vector store.
 * @param {Array<Object>} products - La lista de productos para indexar.
 * @param {string} apiKey - La clave de la API de OpenAI.
 * @returns {Promise<MemoryVectorStore>} El vector store inicializado.
 */
const buildVectorStore = async (domain, products, apiKey) => {
  if (VECTOR_STORE_CACHE.has(domain)) {
    return VECTOR_STORE_CACHE.get(domain);
  }

  const embeddings = new OpenAIEmbeddings({
    apiKey: apiKey,
    model: 'text-embedding-3-small',
  });

  // Prepara los documentos en el formato que LangChain espera.
  const documents = products.map(product => ({
    pageContent: `Nombre: ${product.title}, Descripción: ${product.description_short}`,
    metadata: {
      productId: product._id.toString(),
      // Puedes añadir más metadatos aquí si es necesario en el futuro.
    },
  }));

  const vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
  VECTOR_STORE_CACHE.set(domain, vectorStore);

  return vectorStore;
};

/**
 * Busca los productos más relevantes en un dominio dado una consulta de usuario.
 * @param {string} domain - El dominio en el que buscar.
 * @param {Array<Object>} products - La lista completa de productos del dominio.
 * @param {string} query - La consulta del usuario.
 * @param {string} apiKey - La clave de la API de OpenAI.
 * @param {number} [k=5] - El número de resultados a devolver.
 * @returns {Promise<Array<string>>} Una lista de los IDs de los productos más relevantes.
 */
const searchProducts = async (domain, products, query, apiKey, k = 5) => {
  if (!products || products.length === 0) {
    return [];
  }

  const vectorStore = await buildVectorStore(domain, products, apiKey);

  // similaritySearch retorna una lista de documentos con su metadata.
  const searchResults = await vectorStore.similaritySearch(query, k);

  // Extraemos los IDs de los productos desde la metadata de los resultados.
  const relevantProductIds = searchResults.map(result => result.metadata.productId);

  return relevantProductIds;
};

module.exports = { searchProducts };
