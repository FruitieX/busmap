# Self-hosted build of busmap (the private busmap.fruitiex.org deployment).
# The public site is still built and served by Netlify.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN --mount=type=secret,id=digitransit_api_key \
    VITE_DIGITRANSIT_API_KEY="$(cat /run/secrets/digitransit_api_key)" npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
