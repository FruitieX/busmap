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

import { indexToHue } from '../utils/routes';
import { Marker } from './Marker';
import { Container } from './Layout';
import hsl from 'hsl-to-hex';

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

  // TODO: this is bad, prolly gets redrawn every time
  renderPolylines = () => {
    //console.log('drawing polylines', Object.keys(this.props.polylines));

    const polylines = [];

    Object.entries(this.props.polylines)
      .forEach(([shortName, polyline]) => {
        const index = this.props.lines.indexOf(shortName);
        const color = indexToHue(index, this.props.lines.length);
        const hexColor = `${hsl(color, 100, 35)}aa`;

        polylines.push(
          <MapView.Polyline
            coordinates={polyline}
            key={index}
            strokeColor={hexColor}
            strokeWidth={4}
          />
        )
      })

    // This super absurd hack (partially?) resolves weird dangling polylines
    // when deleting lines on iOS. Major WTF.
    if (Platform.OS === 'ios') {
      polylines.push(<MapView.Polyline
        coordinates={[{latitude: 0, longitude: 0}, {latitude: 1, longitude: 1}]}
        key={polylines.length}
        strokeWidth={0}
      />);
    }

    return polylines;
  }

  render = () => (
    <View style={{ flex: 1 }}>
      <MapView
        provider="google"
        showsUserLocation={true}
        showsMyLocationButton={true}
        style={{ flex: 1 }}
        initialRegion={this.props.region}
        onPress={Keyboard.dismiss}
        onMarkerPress={Keyboard.dismiss}
        ref={ref => this.mapView = ref }
      >
        {this.renderMarkers()}
        {this.renderPolylines()}
      </MapView>
    </View>
  );
}
