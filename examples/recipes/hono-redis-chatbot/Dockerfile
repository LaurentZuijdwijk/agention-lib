# Minimal image for the Hono + Redis chatbot recipe.
# The app runs TypeScript directly with tsx, so there is no build step.
FROM node:22-alpine

WORKDIR /app

# Install dependencies first so this layer is cached across source changes.
COPY package*.json ./
RUN npm install

# Copy the application source.
COPY . .

EXPOSE 3000

# REDIS_URL and ANTHROPIC_API_KEY are supplied at runtime (compose / -e flags).
CMD ["npm", "start"]
