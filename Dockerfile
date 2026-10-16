# Self-hosted build of busmap, served at busmap.fruitiex.org.
# busmap.netlify.app only redirects here (see deploy/netlify-redirect).
FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN --mount=type=secret,id=digitransit_api_key \
    VITE_DIGITRANSIT_API_KEY="$(cat /run/secrets/digitransit_api_key)" npm run build

FROM nginxinc/nginx-unprivileged:1.31-alpine@sha256:378d0c32f6562f7fd9629170797f57d2b953aa09be983b3daaf4809bb039ca00
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
