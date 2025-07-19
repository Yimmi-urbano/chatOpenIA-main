const Product = require('../../../models/Product');

const getProductsByDomain = async (domain) => {
  return await Product.find({ domain });
};

module.exports = { getProductsByDomain };
