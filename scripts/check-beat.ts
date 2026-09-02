import { classify, beatsCombo, legalShows } from './src/core/rules'

const run43 = classify([4, 3])
const grp66 = classify([6, 6])
console.log('run43:', run43)
console.log('grp66:', grp66)
console.log('run43 beats grp66:', beatsCombo(run43!, grp66!))

const hand = [
  { top: 4, bottom: 1 },
  { top: 3, bottom: 2 },
]
console.log('legal vs grp66:', legalShows(hand, grp66))
