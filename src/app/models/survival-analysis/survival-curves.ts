/**
 * Copyright 2020 - 2021 CHUV
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { SurvivalAnalysisClear } from './survival-analysis-clear';

import { SurvivalPoint } from './survival-point';
import { SurvivalState } from './survival-state';

export class SurvivalCurve {

  curves: Array<{
    groupId: string
    points: Array<SurvivalPoint>
  }>

}


export function clearResultsToArray(clearRes: SurvivalAnalysisClear): SurvivalCurve {

  let curves = clearRes.results.map(result => {
    let sortedByTimePoint = result.groupResults.sort((a, b) => {
      return a.timepoint < b.timepoint ? -1 : 1;
    })

    const nofTimePoints = sortedByTimePoint.length
    let points = new Array<SurvivalPoint>(nofTimePoints + 1)


    let survivalState = new SurvivalState(result.initialCount)

    // make the curve start at zero with prob 1 and variance 0
    points[0] = survivalState.current()

    // fill the rest of the points
    sortedByTimePoint.forEach((oneTimePointRes, idx) => {
      let survPoint = survivalState
        .next(oneTimePointRes.timepoint, oneTimePointRes.events.eventOfInterest, oneTimePointRes.events.censoringEvent)
      points[idx + 1] = survPoint
    }
    )
    return {
      groupId: result.groupId,
      points: points
    }
  })

  let srva = new SurvivalCurve
  srva.curves = curves
  return srva

}

export function retrieveGroupIds(clearRes: SurvivalAnalysisClear): Array<string> {
  return clearRes.results.map(res => res.groupId)
}
