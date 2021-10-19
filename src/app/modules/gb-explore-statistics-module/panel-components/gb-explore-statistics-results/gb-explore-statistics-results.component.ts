/**
 * Copyright 2020 - 2021 CHUV
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { AfterViewInit, ChangeDetectorRef, Component, ComponentFactoryResolver, ComponentRef, ElementRef, OnDestroy, Type, ViewChild, ViewContainerRef } from '@angular/core';
import Chart from 'chart.js';
import * as ChartAnnotation from 'chartjs-plugin-annotation';
import { ChartInformation, ExploreStatisticsService } from '../../../../services/explore-statistics.service';

@Component({
  selector: 'gb-explore-statistics-results',
  templateUrl: './gb-explore-statistics-results.component.html',
  styleUrls: ['./gb-explore-statistics-results.component.css'],
})
export class GbExploreStatisticsResultsComponent implements AfterViewInit, OnDestroy {

  @ViewChild('exploreStatsCanvasContainer', { read: ViewContainerRef })
  canvasContainer: ViewContainerRef;

  private componentRefs: Array<ComponentRef<any>> = []

  private _displayLoadingIcon: boolean = false


  constructor(private exploreStatisticsService: ExploreStatisticsService,
    private componentFactoryResolver: ComponentFactoryResolver,
    private cdref: ChangeDetectorRef) { }



  private displayCharts(chartsInfo: ChartInformation[]) {


    // Clean the content of the canvas container: remove the previous charts from the canvas container
    this.canvasContainer.clear()

    chartsInfo.forEach(chartInfo => {

      //create a histogram
      this.buildChart(chartInfo, HistogramChartComponent)

      // create a smooth line graph
      this.buildChart(chartInfo, LineChartComponent)

      this.buildReferenceInterval(chartInfo, ReferenceIntervalHistogram)
      this.buildReferenceInterval(chartInfo, ReferenceIntervalLine)

    });

  }


  private buildChart<C extends ChartComponent>(chartInfo: ChartInformation, componentType: Type<C>) {
    const componentRef = Utils.buildChart(this.componentFactoryResolver, this.canvasContainer, chartInfo, componentType)

    this.componentRefs.push(componentRef)
  }


  private buildReferenceInterval<R extends ReferenceInterval>(chartInfo: ChartInformation, refIntervalType: Type<R>) {
    const componentRef = Utils.buildComponent(this.componentFactoryResolver, this.canvasContainer, refIntervalType)
    this.componentRefs.push(componentRef)

    const component = componentRef.instance
    component.chartInfo = chartInfo
  }

  get displayLoadingIcon() {
    return this._displayLoadingIcon
  }

  ngOnInit() {

    const namedChartAnnotation = ChartAnnotation;
    namedChartAnnotation["id"] = "annotation";
    Chart.pluginService.register(namedChartAnnotation);

    this.exploreStatisticsService.displayLoadingIcon.subscribe((display: boolean) => {
      this._displayLoadingIcon = display
      this.cdref.detectChanges();
    })
  }

  ngAfterViewInit() {
    this.exploreStatisticsService.chartsDataSubject.subscribe((chartsInfo: ChartInformation[]) => {
      this.displayCharts(chartsInfo);
    })
  }

  ngOnDestroy() {
    this.componentRefs.forEach(element => {
      element.destroy()
    });
  }

}

class Utils {
  public static buildComponent<C>(componentFactoryResolver: ComponentFactoryResolver, newComponentContainer: ViewContainerRef, componentType: Type<C>): ComponentRef<C> {
    const componentFactory = componentFactoryResolver.resolveComponentFactory(componentType);
    return newComponentContainer.createComponent(componentFactory);
  }


  public static buildChart<C extends ChartComponent>(componentFactoryResolver: ComponentFactoryResolver, newComponentContainer: ViewContainerRef,
    chartInfo: ChartInformation, componentType: Type<C>): ComponentRef<C> {
    const componentRef = Utils.buildComponent(componentFactoryResolver, newComponentContainer, componentType)

    const component = componentRef.instance
    component.chartInfo = chartInfo

    return componentRef
  }
}


@Component({
  templateUrl: './gb-reference-interval.component.html',
  styleUrls: ['./gb-reference-interval.component.css'],
})
export abstract class ReferenceInterval implements OnDestroy {

  @ViewChild('chartContainer', { read: ViewContainerRef }) chartContainer: ViewContainerRef;

  private _nbEntries: number
  private _lowQuantile: number
  private _lowBoundCI1: number
  private _highBoundCI1: number
  private _highQuantile: number
  private _lowBoundCI2: number
  private _highBoundCI2: number

  private _chartInfo: ChartInformation

  private componentRefs: Array<ComponentRef<any>> = []

  protected chartType: Type<ChartComponent>;


  constructor(private componentFactoryResolver: ComponentFactoryResolver) {
    this._nbEntries = 1
    this._lowQuantile = 2
    this._lowBoundCI1 = 3
    this._highBoundCI1 = 4
    this._highQuantile = 5
    this._lowBoundCI2 = 6
    this._highBoundCI2 = 7
  }




  private buildChart<C extends ChartComponent>(chartInfo: ChartInformation, componentType: Type<C>) {
    const componentRef = Utils.buildChart(this.componentFactoryResolver, this.chartContainer, chartInfo, componentType)
    this.componentRefs.push(componentRef)
  }

  ngAfterViewInit() {
    this.buildChart(this._chartInfo, this.chartType)
  }

  ngOnDestroy(): void {
    this.componentRefs.forEach(component => component.destroy())
  }

  numberOfObservations() {
    return this._chartInfo.numberOfObservations()
  }

  get nbEntries(): number { return this._nbEntries; }
  get lowQuantile(): number { return this._lowQuantile; }
  get lowBoundCI1(): number { return this._lowBoundCI1; }
  get highBoundCI1(): number { return this._highBoundCI1; }
  get highQuantile(): number { return this._highQuantile; }
  get lowBoundCI2(): number { return this._lowBoundCI2; }
  get highBoundCI2(): number { return this._highBoundCI2; }

  public set chartInfo(chartInfo: ChartInformation) {
    this._chartInfo = chartInfo
  }

}

@Component({
  templateUrl: './gb-reference-interval.component.html',
  styleUrls: ['./gb-reference-interval.component.css'],
})
export class ReferenceIntervalLine extends ReferenceInterval {
  constructor(componentFactoryResolver: ComponentFactoryResolver) {
    super(componentFactoryResolver)
    this.chartType = LineChartComponent
  }
}

@Component({
  templateUrl: './gb-reference-interval.component.html',
  styleUrls: ['./gb-reference-interval.component.css'],
})
export class ReferenceIntervalHistogram extends ReferenceInterval {
  constructor(componentFactoryResolver: ComponentFactoryResolver) {
    super(componentFactoryResolver)
    this.chartType = HistogramChartComponent
  }
}



const chartSelector = 'gb-explore-stats-canvas'
const chartTemplate = `<div><canvas #canvasElement>{{chart}}</canvas></div>`

// See for reference how to use canvas in angular:  https://stackoverflow.com/questions/44426939/how-to-use-canvas-in-angular
export abstract class ChartComponent implements AfterViewInit, OnDestroy {
  private static BACKGROUND_COLOURS: string[] = [
    'rgba(68, 0, 203, 0.5)',
    'rgba(54, 162, 235, 0.5)',
    'rgba(255, 99, 132, 0.5)',
    'rgba(255, 206, 86, 0.5)',
    'rgba(75, 192, 192, 0.5)',
    'rgba(255, 159, 64, 0.5)']


  private context: CanvasRenderingContext2D; // not sure it is necessary to put this as an attribute of the class
  private chartType: string

  @ViewChild('canvasElement', { static: false })
  private canvasRef: ElementRef<HTMLCanvasElement>;

  chartInfo: ChartInformation

  chart: Chart


  // the colour is chosen in BACKGROUND_COLOURS modulo the length of BACKGROUND_COLOURS
  static getBackgroundColor(index: number): string {
    return ChartComponent.BACKGROUND_COLOURS[index % ChartComponent.BACKGROUND_COLOURS.length]
  }

  constructor(public element: ElementRef, chartType: string) {
    this.chartType = chartType
  }


  protected getNewChart(): Chart {
    return new Chart(this.context, {
      type: this.chartType,
    })
  }


  ngAfterViewInit(): void {

    //TODO debug: ExpressionChangedAfterItHasBeenCheckedError (maybe use angular chart js?)
    // the reference to the `canvas` on which the chart will be drawn. See the @Component to see the canvas.
    this.context = this.canvasRef.nativeElement.getContext('2d');

    this.chart = this.getNewChart();
    this.draw()
  }

  abstract draw();

  ngOnDestroy() {
  }


}

@Component({
  selector: chartSelector,
  template: chartTemplate
})
export class HistogramChartComponent extends ChartComponent {


  constructor(public element: ElementRef) {
    super(element, 'bar')
  }

  ngAfterViewInit() {
    super.ngAfterViewInit()
  }

  /*
  * Given ChartInformation object this function will draw the histogram on the canvas
  */
  draw() {
    const chart = this.chart

    if (!(this.chartInfo && this.chartInfo.intervals && this.chartInfo.intervals.length > 0)) {
      chart.data.labels = [];
      chart.data.datasets[0].data = [];

      chart.update()

      return

    }

    // When the interval is the last one the right bound is inclusive, otherwise it is exclusive.
    const getRightBound = (i: number) => i < (this.chartInfo.intervals.length - 1) ? '[' : ']'

    chart.data.labels = this.chartInfo.intervals.map((int, i) => {
      return '[ ' + parseFloat(int.lowerBound) + ', ' + parseFloat(int.higherBound) + ' ' + getRightBound(i)
    });
    chart.data.datasets[0] = {
      data: this.chartInfo.intervals.map(i => i.count),
      backgroundColor: ChartComponent.getBackgroundColor(0) //this.chartInfo.intervals.map(_ => ChartComponent.getBackgroundColor(0))
    }


    chart.options = this.buildHistogramOptions()

    const minDisplayed = this.findMinDisplayed();
    chart.options.scales.yAxes = [{
      ticks: {
        min: minDisplayed
      }
    }]

    chart.update();
  }


  private findMinDisplayed() {
    let min, max: number;
    max = this.chartInfo.intervals[0].count;
    min = max;

    this.chartInfo.intervals.forEach(v => {
      if (max < v.count) {
        max = v.count;
      }
      if (min > v.count) {
        min = v.count;
      }
    });

    // the minimum value displayed by the chart is defined as the minimum data point minus 10% the range of values (max - min)
    const minDisplayed = min === 0 ? 0 : Math.floor(min - (max - min) * .1);
    return minDisplayed;
  }

  private buildHistogramOptions(): Chart.ChartOptions {
    return {
      legend: {
        display: false
      },
      title: {
        text: 'Histogram for the `' + this.chartInfo.treeNodeName + '` analyte',
        display: true
      },
      scales: {
        xAxes: [{
          scaleLabel: {
            display: true,
            labelString: 'Value [' + this.chartInfo.unit + ']',
          }
        }],
        yAxes: [{
          scaleLabel: {
            display: true,
            labelString: 'Frequency',
          }
        }]
      }
    };
  }
}

@Component({
  selector: chartSelector,
  template: chartTemplate
})
export class LineChartComponent extends ChartComponent {
  constructor(public element: ElementRef) {
    super(element, 'line')
  }

  ngAfterViewInit() {
    super.ngAfterViewInit()
  }

  //this method process the dataset necessary for drawing the interpolated line graph
  private buildPoints(chartInfo: ChartInformation): Chart.ChartData {
    // the x axis point associated to an interval count will be the the middle between the higher and lower bound of an interval
    const xPoints: Array<number> = chartInfo.intervals.map(interval => {
      return (parseFloat(interval.higherBound) + parseFloat(interval.lowerBound)) / 2
    })

    const dataPoints: Array<number> = chartInfo.intervals.map(interval => interval.count)


    return {
      labels: xPoints,
      datasets: [
        {
          label: 'Interpolated line plot for the `' + chartInfo.treeNodeName + '` analyte', //'Cubic interpolation (monotone)',
          data: dataPoints,
          borderColor: ChartComponent.getBackgroundColor(0),
          fill: false,
          cubicInterpolationMode: 'monotone',
        },
        // {
        //   label: 'Cubic interpolation',
        //   data: dataPoints,
        //   borderColor: ChartComponent.BACKGROUND_COLOURS[1],
        //   fill: false,
        //   tension: 0.4
        // },
        // {
        //   label: 'Linear interpolation (default)',
        //   data: dataPoints,
        //   borderColor: ChartComponent.BACKGROUND_COLOURS[2],
        //   fill: false
        // }
      ]
    };
  }

  // this method builds the config necessary for drawing the interpolated line graph
  private buildConfig(data: Chart.ChartData): Object /*Chart.ChartConfiguration*/ {



    const refIntervalX1 = data.labels[1]

    return {
      type: 'line',
      data: data,
      options: {
        annotation: {
          annotations: [{
            type: 'line',
            mode: 'vertical',
            scaleID: 'x-axis-0',
            value: refIntervalX1,
            borderColor: 'red',
            label: {
              content: "Test",
              enabled: true,
              position: "top"
            }

          }],
        },
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'Interpolated line plot for the `' + this.chartInfo.treeNodeName + '` analyte',
          },
        },
        interaction: {
          intersect: false,
        },
        scales: {
          xAxes: [{
            scaleLabel: {
              display: true,
              labelString: 'Value [' + this.chartInfo.unit + ']',
            }
          }],
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: 'Frequency',
            }
          }],
        }
      },
    };
  }

  /*
  * Given ChartInformation object this function will a line graph on the canvas. The points of the curves are interconnected using interpolation methods
  * see for reference https://github.com/chartjs/Chart.js/blob/master/docs/samples/line/interpolation.md
  */
  draw() {
    const chart = this.chart

    if (!(this.chartInfo && this.chartInfo.intervals && this.chartInfo.intervals.length > 0)) {
      chart.data.labels = [];
      chart.data.datasets[0].data = [];

      chart.update()

      return

    }


    const data = this.buildPoints(this.chartInfo)

    const config = this.buildConfig(data)

    chart.config = config
    chart.data = data

    chart.update()
  }


}