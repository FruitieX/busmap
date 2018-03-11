import React from 'react';
import { MapView } from 'expo';
import {
  TextInput,
  Button,
  View,
  Image,
  ActivityIndicator,
  Keyboard,
  Text,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { connect } from 'react-redux';

import { Marker } from './Marker';
import { Container } from './Layout';

export default class Map extends React.Component {
  data = [];

  state = {
    filter: '',
    markers: [],
    availableRoutes: [],
    connected: false,
  };

  /*
  wsError = async err => {
    this.setState({ connected: false });
    console.log('wsError()', err);
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.wsConnect();
  };

  wsConnect = () => {
    this.ws = new WebSocket('ws://fruitiex.org:7592');

    this.ws.onopen = () => {
      this.setState({ connected: true });
      console.log('connected');

      this.props.lines.forEach(line => {
        this.ws.send(JSON.stringify({
          method: 'subscribe',
          id: line
        }));
      });
    }
    this.ws.onerror = () => this.wsError();
    this.ws.onclose = () => this.wsError();
    this.ws.onmessage = e => {
      const json = JSON.parse(e.data);
      const vehIndex = this.data.findIndex(v => v.veh === json.veh);

      if (vehIndex === -1) {
        this.data = [...this.data, json];
      } else {
        const newData = [...this.data];
        newData[vehIndex] = json;

        this.data = newData;
      }
    };
  };
  */

  componentDidMount = async () => {
    // weird hack for getting iOS initialRegion right
    // https://github.com/react-community/react-native-maps/issues/1577
    // 💯💯💯
    if (Platform.OS === 'ios') {
      requestAnimationFrame(() => {
        this.mapView.animateToRegion(this.props.region, 1);
      });
    }
  };

  componentWillReceiveProps = (nextProps) => {
    // If region changed, animate to new region
    if (this.props.region !== nextProps.region) {
      this.mapView.animateToRegion(nextProps.region, 500);
    }
  };

  renderMarkers = () =>
    this.props.markers
      //.filter(marker => this.props.lines.includes(marker.desi))
      .map((marker, index) =>
        <Marker
          data={marker}
          key={marker.veh}
          index={this.props.lines.indexOf(marker.desi)}
          numLines={this.props.lines.length}
        />
      );


  render = () => (
    <Container>
      <MapView
        provider="google"
        showsUserLocation={true}
        showsMyLocationButton={true}
        style={{ flex: 1 }}
        initialRegion={this.props.region}
        ref={ref => this.mapView = ref }
      >
        {this.renderMarkers()}
      </MapView>
    </Container>
  );
}
