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
  Platform,
  Dimensions
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
const NoLines = styled.Text`
  color: #777;
  padding-top: 12px;
  padding-left: 12px;
  width: 100%;
  text-align: center;
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

  changeHandler = text => this.setState({ text: text.trim() });

  submitHandler = (lineId) => () => {
    if (!lineId || !lineId.length) return;

    this.setState({ text: '' });

    const routeIndex = this.props.availableRoutes
      .findIndex(line => line.shortName.toLowerCase() === lineId.toLowerCase());

    if (routeIndex === -1) {
      return;
    }

    this.props.addLine(this.props.availableRoutes[routeIndex].shortName);

    Keyboard.dismiss();
  };

  renderSelectedLines = () => {
    const lines = this.props.lines.map((lineId, index) =>
      <MarkerButtonComponent
        lineId={lineId}
        onPress={this.props.removeLine}
        key={lineId}
        index={index}
        numLines={this.props.lines.length}
      />
    );

    if (!lines.length) {
      return [<NoLines key="nolines">(No lines selected)</NoLines>];
    }

    return lines;
  }

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

    const lines = this.props.availableRoutes
      .filter(line => !line.shortName.toLowerCase().indexOf(text))
      .sort((a, b) => a.shortName.length - b.shortName.length);

    if (!lines.length) {
      return [{
        longName: 'No search results'
      }];
    }
    return lines;
  }

  clearFilter = () => this.setState({ text: '' });

  // react native sucks
  // especially on android
  onShowResults = (active) => {
    if (this.state.active !== active) {
      setTimeout(() => this.setState({ active }));
    }
  };

  componentDidMount = () => {
    this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      this.clearFilter();
    });
  };

  componentWillUnmount = () => {
    this.keyboardDidHideListener.remove();
  };

  activeStyle = Platform.OS === 'ios' ? { height: 340 } : { flex: 3, flexDirection: 'row', position: 'relative' };
  inactiveStyle = { height: 40, flexDirection: 'row', position: 'relative' };

  render = () => (
    <View style={this.state.active ? this.activeStyle : this.inactiveStyle}>
        <Autocomplete
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={styles.autocompleteContainer}
          inputContainerStyle={styles.inputContainer}
          listStyle={{
            borderWidth: 0,
            marginHorizontal: 0,
            marginBottom: 40,
            backgroundColor: 'white',
            zIndex: 1,
            //position: 'relative',
            height: Platform.OS === 'ios' ? 300 : undefined,
          }}
          data={this.findLines()}
          defaultValue={this.state.text}
          onChangeText={this.changeHandler}
          onSubmitEditing={this.submitHandler(this.state.text)}
          placeholder="Enter route number"
          renderItem={this.renderItem}
          onShowResults={this.onShowResults}
        />
      <ScrollView
        keyboardShouldPersistTaps="always"
        style={styles.lineContainer}
        horizontal
      >
        {this.renderSelectedLines()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  autocompleteContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    width: '100%',
    height: '100%'
  },
  inputContainer: {
    height: 40,
    width: 150,
    borderWidth: 0,
  },
  lineContainer: {
    height: 40,
    marginLeft: 150,
    backgroundColor: 'white',
    flex: 1,
  }
});
