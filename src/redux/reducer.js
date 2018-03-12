import { persistCombineReducers } from 'redux-persist';
import { persistConfig } from './persist';

// ## Reducer Imports ##
import { reducer as LinesReducer } from '../state/lines';
import { reducer as AvailableRoutesReducer } from '../state/availableRoutes';
import { reducer as PolylinesReducer } from '../state/polylines';

export default persistCombineReducers(persistConfig, {
  // ## Reducers ##

  lines: LinesReducer,
  availableRoutes: AvailableRoutesReducer,
  polylines: PolylinesReducer
});
