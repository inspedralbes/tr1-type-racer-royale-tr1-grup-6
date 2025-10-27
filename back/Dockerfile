FROM node:20-alpine

WORKDIR /app

# Install deps (production). If you need dev deps for development, adjust accordingly.
COPY package*.json ./
# Install production dependencies from package.json
RUN npm install --production

COPY . .

EXPOSE 3000

# Default command - update if your entrypoint is different (e.g., server.js or src/index.js)
CMD ["node", "index.js"]
