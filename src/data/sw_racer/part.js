exports.parts = [
    {
        "names": [
            { "antiskid": "R-20", "turn_response": "Linkage", "acceleration": "Dual 20 PCX", "max_speed": "Plug 2", "air_brake_interval": "Mark II", "cool_rate": "Coolant", "repair_rate": "Single" },
            { "antiskid": "R-60", "turn_response": "Shift Plate", "acceleration": "44 PCX", "max_speed": "Plug 3", "air_brake_interval": "Mark III", "cool_rate": "Stack-3", "repair_rate": "Dual2" },
            { "antiskid": "R-80", "turn_response": "Vectro-Jet", "acceleration": "Dual 32 PCX", "max_speed": "Plug 5", "air_brake_interval": "Mark IV", "cool_rate": "Stack-6", "repair_rate": "Quad" },
            { "antiskid": "R-100", "turn_response": "Coupling", "acceleration": "Quad 32 PCX", "max_speed": "Plug 8", "air_brake_interval": "Mark V", "cool_rate": "Rod", "repair_rate": "Cluster" },
            { "antiskid": "R-300", "turn_response": "Nozzle", "acceleration": "Quad 44", "max_speed": "Block 5", "air_brake_interval": "Tri-Jet", "cool_rate": "Dual", "repair_rate": "Rotary" },
            { "antiskid": "R-600", "turn_response": "Stablizer", "acceleration": "Mag 6", "max_speed": "Block 6", "air_brake_interval": "Quadrijet", "cool_rate": "Turbo", "repair_rate": "Cluster 2" }
        ],
        "prices": [
            { "antiskid": 250, "turn_response": 200, "acceleration": 800, "max_speed": 1000, "air_brake_interval": 700, "cool_rate": 50, "repair_rate": 150 },
            { "antiskid": 400, "turn_response": 400, "acceleration": 2200, "max_speed": 2400, "air_brake_interval": 1400, "cool_rate": 100, "repair_rate": 300 },
            { "antiskid": 600, "turn_response": 700, "acceleration": 5600, "max_speed": 6000, "air_brake_interval": 3600, "cool_rate": 300, "repair_rate": 800 },
            { "antiskid": 1200, "turn_response": 1600, "acceleration": 7000, "max_speed": 14000, "air_brake_interval": 7000, "cool_rate": 900, "repair_rate": 1400 },
            { "antiskid": 2600, "turn_response": 3800, "acceleration": 10400, "max_speed": 17500, "air_brake_interval": 10400, "cool_rate": 2700, "repair_rate": 4000 },
            { "antiskid": 6000, "turn_response": 7500, "acceleration": 14000, "max_speed": 20000, "air_brake_interval": 14000, "cool_rate": 5400, "repair_rate": 7000 }
        ]
    }
]

exports.upgradeTraction = function (base, upg) {
    return Math.min(1, base + upg * 0.05)
}
exports.upgradeTurning = function (base, upg) {
    if (upg < 5) {
        return base + upg * 116
    } else {
        return base + (upg - 1) * 116 + 114
    }
}
exports.upgradeAcceleration = function (base, upg) {
    return base - 0.14 * base * upg
}
exports.upgradeTopSpeed = function (base, upg) {
    return Math.min(base + 40 * upg, 650)
}
exports.upgradeAirBrake = function (base, upg) {
    var brake = base
    if (upg > 0) {
        brake = brake - base * 0.08
    }
    if (upg > 1) {
        brake = brake - base * 0.09 * upg
    }
    return brake
}
exports.upgradeCooling = function (base, upg) {
    return (base + upg * 1.6)
}
exports.upgradeRepair = function (base, upg) {
    if (upg < 5) {
        return (Math.min(1, base + upg * 0.1))
    } else {
        return (Math.min(1, base + (upg - 1) * 0.1 + 0.05))
    }
}
exports.avgSpeed = function (topspeed, boost, heatrate, coolrate) {
    var boostdistance = (boost / 50) * (50 * (100 / heatrate) - 11 * Math.log(Math.abs(50 * (100 / heatrate) + 11))) - (boost / 50) * (50 * (0) - 11 * Math.log(Math.abs(50 * (0) + 11)))
    var avgboost = boostdistance / (100 / heatrate)
    var e19 = 1 - (3333 / (100 * 45 * ((3333 / (100 * 45)) + 5)))
    var cooldistance = boost * Math.log(Math.abs(11 * e19 ** (45 * (100 / heatrate)) * heatrate + 7500 * e19 ** (45 * (100 / heatrate + 100 / coolrate)))) / (Math.log(e19) * 45) - boost * Math.log(Math.abs(11 * e19 ** (45 * (100 / heatrate)) * heatrate + 7500 * e19 ** (45 * (100 / heatrate)))) / (Math.log(e19) * 45)
    var avgcool = cooldistance / (100 / coolrate)
    var avgspeed = ((100 / heatrate) * (topspeed + avgboost) + (100 / coolrate) * (topspeed + avgcool)) / (100 / heatrate + 100 / coolrate)
    return avgspeed
}
