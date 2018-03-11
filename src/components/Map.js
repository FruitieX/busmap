import React from 'react';
import { MapView } from 'expo';
import {
  TextInput,
  Button,
  View,
  Image,
  ActivityIndicator,
  Text,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
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
    <View style={{ flex: 1 }}>
      <MapView
        provider="google"
        showsUserLocation={true}
        showsMyLocationButton={true}
        style={{ flex: 1 }}
        initialRegion={this.props.region}
        onPress={Keyboard.dismiss}
        onPanDrag={Keyboard.dismiss}
        onMarkerPress={Keyboard.dismiss}
        ref={ref => this.mapView = ref }
      >
        {this.renderMarkers()}
      </MapView>
    </View>
  );
}
