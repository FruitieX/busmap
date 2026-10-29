# Self-hosted build of busmap, served at busmap.fruitiex.org.
# busmap.netlify.app only redirects here (see deploy/netlify-redirect).
FROM node:26.13.0-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN --mount=type=secret,id=digitransit_api_key \
    VITE_DIGITRANSIT_API_KEY="$(cat /run/secrets/digitransit_api_key)" npm run build

FROM nginxinc/nginx-unprivileged:1.31-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
