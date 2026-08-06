# AC#7 (FEAT-008): Docker execution mode. Base image ships Chromium/Firefox/WebKit
# already installed — do not run `npx playwright install` in this file or at
# container entrypoint; that would defeat "no additional setup" (AC#7) by
# re-downloading browsers already baked into the image.
FROM mcr.microsoft.com/playwright:v1.62.0-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV CI=true
ENV BASE_URL=http://localhost:5173

CMD ["npm", "run", "test:e2e:report"]
