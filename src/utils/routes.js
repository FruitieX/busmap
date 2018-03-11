export const indexToHue = (index, numLines) => {
  numLines = Math.max(6, numLines);
  return 360 * index / numLines
};

const allRoutesQuery =
`{
  routes(name: "") {
    gtfsId
    shortName
    longName
  }
}`;

export const getRoutes = () => {
  const doFetch = async (callback) => {
    try {
      const response = await fetch('https://api.digitransit.fi/routing/v1/routers/hsl/index/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/graphql'
        },
        body: allRoutesQuery
      })
      .then(response => response.json());

      callback(response.data.routes);
    } catch (e) {
      console.log('failed to fetch routes:', e);
      setTimeout(() => doFetch(callback), 1000);
    }
  };

  return new Promise(resolve => doFetch(resolve));
}
