const { tracks } = require("../../data/sw_racer/track")
const { racers } = require("../../data/sw_racer/racer")
const { upgradeTopSpeed, upgradeAcceleration, upgradeCooling } = require("../../data/sw_racer/part")

exports.simulateSpeed = function (chosenTrack, fps, upgradeLevel, laps) {
    var returnValue = [] //format:: [[pod index, average speed, finish time], [next pod], ... [final pod], fps, track]

    //var chosenTrack = track
    var trackLength = null
    if (laps == 1) {
        trackLength = tracks[chosenTrack].first_lap.length
    } else {
        trackLength = tracks[chosenTrack].first_lap.length + (laps - 1) * tracks[chosenTrack].lap.length
    }
    const firstPod = 0
    const lastPod = 22 //inclusive
    //var upgradeLevel = upgrades

    //constants
    //var fps = 24
    var frameTime = 1 / fps
    var maxAllowedHeat = 100.0

    //pod stats
    var podStats = { //default values here are never used
        statSpeed: 650.0,
        statThrust: 200.0,
        statAccel: 1.0,
        statHeatRate: 10,
        statCoolRate: 10
    }


    const stateZeroFrame = createState(
        0, //frame
        frameTime, //raceTime
        0.0, //distanceTravelled
        0.0, //speedValue
        0.0, //boostCharge
        100.0, //heat
        0.0, //boostValue
        false, //isBoosting
        true, //isBoostStart
        false, //isBoostStartEnded
        'd', //nosePosition
        false //isTrackFinished
    )
    var stateInitialPass// = createClonedState(stateZeroFrame)
    var stateInitialPassPrev// = createClonedState(stateZeroFrame)
    var stateLastBoostStart// = createClonedState(stateZeroFrame)
    var stateLastBoostEnd// = createClonedState(stateZeroFrame)
    var stateTrackEndFrame// = createClonedState(stateZeroFrame)
    var stateNextPass// = createClonedState(stateZeroFrame)
    var stateNextPassPrev// = createClonedState(stateZeroFrame)


    var lastAverageSpeedIncreaseFrame

    for (var i = firstPod; i <= lastPod; i++) {
        resetStatesAndValues()
        getPodStats(i)
        initialPass(stateInitialPass, stateInitialPassPrev)
        recursivePass(stateNextPass, stateNextPassPrev, 1000000, 0)
        returnValue.push([i, stateNextPass.averageSpeedAtTrackEnd, stateNextPass.finishTime])
    }

    returnValue.sort(function (a, b) {
        return a[2] - b[2]
    })

    returnValue.push(fps)
    returnValue.push(chosenTrack)

    for (var i = firstPod; i <= lastPod; i++) {
        //console.log(returnValue[i][0] + ": " + Math.round(returnValue[i][1]*10)/10 + ", Time: " + Math.round(returnValue[i][2]*1000)/1000)
    }

    return returnValue

    //all functions
    //core loop functions
    function initialPass(state, statePrev) {
        runTrack(state, statePrev, -1)
        //printState(state)
    }

    function recursivePass(state, statePrev, prevGuessError, i) {
        var newBoostStartFrame
        if (lastAverageSpeedIncreaseFrame >= stateTrackEndFrame.frame) { //speed increased
            newBoostStartFrame = Math.round(stateLastBoostStart.frame - (lastAverageSpeedIncreaseFrame - stateTrackEndFrame.frame) / 2)
        } else {
            newBoostStartFrame = Math.round(stateLastBoostEnd.frame - 1 - (lastAverageSpeedIncreaseFrame - stateTrackEndFrame.frame) / 2)
        }

        overwriteState(stateZeroFrame, state)
        overwriteState(stateZeroFrame, statePrev)
        runTrack(state, statePrev, newBoostStartFrame)

        var guessError = lastAverageSpeedIncreaseFrame - stateTrackEndFrame.frame
        if (i >= 10) { //abort after 10 iterations
            return
        }
        else if (Math.abs(guessError) <= 0) { //desired accuracy reached
            return
        }
        else if ((prevGuessError > 0 && guessError > prevGuessError) || (prevGuessError < 0 && guessError < prevGuessError)) { //less accurate
            return
        }
        else { //more accurate
            recursivePass(state, statePrev, guessError, i + 1)
        }

    }

    function runTrack(state, statePrev, injectedBoostFrame) {
        var i = 0
        var maxFrames = 200000
        var loopAgain = true
        var fire = false
        while (loopAgain) {
            overwriteState(state, statePrev)
            incrementFrame(state, injectedBoostFrame)
            /*console.log("frame: " + state.frame + " (" + Math.round(state.raceTime*1000)/1000 + "s)")
            console.log("combinedSpeed: " + Math.round(state.combinedSpeed*10)/10 + " = " + Math.round(state.baseSpeed*10)/10 + " + " + Math.round(state.boostSpeed*10)/10)
            //console.log("speedValue: " + state.speedValue + ", boostValue: " + state.boostValue)
            //console.log("isBoostStart: " + state.isBoostStart + ", isBoostStartEnded: " + state.isBoostStartEnded)
            console.log("distance travelled: " + Math.round(state.distanceTravelled*10)/10 + ", track finished?: " + state.isTrackFinished)*/

            //determine whether to loop again
            i++
            loopAgain = (loopAgain && i < maxFrames) ? true : false
            if (state.isTrackFinished) { //continue running after track finish until average speed drops
                loopAgain = (loopAgain && state.averageSpeed > state.prevAverageSpeed) ? true : false
            }
        }
    }


    //data (object) functions
    function resetStatesAndValues() {
        lastAverageSpeedIncreaseFrame = 0
        stateInitialPass = createClonedState(stateZeroFrame)
        stateInitialPassPrev = createClonedState(stateZeroFrame)
        stateLastBoostStart = createClonedState(stateZeroFrame)
        stateLastBoostEnd = createClonedState(stateZeroFrame)
        stateTrackEndFrame = createClonedState(stateZeroFrame)
        stateNextPass = createClonedState(stateZeroFrame)
        stateNextPassPrev = createClonedState(stateZeroFrame)
    }

    function createState(frame, raceTime, distanceTravelled, speedValue, boostCharge, heat, boostValue, isBoosting, isBoostStart, isBoostStartEnded, nosePosition, isTrackFinished) {
        return {
            frame: frame,

            raceTime: raceTime,
            speedValue: speedValue,
            baseSpeed: calculateBaseSpeed(speedValue),
            boostCharge: boostCharge,

            //boost stuff
            heat: heat,
            boostValue: boostValue,
            boostSpeed: calculateBoostSpeed(boostValue),
            isBoosting: isBoosting,
            isBoostStart: isBoostStart,
            isBoostStartEnded: isBoostStartEnded, //becomes true to prevent boost start if speed later drops below 290

            speedTimeMultiplier: (isBoosting || isBoostStart) ? 4.0 : 1.5, //4.0 when boosting or boost start, 1.5 otherwise

            nosePosition: nosePosition, //'d': down, 'u': up, 'n': neutral
            noseMultiplier: calculateNoseMultiplier(nosePosition),
            isTrackFinished: isTrackFinished,
            finishTime: 1000000.0,

            combinedSpeed: this.baseSpeed + this.boostSpeed,
            distanceTravelled: distanceTravelled,
            averageSpeed: distanceTravelled / raceTime,
            averageSpeedAtTrackEnd: 0.0,
            prevAverageSpeed: this.averageSpeed
        }
    }

    function createClonedState(state) {
        return {
            frame: state.frame,

            raceTime: state.raceTime,
            speedValue: state.speedValue,
            baseSpeed: state.baseSpeed,
            boostCharge: state.boostCharge,

            heat: state.heat,
            boostValue: state.boostValue,
            boostSpeed: state.boostSpeed,
            isBoosting: state.isBoosting,
            isBoostStart: state.isBoostStart,
            isBoostStartEnded: state.isBoostStartEnded, //becomes true to prevent boost start if speed later drops below 290

            speedTimeMultiplier: state.speedTimeMultiplier, //4.0 when boosting or boost start, 1.5 otherwise

            nosePosition: state.nosePosition, //'d': down, 'u': up, 'n': neutral
            noseMultiplier: state.noseMultiplier,
            isTrackFinished: state.isTrackFinished,
            finishTime: state.finishTime,

            combinedSpeed: state.combinedSpeed,
            distanceTravelled: state.distanceTravelled,
            averageSpeed: state.averageSpeed,
            averageSpeedAtTrackEnd: state.averageSpeedAtTrackEnd,
            prevAverageSpeed: state.prevAverageSpeed
        }
    }

    function overwriteState(sourceState, destinationState) {
        destinationState.frame = sourceState.frame,

            destinationState.raceTime = sourceState.raceTime,
            destinationState.speedValue = sourceState.speedValue,
            destinationState.baseSpeed = sourceState.baseSpeed,
            destinationState.boostCharge = sourceState.boostCharge,

            destinationState.heat = sourceState.heat,
            destinationState.boostValue = sourceState.boostValue,
            destinationState.boostSpeed = sourceState.boostSpeed,
            destinationState.isBoosting = sourceState.isBoosting,
            destinationState.isBoostStart = sourceState.isBoostStart,
            destinationState.isBoostStartEnded = sourceState.isBoostStartEnded,

            destinationState.speedTimeMultiplier = sourceState.speedTimeMultiplier,

            destinationState.nosePosition = sourceState.nosePosition,
            destinationState.noseMultiplier = sourceState.noseMultiplier,
            destinationState.isTrackFinished = sourceState.isTrackFinished,
            destinationState.finishTime = sourceState.finishTime,

            destinationState.combinedSpeed = sourceState.combinedSpeed,
            destinationState.distanceTravelled = sourceState.distanceTravelled,
            destinationState.averageSpeed = sourceState.averageSpeed,
            destinationState.averageSpeedAtTrackEnd = sourceState.averageSpeedAtTrackEnd,
            destinationState.prevAverageSpeed = sourceState.prevAverageSpeed
    }

    function printState(state) {
        console.log(String("frame: " + state.frame))

        console.log(String("raceTime: " + state.raceTime))
        console.log(String("speedValue: " + state.speedValue))
        console.log(String("baseSpeed: " + state.baseSpeed))
        console.log(String("boostCharge: " + state.boostCharge))

        console.log(String("heat: " + state.heat))
        console.log(String("boostValue: " + state.boostValue))
        console.log(String("boostSpeed: " + state.boostSpeed))
        console.log(String("isBoosting: " + state.isBoosting))
        console.log(String("isBoostStart: " + state.isBoostStart))
        console.log(String("isBoostStartEnded: " + state.isBoostStartEnded))

        console.log(String("speedTimeMultiplier: " + state.speedTimeMultiplier))

        console.log(String("nosePosition: " + state.nosePosition))
        console.log(String("noseMultiplier: " + state.noseMultiplier))
        console.log(String("isTrackFinished: " + state.isTrackFinished))
        console.log(String("finishTime: " + state.finishTime))

        console.log(String("combinedSpeed: " + state.combinedSpeed))
        console.log(String("distanceTravelled: " + state.distanceTravelled))
        console.log(String("averageSpeed: " + state.averageSpeed))
        console.log(String("averageSpeedAtTrackEnd: " + state.averageSpeedAtTrackEnd))
        console.log(String("prevAverageSpeed: " + state.prevAverageSpeed))
    }

    //speed functions
    function incrementFrame(state, injectedBoostFrame) {
        state.frame++
        state.raceTime = (state.frame + 1) * frameTime

        //booststart
        {
            if (!state.isBoostStartEnded && state.isBoostStart && state.combinedSpeed > 290) { //boost start ends at 290 ASU
                state.isBoostStartEnded = true
                state.isBoostStart = false
            }
        }

        //check if should boost
        {
            //boost charge
            if (state.combinedSpeed >= podStats.statSpeed * 0.75) { //cannot boost below 75% max base speed
                state.boostCharge = Math.min(Math.max(state.boostCharge + frameTime, 0), 1) //1 second to charge boost
            }
            //toggle boost
            var prevIsBoosting = state.isBoosting
            if (state.heat + (podStats.statCoolRate * frameTime) >= maxAllowedHeat && state.boostCharge == 1) { //boost if boost is ready
                state.isBoosting = true
            } else if (state.isBoosting && state.heat - (podStats.statHeatRate * frameTime) > 0) { //boost until heat == 0
                state.isBoosting = true
            } else if (state.frame == injectedBoostFrame) { //manually boost on frame
                state.isBoosting = true
            } else {
                state.isBoosting = false
            }

            if (!prevIsBoosting && state.isBoosting) { //boost just started
                //lastBoostStartFrame = state.frame
                overwriteState(state, stateLastBoostStart)
            }
            else if (prevIsBoosting && !state.isBoosting) { //boost just ended
                //lastBoostEndFrame = state.frame -1
                overwriteState(state, stateLastBoostEnd)
            }
        }

        //base speed
        {
            state.speedTimeMultiplier = (state.isBoosting || state.isBoostStart) ? 4.0 : 1.5 //1.5 normally, 4.0 during boost start or boost
            state.speedValue += state.noseMultiplier * frameTime * state.speedTimeMultiplier
            state.baseSpeed = calculateBaseSpeed(state.speedValue) //where base speed is calculated
        }

        //handle the effects of boost
        {
            if (state.isBoosting) {
                state.boostValue += 1.5 * frameTime //boosting
                state.heat -= podStats.statHeatRate * frameTime
            }
            else {
                if (state.boostValue >= 0.001) { //decelerating
                    state.boostValue *= (1 - (33.33 * frameTime / (33.33 * frameTime + 5)))
                }
                else state.boostValue = 0 //no boost
                state.heat += podStats.statCoolRate * frameTime
            }
            state.heat = Math.min(Math.max(state.heat, 0), 100)
            state.boostSpeed = calculateBoostSpeed(state.boostValue)
        }

        state.combinedSpeed = state.baseSpeed + state.boostSpeed //actual pod speed

        //track stuff
        {
            state.distanceTravelled += state.combinedSpeed * frameTime
            state.prevAverageSpeed = state.averageSpeed
            state.averageSpeed = state.distanceTravelled / state.raceTime
            lastAverageSpeedIncreaseFrame = (state.averageSpeed > state.prevAverageSpeed) ? state.frame : lastAverageSpeedIncreaseFrame

            var prevIsTrackFinished = state.isTrackFinished
            state.isTrackFinished = state.distanceTravelled >= trackLength ? true : false
            if (!prevIsTrackFinished && state.isTrackFinished) { //track just ended
                //lastTrackEndFrame = state.frame
                state.finishTime = calculateFinishTime(state)
                state.averageSpeedAtTrackEnd = state.averageSpeed
                overwriteState(state, stateTrackEndFrame)
            }
        }
    }

    function calculateBaseSpeed(speedValue) { //calculates base speed (before boost speed)
        return speedValue * podStats.statSpeed / (podStats.statAccel + speedValue)
    }

    function calculateBoostSpeed(boostValue) { //calculates bonus boost speed (before being combined with base speed)
        return boostValue * podStats.statThrust / (boostValue + 0.33)
    }

    function calculateFinishTime(state) {
        return state.raceTime + (trackLength - state.distanceTravelled) / state.combinedSpeed
    }

    function calculateNoseMultiplier(nosePosition) {
        switch (nosePosition) {
            case 'd': //nose down
                return 1.32
            case 'u': //nose up
                return 0.68
            default: //generally this is 'n'
                return 1.0
        }
    }

    //pod stats
    function getPodStats(index) {
        podStats.statSpeed = upgradeTopSpeed(racers[index].max_speed, upgradeLevel)
        podStats.statThrust = racers[index].boost_thrust
        podStats.statAccel = upgradeAcceleration(racers[index].acceleration, upgradeLevel)
        podStats.statCoolRate = upgradeCooling(racers[index].cool_rate, upgradeLevel)
        podStats.statHeatRate = racers[index].heat_rate
    }
}