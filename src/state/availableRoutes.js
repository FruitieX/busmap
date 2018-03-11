const SET_AVAILABLE_ROUTES = 'SET_AVAILABLE_ROUTES';

export const setAvailableRoutes = (routes) => ({
  type: SET_AVAILABLE_ROUTES,
  payload: routes,
});

const initialState = [];

export const reducer = (prevState = initialState, action) => {
  if (action.type === SET_AVAILABLE_ROUTES) {
    return action.payload;
  } else {
    return prevState;
  }
};
