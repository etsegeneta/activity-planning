/* global angular, dhis2, docLibrary */

'use strict';

//Controller for settings page
actplan.controller('HomeController',
        function($scope,
                $translate,
                $filter,                
                $modal,
                Paginator,
                DateUtils,
                PeriodService,
                NotificationService,
                EventService,
                MetaDataFactory,
                SessionStorageService,
                orderByFilter) {

    $scope.model = {
        optionSets: null,
        programs: [],
        categoryCombos: [],
        dataElementsById: [],
        dynamicHeaders: [],
        events: [],
        selectedPeriod: null,
        periods: [],
        periodType: 'Yearly',
        periodOffset: 0,
        openFuturePeriods: 1,
        sortHeader: null
    };

    var applyPeriodFitlerParam = function(){
        $scope.filterParam = '&startDate=' + $scope.model.selectedPeriod.startDate;
        $scope.filterParam += '&endDate=' + $scope.model.selectedPeriod.endDate;
    };
    
    //watch for selection of program
    $scope.$watch('model.selectedPeriod', function() {
        if( angular.isObject($scope.model.selectedPeriod) && $scope.model.selectedPeriod.id){
            applyPeriodFitlerParam();
            $scope.fetchEvents();
        }
    });
    
    //watch for selection of org unit from tree
    $scope.$watch('selectedOrgUnit', function() {
        $scope.resetView();
        if( angular.isObject($scope.selectedOrgUnit)){
            SessionStorageService.set('SELECTED_OU', $scope.selectedOrgUnit);

            if(!$scope.model.optionSets){
                $scope.model.optionSets = [];
                MetaDataFactory.getAll('optionSets').then(function(opts){
                    angular.forEach(opts, function(op){
                        $scope.model.optionSets[op.id] = op;
                    });

                    MetaDataFactory.getAll('categoryCombos').then(function(ccs){
                        angular.forEach(ccs, function(cc){
                            $scope.model.categoryCombos[cc.id] = cc;
                        });

                        MetaDataFactory.getAll('programs').then(function(prs){
                            $scope.model.programs = prs;

                            MetaDataFactory.getAll('dataElements').then(function(des){
                                angular.forEach(des, function(de){
                                    $scope.model.dataElementsById[de.id] = de;
                                });
                                
                                $scope.model.periods = PeriodService.getPeriods( $scope.model.periodType, $scope.model.periodOffset,  $scope.model.openFuturePeriods );
                                var periods = PeriodService.getPeriods($scope.model.periodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
                                $scope.model.periods = periods;
                                if ( $scope.model.periods.length > 0 ){
                                    $scope.model.selectedPeriod = $scope.model.periods[0];
                                }
                            });
                        });
                    });
                });
            }
            else{
                $scope.loadPrograms($scope.selectedOrgUnit);
            }
        }
    });

    $scope.getPeriods = function(mode){
        $scope.model.selectedPeriod = null;
        $scope.model.periodOffset = mode === 'NXT' ? ++$scope.model.periodOffset : --$scope.model.periodOffset;
        $scope.model.periods = PeriodService.getPeriods( $scope.model.periodType, $scope.model.periodOffset,  $scope.model.openFuturePeriods );
    };
    
    //load programs associated with the selected org unit.
    $scope.loadPrograms = function(orgUnit) {
        $scope.selectedOrgUnit = orgUnit;
        $scope.model.programs = [];
        if (angular.isObject($scope.selectedOrgUnit)) {
            MetaDataFactory.getAll('programs').then(function(prs){
                $scope.model.programs = prs;
            });
        }
    };

    //watch for selection of program
    $scope.$watch('model.selectedProgram', function() {
        $scope.model.selectedProgramStage = null;
        if( angular.isObject($scope.model.selectedProgram) && $scope.model.selectedProgram.id){
            $scope.loadProgramDetails();
        }
    });

    $scope.loadProgramDetails = function (){
        $scope.model.selectedProgramStage = null;
        $scope.filterText = {};
        $scope.filterParam = '';

        if( $scope.model.selectedProgram && $scope.model.selectedProgram.id && $scope.model.selectedProgram.programStages.length > 0)
        {
            if ( $scope.model.selectedProgram.programStages.length > 1 )
            {
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_document_folder"));
                return;
            }

            $scope.model.selectedProgramStage = $scope.model.selectedProgram.programStages[0];

            var prDes = $scope.model.selectedProgramStage.programStageDataElements;

            prDes = orderByFilter(prDes, '-sortOrder').reverse();
            $scope.model.dynamicHeaders = [];
            angular.forEach(prDes, function(prDe){                
                var de = $scope.model.dataElementsById[prDe.dataElement.id];
                if( de ){
                    de.show = prDe.displayInReports;
                    de.sortOrder = prDe.sortOrder;
                    de.showFilter = false;
                    de.filterWithRange = de.valueType === 'DATE' ||
                        de.valueType === 'NUMBER' ||
                        de.valueType === 'INTEGER' ||
                        de.valueType === 'INTEGER_POSITIVE' ||
                        de.valueType === 'INTEGER_NEGATIVE' ||
                        de.valueType === 'INTEGER_ZERO_OR_POSITIVE' ? true : false,
                    $scope.model.dynamicHeaders.push(de);
                }
            });

            $scope.fetchEvents();
        }
    };

    $scope.sortItems = function(gridHeader){        
        if ($scope.model.sortHeader && $scope.model.sortHeader.id === gridHeader.id){
            $scope.reverse = !$scope.reverse;            
        }        
        $scope.model.sortHeader = {id: gridHeader.id, direction: $scope.reverse ? 'desc' : 'asc'};        
        $scope.fetchEvents();
    };
    
    $scope.filterItems = function( gridColumn, applyFilter ){        
        $scope.filterParam = '';
        //var applyFilter = false;
        angular.forEach($scope.model.dynamicHeaders, function(col){            
            if( gridColumn ){
                if( col.id === gridColumn.id ){
                    col.showFilter = !col.showFilter;
                }
            }            
            
            if( applyFilter && $scope.filterText[col.id] ){
                if( col.group === "FIXED" ){
                    switch ( col.id ){
                        case "eventDate":
                            if( $scope.filterText[col.id].start || $scope.filterText[col.id].end ){                            
                                if( $scope.filterText[col.id].start ){
                                    $scope.filterParam += '&startDate=' + DateUtils.formatFromUserToApi($scope.filterText[col.id].start);
                                }                    
                                if( $scope.filterText[col.id].end ){
                                    $scope.filterParam += '&endDate=' + DateUtils.formatFromUserToApi($scope.filterText[col.id].end);
                                }
                            }
                            break;
                        case "lastUpdated":
                            if( $scope.filterText[col.id].start || $scope.filterText[col.id].end ){                            
                                if( $scope.filterText[col.id].start ){
                                    $scope.filterParam += '&lastUpdatedStartDate=' + DateUtils.formatFromUserToApi($scope.filterText[col.id].start);
                                }                    
                                if( $scope.filterText[col.id].end ){
                                    $scope.filterParam += '&lastUpdatedEndDate=' + DateUtils.formatFromUserToApi($scope.filterText[col.id].end);
                                }
                            }
                            break;
                        case "status":
                            $scope.filterParam += '&status=' + $scope.filterText[col.id];
                            break;
                    }                
                }
                else{                    
                    if( col.optionSetValue ){                        
                        if( $scope.filterText[col.id].length > 0  ){
                            var filters = $scope.filterText[col.id].map(function(filt) {return filt.code;});
                            if( filters.length > 0 ){
                                $scope.filterParam += '&filter=' + col.id + ':IN:' + filters.join(';');
                            }
                        }
                    }
                    else{
                        if( col.filterWithRange ){
                            if($scope.filterText[col.id].start && $scope.filterText[col.id].start !== "" || $scope.filterText[col.id].end && $scope.filterText[col.id].end !== ""){
                                $scope.filterParam += '&filter=' + col.id;
                                if( $scope.filterText[col.id].start ){
                                    $scope.filterParam += ':GT:' + $scope.filterText[col.id].start;
                                }                    
                                if( $scope.filterText[col.id].end ){
                                    $scope.filterParam += ':LT:' + $scope.filterText[col.id].end;
                                }
                            }
                        }
                        else{
                            $scope.filterParam += '&filter=' + col.id + ':like:' + $scope.filterText[col.id];
                        }
                    }
                }
            }
        });

        if( applyFilter ){
            $scope.pager.page = 1;
            $scope.fetchEvents();
        }
    };
    

    //function(orgUnit, ouMode, program, optionSets, dataElementsById, pager, sortHeader, filterText){
    $scope.fetchEvents = function(){
        
        if( $scope.selectedOrgUnit && $scope.selectedOrgUnit.id && $scope.model.selectedProgram && $scope.model.selectedProgram.id ){

            $scope.model.reportStarted = true;
            $scope.model.reportReady = false;

            EventService.getByOrgUnitAndProgram($scope.selectedOrgUnit.id,
                                                    'DESCENDANTS',
                                                    $scope.model.selectedProgram,
                                                    $scope.model.optionSets,
                                                    $scope.model.dataElementsById,
                                                    $scope.pager,
                                                    $scope.model.sortHeader,
                                                    $scope.filterParam).then(function(response){
                if( response.pager ){
                    response.pager.pageSize = response.pager.pageSize ? response.pager.pageSize : $scope.pager.pageSize;
                    $scope.pager = response.pager;
                    $scope.pager.toolBarDisplay = 5;

                    Paginator.setPage($scope.pager.page);
                    Paginator.setPageCount($scope.pager.pageCount);
                    Paginator.setPageSize($scope.pager.pageSize);
                    Paginator.setItemCount($scope.pager.total);
                }

                $scope.model.events = response.events || [];
                $scope.model.reportStarted = false;
                $scope.model.reportReady = true;
            });
        }
    };

    $scope.showHideColumns = function(){
        var modalInstance = $modal.open({
            templateUrl: 'views/column-modal.html',
            controller: 'ColumnDisplayController',
            resolve: {
                gridColumns: function () {
                    return $scope.model.dynamicHeaders;
                },
                hiddenGridColumns: function(){
                    return ($filter('filter')($scope.model.dynamicHeaders, {show: false})).length;
                }
            }
        });

        modalInstance.result.then(function (gridColumns) {
            $scope.model.dynamicHeaders = gridColumns;
        });
    };

    $scope.resetView = function(){
        $scope.model.selectedProgram = null;
    };

    $scope.jumpToPage = function(){
        if($scope.pager && $scope.pager.page && $scope.pager.pageCount && $scope.pager.page > $scope.pager.pageCount){
            $scope.pager.page = $scope.pager.pageCount;
        }
        $scope.fetchRecommendations();
    };

    $scope.resetPageSize = function(){
        $scope.pager.page = 1;
        $scope.fetchEvents();
    };

    $scope.getPage = function(page){
        $scope.pager.page = page;
        $scope.fetchEvents();
    };

    $scope.exportData = function ( name ) {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });

        var reportName = "activities.xls";
        if( name ){
            reportName = name + '.xls';
        }
        saveAs(blob, reportName);
    };

    $scope.resetView = function(){
        $scope.model.selectedProgram = null;
        $scope.model.selectedProgramStage = null;
        $scope.model.dynamicHeaders = [];
        $scope.model.events = [];
    };
});
