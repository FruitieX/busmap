import React from 'react';
import Autocomplete from 'react-native-autocomplete-input';

import {
  TextInput,
  Button,
  View,
  ScrollView,
  TouchableOpacity,
  Text,
} from 'react-native';

import { MarkerButtonComponent } from './Marker';

export default class Lines extends React.Component {
  state = {
    text: '',
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
      <Text>{shortName}: ({longName})</Text>
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

  render = () => (
    <View>
        <Autocomplete
          autoCapitalize="none"
          autoCorrect={false}
          data={this.findLines()}
          defaultValue={this.state.text}
          onChangeText={this.onChangeText}
          onSubmitEditing={this.submitHandler(this.state.text)}
          placeholder="Enter bus line number"
          renderItem={this.renderItem}
        />
        {/* <TextInput
          style={{ height: 40, flex: 1, paddingHorizontal: 10 }}
          onChangeText={this.onChangeText}
          onSubmitEditing={this.submitHandler}
          placeholder="Enter bus line number"
          value={this.state.text}
        />
        <Button
          onPress={this.submitHandler}
          title="Add to map"
        /> */}
      <ScrollView
        keyboardShouldPersistTaps="always"
        style={{ height: 40, flexGrow: 0 }}
        horizontal
      >
        {this.renderSelectedLines()}
      </ScrollView>
    </View>
  );
}
