/* global angular, moment, dhis2, parseFloat, indexedDB */

'use strict';

/* Services */

var actplanServices = angular.module('actplanServices', ['ngResource'])

.factory('DDStorageService', function(){
    var store = new dhis2.storage.Store({
        name: "dhis2acp",
        adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
        objectStores: ['optionSets', 'categoryCombos', 'programs', 'dataElements']
    });
    return{
        currentStore: store
    };
})

.service('PeriodService', function(CalendarService, DateUtils, orderByFilter){

    this.getPeriods = function(periodType, periodOffset, futurePeriods){
        if(!periodType){
            return [];
        }

        var calendarSetting = CalendarService.getSetting();

        dhis2.period.format = calendarSetting.keyDateFormat;

        dhis2.period.calendar = $.calendars.instance( calendarSetting.keyCalendar );

        dhis2.period.generator = new dhis2.period.PeriodGenerator( dhis2.period.calendar, dhis2.period.format );

        dhis2.period.picker = new dhis2.period.DatePicker( dhis2.period.calendar, dhis2.period.format );

        var d2Periods = dhis2.period.generator.generateReversedPeriods( periodType, periodOffset );

        d2Periods = dhis2.period.generator.filterOpenPeriods( periodType, d2Periods, futurePeriods, null, null );

        angular.forEach(d2Periods, function(p){
            p.startDate = p._startDate._year + '-' + p._startDate._month + '-' + p._startDate._day;
            p.endDate = p._endDate._year + '-' + p._endDate._month + '-' + p._endDate._day;
            p.displayName = p.name;
            p.id = p.iso;
        });

        return d2Periods;
    };

    this.getPreviousPeriod = function( periodId, allPeriods ){
        var index = -1, previousPeriod = null;
        if ( periodId && allPeriods && allPeriods.length > 0 ){
            allPeriods = orderByFilter( allPeriods, '-id').reverse();
            for( var i=0; i<allPeriods.length; i++){
                if( allPeriods[i].id === periodId ){
                    index = i;
                }
            }
            if( index > 0 ){
                previousPeriod = allPeriods[index - 1];
            }
        }
        return {location: index, period: previousPeriod};
    };

    this.getForDates = function(periodType, startDate, endDate){
        if(!periodType){
            return [];
        }

        var calendarSetting = CalendarService.getSetting();

        dhis2.period.format = calendarSetting.keyDateFormat;

        dhis2.period.calendar = $.calendars.instance( calendarSetting.keyCalendar );

        dhis2.period.generator = new dhis2.period.PeriodGenerator( dhis2.period.calendar, dhis2.period.format );

        dhis2.period.picker = new dhis2.period.DatePicker( dhis2.period.calendar, dhis2.period.format );

        var d2Periods = dhis2.period.generator.generateReversedPeriods( periodType, -5 );

        d2Periods = dhis2.period.generator.filterOpenPeriods( periodType, d2Periods, 5, null, null );

        angular.forEach(d2Periods, function(p){
            p.displayName = p.name;
            p.id = p.iso;
        });

        return d2Periods;
    };
})

/* Factory to fetch optionSets */
.factory('OptionSetService', function($q, $rootScope, DDStorageService) {
    return {
        getAll: function(){

            var def = $q.defer();

            DDStorageService.currentStore.open().done(function(){
                DDStorageService.currentStore.getAll('optionSets').done(function(optionSets){
                    $rootScope.$apply(function(){
                        def.resolve(optionSets);
                    });
                });
            });

            return def.promise;
        },
        get: function(uid){
            var def = $q.defer();

            DDStorageService.currentStore.open().done(function(){
                DDStorageService.currentStore.get('optionSets', uid).done(function(optionSet){
                    $rootScope.$apply(function(){
                        def.resolve(optionSet);
                    });
                });
            });
            return def.promise;
        },
        getCode: function(options, key){
            if(options){
                for(var i=0; i<options.length; i++){
                    if( key === options[i].displayName){
                        return options[i].code;
                    }
                }
            }
            return key;
        },
        getName: function(options, key){
            if(options){
                for(var i=0; i<options.length; i++){
                    if( key === options[i].code){
                        return options[i].displayName;
                    }
                }
            }
            return key;
        }
    };
})

/* Service to fetch option combos */
.factory('OptionComboService', function($q, $rootScope, DDStorageService) {
    return {
        getAll: function(){
            var def = $q.defer();
            var optionCombos = [];
            DDStorageService.currentStore.open().done(function(){
                DDStorageService.currentStore.getAll('categoryCombos').done(function(categoryCombos){
                    angular.forEach(categoryCombos, function(cc){
                        optionCombos = optionCombos.concat( cc.categoryOptionCombos );
                    });
                    $rootScope.$apply(function(){
                        def.resolve(optionCombos);
                    });
                });
            });

            return def.promise;
        },
        getMappedOptionCombos: function(){
            var def = $q.defer();
            var optionCombos = [];
            DDStorageService.currentStore.open().done(function(){
                DDStorageService.currentStore.getAll('categoryCombos').done(function(categoryCombos){
                    angular.forEach(categoryCombos, function(cc){
                        angular.forEach(cc.categoryOptionCombos, function(oco){
                            oco.categories = [];
                            angular.forEach(cc.categories, function(c){
                                oco.categories.push({id: c.id, displayName: c.displayName});
                            });
                            optionCombos[oco.id] = oco;
                        });
                    });
                    $rootScope.$apply(function(){
                        def.resolve(optionCombos);
                    });
                });
            });
            return def.promise;
        }
    };
})

/* factory to fetch and process programValidations */
.factory('MetaDataFactory', function($q, $rootScope, DDStorageService, orderByFilter) {

    return {
        get: function(store, uid){
            var def = $q.defer();
            DDStorageService.currentStore.open().done(function(){
                DDStorageService.currentStore.get(store, uid).done(function(obj){
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });
            return def.promise;
        },
        set: function(store, obj){
            var def = $q.defer();
            DDStorageService.currentStore.open().done(function(){
                DDStorageService.currentStore.set(store, obj).done(function(obj){
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });
            return def.promise;
        },
        getAll: function(store){
            var def = $q.defer();
            DDStorageService.currentStore.open().done(function(){
                DDStorageService.currentStore.getAll(store).done(function(objs){
                    objs = orderByFilter(objs, ['-code', '-displayName']).reverse();
                    $rootScope.$apply(function(){
                        def.resolve(objs);
                    });
                });
            });
            return def.promise;
        },
        getAllByProperty: function(store, prop, val){
            var def = $q.defer();
            DDStorageService.currentStore.open().done(function(){
                DDStorageService.currentStore.getAll(store).done(function(objs){
                    var selectedObjects = [];
                    for(var i=0; i<objs.length; i++){
                        if(objs[i][prop] ){
                            objs[i][prop] = objs[i][prop].toLocaleLowerCase();
                            if( objs[i][prop] === val )
                            {
                                selectedObjects.push( objs[i] );
                            }
                        }
                    }

                    $rootScope.$apply(function(){
                        selectedObjects = orderByFilter(selectedObjects, ['-code', '-displayName']).reverse();
                        def.resolve(selectedObjects);
                    });
                });
            });
            return def.promise;
        },
        getByProperty: function(store, prop, val){
            var def = $q.defer();
            DDStorageService.currentStore.open().done(function(){
                DDStorageService.currentStore.getAll(store).done(function(objs){
                    var selectedObject = null;
                    for(var i=0; i<objs.length; i++){
                        if(objs[i][prop] ){
                            objs[i][prop] = objs[i][prop].toLocaleLowerCase();
                            if( objs[i][prop] === val )
                            {
                                selectedObject = objs[i];
                                break;
                            }
                        }
                    }

                    $rootScope.$apply(function(){
                        def.resolve(selectedObject);
                    });
                });
            });
            return def.promise;
        }
    };
})

.service('EventService', function($http, $q, DHIS2URL, CommonUtils, DateUtils, OptionSetService) {

    var getByOrgUnitAndProgram = function(orgUnit, ouMode, program, optionSets, dataElementsById, pager, sortHeader, filterText){
        var promise;
        if( program.id && orgUnit ){
            var order = 'lastUpdated:desc';
            if ( sortHeader && sortHeader.id ){
                order = sortHeader.id + ':' + sortHeader.direction;
            }
            if ( filterText ){
                order += filterText;
            }

            var url = DHIS2URL + '/events.json?' + 'orgUnit=' + orgUnit + '&ouMode='+ ouMode + '&program=' + program.id + '&order=' + order;

            if(pager){
                var pgSize = pager.pageSize ? pager.pageSize : 50;
                var pg = pager.page ? pager.page : 1;
                pgSize = pgSize > 1 ? pgSize  : 1;
                pg = pg > 1 ? pg : 1;
                url += '&pageSize=' + pgSize + '&page=' + pg + '&totalPages=true';
            }
            else{
                url += '&pageSize=50&page=1&totalPages=true';
            }

            promise = $http.get( url ).then(function(response){
                var _evs = response.data && response.data.events ? response.data.events : [];
                var events = [];
                if( response && response.data && response.data.events ){
                    angular.forEach(_evs, function(ev){
                        var event = {
                            date: DateUtils.formatFromApiToUser(ev.eventDate),
                            uploadedBy: ev.storedBy,
                            event: ev.event,
                            program: program.displayName,
                            orgUnit: ev.orgUnit,
                            orgUnitName: ev.orgUnitName
                        };

                        if( ev.dataValues ){
                            angular.forEach(ev.dataValues, function(dv){
                                var val = dv.value;
                                var de = dataElementsById[dv.dataElement];

                                if( de && de.optionSetValue ){
                                    val = OptionSetService.getName(optionSets[de.optionSet.id].options, String(val));
                                }

                                event[dv.dataElement] = val;
                            });
                        }
                        events.push( event );
                    });
                }
                return {events: events, pager: response.data.pager};

            }, function(response){
                CommonUtils.errorNotifier(response);
                return null;
            });
        }
        return promise;
    };

    var get = function(eventUid){
        var promise = $http.get(DHIS2URL + '/events/' + eventUid + '.json').then(function(response){
            return response.data;
        });
        return promise;
    };

    var create = function(dhis2Event){
        var promise = $http.post(DHIS2URL + '/events.json', dhis2Event).then(function(response){
            return response.data;
        });
        return promise;
    };

    var deleteEvent = function(dhis2Event){
        var promise = $http.delete(DHIS2URL + '/events/' + dhis2Event.event).then(function(response){
            return response.data;
        });
        return promise;
    };

    var update = function(dhis2Event){
        var promise = $http.put(DHIS2URL + '/events/' + dhis2Event.event, dhis2Event).then(function(response){
            return response.data;
        });
        return promise;
    };

    return {
        get: get,
        create: create,
        deleteEvent: deleteEvent,
        update: update,
        getByOrgUnitAndProgram: getByOrgUnitAndProgram
    };
});