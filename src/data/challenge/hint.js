const { truguts } = require("./trugut")

exports.hints = [
    { value: 'basic', name: "Basic Hint", price: truguts.hint.basic, bonus: truguts.bonus.basic, description: "Single-part hint", hunt: "Force-Intuitive" },
    { value: 'standard', name: "Standard Hint", price: truguts.hint.standard, bonus: truguts.bonus.standard, description: "Two-part hint", hunt: "Force-Attuned" },
    { value: 'deluxe', name: "Deluxe Hint", price: truguts.hint.deluxe, bonus: truguts.bonus.deluxe, description: "Three-part hint", hunt: "Force-Sensitive" }
]