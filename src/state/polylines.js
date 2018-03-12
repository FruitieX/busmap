const SET_POLYLINES = 'SET_POLYLINES';
const REMOVE_POLYLINE = 'REMOVE_POLYLINE';

export const setPolylines = (polylines) => ({
  type: SET_POLYLINES,
  payload: polylines,
});

export const removePolyline = (polyline) => ({
  type: REMOVE_POLYLINE,
  payload: polyline,
});

const initialState = {};

export const reducer = (prevState = initialState, action) => {
  if (action.type === SET_POLYLINES) {
    return action.payload || {};
  } else if (action.type === REMOVE_POLYLINE) {
    const newState = { ...prevState };
    delete newState[action.payload];
    return newState;
  } else {
    return prevState;
  }
};
