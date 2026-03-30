import { Score } from "../modules/Score.module.js";
import { User } from "../modules/user.module.js";
import { hasActiveSubscription } from "../constants/subscriptionPlans.js";

const DRAW_NUMBER_MIN = 1;
const DRAW_NUMBER_MAX = 45;
const DRAW_SIZE = 5;

const roundToTwo = (value) => Number(Number(value || 0).toFixed(2));

const buildNumberPool = () =>
    Array.from(
        { length: DRAW_NUMBER_MAX - DRAW_NUMBER_MIN + 1 },
        (_, index) => DRAW_NUMBER_MIN + index
    );

const hasAnyWinner = (result) =>
    Boolean(
        (result?.matchCounts?.three || 0) +
        (result?.matchCounts?.four || 0) +
        (result?.matchCounts?.five || 0)
    );

const padMonthValue = (value) => String(value).padStart(2, "0");

const parseMonthParts = (monthKey) => {
    const match = String(monthKey || "").match(/^(\d{4})-(\d{2})$/);

    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }

    return { year, month };
};

export const getDrawMonthKey = (date = new Date()) => {
    const parsedDate = date instanceof Date ? date : new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        throw new Error("Invalid draw date");
    }

    return `${parsedDate.getFullYear()}-${padMonthValue(parsedDate.getMonth() + 1)}`;
};

export const isValidDrawMonthKey = (monthKey) => Boolean(parseMonthParts(monthKey));

export const getStartOfDrawMonth = (monthKey) => {
    const parts = parseMonthParts(monthKey);

    if (!parts) {
        throw new Error("Invalid draw month");
    }

    return new Date(parts.year, parts.month - 1, 1);
};

const getRandomIndexFromWeight = (weightedItems) => {
    const totalWeight = weightedItems.reduce((sum, item) => sum + item.weight, 0);

    if (totalWeight <= 0) {
        return Math.floor(Math.random() * weightedItems.length);
    }

    let threshold = Math.random() * totalWeight;

    for (let index = 0; index < weightedItems.length; index += 1) {
        threshold -= weightedItems[index].weight;

        if (threshold <= 0) {
            return index;
        }
    }

    return weightedItems.length - 1;
};

const pickNumbersFromPool = ({
    availableNumbers,
    picksNeeded,
    logicMode,
    algorithmicPreference,
    scoreFrequency
}) => {
    const normalizedPicks = Math.max(0, Number(picksNeeded) || 0);

    if (!normalizedPicks || !availableNumbers.length) {
        return [];
    }

    if (logicMode !== "algorithmic") {
        const workingPool = [...availableNumbers];
        const selected = [];

        while (selected.length < normalizedPicks && workingPool.length) {
            const randomIndex = Math.floor(Math.random() * workingPool.length);
            selected.push(workingPool.splice(randomIndex, 1)[0]);
        }

        return selected;
    }

    const maxFrequency = Math.max(...availableNumbers.map((number) => scoreFrequency.get(number) || 0), 0);
    const weightedPool = availableNumbers.map((number) => {
        const frequency = scoreFrequency.get(number) || 0;
        const weight =
            algorithmicPreference === "least_frequent"
                ? maxFrequency - frequency + 1
                : frequency + 1;

        return {
            number,
            weight: Math.max(weight, 1)
        };
    });

    const selected = [];

    while (selected.length < normalizedPicks && weightedPool.length) {
        const pickedIndex = getRandomIndexFromWeight(weightedPool);
        selected.push(weightedPool.splice(pickedIndex, 1)[0].number);
    }

    return selected;
};

const buildGuaranteedThreeMatchWinningNumbers = ({
    tickets,
    logicMode,
    algorithmicPreference,
    scoreFrequency
}) => {
    const eligibleTickets = tickets.filter(
        (ticket) => Array.isArray(ticket?.uniqueTicketNumbers) && ticket.uniqueTicketNumbers.length >= 3
    );

    if (!eligibleTickets.length) {
        return null;
    }

    const guaranteedTicket = eligibleTickets[Math.floor(Math.random() * eligibleTickets.length)];
    const guaranteedNumbers = pickNumbersFromPool({
        availableNumbers: [...new Set(guaranteedTicket.uniqueTicketNumbers)],
        picksNeeded: 3,
        logicMode: "random",
        algorithmicPreference,
        scoreFrequency
    });

    if (guaranteedNumbers.length < 3) {
        return null;
    }

    const remainingPool = buildNumberPool().filter((number) => !guaranteedNumbers.includes(number));
    const additionalNumbers = pickNumbersFromPool({
        availableNumbers: remainingPool,
        picksNeeded: DRAW_SIZE - guaranteedNumbers.length,
        logicMode,
        algorithmicPreference,
        scoreFrequency
    });

    return [...guaranteedNumbers, ...additionalNumbers].sort((left, right) => left - right);
};

const buildFrequencyEntries = (frequencyMap, limit = 8) =>
    [...frequencyMap.entries()]
        .map(([score, count]) => ({ score: Number(score), count }))
        .sort((left, right) => right.count - left.count || left.score - right.score)
        .slice(0, limit);

const buildLeastFrequentEntries = (frequencyMap, limit = 8) =>
    [...frequencyMap.entries()]
        .map(([score, count]) => ({ score: Number(score), count }))
        .sort((left, right) => left.count - right.count || left.score - right.score)
        .slice(0, limit);

const buildEligibleTickets = async () => {
    const players = await User.find({ role: { $ne: "admin" } })
        .select("name email subscription")
        .sort({ createdAt: 1 });

    const activePlayers = players.filter(hasActiveSubscription);

    if (!activePlayers.length) {
        return {
            tickets: [],
            scoreFrequency: new Map()
        };
    }

    const activePlayerIds = activePlayers.map((player) => player._id);
    const scores = await Score.find({ player: { $in: activePlayerIds } })
        .select("player stablefordScore playedAt createdAt")
        .sort({ player: 1, playedAt: -1, createdAt: -1 });

    const scoreMapByPlayer = new Map();
    const scoreFrequency = new Map();

    scores.forEach((score) => {
        const playerKey = String(score.player);
        const playerScores = scoreMapByPlayer.get(playerKey) || [];

        if (playerScores.length >= DRAW_SIZE) {
            return;
        }

        playerScores.push(score.stablefordScore);
        scoreMapByPlayer.set(playerKey, playerScores);
        scoreFrequency.set(
            score.stablefordScore,
            (scoreFrequency.get(score.stablefordScore) || 0) + 1
        );
    });

    const tickets = activePlayers
        .map((player) => {
            const ticketNumbers = scoreMapByPlayer.get(String(player._id)) || [];
            const uniqueTicketNumbers = [...new Set(ticketNumbers)].sort((left, right) => left - right);

            return {
                userId: player._id,
                name: player.name,
                email: player.email,
                ticketNumbers,
                uniqueTicketNumbers
            };
        })
        .filter((ticket) => ticket.ticketNumbers.length);

    return {
        tickets,
        scoreFrequency
    };
};

export const generateWinningNumbers = ({
    logicMode,
    algorithmicPreference,
    scoreFrequency
}) => {
    const selectedNumbers = pickNumbersFromPool({
        availableNumbers: buildNumberPool(),
        picksNeeded: DRAW_SIZE,
        logicMode,
        algorithmicPreference,
        scoreFrequency
    });

    return selectedNumbers.sort((left, right) => left - right);
};

export const evaluateDrawResult = ({
    winningNumbers,
    tickets,
    prizeConfig,
    carryOverFromPrevious,
    scoreFrequency
}) => {
    const winningNumberSet = new Set(winningNumbers);
    const matchCounts = {
        three: 0,
        four: 0,
        five: 0
    };

    const provisionalWinners = tickets
        .map((ticket) => {
            const matchedNumbers = ticket.uniqueTicketNumbers.filter((number) => winningNumberSet.has(number));
            const matchCount = matchedNumbers.length;

            if (matchCount < 3) {
                return null;
            }

            if (matchCount === 3) matchCounts.three += 1;
            if (matchCount === 4) matchCounts.four += 1;
            if (matchCount >= 5) matchCounts.five += 1;

            return {
                userId: ticket.userId,
                name: ticket.name,
                email: ticket.email,
                ticketNumbers: ticket.ticketNumbers,
                matchedNumbers,
                matchCount,
                prizeAmount: 0
            };
        })
        .filter(Boolean);

    const jackpotValue = roundToTwo((prizeConfig?.fiveMatchJackpot || 0) + (carryOverFromPrevious || 0));
    const splitJackpotPrize = matchCounts.five ? roundToTwo(jackpotValue / matchCounts.five) : 0;

    const winners = provisionalWinners
        .map((winner) => {
            if (winner.matchCount >= 5) {
                return {
                    ...winner,
                    prizeAmount: splitJackpotPrize
                };
            }

            if (winner.matchCount === 4) {
                return {
                    ...winner,
                    prizeAmount: roundToTwo(prizeConfig?.fourMatchPrize || 0)
                };
            }

            return {
                ...winner,
                prizeAmount: roundToTwo(prizeConfig?.threeMatchPrize || 0)
            };
        })
        .sort((left, right) => right.matchCount - left.matchCount || right.prizeAmount - left.prizeAmount || left.name.localeCompare(right.name));

    const payout = {
        three: roundToTwo(matchCounts.three * (prizeConfig?.threeMatchPrize || 0)),
        four: roundToTwo(matchCounts.four * (prizeConfig?.fourMatchPrize || 0)),
        five: matchCounts.five ? jackpotValue : 0,
        total: 0
    };

    payout.total = roundToTwo(payout.three + payout.four + payout.five);

    return {
        winningNumbers,
        eligiblePlayers: tickets.length,
        matchCounts,
        payout,
        rolloverToNextMonth: matchCounts.five ? 0 : jackpotValue,
        topScoreFrequencies: buildFrequencyEntries(scoreFrequency),
        winners
    };
};

export const simulateDraw = async ({
    logicMode,
    algorithmicPreference,
    prizeConfig,
    carryOverFromPrevious,
    runs = 1
}) => {
    const normalizedRuns = Math.max(1, Math.min(Number(runs) || 1, 500));
    const { tickets, scoreFrequency } = await buildEligibleTickets();
    const winningNumberFrequency = new Map();

    let previewResult = null;
    const aggregateMatchCounts = {
        three: 0,
        four: 0,
        five: 0
    };
    let rolloverAccumulator = 0;
    let fiveMatchHitRuns = 0;

    for (let runIndex = 0; runIndex < normalizedRuns; runIndex += 1) {
        let winningNumbers = generateWinningNumbers({
            logicMode,
            algorithmicPreference,
            scoreFrequency
        });

        let evaluatedResult = evaluateDrawResult({
            winningNumbers,
            tickets,
            prizeConfig,
            carryOverFromPrevious,
            scoreFrequency
        });

        if (tickets.length && !hasAnyWinner(evaluatedResult)) {
            const guaranteedNumbers = buildGuaranteedThreeMatchWinningNumbers({
                tickets,
                logicMode,
                algorithmicPreference,
                scoreFrequency
            });

            if (guaranteedNumbers?.length === DRAW_SIZE) {
                winningNumbers = guaranteedNumbers;
                evaluatedResult = evaluateDrawResult({
                    winningNumbers,
                    tickets,
                    prizeConfig,
                    carryOverFromPrevious,
                    scoreFrequency
                });
            }
        }

        winningNumbers.forEach((number) => {
            winningNumberFrequency.set(number, (winningNumberFrequency.get(number) || 0) + 1);
        });

        aggregateMatchCounts.three += evaluatedResult.matchCounts.three;
        aggregateMatchCounts.four += evaluatedResult.matchCounts.four;
        aggregateMatchCounts.five += evaluatedResult.matchCounts.five;
        rolloverAccumulator += evaluatedResult.rolloverToNextMonth;

        if (evaluatedResult.matchCounts.five > 0) {
            fiveMatchHitRuns += 1;
        }

        previewResult = evaluatedResult;
    }

    return {
        runs: normalizedRuns,
        generatedAt: new Date(),
        winningNumbers: previewResult?.winningNumbers || [],
        eligiblePlayers: previewResult?.eligiblePlayers || 0,
        matchCounts: previewResult?.matchCounts || { three: 0, four: 0, five: 0 },
        payout: previewResult?.payout || { three: 0, four: 0, five: 0, total: 0 },
        rolloverToNextMonth: previewResult?.rolloverToNextMonth || 0,
        topScoreFrequencies:
            algorithmicPreference === "least_frequent"
                ? buildLeastFrequentEntries(scoreFrequency)
                : buildFrequencyEntries(scoreFrequency),
        winners: previewResult?.winners || [],
        analysis: {
            averageMatchCounts: {
                three: roundToTwo(aggregateMatchCounts.three / normalizedRuns),
                four: roundToTwo(aggregateMatchCounts.four / normalizedRuns),
                five: roundToTwo(aggregateMatchCounts.five / normalizedRuns)
            },
            fiveMatchHitRate: roundToTwo((fiveMatchHitRuns / normalizedRuns) * 100),
            averageRollover: roundToTwo(rolloverAccumulator / normalizedRuns),
            mostCommonWinningNumbers: buildFrequencyEntries(winningNumberFrequency)
        }
    };
};
