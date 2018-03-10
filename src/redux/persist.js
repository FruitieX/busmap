import storage from 'redux-persist/lib/storage';
import { persistStore } from 'redux-persist';

export const persistConfig = {
  key: 'primary',
  storage,

  // blacklisted reducers, useful when debugging to recover from broken state
  blacklist: [
    // 'navigatorState',
  ],
};

export default store =>
  new Promise(resolve => {
    const persistor = persistStore(store, null, () =>
      resolve(persistor),
    );
  });
