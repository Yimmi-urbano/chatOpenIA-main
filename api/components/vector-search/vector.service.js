/**
 * @fileoverview Servicio para la creación y consulta de un índice de búsqueda vectorial en memoria.
 *
 * Utiliza HNSW (Hierarchical Navigable Small World) para la búsqueda de vecinos más cercanos,
 * lo que permite encontrar rápidamente los productos más relevantes semánticamente a una consulta de usuario.
 *
 * Funcionalidades clave:
 * - Creación de embeddings para texto usando la API de OpenAI.
 * - Construcción de un índice HNSW por dominio.
 * - Búsqueda de productos por similitud vectorial.
 * - Cacheo de índices para evitar reconstrucciones innecesarias.
 */

const { HierarchicalNSW } = require('hnswlib-node');
const axios = require('axios');
require('dotenv').config();

// --- Configuración Centralizada ---
const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'; // Modelo rápido y eficiente para embeddings.
const EMBEDDING_DIMENSION = 1536; // Dimensión de los vectores de 'text-embedding-3-small'.
const INDEX_CACHE = new Map(); // Caché en memoria para los índices HNSW.

/**
 * Genera un embedding para un texto dado usando la API de OpenAI.
 * @param {string} text - El texto a convertir en vector.
 * @param {string} apiKey - La clave de la API de OpenAI.
 * @returns {Promise<Array<number>>} El vector de embedding.
 */
const createEmbedding = async (text, apiKey) => {
  try {
    const { data } = await axios.post(
      OPENAI_EMBEDDING_URL,
      {
        input: text,
        model: OPENAI_EMBEDDING_MODEL,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return data.data[0].embedding;
  } catch (err) {
    console.error('Error al crear embedding:', err.message);
    throw new Error('No se pudo generar el embedding.');
  }
};

/**
 * Construye o recupera desde el caché un índice HNSW para un dominio específico.
 * @param {string} domain - El dominio para el que se construirá el índice.
 * @param {Array<Object>} products - La lista de productos para indexar.
 * @param {string} apiKey - La clave de la API de OpenAI.
 * @returns {Promise<HierarchicalNSW>} El índice HNSW inicializado.
 */
const buildIndex = async (domain, products, apiKey) => {
  if (INDEX_CACHE.has(domain)) {
    return INDEX_CACHE.get(domain);
  }

  const index = new HierarchicalNSW('l2', EMBEDDING_DIMENSION);
  index.initIndex(products.length);

  // Paraleliza la creación de embeddings para acelerar la construcción del índice.
  const embeddingPromises = products.map(product => {
    const textToIndex = `Nombre: ${product.title}, Descripción: ${product.description_short}`;
    return createEmbedding(textToIndex, apiKey);
  });

  const embeddings = await Promise.all(embeddingPromises);

  embeddings.forEach((embedding, i) => {
    index.addPoint(embedding, i);
  });

  INDEX_CACHE.set(domain, index);
  return index;
};

/**
 * Busca los productos más relevantes en un dominio dado una consulta de usuario.
 * @param {string} domain - El dominio en el que buscar.
 * @param {Array<Object>} products - La lista completa de productos del dominio.
 * @param {string} query - La consulta del usuario.
 * @param {string} apiKey - La clave de la API de OpenAI.
 * @param {number} [k=5] - El número de resultados a devolver.
 * @returns {Promise<Array<Object>>} Una lista de los IDs de los productos más relevantes.
 */
const searchProducts = async (domain, products, query, apiKey, k = 5) => {
  if (!products || products.length === 0) {
    return [];
  }

  const index = await buildIndex(domain, products, apiKey);
  const queryEmbedding = await createEmbedding(query, apiKey);

  // searchKnn retorna { neighbors: Array<number>, distances: Array<number> }
  const { neighbors } = index.searchKnn(queryEmbedding, k);

  // `neighbors` es una lista de índices del array de productos original.
  // Mapeamos estos índices a los IDs de los productos correspondientes.
  const relevantProductIds = neighbors.map(neighborIndex => products[neighborIndex]._id);

  return relevantProductIds;
};

module.exports = { searchProducts };
