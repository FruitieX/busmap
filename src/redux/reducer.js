import { persistCombineReducers } from 'redux-persist';
import { persistConfig } from './persist';

// ## Reducer Imports ##
import { reducer as LinesReducer } from '../state/lines';

export default persistCombineReducers(persistConfig, {
  // ## Reducers ##

  lines: LinesReducer
});
