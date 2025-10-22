const { Product } = require('../../../config/database');

const getProductsByDomain = async (domain) => {
  return await Product.find({ domain });
};

module.exports = { getProductsByDomain };
