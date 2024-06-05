
FROM node:18.20.3-alpine3.20

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source code to the working directory
COPY . .

# Expose port 3000
EXPOSE 3033

# Command to run the application
CMD ["node", "server.js"]
