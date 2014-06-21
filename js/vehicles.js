function Vehicles(map, visibleCriteria, utils) {
    this.map = map;
    this.visibleCriteria = visibleCriteria;
    this.vehicles = [];
    this.markers = {};
    this.busLocationResponse = null;
    this.utils = utils;  // FIXME: requirejs
}

Vehicles.prototype = {
    loadBusLocation: function() {
        var deferred = new $.Deferred();

        $.ajax({
            url: 'http://query.yahooapis.com/v1/public/yql',
            data:{
                q: 'select * from xml where url="http://www.capmetro.org/planner/s_buslocation.asp?route=*"',
                format: 'xml'
            }
        }).done(function(data) {
            var busLocationResponse = x2js.xml2json(data);

            this.busLocationResponse = busLocationResponse;
            this.vehicles = busLocationResponse.query.results.Envelope.Body.BuslocationResponse.Vehicles.Vehicle;

            this.vehicles.forEach(function(vehicle) {
                var Position = vehicle.Positions.Position,
                    posStr = Array.isArray(Position) ? Position[0] : Position;
                vehicle.lat = posStr.split(',')[0];
                vehicle.lng = posStr.split(',')[1];
            });

            deferred.resolve();
        }.bind(this)).fail(function(xhr, status, err) {
            console.error(err);
            deferred.reject();
        });

        return deferred.promise();
    },
    filterVehicles: function() {
        return _.filter(this.vehicles, function(vehicle) {
            var _route = parseInt(vehicle.Route),
                _dir = this.utils.getDirectionID(vehicle.Direction);
            return !!_.find(this.visibleCriteria, function(c) {
                return c.route === _route && c.direction === _dir;
            });
        }.bind(this));
    },
    update: function() {
        var deferred = $.Deferred();

        this.loadBusLocation().then(function() {
            var visibleVehicles = this.filterVehicles();
            console.log('Total vehicles', this.vehicles.length, 'Visible vehicles', visibleVehicles.length, visibleVehicles);
            this.draw(visibleVehicles);
            deferred.resolve();
        }.bind(this));

        return deferred.promise();
    },
    popupContent: function(vehicle) {
        return [
            'Vehicle ' + vehicle.Vehicleid,
            'Updated at ' + vehicle.Updatetime,
            'Moving ' + utils.formatDirection(vehicle.Direction) + ' at ' + vehicle.Speed + 'mph',
            'Reliable? ' + vehicle.Reliable,
            'Stopped? ' + vehicle.Stopped,
            'Off Route? ' + vehicle.Offroute,
            'In Service? ' + vehicle.Inservice,
        ].join('<br />');
    },
    draw: function(vehicles) {
        var vehicleIDs = vehicles.map(function(v) { return v.Vehicleid; }),
            deletedVehicleIDs = _.filter(Object.keys(this.markers), function(vehicleID) {
                return !_.find(vehicleIDs, function(vID) { return vID === vehicleID; });
            });

        console.log('Deleted vehicles', deletedVehicleIDs.length, deletedVehicleIDs);

        deletedVehicleIDs.forEach(function(vID) {
            this.map.removeLayer(this.markers[vID]);
            delete this.markers[vID];
        }.bind(this));

        vehicles.forEach(function(vehicle) {
            var marker = this.markers[vehicle.Vehicleid],
                popupContent = this.popupContent(vehicle),
                fillColor = vehicle.Inservice === 'Y' ? 'rgb(34,189,252)' : 'rgb(188,188,188)';

            if (marker) {
                console.log('Updating existing marker', marker, vehicle);

                var markerLatLng = marker.getLatLng(),
                    start = [markerLatLng.lat, markerLatLng.lng],
                    stop = [vehicle.lat, vehicle.lng],
                    delta = [stop[0] - start[0], stop[1] - start[1]],
                    easeInOutCubic = function(t, b, c, d) {
                        if ((t/=d/2) < 1) return c/2*t*t*t + b;
                        return c/2*((t-=2)*t*t + 2) + b;
                    },
                    animateFn = function(i, steps, startLatLng, deltaLatLng) {
                        var x = easeInOutCubic(i, startLatLng[0], deltaLatLng[0], steps),
                            y = easeInOutCubic(i, startLatLng[1], deltaLatLng[1], steps);
                        marker.setLatLng([x, y]);
                        if (i < steps) {
                            setTimeout(animateFn.bind(null, i+1, steps, startLatLng, deltaLatLng), 10);
                        }
                    };

                animateFn(0, 200, start, delta);

                marker._popup.setContent(popupContent);
                marker.setStyle({fillColor: fillColor});

                return;
            }

            marker = L.circleMarker([vehicle.lat, vehicle.lng], {
                weight: 0,
                radius: 12,
                fillOpacity: '0.9',
                fillColor: fillColor,
            }).bindPopup(popupContent);

            marker.addTo(this.map);
            this.markers[vehicle.Vehicleid] = marker;
        }.bind(this));
    }
};