/**
 * Copyright 2020 - 2021 CHUV
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { logRank2Groups } from './log-rank-p-value'
import {SurvivalPoint} from '../../models/survival-analysis/survival-point';

describe('Logrank test', () => {
  const precision = 5
  const logranktest: Array<Array<SurvivalPoint>> = [
    [
      {
        timePoint: 1,
        prob: 0,
        cumul: 0,
        cumulCensoringEvents: 0,
        cumulEvents: 0,
        remaining: 1,
        atRisk: 2, // at risk at instant t, it is equivalent to remaining +censorings +events
        eventOfInterest: 1,
        censoringEvent: 0,
      }, {
        timePoint: 2,
        prob: 0,
        cumul: 0,
        cumulCensoringEvents: 0,
        cumulEvents: 0,
        remaining: 0,
        atRisk: 1, // at risk at instant t, it is equivalent to remaining +censorings +events
        eventOfInterest: 1,
        censoringEvent: 0,
      }

    ], [{
      timePoint: 3,
      prob: 0,
      cumul: 0,
      cumulCensoringEvents: 0,
      cumulEvents: 0,
      remaining: 1,
      atRisk: 2, // at risk at instant t, it is equivalent to remaining +censorings +events
      eventOfInterest: 1,
      censoringEvent: 0,
    }, {
      timePoint: 4,
      prob: 0,
      cumul: 0,
      cumulCensoringEvents: 0,
      cumulEvents: 0,
      remaining: 0,
      atRisk: 1, // at risk at instant t, it is equivalent to remaining +censorings +events
      eventOfInterest: 1,
      censoringEvent: 0,
    }

    ]

  ]

  let logrankStat = logRank2Groups(logranktest[0], logranktest[1])
  it('test value of logrank test', () => {
    expect(logrankStat).toBeCloseTo(0.08956, precision)
  })

})
