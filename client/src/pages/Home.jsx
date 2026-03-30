import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const sectionVariants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

const cardHover = {
  y: -4,
  transition: { duration: 0.22, ease: 'easeOut' },
}

const visitorHighlights = [
  {
    title: 'View Platform Concept',
    description:
      'Digital Heroes is a charity golf platform where subscribed players track Stableford scores, support charities, and take part in a monthly draw experience.',
  },
  {
    title: 'Explore Listed Charities',
    description:
      'Visitors can understand that players choose a preferred charity and set a contribution percentage, keeping the fundraising side visible alongside the golf experience.',
  },
  {
    title: 'Understand Draw Mechanics',
    description:
      'The draw is run monthly using each player’s latest five scores, with 3-number, 4-number, and 5-number matches, simulation before publishing, and 5-match rollover support.',
  },
  {
    title: 'Initiate Subscription',
    description:
      'A visitor starts by choosing a subscription plan, then creates an account with that plan attached before accessing the signed-in player features.',
  },
]

const howItWorks = [
  'Choose a subscription plan first, then continue to signup with the selected plan attached.',
  'Signed-in players can save up to five recent Stableford scores that become the basis of their draw participation.',
  'Players also select a preferred charity and set a contribution percentage starting from 10%.',
  'Admins configure the draw, simulate outcomes, publish results, review winner proof screenshots, and move payouts from pending to paid.',
]

const drawDetails = [
  {
    label: 'Monthly Cadence',
    value: 'One draw per month',
  },
  {
    label: 'Score Ticket Logic',
    value: 'Latest five scores',
  },
  {
    label: 'Match Levels',
    value: '3, 4, and 5 matches',
  },
  {
    label: 'Winner Verification',
    value: 'Screenshot review before payout',
  },
]

const charityDetails = [
  'Charities are listed with their name, description, and supporting profile information.',
  'A player can choose one preferred charity from the listed options.',
  'The contribution slider starts at 10% and lets players dedicate more of their impact.',
]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const getShotMessage = (distanceFromHole) => {
  if (distanceFromHole <= 2) {
    return 'Hole in one feel. That was almost perfect.'
  }

  if (distanceFromHole <= 6) {
    return 'Great chip. You landed very close to the flag.'
  }

  if (distanceFromHole <= 12) {
    return 'Solid try. A little more touch and you are there.'
  }

  return 'A touch off line. Try timing the swing meter again.'
}

const Home = () => {
  const holePosition = 76
  const [swingPower, setSwingPower] = useState(18)
  const [swingDirection, setSwingDirection] = useState(1)
  const [ballPosition, setBallPosition] = useState(8)
  const [shotCount, setShotCount] = useState(0)
  const [bestDistance, setBestDistance] = useState(null)
  const [gameMessage, setGameMessage] = useState('Time the moving meter and try to stop the ball as close to the flag as you can.')

  // useEffect(() => {
  //   const intervalId = window.setInterval(() => {
  //     setSwingPower((currentPower) => {
  //       const nextPower = currentPower + swingDirection * 4

  //       if (nextPower >= 100) {
  //         setSwingDirection(-1)
  //         return 100
  //       }

  //       if (nextPower <= 6) {
  //         setSwingDirection(1)
  //         return 6
  //       }

  //       return nextPower
  //     })
  //   }, 70)

  //   return () => window.clearInterval(intervalId)
  // }, [swingDirection])

  // const handleTakeShot = () => {
  //   const drift = Math.round((Math.random() - 0.5) * 8)
  //   const nextBallPosition = clamp(swingPower + drift, 8, 96)
  //   const distanceFromHole = Math.abs(nextBallPosition - holePosition)

  //   setBallPosition(nextBallPosition)
  //   setShotCount((currentCount) => currentCount + 1)
  //   setBestDistance((currentBest) =>
  //     currentBest === null ? distanceFromHole : Math.min(currentBest, distanceFromHole)
  //   )
  //   setGameMessage(getShotMessage(distanceFromHole))
  // }

  // const handleResetGame = () => {
  //   setBallPosition(8)
  //   setShotCount(0)
  //   setBestDistance(null)
  //   setGameMessage('Fresh fairway. Try to land the ball right on the flag.')
  // }

  return (
    <motion.div initial="hidden" animate="show" variants={sectionVariants} className="space-y-8">
      <motion.section variants={sectionVariants} className="hero-panel rounded-[36px] border border-white/10 px-6 py-16 shadow-[0_30px_100px_rgba(15,23,42,0.45)] sm:px-10">
        <motion.p variants={itemVariants} className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">
          Charity Golf Platform
        </motion.p>
        <motion.h1 variants={itemVariants} className="max-w-4xl text-4xl font-semibold leading-tight text-white sm:text-6xl">
          Play with purpose, support charities, and join a monthly score-based draw.
        </motion.h1>
        <motion.p variants={itemVariants} className="mt-6 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
          This website connects subscribed golf players, charity selection, draw management, and winner verification into one platform with a clear admin and user workflow.
        </motion.p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div variants={itemVariants} className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">Public Visitor</p>
            <motion.div variants={sectionVariants} className="mt-5 space-y-4">
              {visitorHighlights.map((item) => (
                <motion.div
                  key={item.title}
                  variants={itemVariants}
                  whileHover={cardHover}
                  className="rounded-2xl border border-white/8 bg-slate-950/40 p-4"
                >
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{item.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants} whileHover={cardHover} className="flex flex-col justify-between gap-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">Get Started</p>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Visitors can review the platform model first, then move into the subscription and account-creation path when ready.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-5">
              <p className="text-sm text-slate-300">Start by choosing a subscription plan, then create an account to access the player features.</p>
            </div>
            <motion.div variants={sectionVariants} className="flex flex-wrap gap-3">
              <motion.div variants={itemVariants} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/subscription"
                  className="rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 text-sm font-semibold text-slate-950"
                >
                  Start Subscription
                </Link>
              </motion.div>
              <motion.div variants={itemVariants} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/signin"
                  className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Sign In
                </Link>
              </motion.div>
              <motion.div variants={itemVariants} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/signup"
                  className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Create Account
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section variants={sectionVariants} id="how-it-works" className="content-panel rounded-[32px] border border-white/10 p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <motion.div variants={itemVariants}>
            <h2 className="text-2xl font-semibold text-white">How It Works</h2>
            <p className="mt-3 max-w-2xl text-slate-300">
              The site is structured around subscription-gated user access, score tracking, charity preference, monthly draw publishing, and winner verification.
            </p>
            <motion.div variants={sectionVariants} className="mt-6 space-y-3">
              {howItWorks.map((item) => (
                <motion.div
                  key={item}
                  variants={itemVariants}
                  whileHover={cardHover}
                  className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-4"
                >
                  <span className="mt-2 h-2 w-2 rounded-full bg-amber-300" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants} whileHover={cardHover} className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">Draw Mechanics</p>
            <motion.div variants={sectionVariants} className="mt-5 grid gap-4 sm:grid-cols-2">
              {drawDetails.map((item) => (
                <motion.div
                  key={item.label}
                  variants={itemVariants}
                  whileHover={{ y: -3 }}
                  className="rounded-2xl border border-white/8 bg-slate-950/40 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-base font-semibold text-white">{item.value}</p>
                </motion.div>
              ))}
            </motion.div>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              The admin draw workspace also supports random or algorithmic generation, simulation before official publish, and rollover of the 5-match jackpot when there is no top winner.
            </p>
          </motion.div>
        </div>
      </motion.section>

      <motion.section variants={sectionVariants} id="charities" className="content-panel rounded-[32px] border border-white/10 p-8">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <motion.div variants={itemVariants}>
            <h2 className="text-2xl font-semibold text-white">Charities</h2>
            <p className="mt-3 max-w-2xl text-slate-300">
              The charity side of the website is built so supporters and players can see listed organisations and connect their golf participation to a cause.
            </p>
          </motion.div>

          <motion.div variants={sectionVariants} className="space-y-3">
            {charityDetails.map((item) => (
              <motion.div
                key={item}
                variants={itemVariants}
                whileHover={cardHover}
                className="rounded-2xl border border-white/8 bg-white/5 px-4 py-4"
              >
                <p className="text-sm leading-7 text-slate-200">{item}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>
    </motion.div>
  )
}

export default Home
