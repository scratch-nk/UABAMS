FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the application source code
COPY src ./src

EXPOSE 5000

CMD ["node", "src/app.js]
