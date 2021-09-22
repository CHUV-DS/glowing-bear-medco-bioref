import { EventEmitter, Injectable, Output } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ApiI2b2Timing } from '../models/api-request-models/medco-node/api-i2b2-timing';
import { ApiExploreStatistics, ModifierApiObjet } from '../models/api-request-models/survival-analyis/api-explore-statistics';
import { ApiExploreStatisticResult, ApiExploreStatisticsResponse, ApiInterval } from '../models/api-response-models/explore-statistics/explore-statistics-response';
import { Concept } from '../models/constraint-models/concept';
import { Constraint } from '../models/constraint-models/constraint';
import { Modifier } from '../models/constraint-models/modifier';
import { TreeNode } from '../models/tree-models/tree-node';
import { ErrorHelper } from '../utilities/error-helper';
import { ApiEndpointService } from './api-endpoint.service';
import { MedcoNetworkService } from './api/medco-network.service';
import { CohortService } from './cohort.service';
import { ConstraintMappingService } from './constraint-mapping.service';
import { ConstraintReverseMappingService } from './constraint-reverse-mapping.service';
import { ConstraintService } from './constraint.service';
import { CryptoService } from './crypto.service';
import { NavbarService } from './navbar.service';
import { QueryService } from './query.service';

//this class represents contains the following info: how many observations there are in a interval of a histogram for a concept
export class Interval {
    count: number
    higherBound: string
    lowerBound: string

    constructor(lowerBound, higherBound, decryptedCount) {
        this.higherBound = higherBound
        this.lowerBound = lowerBound
        this.count = decryptedCount
        console.log('Clear count for [', this.lowerBound, ', ', this.higherBound, '] is ', this.count)
    }
}

//This class contains all information necessary to build a histogram chart with chart.js
export class ChartInformation {
    intervals: Interval[]
    readonly unit: string
    readonly readable: Observable<any>

    constructor(apiResponse: ApiExploreStatisticResult, cryptoService: CryptoService,
        public readonly treeNodeName: string, public readonly cohortName: string) {
        this.unit = apiResponse.unit

        const encCounts: string[] = apiResponse.intervals.map((i: ApiInterval) => i.encCount)
        const decryptedCounts = cryptoService.decryptIntegersWithEphemeralKey(encCounts)
        this.readable = decryptedCounts
        decryptedCounts.subscribe(counts => {
            this.intervals = counts.map((count, intervalIndex) => {
                const apiInterval = apiResponse.intervals[intervalIndex]
                return new Interval(apiInterval.lowerBound, apiInterval.higherBound, count)
            })
        })

    }

}

/*
* ExploreStatisticsService communicates with the following two components: explore-statistics-settings, explore-statistics-results.
* From the settings given by the explore-statistics-settings form, this class is able to execute a query which will fetch the aggregated number of observations
* per interval for a specific concept. It communicates that info to explore-statistics-results which will display that histogram as a chart
*/
@Injectable()
export class ExploreStatisticsService {

    // 1 minute timeout
    private static TIMEOUT_MS = 1000 * 60 * 1;

    // Sends the result of the latest query when is is available
    @Output() ChartDataEmitter: EventEmitter<ChartInformation> = new EventEmitter()

    private static getNewQueryID(): string {
        let d = new Date()
        return (`Explore_Statistics${d.getUTCFullYear()}${d.getUTCMonth()}${d.getUTCDate()}${d.getUTCHours()}` +
            `${d.getUTCMinutes()}${d.getUTCSeconds()}${d.getUTCMilliseconds()}`)
    }

    constructor(
        private apiEndpointService: ApiEndpointService,
        private cryptoService: CryptoService,
        private cohortService: CohortService,
        private medcoNetworkService: MedcoNetworkService,
        private constraintService: ConstraintService,

        private queryService: QueryService,
        private constraintMappingService: ConstraintMappingService,
        private reverseConstraintMappingService: ConstraintReverseMappingService,
        private navbarService: NavbarService
    ) { }


    private refreshConstraint(constraint: Constraint): Observable<Constraint> {
        return this.reverseConstraintMappingService.mapPanels(this.constraintMappingService.mapConstraint(constraint))
    }


    /*
     * This function is called when the user wants to execute an explore statistics from the explore tab.
     * This function sends an explore statistics query to all running back-end nodes. When the answer is received it is processed and transformed
     * into a list of chart informations. Each chart information is used to build a new chart in the front end.
     */
    executeQueryFromExplore() {
        const constraint = this.constraintService.rootInclusionConstraint
        const upToDateConstraint = this.refreshConstraint(constraint)

        upToDateConstraint.subscribe(upToDateConstraint => {
            const uniqueAnalytes = new Set(upToDateConstraint.getAnalytes())
            console.log("Analytes ", uniqueAnalytes)


            const cohortConstraint = this.prepareCohort(upToDateConstraint);

            const analytes = Array.from(uniqueAnalytes)

            //the analytes split into two groups: modifiers and concepts
            const { conceptsPaths, modifiers }: { conceptsPaths: string[]; modifiers: ModifierApiObjet[]; } = this.extractConceptsAndModifiers(analytes);

            const apiRequest: ApiExploreStatistics = {
                ID: ExploreStatisticsService.getNewQueryID(),
                concepts: conceptsPaths,
                modifiers: modifiers,
                userPublicKey: this.cryptoService.ephemeralPublicKey,
                numberOfBuckets: 6, //TODO define this in another way
                cohortDefinition: {
                    queryTiming: this.queryService.lastTiming,
                    panels: this.constraintMappingService.mapConstraint(cohortConstraint)
                }
            }

            const observableRequest = this.sendRequest(apiRequest)

            this.navbarService.navigateToExploreTab()
            console.log("Api request ", apiRequest)

            observableRequest.subscribe((answers: ApiExploreStatisticsResponse[]) => {
                //TODO if answers is empty send an error
                if (answers == undefined || answers.length == 0) {
                    ErrorHelper.handleNewError('Error with the servers. Empty result in explore-statistics.')
                }
                // All servers are supposed to send the same information so we pick the element with index zero
                const serverResponse: ApiExploreStatisticsResponse = answers[0]

                console.debug("Explore stats response ", serverResponse)
                const chartsInformations = serverResponse.results.map ((result: ApiExploreStatisticResult) => {
                    return new ChartInformation(result, this.cryptoService, result.analyteName, "TODO Generate this from the constraints of the explore query settings menu")
                })

                console.debug("Information constructed for the charts ", chartsInformations)
            })
        })

        //TODO
        // Send the object to all nodes. i.e. subscribe to the back-end's answer
        // When the answer is received display it in the widgets.
    }


    //TODO define the return type of this method
    private sendRequest(apiRequest: ApiExploreStatistics) {
        return forkJoin(this.medcoNetworkService.nodes
            .map(
                node => this.apiEndpointService.postCall(
                    'node/explore-statistics/query',
                    apiRequest,
                    node.url
                )
            ))
            .pipe(timeout(ExploreStatisticsService.TIMEOUT_MS));
    }

    private extractConceptsAndModifiers(analytes: TreeNode[]) {
        const conceptsPaths = analytes
            .filter(node => !node.isModifier)
            .map(node => node.path);

        const modifiers: Array<ModifierApiObjet> = analytes.filter(node => node.isModifier).map(node => {
            return {
                ParentConceptPath: node.appliedPath,
                ModifierKey: node.path,
                AppliedPath: node.appliedConcept.path
            };
        });
        return { conceptsPaths, modifiers };
    }

    private prepareCohort(upToDateConstraint: Constraint) {
        const filteredInclusionConstraint = upToDateConstraint.constraintWithoutAnalytes();
        const cohortConstraint = this.constraintService.generateConstraintHelper(filteredInclusionConstraint, this.constraintService.rootExclusionConstraint);

        console.log("Cohort constraint ", cohortConstraint);

        if (cohortConstraint === undefined) {
            throw ErrorHelper.handleNewError("Undefined population. Please select criterias which are not analytes");
        }

        const errorMsg = cohortConstraint.inputValueValidity();
        if (errorMsg !== '') {
            throw ErrorHelper.handleNewError(errorMsg);
        }
        return cohortConstraint;
    }

    /*
     * Queries all nodes of the medco network in order to perform the construction of a histogram giving the observations counts for a concept or modifier.
     * Create a ChartInformation object from that information and emit this object via the ChartDataEmitter that the explore-statistics-results component subscribes to
     */
    executeQuery(concept: Concept, onExecuted: () => any) {
        if (!this.cohortService.selectedCohort || !this.cohortService.selectedCohort.name) {
            throw ErrorHelper.handleNewError('Please select a cohort on the left located cohort selection menu.')
        }

        const apiRequest: ApiExploreStatistics = {
            ID: ExploreStatisticsService.getNewQueryID(),
            concepts: [concept.path],
            userPublicKey: this.cryptoService.ephemeralPublicKey,
            numberOfBuckets: 6, //TODO remove this
            cohortDefinition: {
                queryTiming: ApiI2b2Timing.any,
                panels: []
            }
        }
        console.warn("TODO define explore query of explore statistics API message correctly!")


        if (concept.modifier) {
            apiRequest.modifiers = [{
                ParentConceptPath: concept.modifier.appliedConceptPath,
                ModifierKey: concept.modifier.path,
                AppliedPath: concept.modifier.appliedPath
            }]
        }

        console.log('Api request: ', apiRequest)

        const obs = forkJoin(this.medcoNetworkService.nodes
            .map(
                node =>
                    this.apiEndpointService.postCall(
                        'node/explore-statistics/query',
                        apiRequest,
                        node.url
                    )
            ))
            .pipe(timeout(ExploreStatisticsService.TIMEOUT_MS))


        const displayedName = concept.modifier ? this.getModifierDisplayName(concept.modifier) : concept.name

        obs.subscribe(
            (results: Array<ApiExploreStatisticsResponse>) => {
                console.log('Explore statistics request results ', results)
                if (results === undefined || results.length <= 0) {
                    ErrorHelper.handleNewError('Error with the server. Empty result.')
                }


                // Store the clear counts within the chart information class instance
                const chartInfo = new ChartInformation(results[0].results[0], this.cryptoService, displayedName, "TODO Generate this from the constraints of the explore query settings menu")
                chartInfo.readable.subscribe(_ => {
                    // waiting for the intervals to be decrypted by the crypto service to emit the chart information to external listeners.
                    this.ChartDataEmitter.emit(chartInfo)
                    onExecuted()
                })

            },
            err => {
                onExecuted()
            }

        )

    }

    private getModifierDisplayName(m: Modifier): string {
        return m.path.split('/').filter(s => s).pop()
    }

}
