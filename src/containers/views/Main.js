import React from 'react';

import { addLine, removeLine } from '../../state/lines';
import { setAvailableRoutes } from '../../state/availableRoutes';
import { setPolylines, removePolyline } from '../../state/polylines';
import { Container } from '../../components/Layout';
import { connect } from 'react-redux';
import { getRoutes, getPolylines } from '../../utils/routes';
import Map from '../../components/Map';
import Lines from '../../components/Lines';

import '../../utils/mqttShim';
import mqtt from 'mqtt';

const mapStateToProps = state => ({
  lines: state.lines,
  polylines: state.polylines,
  availableRoutes: state.availableRoutes,
});
const mapDispatchToProps = dispatch => ({
  addLine: (lineId) => dispatch(addLine(lineId)),
  removeLine: (lineId) => dispatch(removeLine(lineId)),
  setAvailableRoutes: (routes) => dispatch(setAvailableRoutes(routes)),
  setPolylines: (polylines) => dispatch(setPolylines(polylines)),
  removePolyline: (polyline) => dispatch(removePolyline(polyline)),
});

export class Main extends React.Component {
  state = {
    markers: [],
    availableRoutes: [],
  };

  data = [];

  componentDidMount = async () => {
    getRoutes().then(this.props.setAvailableRoutes);
    this.fetchPolylinesForLines(this.props.lines);

    // TODO: bring mqtt client back up if app is resumed
    //AppState.addEventListener("change",
    // mqttClient._checkPing()
    this.mqtt = mqtt.connect('ws://mqtt.hsl.fi:1883');
    //this.mqtt.subscribe('/hfp/v1/journey/#');

    this.mqtt.on('message', this.handleMessage);

    this.subscribeToLines(this.props.lines);

    this.updateInterval = setInterval(this.doUpdate, 1000);
  };

  doUpdate = () => {
    this.data = this.data
      .filter(vehicle => this.props.lines.includes(vehicle.desi));
    this.setState({ markers: this.data });
  };

  componentWillUnmount = () => {
    clearInterval(this.updateInterval);
    this.mqtt.end();
  };

  handleMessage = (topic, message) => {
    try {
      const vehicle = JSON.parse(message.toString()).VP;
      const availableRoute = this.props.availableRoutes
        .find(availableRoute => availableRoute.shortName === vehicle.desi);

      const routeDestinations = availableRoute.longName
        .split('-')
        .map(dest => dest.trim());

      const destIndex = vehicle.dir === '2' ? 0 : routeDestinations.length - 1;
      const dest = routeDestinations[destIndex];

      vehicle.dest = dest;

      // add vehicle to this.data
      const vehIndex = this.data.findIndex(old => old.veh === vehicle.veh);

      if (vehIndex === -1) {
        this.data.push(vehicle);
      } else {
        this.data.splice(vehIndex, 1, vehicle);
      }
    } catch(e) {
      console.log('error in handleMessage:', e);
    }
  };

  subscribeToLine = (line, unsubscribe) => {
    const availableRoute = this.props.availableRoutes
    .find(availableRoute => availableRoute.shortName === line);

    try {
      if (availableRoute) {
        const gtfsId = availableRoute.gtfsId;
        // gtfsId is in format HSL:1234, mqtt wants only 1234 part
        const [trash, mqttLineId] = gtfsId.match(/.+:(.+)/);
        //this.mqtt.subscribe(`/hfp/v1/journey/`);
        const topic = `/hfp/v1/journey/+/+/+/+/${mqttLineId}/#`

        if (unsubscribe) {
          console.log('unsubscribing from', topic);
          this.mqtt.unsubscribe(topic);
        } else {
          console.log('subscribing to', topic);
          this.mqtt.subscribe(topic);
        }
      }
    } catch(e) {
      console.log('error while subscribing:', e);
    }
  }

  subscribeToLines = (lines) => {
    lines.forEach(line => this.subscribeToLine(line));
  };

  addAndSub = line => {
    this.subscribeToLine(line, false);
    this.fetchPolylinesForLines([...this.props.lines, line]);
    this.props.addLine(line);
  }

  removeAndUnsub = line => {
    this.subscribeToLine(line, true);
    this.props.removeLine(line);
    this.props.removePolyline(line);

    this.data = this.data.filter(l => l.desi !== line);
    this.doUpdate();
  }

  fetchPolylinesForLines = async (lines) => {
    const gtfsIdLines = [];

    lines.forEach(line => {
      const availableRoute = this.props.availableRoutes
        .find(availableRoute => availableRoute.shortName === line);

      if (availableRoute) {
        gtfsIdLines.push(availableRoute.gtfsId);
      }
    });

    const polylines = await getPolylines(gtfsIdLines);

    this.props.setPolylines(polylines);
  }

  render = () => {
    return (
      <Container>
        <Lines
          lines={this.props.lines}
          availableRoutes={this.props.availableRoutes}
          addLine={this.addAndSub}
          removeLine={this.removeAndUnsub}
        />
        <Map
          lines={this.props.lines}
          markers={this.state.markers}
          region={this.props.region}
          polylines={this.props.polylines}
        />
      </Container>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Main);
