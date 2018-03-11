import React from 'react';
import Autocomplete from 'react-native-autocomplete-input';

import {
  TextInput,
  Button,
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
  Platform
} from 'react-native';

import styled from 'styled-components/native';
import { MarkerButtonComponent } from './Marker';

const BusNumber = styled.Text`
  padding-left: 8px;
  font-size: 32px;
  width: 100px;
  text-align: center;
`;
const BusDest = styled.Text`
  flex: 1;
  padding-left: 8px;
  padding-right: 8px;
  font-size: 20px;
`;

// const AutocompleteContainer = styled.View`
//   flex: 1;
//   left: 0;
//   position: absolute;
//   right: 0;
//   top: 0;
//   z-index: 1;
// `;
//
export default class Lines extends React.Component {
  state = {
    text: '',
    active: false,
  };

  onChangeText = text => this.setState({ text: text.trim() });

  submitHandler = (lineId) => () => {
    this.setState({ text: '' });

    const routeIndex = this.props.availableRoutes
      .findIndex(line => line.shortName.toLowerCase() === lineId.toLowerCase());

    if (routeIndex === -1) {
      return;
    }

    this.props.addLine(this.props.availableRoutes[routeIndex].shortName);

    Keyboard.dismiss();
  };

  renderSelectedLines = () =>
    this.props.lines.map((lineId, index) =>
      <MarkerButtonComponent
        lineId={lineId}
        onPress={this.props.removeLine}
        key={lineId}
        index={index}
        numLines={this.props.lines.length}
      />
    );

  renderItem = ({ shortName, longName }) => (
    <TouchableOpacity onPress={this.submitHandler(shortName)}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <BusNumber numberOfLines={1}>{shortName}</BusNumber>
        <BusDest numberOfLines={2}>{longName}</BusDest>
      </View>
    </TouchableOpacity>
  )

  findLines = () => {
    if (!this.state.text.length) {
      return [];
    }

    const text = this.state.text.toLowerCase()

    return this.props.availableRoutes
      .filter(line => !line.shortName.toLowerCase().indexOf(text))
      .sort((a, b) => a.shortName.length - b.shortName.length);
  }

  // react native sucks
  // especially on android
  onShowResults = (active) => {
    if (this.state.active !== active) {
      setTimeout(() => this.setState({ active }));
    }
  };

  activeStyle = { flex: 3 };
  inactiveStyle = { height: 80 };

  render = () => (
    <View style={this.state.active ? this.activeStyle : this.inactiveStyle}>
        <Autocomplete
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={styles.autocompleteContainer}
          listStyle={{ borderWidth: 0, marginHorizontal: 0, marginBottom: 40 }}
          keyboardType="numeric"
          data={this.findLines()}
          defaultValue={this.state.text}
          onChangeText={this.onChangeText}
          onSubmitEditing={this.submitHandler(this.state.text)}
          placeholder="Enter bus line number"
          renderItem={this.renderItem}
          onShowResults={this.onShowResults}
        />
      {/* <Button
        onPress={this.submitHandler(this.state.text)}
        title="Add to map"
      /> */}
      <ScrollView
        keyboardShouldPersistTaps="always"
        style={{ height: 40, flexGrow: 0, zIndex: 0 }}
        horizontal
      >
        {this.renderSelectedLines()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  autocompleteContainer: {
    flex: 1,
    left: 0,
    right: 0,
    top: 0,
    zIndex: 1
  }
});
