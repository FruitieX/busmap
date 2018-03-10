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
import { NavigationActions } from 'react-navigation';
import { addLine, removeLine } from '../../state/lines';

import { Title, Description, Bold } from '../../components/Text';
import { ViewContainer, Centered } from '../../components/Layout';
import styled from 'styled-components/native';

const initialRegion = {
  latitude: 60.2,
  longitude: 24.9,
  latitudeDelta: 0.2,
  longitudeDelta: 0.1,
};

const mapStateToProps = state => ({
  lines: state.lines
});
const mapDispatchToProps = dispatch => ({
  addLine: (lineId) =>
    dispatch(addLine(lineId)),
  removeLine: (lineId) =>
    dispatch(removeLine(lineId)),
});

const MarkerText = styled.Text`
  color: black;
  font-size: 18;
`;

const MarkerSubText = styled.Text`
  color: black;
  font-size: 12;
`;

const MarkerStyle = styled.View`
  background-color: hsla(${props => props.hue || 0}, 70%, 50%, 0.5);
  border-radius: 4;
  width: 60;
  align-items: center;
`;

const MarkerButton = styled.TouchableOpacity`
  background-color: hsla(${props => props.hue || 0}, 75%, 50%, 0.5);
  border-radius: 4;
  width: 60;
  align-items: center;
  margin: 4px;
`;

const indexToHue = (index, numLines) => {
  numLines = Math.max(6, numLines);
  return 360 * index / numLines
};

class Marker extends React.Component {
  render = () => {
    const { data } = this.props;
    const color = data.dir === '1' ? '#aa4400' : '#0044aa';

    if (!data.lat || !data.long) {
      return null;
    }

    return (
      <View>
        <MapView.Marker
          coordinate={{
            latitude: data.lat,
            longitude: data.long,
          }}
          //rotation={data.hdg}
          anchor={{ x: 0.5, y: 0.5 }}
          title={`Dest: ${data.dest}, ID: ${data.veh}`}
          description={`Last update: ${new Date(data.t).toTimeString()}`}
        >
          <MarkerStyle hue={indexToHue(this.props.index, this.props.numLines)}>
            <MarkerText numberOfLines={1}>{data.desi}</MarkerText>
            <MarkerSubText numberOfLines={1}>{data.dest}</MarkerSubText>
          </MarkerStyle>
          {/* <Image
            source={ArrowImage}
            style={{ height: 50, width: 50, transform: [{ rotate: data.hdg ? `${data.hdg}deg` : '0deg' }] }}
          /> */}
        </MapView.Marker>
        {/* <MapView.Polyline
          strokeWidth={2}
          lineCap="butt"
          strokeColor={color}
          coordinates={[
            { latitude: data.lat, longitude: data.long },
            {
              latitude: data.prevlat,
              longitude: data.prevlong,
            },
          ]}
        /> */}
      </View>
    );
  };
}

class MarkerButtonComponent extends React.Component {
  pressHandler = () => this.props.onPress(this.props.lineId);

  render = () =>
    <MarkerButton hue={indexToHue(this.props.index, this.props.numLines)} onPress={this.pressHandler}>
      <MarkerText>{this.props.lineId}</MarkerText>
    </MarkerButton>;
}

class Map extends React.Component {
  data = [];

  state = {
    filter: '',
    markers: [],
    connected: false,
  };

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

  componentDidMount = async () => {
    this.wsConnect();

    this.updateInterval = setInterval(() => {
      this.setState({ markers: this.data });
    }, 1000);

    const { status } = await Expo.Permissions.askAsync(
      Expo.Permissions.LOCATION,
    );

    let initialRegion_ = initialRegion;
    if (status === 'granted') {
      const curPos = await Expo.Location.getCurrentPositionAsync({});
      initialRegion_ = {
        ...initialRegion,
        ...curPos.coords,
      };
    }

    // weird hack for getting iOS initialRegion right
    // https://github.com/react-community/react-native-maps/issues/1577
    // 💯💯💯
    if (Platform.OS === 'ios') {
      requestAnimationFrame(() => {
        this.mapView.animateToRegion(initialRegion_, 1)
      });
    }
  };

  componentWillUnmount = () => {
    clearInterval(this.updateInterval);
  }

  onChangeText = filter => this.setState({ filter });

  removeLine = lineId => {
    let newData = [...this.data];
    newData = newData.filter(v => v.desi !== lineId);

    this.data = newData;

    this.props.removeLine(lineId);
    if (this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({
        method: 'unsubscribe',
        id: lineId
      }));
    }
  };

  submitHandler = async () => {
    //Keyboard.dismiss();
    const line = this.state.filter.trim();
    this.setState({ filter: '' });

    this.props.addLine(line);

    if (this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({
        method: 'subscribe',
        id: line,
      }));
    }

    // this.setState({ fetching: true });
    //
    // const response = await fetch('http://api.digitransit.fi/realtime/vehicle-positions/v1/hfp/journey/');
    // const json = await response.json();
    //
    // const filteredBuses = [];
    //
    // Object.entries(json).forEach(([key, value]) => {
    //   if (value.VP && value.VP.desi === this.state.filter) {
    //     console.log(value.VP.hdg);
    //     filteredBuses.push({
    //       ...value.VP,
    //       key,
    //     });
    //   }
    // });
    //
    // this.setState({ data: filteredBuses, fetching: false });
  };

  renderMarkers = () =>
    this.state.markers
      .filter(marker => this.props.lines.includes(marker.desi))
      .map(marker =>
        <Marker
          data={marker}
          key={marker.veh}
          index={this.props.lines.indexOf(marker.desi)}
          numLines={this.props.lines.length}
        />
      );

  renderSelectedLines = () =>
    this.props.lines.map((lineId, index) =>
      <MarkerButtonComponent
        lineId={lineId}
        onPress={this.removeLine}
        key={lineId}
        index={index}
        numLines={this.props.lines.length}
      />
    );

  render = () => (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', marginTop: Platform.OS === 'ios' ? 20 : 0 }}>
        <TextInput
          style={{ height: 40, flex: 1, paddingHorizontal: 10 }}
          onChangeText={this.onChangeText}
          onSubmitEditing={this.submitHandler}
          blurOnSubmit={false}
          placeholder="Enter bus line number"
          value={this.state.filter}
        />
        <Button
          onPress={this.submitHandler}
          disabled={this.state.fetching}
          title="Add to map"
        />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="always"
        style={{ height: 40, flexGrow: 0 }}
        horizontal
      >
        {this.renderSelectedLines()}
      </ScrollView>

      <MapView
        provider="google"
        showsUserLocation={true}
        showsMyLocationButton={true}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        ref={ref => this.mapView = ref }
      >
        {this.renderMarkers()}
      </MapView>
    </View>
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(Map);
