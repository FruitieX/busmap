import { persistCombineReducers } from 'redux-persist';
import { persistConfig } from './persist';

// ## Reducer Imports ##
import { reducer as LinesReducer } from '../state/lines';
import { reducer as AvailableRoutesReducer } from '../state/availableRoutes';

export default persistCombineReducers(persistConfig, {
  // ## Reducers ##

  lines: LinesReducer,
  availableRoutes: AvailableRoutesReducer
});
