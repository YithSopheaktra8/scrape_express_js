
FROM node:18.20.3-alpine3.20

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Install necessary dependencies for Puppeteer
RUN apk update && apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && apk add --no-cache --virtual .build-deps \
    gcc \
    g++ \
    make \
    python3

# Tell Puppeteer to use the installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy all source code to the working directory
COPY . .

# Expose port 3000
EXPOSE 3033

# Command to run the application
CMD ["node", "server.js"]
