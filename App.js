import React from 'react';
import { BackHandler } from 'react-native';
import { AppLoading } from 'expo';

import { Provider } from 'react-redux';
import store from './src/redux/store';
import persistStore from './src/redux/persist';

import Map from './src/containers/views/Map';

export default class App extends React.Component {
  state = {
    isReady: false,
  };

  startAsync = async () => {
    // Perform any initialization tasks here while Expo shows its splash screen.
    await persistStore(store);
  };

  onFinish = () => this.setState(() => ({ isReady: true }));

  render = () => {
    if (!this.state.isReady) {
      return (
        <AppLoading
          startAsync={this.startAsync}
          onFinish={this.onFinish}
          onError={console.warn}
        />
      );
    }

    // Render the app only after we're done initializing
    return (
      <Provider store={store}>
        <Map />
      </Provider>
    );
  };
}
