import React from 'react';
import { View } from 'react-native';
import { MapView } from 'expo';
import styled from 'styled-components/native';
import { indexToHue } from '../utils/routes';

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

export class Marker extends React.Component {
  render = () => {
    const { data } = this.props;

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
          description={`Last update: ${new Date(data.tst).toTimeString()}`}
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

export class MarkerButtonComponent extends React.Component {
  pressHandler = () => this.props.onPress(this.props.lineId);

  render = () =>
    <MarkerButton hue={indexToHue(this.props.index, this.props.numLines)} onPress={this.pressHandler}>
      <MarkerText>{this.props.lineId}</MarkerText>
    </MarkerButton>;
}
