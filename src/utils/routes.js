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

const yyyymmdd = date => {
  let mm = date.getMonth() + 1; // getMonth() is zero-based
  let dd = date.getDate();

  return [date.getFullYear(),
    (mm>9 ? '' : '0') + mm,
    (dd>9 ? '' : '0') + dd
  ].join('');
}

const polylineQuery = ids =>
`{
  routes(ids: ${ids}) {
    gtfsId
    shortName
    patterns {
      tripsForDate(serviceDate: "${yyyymmdd(new Date())}") {
        id
      }
      geometry {
        lat
        lon
      }
    }
  }
}`;

let polylineTimeout = null;
export const getPolylines = (gtfsIdLines) => {
  clearTimeout(polylineTimeout);
  if (!gtfsIdLines.length) return {};

  const doFetch = async (callback) => {
    try {
      console.log('fetching polylines for gtfsIds:', JSON.stringify(gtfsIdLines));
      const query = polylineQuery(`["${gtfsIdLines.join('","')}"]`);
      const response = await fetch('https://api.digitransit.fi/routing/v1/routers/hsl/index/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/graphql'
        },
        body: query
      })
      .then(response => response.json());

      const polylines = {};

      response.data.routes.forEach(route => {
        const polyline = [];

        // sort by number of trips for today
        route.patterns.sort((a, b) => b.tripsForDate.length - a.tripsForDate.length);
        route.patterns[0].geometry.forEach(coord => {
          polyline.push({
            latitude: coord.lat,
            longitude: coord.lon,
          });
        });

        polylines[route.shortName] = polyline;
      });

      callback(polylines);
    } catch (e) {
      console.log('failed to fetch polyline:', e);
      polylineTimeout = setTimeout(() => doFetch(callback), 5000);
    }
  };

  return new Promise(resolve => doFetch(resolve));
}
