const { Product } = require('../../../config/database');

const getProductsByDomain = async (domain) => {
  return await Product.find({ domain });
};

const getProductsByIds = async (ids) => {
  return await Product.find({ _id: { $in: ids } });
};

module.exports = { getProductsByDomain, getProductsByIds };
