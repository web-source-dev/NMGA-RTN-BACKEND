const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    assignedTo: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    assignedAt: {
        type: Date,
        default: Date.now,
    },
});

const Supplier = mongoose.model("Supplier", supplierSchema);

module.exports = Supplier;
