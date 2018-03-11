import React from 'react';
import { AppLoading } from 'expo';

import { Provider } from 'react-redux';
import store from './src/redux/store';
import persistStore from './src/redux/persist';
import Main from './src/containers/views/Main';

// Helsinki
const defaultRegion = {
  latitude: 60.2,
  longitude: 24.9,
  latitudeDelta: 0.2,
  longitudeDelta: 0.1,
};

export default class App extends React.Component {
  state = {
    isReady: false,
    region: defaultRegion,
  };

  getLocation = async () => {
    const { status } = await Expo.Permissions.askAsync(
      Expo.Permissions.LOCATION,
    );

    if (status === 'granted') {
      const curPos = await Expo.Location.getCurrentPositionAsync({});
      this.setState(() => ({
        region: {
          ...curPos.coords,

          // Zoom in some more if location known
          latitudeDelta: 0.05,
          longitudeDelta: 0.025,
        }
      }));
    }
  };

  startAsync = async () => {
    // Perform any initialization tasks here while Expo shows its splash screen.
    await persistStore(store);
    this.getLocation();
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
        <Main region={this.state.region} />
      </Provider>
    );
  };
}
