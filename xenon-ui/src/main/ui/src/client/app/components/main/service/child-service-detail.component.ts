// angular
import { AfterViewChecked, ChangeDetectionStrategy, Input,
    SimpleChange, OnChanges, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import * as _ from 'lodash';

declare var Chart: any;

// app
import { BaseComponent } from '../../../frameworks/core/index';

import { ModalContext, ServiceDocument, ServiceDocumentQueryResult,
    ServiceStats, ServiceStatsEntry } from '../../../frameworks/app/interfaces/index';
import { StringUtil } from '../../../frameworks/app/utils/index';

import { BaseService, NotificationService } from '../../../frameworks/app/services/index';

const OPERATIONS: string[] = ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS'];

@BaseComponent({
    selector: 'xe-child-service-detail',
    moduleId: module.id,
    templateUrl: './child-service-detail.component.html',
    styleUrls: ['./child-service-detail.component.css'],
    changeDetection: ChangeDetectionStrategy.Default
})

export class ChildServiceDetailComponent implements AfterViewChecked, OnChanges, OnDestroy {
    /**
     * Id for the selected service. E.g. /core/examples
     */
    @Input()
    selectedServiceId: string;

    /**
     * Id for the selected child service.
     */
    @Input()
    selectedChildServiceId: string;

    /**
     * Context object for rendering edit child service modal.
     */
    editChildServiceModalContext: ModalContext = {
        name: '',
        data: {
            documentSelfLink: '',
            method: '',
            body: ''
        }
    };

    /**
     * Context object for rendering delete child service modal.
     */
    deleteChildServiceModalContext: ModalContext = {
        name: '',
        data: {
            documentSelfLink: ''
        }
    };

    /**
     * Selected child service document
     */
    private _selectedChildService: ServiceDocumentQueryResult;

    /**
     * Selected child service stats document
     */
    private _selectedChildServiceStats: ServiceStats;

    /**
     * Canvas for rendering operation count chart
     */
    private _operationCountChartCanvas: any;

    /**
     * The operation count chart
     */
    private _operationCountChart: any;

    /**
     * Canvas for rendering operation duration chart
     */
    private _operationDurationChartCanvas: any;

    /**
     * The operation duration chart
     */
    private _operationDurationChart: any;

    /**
     * Flag indicates whether the view has been initialized
     */
    private _isViewInitialized: boolean = false;

    /**
     * Subscriptions to services.
     */
    private _baseServiceGetChildServiceSubscription: Subscription;
    private _baseServiceGetChildServiceStatsSubscription: Subscription;

    constructor(
        private _baseService: BaseService,
        private _notificationService: NotificationService) {}

    ngOnChanges(changes: {[propertyName: string]: SimpleChange}): void {
        var selectedChildServiceIdChanges = changes['selectedChildServiceId'];

        if (!selectedChildServiceIdChanges
            || _.isEqual(selectedChildServiceIdChanges.currentValue, selectedChildServiceIdChanges.previousValue)
            || _.isEmpty(selectedChildServiceIdChanges.currentValue)) {
            return;
        }

        this.selectedChildServiceId = selectedChildServiceIdChanges.currentValue;

        this._getData();
    }

    ngAfterViewChecked(): void {
        if (this._isViewInitialized) {
            return;
        }

        this._operationCountChartCanvas = document.getElementById('operationCountChart');
        this._operationDurationChartCanvas = document.getElementById('operationDurationChart');

        if (_.isNull(this._operationCountChartCanvas) || _.isNull(this._operationDurationChartCanvas)) {
            return;
        }

        this._isViewInitialized = true;
        this._renderChart();
    }

    ngOnDestroy(): void {
        if (!_.isUndefined(this._operationCountChart)) {
            this._operationCountChart.destroy();
        }

        if (!_.isUndefined(this._operationDurationChart)) {
            this._operationDurationChart.destroy();
        }

        if (!_.isUndefined(this._baseServiceGetChildServiceSubscription)) {
            this._baseServiceGetChildServiceSubscription.unsubscribe();
        }

        if (!_.isUndefined(this._baseServiceGetChildServiceStatsSubscription)) {
            this._baseServiceGetChildServiceStatsSubscription.unsubscribe();
        }
    }

    getSelectedChildService(): ServiceDocumentQueryResult {
        return this._selectedChildService;
    }

    getTimeline(): any[] {
        if (_.isUndefined(this._selectedChildServiceStats)) {
            return [];
        }

        var operationEntries: {[key: string]: ServiceStatsEntry} = this._selectedChildServiceStats.entries;
        var timeline: any[] = [];

        _.each(OPERATIONS, (operation: string) => {
            var property: string = `${operation}requestCount`;

            if (operationEntries.hasOwnProperty(property)) {
                timeline.push({
                    name: operation,
                    count: operationEntries[property].latestValue,
                    timestamp: operationEntries[property].lastUpdateMicrosUtc
                });
            }
        });

        return _.orderBy(timeline, ['timestamp'], ['desc']);
    }

    getTimeStamp(timeMicros: number): string {
        return StringUtil.getTimeStamp(timeMicros);
    }

    isNullOrUndefined(value: any) {
        return _.isNull(value) || _.isUndefined(value);
    }

    onEditChildServiceMethodChanged(event: MouseEvent, method: string) {
        this.editChildServiceModalContext.data['method'] = method;

        if (method === 'PATCH' && !_.isUndefined(this._selectedChildService)) {
            this.editChildServiceModalContext.data['body'] = this._getPatchMethodDefaultBody();
        } else {
            this.editChildServiceModalContext.data['body'] = '';
        }
    }

    onEditChildService(event: MouseEvent): void {
        var selectedServiceId: string = this.editChildServiceModalContext.data['documentSelfLink'];
        var method: string = this.editChildServiceModalContext.data['method'];
        var body: string = this.editChildServiceModalContext.data['body'];

        if (!selectedServiceId || !method || !body) {
            return;
        }

        if (method === 'PATCH') {
            this._baseService.patch(selectedServiceId, body).subscribe(
                (document: ServiceDocument) => {
                    this._notificationService.set([{
                        type: 'SUCCESS',
                        messages: [`Child Service ${document.documentSelfLink} Updated`]
                    }]);

                    // Reset body
                    this.editChildServiceModalContext.data['body'] = null;
                },
                (error) => {
                    // TODO: Better error handling
                    this._notificationService.set([{
                        type: 'ERROR',
                        messages: [`[${error.statusCode}] ${error.message}`]
                    }]);
                });
        } else if (method === 'PUT') {
            this._baseService.put(selectedServiceId, body).subscribe(
                (document: ServiceDocument) => {
                    this._notificationService.set([{
                        type: 'SUCCESS',
                        messages: [`Child Service ${document.documentSelfLink} Updated`]
                    }]);

                    // Reset body
                    this.editChildServiceModalContext.data['body'] = null;
                },
                (error) => {
                    // TODO: Better error handling
                    this._notificationService.set([{
                        type: 'ERROR',
                        messages: [`[${error.statusCode}] ${error.message}`]
                    }]);
                });
        } else {
            this._notificationService.set([{
                type: 'ERROR',
                messages: [`Unknown method ${method} used to modify the child service`]
            }]);
        }
    }

    onDeleteChildService(event: MouseEvent): void {
        var selectedServiceId: string = this.deleteChildServiceModalContext.data['documentSelfLink'];

        if (!selectedServiceId) {
            return;
        }

        this._baseService.delete(selectedServiceId).subscribe(
            (document: ServiceDocument) => {
                this._notificationService.set([{
                    type: 'SUCCESS',
                    messages: [`Child Service ${document.documentSelfLink} Deleted`]
                }]);
            },
            (error) => {
                // TODO: Better error handling
                this._notificationService.set([{
                    type: 'ERROR',
                    messages: [`[${error.statusCode}] ${error.message}`]
                }]);
            });
    }

    private _getData(): void {
        let link: string = this.selectedServiceId + '/' + this.selectedChildServiceId;

        this._baseServiceGetChildServiceSubscription =
            this._baseService.getDocument(link).subscribe(
                (childService: ServiceDocumentQueryResult) => {
                    this._selectedChildService = childService;

                    // Set modal context
                    this.editChildServiceModalContext.name = link;
                    this.editChildServiceModalContext.data['documentSelfLink'] = link;
                    this.editChildServiceModalContext.data['method'] = 'PATCH';
                    this.editChildServiceModalContext.data['body'] = this._getPatchMethodDefaultBody();

                    this.deleteChildServiceModalContext.name = link;
                    this.deleteChildServiceModalContext.data['documentSelfLink'] = link;
                },
                (error) => {
                    // TODO: Better error handling
                    this._notificationService.set([{
                        type: 'ERROR',
                        messages: [`Failed to retrieve factory child service details: [${error.statusCode}] ${error.message}`]
                    }]);
                });

        this._baseServiceGetChildServiceStatsSubscription =
            this._baseService.getDocumentStats(link).subscribe(
                (childServiceStats: ServiceStats) => {
                    this._selectedChildServiceStats = childServiceStats;

                    this._renderChart();
                },
                (error) => {
                    // TODO: Better error handling
                    this._notificationService.set([{
                        type: 'ERROR',
                        messages: [`Failed to retrieve factory child service details: [${error.statusCode}] ${error.message}`]
                    }]);
                });
    }

    private _renderChart(): void {
        if (_.isUndefined(this._selectedChildServiceStats)
            || _.isNull(this._operationCountChartCanvas)
            || _.isNull(this._operationDurationChartCanvas)) {
            return;
        }

        if (!_.isUndefined(this._operationCountChart)) {
            this._operationCountChart.destroy();
        }

        if (!_.isUndefined(this._operationDurationChart)) {
            this._operationDurationChart.destroy();
        }

        var operationEntries: {[key: string]: ServiceStatsEntry} = this._selectedChildServiceStats.entries;

        var operationsCounts: number[] = _.map(OPERATIONS, (operation: string) => {
            var property: string = `${operation}requestCount`;
            return operationEntries.hasOwnProperty(property) ? operationEntries[property].latestValue : 0;
        });
        var operationDurations: number[] = _.map(OPERATIONS, (operation: string) => {
            var property: string = `${operation}operationDuration`;
            return operationEntries.hasOwnProperty(property) ? operationEntries[property].latestValue : 0;
        });

        // Render operation count chart
        this._operationCountChart = new Chart(this._operationCountChartCanvas, {
            type: 'radar',
            data: {
                labels: OPERATIONS,
                datasets: [{
                    data: operationsCounts,
                    backgroundColor: 'rgba(38, 198, 218, .25)',
                    pointRadius: 3,
                    borderColor: 'rgba(38, 198, 218, 1)',
                    pointBackgroundColor: 'rgba(38, 198, 218, 1)',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(38, 198, 218, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scale: {
                    ticks: {
                        maxTicksLimit: 4
                    }
                },
                tooltips: {
                    callbacks: {
                        label: (tooltip: any, data: any) => {
                            var dataIndex: number = tooltip.index;
                            var datasetIndex: number = tooltip.datasetIndex;
                            var formattedValue: string =
                                StringUtil.formatNumber(data.datasets[datasetIndex].data[dataIndex]);

                            return `${formattedValue} requests`;
                        }
                    }
                }
            }
        });

        this._operationDurationChart = new Chart(this._operationDurationChartCanvas, {
            type: 'bar',
            data: {
                labels: OPERATIONS,
                datasets: [{
                    data: operationDurations,
                    backgroundColor: 'rgba(255, 202, 40, .25)',
                    borderColor: 'rgba(255, 202, 40, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    xAxes: [{
                        gridLines: {
                            display: false
                        }
                    }],
                    yAxes: [{
                        display: false
                    }]
                },
                tooltips: {
                    callbacks: {
                        label: (tooltip: any, data: any) => {
                            var dataIndex: number = tooltip.index;
                            var datasetIndex: number = tooltip.datasetIndex;
                            var formattedValue: string =
                                StringUtil.formatDurationToMilliseconds(data.datasets[datasetIndex].data[dataIndex]);

                            return `${formattedValue} ms`;
                        }
                    }
                }
            }
        });
    }

    private _getPatchMethodDefaultBody(): string {
        if (_.isUndefined(this._selectedChildService)) {
            return '';
        }

        return JSON.stringify(_.omitBy(this._selectedChildService, (value: any, key: string) => {
            return key.search(/^document[^s]?[A-Z][\w]*/) !== -1;
        }), null, 4);
    }
}
