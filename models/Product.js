const mongoose = require('mongoose');

const AttributeSchema = new mongoose.Schema({
    name_attr: String,
    values: [
        {
            Id: String,
            valor: String,
            _id: mongoose.Schema.Types.ObjectId,
        }
    ]
});

const VariationSchema = new mongoose.Schema({
    chill_attr: [String],
    price: {
        regular: Number,
        sale: Number,
        tag: String,
    },
});

const CategorySchema = new mongoose.Schema({
    idcat: String,
    slug: String,
});

const ProductSchema = new mongoose.Schema({
    domain: { type: String, required: true },
    is_trash: {
        status: Boolean,
        date: Date,
    },
    price: {
        regular: Number,
        sale: Number,
        tag: String,
    },
    title: { type: String, required: true },
    slug: String,
    type_product: String,
    image_default: [String],
    stock: Number,
    category: [CategorySchema],
    is_available: Boolean,
    default_variations: [String],
    atributos: [AttributeSchema],
    variations: [VariationSchema],
    description_long: String,
    description_short: String,
});

module.exports = mongoose.model('Product', ProductSchema);
