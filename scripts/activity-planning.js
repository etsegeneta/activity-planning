
/* global dhis2, angular, selection, i18n_ajax_login_failed, _, Promise, await */

dhis2.util.namespace('dhis2.acp');
dhis2.util.namespace('dhis2.rd');

// whether current user has any organisation units
dhis2.acp.emptyOrganisationUnits = false;

dhis2.acp.apiUrl = '../api';

var i18n_no_orgunits = 'No organisation unit attached to current user, no data entry possible';
var i18n_offline_notification = 'You are offline';
var i18n_online_notification = 'You are online';
var i18n_ajax_login_failed = 'Login failed, check your username and password and try again';

var optionSetsInPromise = [];
var attributesInPromise = [];
dhis2.acp.batchSize = 50;

dhis2.acp.store = null;
dhis2.rd.metaDataCached = dhis2.rd.metaDataCached || false;
dhis2.acp.memoryOnly = $('html').hasClass('ie7') || $('html').hasClass('ie8');
var adapters = [];
if( dhis2.acp.memoryOnly ) {
    adapters = [ dhis2.storage.InMemoryAdapter ];
} else {
    adapters = [ dhis2.storage.IndexedDBAdapter, dhis2.storage.DomLocalStorageAdapter, dhis2.storage.InMemoryAdapter ];
}

dhis2.acp.store = new dhis2.storage.Store({
    name: 'dhis2acp',
    adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
    objectStores: ['optionSets', 'categoryCombos', 'programs', 'dataElements']
});

(function($) {
    $.safeEach = function(arr, fn)
    {
        if (arr)
        {
            $.each(arr, fn);
        }
    };
})(jQuery);

/**
 * Page init. The order of events is:
 *
 * 1. Load ouwt
 * 2. Load meta-data (and notify ouwt)
 *
 */
$(document).ready(function()
{
    $.ajaxSetup({
        type: 'POST',
        cache: false
    });

    $('#loaderSpan').show();
});

$(document).bind('dhis2.online', function(event, loggedIn)
{
    if (loggedIn)
    {
        if (dhis2.acp.emptyOrganisationUnits) {
            setHeaderMessage(i18n_no_orgunits);
        }
        else {
            setHeaderDelayMessage(i18n_online_notification);
        }
    }
    else
    {
        var form = [
            '<form style="display:inline;">',
            '<label for="username">Username</label>',
            '<input name="username" id="username" type="text" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
            '<label for="password">Password</label>',
            '<input name="password" id="password" type="password" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
            '<button id="login_button" type="button">Login</button>',
            '</form>'
        ].join('');

        setHeaderMessage(form);
        ajax_login();
    }
});

$(document).bind('dhis2.offline', function()
{
    if (dhis2.acp.emptyOrganisationUnits) {
        setHeaderMessage(i18n_no_orgunits);
    }
    else {
        setHeaderMessage(i18n_offline_notification);
    }
});

function ajax_login()
{
    $('#login_button').bind('click', function()
    {
        var username = $('#username').val();
        var password = $('#password').val();

        $.post('../dhis-web-commons-security/login.action', {
            'j_username': username,
            'j_password': password
        }).success(function()
        {
            var ret = dhis2.availability.syncCheckAvailability();

            if (!ret)
            {
                alert(i18n_ajax_login_failed);
            }
        });
    });
}

// -----------------------------------------------------------------------------
// Metadata downloading
// -----------------------------------------------------------------------------

function downloadMetaData()
{
    console.log('Loading required meta-data');
    var def = $.Deferred();
    var promise = def.promise();

    promise = promise.then( dhis2.acp.store.open );
    promise = promise.then( getSystemSetting );

    //fetch category combos
    promise = promise.then( getMetaCategoryCombos );
    promise = promise.then( filterMissingCategoryCombos );
    promise = promise.then( getCategoryCombos );

    //fetch data sets
    promise = promise.then( getMetaPrograms );
    promise = promise.then( filterMissingPrograms );
    promise = promise.then( getPrograms );

    //fetch option sets
    promise = promise.then( getMetaOptionSets );
    promise = promise.then( filterMissingOptionSets );
    promise = promise.then( getOptionSets );

    //fetch data elements
    promise = promise.then( getMetaDataElements );
    promise = promise.then( filterMissingDataElements );
    promise = promise.then( getDataElements );

    promise.done(function() {
        //Enable ou selection after meta-data has downloaded
        $( "#orgUnitTree" ).removeClass( "disable-clicks" );
        dhis2.acp.metaDataCached = true;
        dhis2.availability.startAvailabilityCheck();
        console.log( 'Finished loading meta-data' );
        selection.responseReceived();
    });

    def.resolve();
}

function getUserAccessibleDataSets(){
    return dhis2.metadata.getMetaObject(null, 'ACCESSIBLE_DATASETS', dhis2.acp.apiUrl + '/dataSets.json', 'fields=id,access[data[write]]&paging=false', 'sessionStorage', dhis2.acp.store);
}

function getOrgUnitLevels()
{
    dhis2.acp.store.getKeys( 'ouLevels').done(function(res){
        if(res.length > 0){
            return;
        }
        return dhis2.metadata.getMetaObjects('ouLevels', 'organisationUnitLevels', dhis2.acp.apiUrl + '/organisationUnitLevels.json', 'fields=id,displayName,level&paging=false', 'idb', dhis2.acp.store);
    });
}

function getSystemSetting(){
    return dhis2.metadata.getMetaObject(null, 'SYSTEM_SETTING', dhis2.acp.apiUrl + '/systemSettings?key=keyUiLocale&key=keyCalendar&key=keyDateFormat&key=multiOrganisationUnitForms', '', 'sessionStorage', dhis2.acp.store);
}

function getMetaCategoryCombos(){
    return dhis2.metadata.getMetaObjectIds('categoryCombos', dhis2.acp.apiUrl + '/categoryCombos.json', 'paging=false&fields=id,version');
}

function filterMissingCategoryCombos( objs ){
    return dhis2.metadata.filterMissingObjIds('categoryCombos', dhis2.acp.store, objs);
}

function getCategoryCombos( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.acp.batchSize, 'categoryCombos', 'categoryCombos', dhis2.acp.apiUrl + '/categoryCombos.json', 'paging=false&fields=id,displayName,code,skipTotal,isDefault,categoryOptionCombos[id,displayName,categoryOptions[displayName,id]],categories[id,displayName,code,dimension,dataDimensionType,attributeValues[value,attribute[id,name,valueType,code]],categoryOptions[id,displayName,code,attributeValues[value,attribute[id,code,valueType]]]]', 'idb', dhis2.acp.store);
}

function getLinkedMetaDataElements( dataElements ){
    return dhis2.metadata.getMetaObjectIds('dataElements', dhis2.acp.apiUrl + '/dataElements.json', 'paging=false&fields=id,version');
}

function getMetaDataElementsByType( type ){
    return dhis2.metadata.getMetaObjectIds('dataElements', dhis2.acp.apiUrl + '/dataElements.json', 'paging=false&fields=id,version&filter=attributeValues.value:eq:' + type );
}

function getMetaDataElements(){
    return dhis2.metadata.getMetaObjectIds('dataElements', dhis2.acp.apiUrl + '/dataElements.json', 'paging=false&fields=id,version');
}

function filterMissingDataElements( objs ){
    return dhis2.metadata.filterMissingObjIds('dataElements', dhis2.acp.store, objs);
}

function getDataElements( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.acp.batchSize, 'dataElements', 'dataElements', dhis2.acp.apiUrl + '/dataElements.json', 'paging=false&fields=id,code,displayName,shortName,description,formName,valueType,optionSetValue,optionSet[id],legendSets[id],attributeValues[value,attribute[id,name,valueType,code]],categoryCombo[id]', 'idb', dhis2.acp.store);
}

function getMetaOptionSets(){
    return dhis2.metadata.getMetaObjectIds('optionSets', dhis2.acp.apiUrl + '/optionSets.json', 'paging=false&fields=id,version');
}

function filterMissingOptionSets( objs ){
    return dhis2.metadata.filterMissingObjIds('optionSets', dhis2.acp.store, objs);
}

function getOptionSets( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.acp.batchSize, 'optionSets', 'optionSets', dhis2.acp.apiUrl + '/optionSets.json', 'paging=false&fields=id,displayName,code,version,valueType,attributeValues[value,attribute[id,name,valueType,code]],options[id,displayName,code,attributeValues[value,attribute[id,name,valueType,code]]]', 'idb', dhis2.acp.store);
}

function getMetaAttributes(){
    return dhis2.metadata.getMetaObjectIds('attributes', dhis2.acp.apiUrl + '/attributes.json', 'paging=false&fields=id,version');
}

function filterMissingAttributes( objs ){
    return dhis2.metadata.filterMissingObjIds('attributes', dhis2.acp.store, objs);
}

function getAttributes( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.acp.batchSize, 'attributes', 'attributes', dhis2.acp.apiUrl + '/attributes.json', 'paging=false&fields=:all,!access,!lastUpdatedBy,!lastUpdated,!created,!href,!user,!translations,!favorites,optionSet[id,displayName,code,options[id,displayName,code,sortOrder]]', 'idb', dhis2.acp.store);
}

function getMetaPrograms(){
    return dhis2.metadata.getMetaObjectIds('programs', dhis2.acp.apiUrl + '/programs.json', 'paging=false&fields=id,version');
}

function filterMissingPrograms( objs ){
    return dhis2.metadata.filterMissingObjIds('programs', dhis2.acp.store, objs);
}

function getPrograms( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.acp.batchSize, 'programs', 'programs', dhis2.acp.apiUrl + '/programs.json', 'paging=false&fields=*,programSections[sortOrder,displayName],categoryCombo[id],attributeValues[value,attribute[id,name,valueType,code]],organisationUnits[id,level],programStages[*,programStageDataElements[id,sortOrder,displayInReports,dataElement[id]]]', 'idb', dhis2.acp.store, dhis2.metadata.processObject);
}