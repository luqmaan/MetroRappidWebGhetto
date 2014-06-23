define(['libs/jquery', 'libs/knockout', 'libs/leaflet-src', 'libs/when/when', 'LocateControl', 'models/Vehicles', 'models/Shape', 'models/Stops'],
function($, ko, L, when, LocateControl, Vehicles, Shape, Stops) {
    function Rappid() {
        // leaflet
        this.map = null;
        this.routeLayer = null;

        this.availableRoutes = ko.observableArray([
            {id: 801, direction: 1, name: '801 MetroRapid North'},
            {id: 801, direction: 0, name: '801 MetroRapid South'},
            {id: 550, direction: 1, name: '550 MetroRail North'},
            {id: 550, direction: 0, name: '550 MetroRail South'},
        ]);
        this.activity = ko.observable();

        // data
        this.vehicles = null;
        this.shape = null;
        this.stops = null;

        // viewmodels
        this.route = ko.observable();
        this.stopsList = ko.observableArray();
    }

    Rappid.prototype = {
        start: function() {
            this.setupMap();

            this.route.subscribe(this.initRoute.bind(this));
            this.route(this.availableRoutes()[0]);
        },
        refresh: function() {
            this.activity('refreshing...');
            console.log('refreshing...');

            this.vehicles.update().then(function() {
                this.activity('');
                setTimeout(this.refresh, 15 * 1000);
            }.bind(this));
        },
        setupMap: function() {
            var tileLayer,
                zoomCtrl,
                locateCtrl;

            this.map = L.map('map', {zoomControl: false,});
            this.map.setView([30.267153, -97.743061], 12);

            tileLayer = L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
                    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
                    'Imagery © <a href="http://mapbox.com">Mapbox</a>',
                id: 'examples.map-i86knfo3',
            });

            zoomCtrl = new L.Control.Zoom({position: 'bottomright'});

            locateCtrl = new LocateControl({
                position: 'bottomright',
                zoomLevel: undefined,  // null is treated as zoomLevel 0
            });

            tileLayer.addTo(this.map);
            zoomCtrl.addTo(this.map);
            locateCtrl.addTo(this.map);

        },
        initRoute: function() {
            var route = this.route().id,
                direction = this.route().direction;

            if (this.routeLayer) {
                this.map.removeLayer(this.routeLayer);
            }

            this.routeLayer = L.layerGroup();
            this.routeLayer.addTo(this.map);

            this.vehicles = new Vehicles(route, direction);
            this.shape = new Shape(route, direction);
            this.stops = new Stops(route, direction);

            this.shape.fetch().then(this.shape.draw.bind(this.shape, this.routeLayer));
            this.vehicles.fetch().then(this.vehicles.draw.bind(this.vehicles, this.routeLayer));
            this.stops.fetch().then(function() {
                try {
                    this.stops.draw(this.routeLayer);
                    this.stopsList(this.stops._stops);
                } catch (e) {
                    console.error(e);
                }
            }.bind(this));
        },
    };

    return Rappid;
});